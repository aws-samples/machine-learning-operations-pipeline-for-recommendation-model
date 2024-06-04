/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { CfnResource, RemovalPolicy } from "aws-cdk-lib";
import {
  IVpc,
  ISecurityGroup,
  SecurityGroup,
  Port,
  InterfaceVpcEndpoint,
  InterfaceVpcEndpointAwsService,
  GatewayVpcEndpoint,
  GatewayVpcEndpointAwsService,
  CfnSecurityGroup,
} from "aws-cdk-lib/aws-ec2";
import { FileSystem } from "aws-cdk-lib/aws-efs";
import { Role, IRole, ServicePrincipal, PolicyStatement, ManagedPolicy } from "aws-cdk-lib/aws-iam";
import { CfnDomain, CfnUserProfile, CfnApp, CfnSpace } from "aws-cdk-lib/aws-sagemaker";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { namespaced } from "../../util/common";
export interface SageMakerStudioProps {
  namespace: string;
  vpc: IVpc;
  sagemakerSecurityGroup?: ISecurityGroup;
  sagemakerExecutionRole?: IRole;
  domainName: string;
  defaultUserProfileName?: string;
  defaultSpaceName?: string;
}

export class SageMakerStudio extends Construct {
  readonly namespace: string;
  readonly executionRole: IRole;

  constructor(scope: Construct, id: string, props: SageMakerStudioProps) {
    super(scope, id);

    const { vpc, sagemakerSecurityGroup, sagemakerExecutionRole, domainName, defaultUserProfileName, defaultSpaceName } = props;
    this.namespace = props.namespace;

    //-------------------------------------------------------
    // Network and Security
    //-------------------------------------------------------
    const executionRole = sagemakerExecutionRole ? sagemakerExecutionRole : this.newExecutionRole();
    const securityGroup = sagemakerSecurityGroup ? sagemakerSecurityGroup : this.newSecurityGroup(vpc);
    this.executionRole = executionRole;

    //-------------------------------------------------------
    // Sagemaker Studio
    //-------------------------------------------------------
    // Sagemaker Domain
    const domain = this.newSagemakerDomain(domainName, vpc, securityGroup, executionRole);
    this.setRemovalPolicyToEFS(domain, securityGroup);

    // User setup
    const userProfile = this.newUserProfile(domain, executionRole, defaultUserProfileName);
    userProfile.addDependency(domain);

    // Jupyter notebook - Sagemaker Studio Classic
    //const app = this.createJupyterServerApp(domain, userProfile);
    //app.addDependency(userProfile);

    // Sagemaker Studio - Private Space and JupyterLab
    const privateSpace = this.createPrivateSpace(domain, userProfile, defaultSpaceName);
    privateSpace.addDependency(userProfile);
    //------------------------------------------------------------------
    // NagSuppressions
    //------------------------------------------------------------------
    NagSuppressions.addResourceSuppressions(
      executionRole,
      [
        {
          id: "AwsPrototyping-IAMNoManagedPolicies",
          reason:
            "This SageMaker execution role is used for SageMaker Studio, so it needs to have AmazonSageMakerFullAccess and AmazonSageMakerCanvasFullAccess managed policies attached",
        },
        {
          id: "AwsPrototyping-IAMNoWildcardPermissions",
          reason:
            "This SageMaker execution role is used for SageMaker Studio, so it needs Wildcard permissions to access any resources to be created by SageMaker Studio",
        },
      ],
      true,
    );
  }

  private newExecutionRole() {
    const role = new Role(this, "SageMakerExecutionRole", {
      assumedBy: new ServicePrincipal("sagemaker.amazonaws.com"),
      managedPolicies: [
        // For SageMaker Studio
        ManagedPolicy.fromAwsManagedPolicyName("AmazonSageMakerFullAccess"),
        ManagedPolicy.fromAwsManagedPolicyName("AmazonSageMakerCanvasFullAccess"),
        ManagedPolicy.fromAwsManagedPolicyName("AmazonSageMakerCanvasAIServicesAccess"),
        // For Codecommit
        ManagedPolicy.fromAwsManagedPolicyName("AWSCodeCommitPowerUser"),
        // For S3
        ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"),
      ],
    });
    // For CodeWhisperer
    role.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["codewhisperer:GenerateRecommendations"],
        resources: ["*"],
      }),
    );
    // For ParameterStore
    role.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["ssm:GetParameter", "ssm:GetParameters", "ssm:DescribeParameters", "ssm:PutParameter", "ssm:DeleteParameter", "ssm:DeleteParameters"],
        resources: ["*"],
      }),
    );
    // For Lambda Function
    role.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["lambda:CreateFunction", "lambda:DeleteFunction", "lambda:InvokeFunction", "lambda:UpdateFunctionCode"],
        resources: ["arn:aws:lambda:*:*:function:*"],
      }),
    );
    role.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["iam:PassRole"],
        resources: ["arn:aws:iam::*:role/*"],
        conditions: {
          StringEquals: {
            "iam:PassedToService": ["lambda.amazonaws.com"],
          },
        },
      }),
    );
    // CreateModel시 PassRole 추가 필요
    // https://docs.aws.amazon.com/ko_kr/sagemaker/latest/dg/api-permissions-reference.html
    role.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["iam:PassRole"],
        resources: ["*"],
        conditions: {
          StringEquals: {
            "iam:PassedToService": ["sagemaker.amazonaws.com"],
          },
        },
      }),
    );
    // For EventBridge Rule
    role.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["events:DescribeRule", "events:PutRule", "events:ListRules"],
        resources: ["*"],
      }),
    );
    // Removal policy
    role.applyRemovalPolicy(RemovalPolicy.DESTROY);
    return role;
  }

  private newSecurityGroup(vpc: IVpc): ISecurityGroup {
    const securityGroup = new SecurityGroup(this, "SecurityGroup", { vpc });
    securityGroup.connections.allowInternally(Port.tcp(443), "internal SDK");
    securityGroup.connections.allowInternally(Port.tcp(2049), "internal NFS");
    securityGroup.connections.allowInternally(Port.tcpRange(8192, 65535), "internal KernelGateway");
    securityGroup.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // security group escape hatches
    // https://github.com/aws/aws-cdk/issues/19056
    const cfnSg = securityGroup.node.defaultChild as CfnSecurityGroup;
    cfnSg.addPropertyOverride("SecurityGroupEgress", [
      {
        CidrIpv6: "::/0",
        Description: "from ::/0:ALL TRAFFIC",
        IpProtocol: "-1",
      },
      {
        CidrIp: "0.0.0.0/0",
        Description: "Allow all outbound traffic by default",
        IpProtocol: "-1",
      },
    ]);

    // VPC Endpoints
    this.createVpcEndpoints(vpc, securityGroup);

    NagSuppressions.addResourceSuppressions(securityGroup, [
      {
        id: "CdkNagValidationFailure",
        reason: "the security group allows only 443, 2049, 8192~65525 ports for internally use",
      },
    ]);
    return securityGroup;
  }

  // https://docs.aws.amazon.com/sagemaker/latest/dg/studio-notebooks-and-internet-access.html
  private createVpcEndpoints(vpc: IVpc, securityGroup: ISecurityGroup): void {
    const studioVpcEp = new InterfaceVpcEndpoint(this, "StudioVpcEndpoint", {
      vpc,
      service: InterfaceVpcEndpointAwsService.SAGEMAKER_STUDIO,
      securityGroups: [securityGroup],
      privateDnsEnabled: true,
    });
    studioVpcEp.applyRemovalPolicy(RemovalPolicy.DESTROY);

    const sagemakerApiEp = new InterfaceVpcEndpoint(this, "SagemakerAPIVpcEndpoint", {
      vpc,
      service: InterfaceVpcEndpointAwsService.SAGEMAKER_API,
      securityGroups: [securityGroup],
      privateDnsEnabled: true,
    });
    sagemakerApiEp.applyRemovalPolicy(RemovalPolicy.DESTROY);

    const sagememakerRtEp = new InterfaceVpcEndpoint(this, "SagemakerRuntimeVpcEndpoint", {
      vpc,
      service: InterfaceVpcEndpointAwsService.SAGEMAKER_RUNTIME,
      securityGroups: [securityGroup],
      privateDnsEnabled: true,
    });
    sagememakerRtEp.applyRemovalPolicy(RemovalPolicy.DESTROY);

    const s3Ep = new GatewayVpcEndpoint(this, "S3VpcEndpoint", {
      vpc,
      service: GatewayVpcEndpointAwsService.S3,
      subnets: [
        {
          subnets: vpc.privateSubnets,
        },
      ],
    });
    s3Ep.applyRemovalPolicy(RemovalPolicy.DESTROY);

    const catalogVpcEp = new InterfaceVpcEndpoint(this, "ServiceCatalogVpcEndpoint", {
      vpc,
      service: InterfaceVpcEndpointAwsService.SERVICE_CATALOG,
      securityGroups: [securityGroup],
      privateDnsEnabled: true,
    });
    catalogVpcEp.applyRemovalPolicy(RemovalPolicy.DESTROY);

    const stsEp = new InterfaceVpcEndpoint(this, "StsVpcEndpoint", {
      vpc,
      service: InterfaceVpcEndpointAwsService.STS,
      securityGroups: [securityGroup],
      privateDnsEnabled: true,
    });
    stsEp.applyRemovalPolicy(RemovalPolicy.DESTROY);

    const logEp = new InterfaceVpcEndpoint(this, "CloudwatchVpcEndpoint", {
      vpc,
      service: InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      securityGroups: [securityGroup],
      privateDnsEnabled: true,
    });
    logEp.applyRemovalPolicy(RemovalPolicy.DESTROY);
  }

  private newSagemakerDomain(domainName: string, vpc: IVpc, securityGroup: ISecurityGroup, executionRole: IRole) {
    const domain = new CfnDomain(this, "SageMakerDomain", {
      authMode: "IAM",
      defaultUserSettings: {
        executionRole: executionRole.roleArn,
        jupyterServerAppSettings: {
          defaultResourceSpec: {
            instanceType: "system",
          },
        },
        securityGroups: [securityGroup.securityGroupId],
      },
      defaultSpaceSettings: {
        executionRole: executionRole.roleArn,
        jupyterServerAppSettings: {
          defaultResourceSpec: {
            instanceType: "system",
          },
        },
        securityGroups: [securityGroup.securityGroupId],
      },
      domainName: domainName,
      subnetIds: vpc.privateSubnets.map((subnet) => subnet.subnetId),
      vpcId: vpc.vpcId,
      appNetworkAccessType: "VpcOnly",
    });
    domain.applyRemovalPolicy(RemovalPolicy.DESTROY);
    return domain;
  }

  private setRemovalPolicyToEFS(domain: CfnDomain, securityGroup: ISecurityGroup) {
    // Cast the resource to a CfnResource object, then we can apply RemovalPolicy
    const importedEfsFilesystem = FileSystem.fromFileSystemAttributes(this, "ImportedEFS", {
      fileSystemId: domain.attrHomeEfsFileSystemId,
      securityGroup: securityGroup,
    });
    const resource = importedEfsFilesystem.node?.defaultChild as CfnResource;
    resource?.applyRemovalPolicy(RemovalPolicy.DESTROY);
  }

  private newUserProfile(domain: CfnDomain, executionRole: IRole, userProfileName?: string) {
    const defaultUserProfileName = userProfileName ? userProfileName : namespaced("default-profile", this.namespace);
    const userProfile = new CfnUserProfile(this, "SageMakerUserProfile", {
      domainId: domain.attrDomainId,
      userProfileName: defaultUserProfileName,
      userSettings: {
        executionRole: executionRole.roleArn,
      },
    });
    userProfile.applyRemovalPolicy(RemovalPolicy.DESTROY);
    return userProfile;
  }

  private createPrivateSpace(domain: CfnDomain, userProfile: CfnUserProfile, spaceName?: string) {
    const defaultSpaceName = spaceName ? spaceName : namespaced("default-space", this.namespace);
    const space = new CfnSpace(this, "SagemakerStudioSpace", {
      domainId: domain.attrDomainId,
      spaceName: defaultSpaceName,
    });
    space.addOverride("Properties.SpaceSettings.AppType", "JupyterLab");
    space.addOverride("Properties.SpaceSettings.SpaceStorageSettings.EbsStorageSettings.EbsVolumeSizeInGb", 10);
    space.addOverride("Properties.OwnershipSettings.OwnerUserProfileName", userProfile.userProfileName);
    space.addOverride("Properties.SpaceSharingSettings.SharingType", "Private");
    space.applyRemovalPolicy(RemovalPolicy.DESTROY);
    return space;
  }

  private createJupyterServerApp(domain: CfnDomain, userProfile: CfnUserProfile) {
    const app = new CfnApp(this, "DefaultJupyterServerApp", {
      appName: namespaced("default", this.namespace),
      appType: "JupyterServer",
      domainId: domain.attrDomainId,
      userProfileName: userProfile.userProfileName,
      resourceSpec: {
        instanceType: "system",
      },
    });
    app.applyRemovalPolicy(RemovalPolicy.DESTROY);
    return app;
  }
}

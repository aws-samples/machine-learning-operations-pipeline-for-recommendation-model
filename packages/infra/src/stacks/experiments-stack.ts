/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { Stack, StackProps, Environment, RemovalPolicy } from "aws-cdk-lib";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { SageMakerStudio } from "./constructs/sagemaker-studio";
import { VpcService } from "./constructs/vpc";
import { namespaced, namespacedKey, putParameter } from "../util/common";

export interface ExperimentsStackProps extends StackProps {
  readonly env: Environment;
  readonly namespace: string;
  readonly parameterStoreKeys: Record<string, string>;
}

export class ExperimentsStack extends Stack {
  public readonly vpc: IVpc;

  constructor(scope: Construct, id: string, props: ExperimentsStackProps) {
    super(scope, id, props);

    const { env, namespace, parameterStoreKeys } = props;

    //-------------------------------------------------------
    // VPC
    //-------------------------------------------------------
    const commonVpc = new VpcService(this, "CommonInfra", {
      namespace: namespace,
      vpcName: "mlops-vpc",
      removalPolicy: RemovalPolicy.DESTROY, // TO-DO : review in production
    });
    this.vpc = commonVpc.vpc;

    //-------------------------------------------------------
    // SageMaker Studio
    //-------------------------------------------------------
    const sagemaker = new SageMakerStudio(this, "SageMakerStudio", {
      namespace: namespace,
      vpc: this.vpc,
      domainName: namespaced("mlops", namespace),
      defaultUserProfileName: namespaced("mlops-user", namespace),
      defaultSpaceName: namespaced("mlops-space", namespace),
    });
    const keySagemakerExecRoleDefault = namespacedKey(parameterStoreKeys.sagemakerExecRoleDefault!, namespace);
    putParameter(this, keySagemakerExecRoleDefault, sagemaker.executionRole.roleArn);
  }
}

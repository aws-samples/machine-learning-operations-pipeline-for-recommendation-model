/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import * as path from "path";
import { Duration, aws_lambda as lambda, aws_iam as iam, aws_events as events, aws_events_targets as targets, Environment } from "aws-cdk-lib";
import { Construct } from "constructs";
import { PolicyStatements } from "../../util/policy-util";

export interface CreateSageMakerEndpointLambdaProps {
  readonly namespace: string;
  readonly modelPackageGroupNames: string[];
  readonly sagemakerExecutionRole: string;
}

export class CreateSageMakerEndpointLambda extends Construct {
  constructor(scope: Construct, id: string, props: CreateSageMakerEndpointLambdaProps) {
    super(scope, id);

    const { namespace, modelPackageGroupNames, sagemakerExecutionRole } = props;
    const functionName = `${namespace}-create-sagemaker-endpoint`;

    // Create SageMaker Endpoint function
    const lambdaSrcRoot = path.join(__dirname, "../../../../lambda/functions");
    const createEndpointFunc = new lambda.Function(this, "CreateSageMakerEndpointFunction", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "handler.handle",
      code: lambda.Code.fromAsset(path.join(lambdaSrcRoot, "/mlops-pipeline-create-endpoint/src")),
      functionName: functionName,
      timeout: Duration.minutes(5),
      environment: {
        SAGEMAKER_EXEC_ROLE: sagemakerExecutionRole,
      },
      role: new iam.Role(this, "CreateSageMakerEndpointFunctionRole", {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      }),
    });

    createEndpointFunc.role?.attachInlinePolicy(
      new iam.Policy(this, "CreateSageMakerEndpointFunctionPolicy", {
        statements: [
          PolicyStatements.log.createLogGroup(),
          PolicyStatements.log.createLog(),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: ["arn:aws:sagemaker:*:*:endpoint-config/*", "arn:aws:sagemaker:*:*:endpoint/*", "arn:aws:sagemaker:*:*:model/*"],
            actions: [
              "sagemaker:UpdateEndpoint",
              "sagemaker:CreateModel",
              "sagemaker:CreateEndpointConfig",
              "sagemaker:CreateEndpoint",
              "sagemaker:DescribeEndpointConfig",
              "sagemaker:AddTags",
            ],
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: ["*"],
            actions: ["sagemaker:ListEndpointConfigs"],
          }),
          new iam.PolicyStatement({
            actions: ["iam:PassRole"],
            resources: ["arn:aws:iam::*:role/*"],
            conditions: {
              StringEquals: {
                "iam:PassedToService": ["sagemaker.amazonaws.com"],
              },
            },
          }),
        ],
      }),
    );

    // EventBridge Rule
    // https://docs.aws.amazon.com/sagemaker/latest/dg/automating-sagemaker-with-eventbridge.html#eventbridge-model-package
    for (const packageGroupName of modelPackageGroupNames) {
      new events.Rule(this, `ModelApproveEventRule-${packageGroupName}`, {
        ruleName: `sagemaker-model-approve-${packageGroupName}`,
        eventPattern: {
          source: ["aws.sagemaker"],
          detailType: ["SageMaker Model Package State Change"],
          detail: {
            ModelPackageGroupName: [packageGroupName],
            ModelApprovalStatus: ["Approved"],
          },
        },
        targets: [new targets.LambdaFunction(createEndpointFunc)],
      });
    }
  }
}

/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import * as path from "path";
import { Duration, aws_lambda as lambda, aws_iam as iam, aws_events as events, aws_events_targets as targets, Environment } from "aws-cdk-lib";
import { Construct } from "constructs";
import { PolicyStatements } from "../../util/policy-util";

export interface ApiInferenceModelLambdaProps {
  readonly namespace: string;
  readonly sagemakerEndpointName: string;
}

export class ApiInferenceModelLambda extends Construct {
  readonly func: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiInferenceModelLambdaProps) {
    super(scope, id);

    const { namespace, sagemakerEndpointName } = props;
    const functionName = `${namespace}-api-inf-${sagemakerEndpointName}`;

    // Create SageMaker Endpoint function
    const lambdaSrcRoot = path.join(__dirname, "../../../../lambda/functions");
    const inferenceFunc = new lambda.Function(this, `${id}Func`, {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "handler.handle",
      code: lambda.Code.fromAsset(path.join(lambdaSrcRoot, "/api-inference-model-lambda/src")),
      functionName: functionName,
      timeout: Duration.seconds(10),
      environment: {
        SAGEMAKER_ENDPOINT_NAME: sagemakerEndpointName,
      },
      role: new iam.Role(this, `${id}FuncRole`, {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      }),
    });

    inferenceFunc.role?.attachInlinePolicy(
      new iam.Policy(this, `${id}FuncPolicy`, {
        statements: [
          PolicyStatements.log.createLogGroup(),
          PolicyStatements.log.createLog(),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: [`arn:aws:sagemaker:*:*:endpoint/${sagemakerEndpointName}`],
            actions: ["sagemaker:InvokeEndpoint"],
          }),
        ],
      }),
    );

    this.func = inferenceFunc;
  }
}

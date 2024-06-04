/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import * as path from "path";
import { Duration, aws_lambda as lambda, aws_iam as iam } from "aws-cdk-lib";
import { Construct } from "constructs";
import { PolicyStatements } from "../../util/policy-util";

export interface ModelRegistrationStepLambdaProps {
  readonly namespace: string;

  readonly pipelinePrefix: string;
  readonly s3MlopsBucketArn: string;
}

export class ModelRegistrationStepLambda extends Construct {
  public readonly func: lambda.IFunction;
  constructor(scope: Construct, id: string, props: ModelRegistrationStepLambdaProps) {
    super(scope, id);

    const { namespace, pipelinePrefix, s3MlopsBucketArn } = props;
    const functionName = `${namespace}-${pipelinePrefix}-model-repackage`;

    // Model repackage function
    const lambdaSrcRoot = path.join(__dirname, "../../../../lambda/functions");
    const modelRepackageFunc = new lambda.Function(this, "ModelRepackageStepLambda", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "handler.handle",
      code: lambda.Code.fromAsset(path.join(lambdaSrcRoot, "/mlops-pipeline-model-repackage/src")),
      functionName: functionName,
      timeout: Duration.minutes(5),
      environment: {
        // if any environments, describe here
      },
      role: new iam.Role(this, "ModelRepackageFunctionRole", {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      }),
    });
    modelRepackageFunc.role?.attachInlinePolicy(
      new iam.Policy(this, "ModelFunctionPolicy", {
        statements: [PolicyStatements.log.createLogGroup(), PolicyStatements.log.createLog(), PolicyStatements.s3.readWriteBucket(s3MlopsBucketArn)],
      }),
    );

    this.func = modelRepackageFunc;
  }
}

/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import * as path from "path";
import { Duration, aws_lambda as lambda, aws_iam as iam, aws_dynamodb as ddb } from "aws-cdk-lib";
import { Construct } from "constructs";
import { PolicyStatements } from "../../util/policy-util";

export interface ApiABTestSageMakerEndpointLambdaProps {
  readonly namespace: string;
  readonly abTestName: string;
  readonly sagemakerEndpointNameA: string;
  readonly sagemakerEndpointNameB: string;
  readonly abTestStoreTable: ddb.ITable;
}

export class ApiABTestSageMakerEndpointLambda extends Construct {
  readonly func: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiABTestSageMakerEndpointLambdaProps) {
    super(scope, id);

    const { namespace, abTestName, sagemakerEndpointNameA, sagemakerEndpointNameB, abTestStoreTable } = props;
    const functionName = `${namespace}-${abTestName}-api-abtest`;

    // Create SageMaker Endpoint function
    const lambdaSrcRoot = path.join(__dirname, "../../../../lambda/functions");
    const inferenceFunc = new lambda.Function(this, `${id}Func`, {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "handler.handle",
      code: lambda.Code.fromAsset(path.join(lambdaSrcRoot, "/api-ab-test-inference-lambda/src")),
      functionName: functionName,
      timeout: Duration.seconds(10),
      environment: {
        SAGEMAKER_ENDPOINT_NAME_A: sagemakerEndpointNameA,
        SAGEMAKER_ENDPOINT_NAME_B: sagemakerEndpointNameB,
        DDB_AB_TEST_STORE_TABLENAME: abTestStoreTable.tableName,
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
          PolicyStatements.ddb.updateDDBTable(abTestStoreTable.tableArn),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: [`arn:aws:sagemaker:*:*:endpoint/${sagemakerEndpointNameA}`, `arn:aws:sagemaker:*:*:endpoint/${sagemakerEndpointNameB}`],
            actions: ["sagemaker:InvokeEndpoint"],
          }),
        ],
      }),
    );

    this.func = inferenceFunc;
  }
}

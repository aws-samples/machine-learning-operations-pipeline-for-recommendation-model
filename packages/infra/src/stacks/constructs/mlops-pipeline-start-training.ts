/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import * as path from "path";
import { Duration, aws_lambda as lambda, aws_iam as iam, aws_s3 as s3, aws_s3_notifications as s3noti } from "aws-cdk-lib";
import { Construct } from "constructs";
import { PolicyStatements } from "../../util/policy-util";

export interface StartTrainingPipelineLambdaProps {
  readonly namespace: string;

  readonly pipelinePrefix: string;
  readonly s3MlopsBucketArn: string;
  readonly pipelineCoreRepoPrefix: string;
  readonly pipelineManifestFileName: string;
}

export class StartTrainingPipelineLambda extends Construct {
  constructor(scope: Construct, id: string, props: StartTrainingPipelineLambdaProps) {
    super(scope, id);

    const { namespace, pipelinePrefix, s3MlopsBucketArn, pipelineCoreRepoPrefix, pipelineManifestFileName } = props;
    const functionName = `${namespace}-${pipelinePrefix}-start-training`;

    // Start pipeline function
    const lambdaSrcRoot = path.join(__dirname, "../../../../lambda/functions");
    const pipelineStartFunc = new lambda.Function(this, "StartTrainingPipelineLambda", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "handler.handle",
      code: lambda.Code.fromAsset(path.join(lambdaSrcRoot, "/mlops-pipeline-start-training/src")),
      functionName: functionName,
      timeout: Duration.minutes(5),
      environment: {
        // if any environments, describe here
      },
      role: new iam.Role(this, "StartTrainingPipelineFunctionRole", {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      }),
    });
    pipelineStartFunc.role?.attachInlinePolicy(
      new iam.Policy(this, "StartTrainingPipelineFunctionPolicy", {
        statements: [
          PolicyStatements.log.createLogGroup(),
          PolicyStatements.log.createLog(),
          PolicyStatements.s3.readWriteBucket(s3MlopsBucketArn),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["sagemaker:StartPipelineExecution", "sagemaker:DescribePipeline"],
            resources: ["*"],
          }),
        ],
      }),
    );

    // Event triggrt for lambda invoke
    const srcBucket = s3.Bucket.fromBucketArn(this, "MlOpsSrcManifestBucket", s3MlopsBucketArn);
    srcBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3noti.LambdaDestination(pipelineStartFunc), {
      prefix: pipelineCoreRepoPrefix,
      suffix: pipelineManifestFileName,
    });
  }
}

/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  Stack,
  StackProps,
  Environment,
  RemovalPolicy,
  CfnOutput,
  aws_s3 as s3,
  aws_codecommit as codecommit,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { CreateSageMakerEndpointLambda } from "./constructs/mlops-pipeline-create-endpoint";
import { ModelMetricStepLambda } from "./constructs/mlops-pipeline-model-metric";
import { ModelRegistrationStepLambda } from "./constructs/mlops-pipeline-model-repackage";
import { StartTrainingPipelineLambda } from "./constructs/mlops-pipeline-start-training";
import { getParameter, namespaced, namespacedBucket, namespacedKey, putParameter } from "../util/common";

export interface MlOpsStackProps extends StackProps {
  readonly env: Environment;
  readonly namespace: string;
  readonly parameterStoreKeys: Record<string, string>;

  readonly modelPackageGroupNames: string[];
  readonly s3MlOpsBucket?: s3.IBucket;
  readonly codecommitRepo?: codecommit.IRepository;
}

export class MlOpsStack extends Stack {
  readonly mlopsBucket: s3.IBucket;
  readonly codecommitRepo: codecommit.IRepository;

  constructor(scope: Construct, id: string, props?: MlOpsStackProps) {
    super(scope, id, props);
    const { env, namespace, parameterStoreKeys, modelPackageGroupNames, s3MlOpsBucket, codecommitRepo } = props!;

    //------------------------------------------------------------------
    // Storage
    //------------------------------------------------------------------
    if (s3MlOpsBucket) {
      this.mlopsBucket = s3MlOpsBucket;
    } else {
      this.mlopsBucket = new s3.Bucket(this, "MlOpsBucket", {
        bucketName: namespacedBucket("mlops-bucket", namespace, env.account!, env.region!),
        enforceSSL: true,
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        serverAccessLogsPrefix: "logs/",
        // cors
        cors: [
          {
            allowedHeaders: ["*"],
            allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD,],
            allowedOrigins: ["*"],
            exposedHeaders: [
              "x-amz-server-side-encryption",
              "x-amz-request-id",
              "x-amz-id-2"
            ],
            maxAge: 3000
          }
        ],
        // TO-DO: check removal policy in production
        removalPolicy: RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      });
    }

    const keyS3MlOpsBucketArn = namespacedKey(parameterStoreKeys.s3MlOpsBucketArn!, namespace);
    const keyS3MlOpsBucketName = namespacedKey(parameterStoreKeys.s3MlOpsBucketName!, namespace);
    putParameter(this, keyS3MlOpsBucketArn, this.mlopsBucket.bucketArn);
    putParameter(this, keyS3MlOpsBucketName, this.mlopsBucket.bucketName);
    new CfnOutput(this, "CfnMlOpsBucket", { value: this.mlopsBucket.bucketArn });

    //------------------------------------------------------------------
    // Code Repository
    //------------------------------------------------------------------
    if (codecommitRepo) {
      this.codecommitRepo = codecommitRepo;
    } else {
      this.codecommitRepo = new codecommit.Repository(this, "CodeCommitRepo", {
        repositoryName: namespaced("mlops-repo", namespace),
        description: "MLOps repository",
      });
    }
    const keyCodeCommitRepo = namespacedKey(parameterStoreKeys.codeCommitMlOpsRepo!, namespace);
    const keyCodeCommitRepoUrl = namespacedKey(parameterStoreKeys.codeCommitMlOpsRepoUrlGrc!, namespace);
    putParameter(this, keyCodeCommitRepo, this.codecommitRepo.repositoryArn);
    putParameter(this, keyCodeCommitRepoUrl, this.codecommitRepo.repositoryCloneUrlGrc);
    new CfnOutput(this, "CfnCodeCommitRepoUrlGrc", { value: this.codecommitRepo.repositoryCloneUrlGrc });

    //------------------------------------------------------------------
    // Training Pipeline
    //------------------------------------------------------------------
    // Model repackage lambda - it used for LambdaStep in training pipeline
    const funcRepackage = new ModelRegistrationStepLambda(this, "TrainingPipelineRepackage", {
      namespace,
      pipelinePrefix: "training-pipeline",
      s3MlopsBucketArn: this.mlopsBucket.bucketArn,
    });
    new CfnOutput(this, "CfnRepackageFunc", { key: "ModelRepackageFunc", value: funcRepackage.func.functionArn });
    const keyLambdaModelRepackageFunction = namespacedKey(parameterStoreKeys.lambdaModelRepackageFunction!, namespace);
    putParameter(this, keyLambdaModelRepackageFunction, funcRepackage.func.functionArn);

    // Start training pipeline invocation
    new StartTrainingPipelineLambda(this, "TrainingPipelineStart", {
      namespace,
      pipelinePrefix: "training-pipeline",
      s3MlopsBucketArn: this.mlopsBucket.bucketArn,
      pipelineCoreRepoPrefix: "code/",
      pipelineManifestFileName: "pipeline_config.json",
    });

    // Model metric collect
    const funcMetric = new ModelMetricStepLambda(this, "TrainingPipelineMetric", {
      namespace,
      pipelinePrefix: "training-pipeline",
      s3MlopsBucketArn: this.mlopsBucket.bucketArn,
    });
    new CfnOutput(this, "CfnMetricFunc", { key: "ModelMetricFunc", value: funcMetric.func.functionArn });
    const keyLambdaModelMetricFunction = namespacedKey(parameterStoreKeys.lambdaModelMetricFunction!, namespace);
    putParameter(this, keyLambdaModelMetricFunction, funcMetric.func.functionArn);

    //------------------------------------------------------------------
    // Model Deployment
    //------------------------------------------------------------------
    // Model approval event and Create SageMaker Endpoint
    const sagemakerExecutionRole = getParameter(this, namespacedKey(parameterStoreKeys.sagemakerExecRoleDefault!, namespace));
    new CreateSageMakerEndpointLambda(this, "ModelDeploymentCreateEndpoint", {
      namespace,
      modelPackageGroupNames,
      sagemakerExecutionRole,
    });
  }
}

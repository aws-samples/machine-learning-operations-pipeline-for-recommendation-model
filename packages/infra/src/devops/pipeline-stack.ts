/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { PDKPipeline } from "@aws/pdk/pipeline";
import { Stack, StackProps, Environment, CfnOutput } from "aws-cdk-lib";
import { LinuxBuildImage, ComputeType } from "aws-cdk-lib/aws-codebuild";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { namespaced, namespacedKey, putParameter } from "../util/common";

export interface DevOpsPipelineStackProps extends StackProps {
  readonly env: Environment;
  readonly namespace: string;
  readonly parameterStoreKeys: Record<string, string>;
}

export class DevOpsPipelineStack extends Stack {
  readonly pipeline: PDKPipeline;

  constructor(scope: Construct, id: string, props: DevOpsPipelineStackProps) {
    super(scope, id, props);

    const { env, namespace, parameterStoreKeys } = props;

    const pipelineID = "ApplicationPipeline";
    const repositoryName = namespaced("mlops-infra", namespace);
    this.pipeline = new PDKPipeline(this, pipelineID, {
      primarySynthDirectory: "packages/infra/cdk.out",
      repositoryName: repositoryName,
      defaultBranchName: "main",
      branchNamePrefixes: PDKPipeline.ALL_BRANCHES,
      publishAssetsInParallel: false,
      crossAccountKeys: true,
      synth: {},
      synthCodeBuildDefaults: {
        buildEnvironment: {
          buildImage: LinuxBuildImage.STANDARD_7_0,
          computeType: ComputeType.SMALL,
        },
      },
      synthShellStepPartialProps: {
        installCommands: ["npm install -g aws-cdk @aws/pdk pnpm", "pnpm install --frozen-lockfile || npx projen && pnpm install --frozen-lockfile"],
        commands: ["npx nx run-many --target=build --all"],
      },
    });
    const keyCodeCommitRepo = namespacedKey(parameterStoreKeys.codeCommitDevOpsRepo!, namespace);
    putParameter(this, keyCodeCommitRepo, this.pipeline.codeRepository.repositoryArn);
    const keyCodeCommitRepoUrlGrc = namespacedKey(parameterStoreKeys.codeCommitDevOpsRepoUrlGrc!, namespace);
    putParameter(this, keyCodeCommitRepoUrlGrc, this.pipeline.codeRepository.repositoryCloneUrlGrc);
    new CfnOutput(this, "CfnCodeCommitRepoUrlGrc", { value: this.pipeline.codeRepository.repositoryCloneUrlGrc });

    //------------------------------------------------------------------
    // NagSuppressions
    //------------------------------------------------------------------
    NagSuppressions.addStackSuppressions(
      this,
      [
        {
          id: "AwsPrototyping-IAMNoWildcardPermissions",
          reason: "PDKPipeline : Need wildcard permissions for deploying resources",
        },
        {
          id: " AwsPrototyping-LambdaLatestVersion",
          reason: "PDKPipeline : : depends on PDKPipeline's lambda version",
        },
      ],
      true,
    );
    NagSuppressions.addStackSuppressions(
      this,
      [
        {
          id: " AwsPrototyping-LambdaLatestVersion",
          reason: "PDKPipeline : : depends on PDKPipeline's lambda version",
        },
      ],
      true,
    );
  }
}

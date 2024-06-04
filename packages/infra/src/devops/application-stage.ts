/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { Stage, StageProps, Environment } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ApplicationStack, SagemakerEndpointApiConfig } from "../stacks/application-stack";
import { ExperimentsStack } from "../stacks/experiments-stack";
import { MlOpsStack } from "../stacks/mlops-stack";

export interface ApplicationStageProps extends StageProps {
  readonly env: Environment;
  readonly namespace: string;
  readonly parameterStoreKeys: Record<string, string>;
  readonly modelPackageGroupNames: string[];
  readonly sagemakerEndpointAPIs: SagemakerEndpointApiConfig[];
}

export class ApplicationStage extends Stage {
  constructor(scope: Construct, id: string, props: ApplicationStageProps) {
    super(scope, id, props);

    const { env, namespace, parameterStoreKeys, modelPackageGroupNames, sagemakerEndpointAPIs } = props;

    const experimentStack = new ExperimentsStack(this, namespace + "Experiments", {
      env: props!.env!,
      namespace: namespace,
      parameterStoreKeys: parameterStoreKeys,
    });

    const mlopsStack = new MlOpsStack(this, namespace + "MlOps", {
      env: props!.env!,
      namespace: namespace,
      parameterStoreKeys: parameterStoreKeys,
      modelPackageGroupNames: modelPackageGroupNames,
    });
    mlopsStack.addDependency(experimentStack);

    const appStack = new ApplicationStack(this, namespace + "Application", {
      env: props!.env!,
      namespace: namespace,
      parameterStoreKeys: parameterStoreKeys,
      sagemakerEndpointAPIs: sagemakerEndpointAPIs,
    });
    appStack.addDependency(experimentStack)
  }
}

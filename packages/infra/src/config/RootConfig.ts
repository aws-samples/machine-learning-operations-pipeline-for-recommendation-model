/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { Environment } from "aws-cdk-lib";
import { SagemakerEndpointApiConfig } from "../stacks/application-stack";

export interface ICommonContext {
  // project config
  namespace: string;
  administratorEmail: string;

  // deploy accounts
  env: Environment;
  toolEnv: Environment;
  targetEnv: Record<string, Environment>;

  // ssm parameters
  parameterStoreKeys: Record<string, string>;

  // sagemaker model package group for MLOps
  sagemakerModelPackageGroupNames: string[];

  // sagemaker endpoint names for creating REST API
  sagemakerEndpointAPIs: SagemakerEndpointApiConfig[];
}

export type RootConfig = ICommonContext;
// TODO: expand your Config interfaces

export default RootConfig;

/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { CdkGraph, FilterPreset, Filters } from "@aws/pdk/cdk-graph";
import { CdkGraphDiagramPlugin } from "@aws/pdk/cdk-graph-plugin-diagram";
import { CdkGraphThreatComposerPlugin } from "@aws/pdk/cdk-graph-plugin-threat-composer";
import { AwsPrototypingChecks, PDKNag } from "@aws/pdk/pdk-nag";
import config from "./config";
import { ApplicationStage } from "./devops/application-stage";
import { DevOpsPipelineStack } from "./devops/pipeline-stack";

const PROJECT_PREFIX = "proto";

/* eslint-disable @typescript-eslint/no-floating-promises */
(async () => {
  //-------------------------------------------------------
  // Using PdkNag
  //-------------------------------------------------------
  const app = PDKNag.app({
    nagPacks: [new AwsPrototypingChecks()],
  });

  //-------------------------------------------------------
  // DevOps Pipelines
  //-------------------------------------------------------
  const pipelineStack = new DevOpsPipelineStack(app, config.namespace + "DevOpsPipelineStack", {
    env: {
      account: config.env.account!,
      region: config.env.region!,
    },
    namespace: config.namespace,
    parameterStoreKeys: config.parameterStoreKeys,
  });

  const devStage = new ApplicationStage(app, config.namespace + "Dev", {
    env: {
      account: config.env.account!, // Replace with dev account as config.targetEnv.dev.account!
      region: config.env.region!, // Replace with dev account as config.targetEnv.dev.region!
    },
    namespace: config.namespace,
    parameterStoreKeys: config.parameterStoreKeys,
    modelPackageGroupNames: config.sagemakerModelPackageGroupNames,
    sagemakerEndpointAPIs: config.sagemakerEndpointAPIs,
  });
  pipelineStack.pipeline.addStage(devStage);

  /*
  // Only create the Prod stage in the default branch
  if(PDKPipeline.isDefaultBranch({ node: app.node })) {
    const prodStage = new ApplicationStage(app, branchPrefix + "Prod", {
      env: {
        // Replace with Prod account
        //account : config.targetEnv.prod.account!,
        //region : config.targetEnv.prod.region!,
      },
    });
    pipelineStack.pipeline.addStage(prodStage);
  }
  */

  //-------------------------------------------------------
  // Cdk Graph
  //-------------------------------------------------------
  const graph = new CdkGraph(app, {
    plugins: [
      new CdkGraphDiagramPlugin({
        defaults: {
          filterPlan: {
            preset: FilterPreset.COMPACT,
            filters: [{ store: Filters.pruneCustomResources() }],
          },
        },
      }),
      new CdkGraphThreatComposerPlugin(),
    ],
  });

  //-------------------------------------------------------
  // Cdk App Sync
  //-------------------------------------------------------
  app.synth();
  await graph.report();
})();

/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { config } from "../src/config";
import { ExperimentsStack } from "../src/stacks/experiments-stack";

test("Snapshot", () => {
  const app = new App();
  const stack = new ExperimentsStack(app, "test", {
    env: {
      account: config.toolEnv.account!,
      region: config.toolEnv.region!,
    },
    namespace: config.namespace,
    parameterStoreKeys: config.parameterStoreKeys,
  });

  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});

/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import * as path from "path";
import RootConfig from "./RootConfig";

// load config yaml file
process.env.NODE_CONFIG_DIR = path.resolve(__dirname, "../../config");
export type Config = RootConfig;

/* eslint-disable @typescript-eslint/no-require-imports */
const rootCfg: Config = require("config");

// setup account info
const account = rootCfg.toolEnv?.account || process.env.CDK_DEFAULT_ACCOUNT;
const region = rootCfg.toolEnv?.region || process.env.CDK_DEFAULT_REGION;
if (!account) throw new Error(`Config filed to determine account`);
else if (!region) throw new Error(`Config filed to determine region`);
else rootCfg.env = { account, region };

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const config = rootCfg;

if (process.env.CDK_CONFIG_SUPPRESS_WARNING == null && process.env.CDK_NAG == null) {
  console.info(config);
}

export default config;

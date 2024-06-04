/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { aws_ssm as ssm } from "aws-cdk-lib";
import { Construct } from "constructs";

// Namespace tools ------------------------------------------------------------------------------------
export const namespaced = (name: string, namespace: string) => `${namespace}-${name}`;
export const namespacedKey = (key: string, namespace: string) => `/${namespace}${key}`;
export const namespacedBucket = (name: string, namespace: string, account: string, region: string) => {
  return toKebabCase(`${namespace}-${account}-${region}-${name}`);
};

// ParameterStore --------------------------------------------------------------------------------------
export const putParameter = (ctx: Construct, key: string, value: string, description?: string) => {
  new ssm.StringParameter(ctx, "SsmParams/" + key, {
    parameterName: key,
    stringValue: value,
    description: description,
  });
};

export const getParameter = (ctx: Construct, key: string) => ssm.StringParameter.valueForStringParameter(ctx, key);

export function getParameterFromLookup(ctx: Construct, key: string): string {
  return ssm.StringParameter.valueFromLookup(ctx, key);
}

// Miscellaneous ---------------------------------------------------------------------------------------
export const toInt = (input: string, defaultValue?: number) => {
  let num = parseInt(input);

  if (isNaN(num) && defaultValue !== undefined) return defaultValue;
  else return num;
};

export const toCamelCase = (str: string) => {
  let s = str
    .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
    ?.map((x: string) => x.slice(0, 1).toUpperCase() + x.slice(1).toLowerCase())
    .join("");
  return s && s.slice(0, 1).toLowerCase() + s.slice(1);
};

export const toKebabCase = (str: string) =>
  str
    .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
    ?.map((x) => x.toLowerCase())
    .join("-");

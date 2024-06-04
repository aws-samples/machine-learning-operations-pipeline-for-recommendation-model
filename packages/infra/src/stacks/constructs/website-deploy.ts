/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { StaticWebsite } from "@aws/pdk/static-website";
import { aws_cloudfront as cf, aws_cloudfront_origins as cfo, Stack } from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";

export interface WebSiteDeployProps {
  readonly identityPoolId: string;
  readonly userPoolId: string;
  readonly userPoolWebClientId: string;
  readonly apiUrl: string;
  readonly apiKey: string;
  readonly ncfEndpoints?: string[];
}

export class WebSiteDeploy extends Construct {
  constructor(scope: Construct, id: string, props: WebSiteDeployProps) {
    super(scope, id);
    const { identityPoolId, userPoolId, userPoolWebClientId, apiUrl, apiKey, ncfEndpoints } = props;

    //-------------------------------------------------------
    // Web Hosting
    //-------------------------------------------------------
    // web hosting config
    const website = new StaticWebsite(this, "StaticWebsite", {
      websiteContentPath: "../frontend/build",
      distributionProps: {
        defaultBehavior: {
          /* DUMMY (it will be replaced by construct) */
          origin: new cfo.HttpOrigin(""),
          /*------------------------------------------*/
        },
        geoRestriction: cf.GeoRestriction.allowlist("US", "KR"),
        minimumProtocolVersion: cf.SecurityPolicyProtocol.TLS_V1_2_2021,
        errorResponses: [
          {
            httpStatus: 404,
            responseHttpStatus: 404,
            responsePagePath: "/",
          },
        ],
      },
      runtimeOptions: {
        jsonPayload: {
          region: Stack.of(this).region,
          identityPoolId,
          userPoolId,
          userPoolWebClientId,
          apiUrl,
          apiKey,
          ncfEndpoints,
        },
      },
    });

    //-------------------------------------------------------
    // NagSuppressions
    //------------------------------------------------------
    NagSuppressions.addStackSuppressions(Stack.of(this), [
      { id: "AwsPrototyping-IAMNoWildcardPermissions", reason: "Wildcard policy used in PDK Website constructs by common use" },
      { id: "AwsPrototyping-IAMNoManagedPolicies", reason: "Managed policy used in PDK Website constructs by common use" },
      { id: "AwsPrototyping-LambdaLatestVersion", reason: "Lambda version warning in PDK Website constructs by common use" },
    ]);
  }
}

/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { StackProps, Environment, aws_wafv2 as wafv2 } from "aws-cdk-lib";
import { Construct } from "constructs";
import { namespaced } from "../../util/common";

export interface RegionalWafConstructProps extends StackProps {
  readonly env: Environment;
  readonly namespace: string;
}

export class RegionalWafConstruct extends Construct {
  readonly cfnWebACL: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: RegionalWafConstructProps) {
    super(scope, id);

    const { env, namespace } = props;

    //-------------------------------------------------------
    // WAF Web Association
    //-------------------------------------------------------
    // Baseline rule groups: https://docs.aws.amazon.com/ko_kr/waf/latest/developerguide/aws-managed-rule-groups-baseline.html
    const webAclName = namespaced(`${env.region}-${id}-wafacl`, namespace);
    this.cfnWebACL = new wafv2.CfnWebACL(this, "WafWebAcl", {
      defaultAction: {
        allow: {},
      },
      scope: "REGIONAL",
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: webAclName,
        sampledRequestsEnabled: true,
      },
      name: webAclName,
      rules: [
        {
          name: "AWS-AWSManagedRulesCommonRuleSet",
          priority: 0,
          statement: {
            managedRuleGroupStatement: {
              name: "AWSManagedRulesCommonRuleSet",
              vendorName: "AWS",
              excludedRules: [
                { name: "SizeRestrictions_BODY" },
                { name: "NoUserAgent_HEADER" },
                { name: "UserAgent_BadBots_HEADER" },
                { name: "SizeRestrictions_QUERYSTRING" },
                { name: "SizeRestrictions_Cookie_HEADER" },
                { name: "SizeRestrictions_BODY" },
                { name: "SizeRestrictions_URIPATH" },
                { name: "EC2MetaDataSSRF_BODY" },
                { name: "EC2MetaDataSSRF_COOKIE" },
                { name: "EC2MetaDataSSRF_URIPATH" },
                { name: "EC2MetaDataSSRF_QUERYARGUMENTS" },
                { name: "GenericLFI_QUERYARGUMENTS" },
                { name: "GenericLFI_URIPATH" },
                { name: "GenericLFI_BODY" },
                { name: "RestrictedExtensions_URIPATH" },
                { name: "RestrictedExtensions_QUERYARGUMENTS" },
                { name: "GenericRFI_QUERYARGUMENTS" },
                { name: "GenericRFI_BODY" },
                { name: "GenericRFI_URIPATH" },
                { name: "CrossSiteScripting_COOKIE" },
                { name: "CrossSiteScripting_QUERYARGUMENTS" },
                { name: "CrossSiteScripting_BODY" },
                { name: "CrossSiteScripting_URIPATH" },
              ],
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "AWS-AWSManagedRulesCommonRuleSet",
            sampledRequestsEnabled: true,
          },
          overrideAction: {
            none: {},
          },
        },
      ],
    });
  }
}

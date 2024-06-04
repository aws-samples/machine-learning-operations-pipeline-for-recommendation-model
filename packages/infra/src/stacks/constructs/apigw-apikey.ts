/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  Stack,
  StackProps,
  Environment,
  aws_apigateway as apigw,
  aws_logs as logs,
  aws_wafv2 as wafv2,
  aws_secretsmanager as secretsmanager,
  CfnOutput,
  RemovalPolicy,
} from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { RegionalWafConstruct } from "./regional-waf-persistent";
import { namespaced, namespacedKey } from "../../util/common";

export interface ApiGwApiKeyConstructProps extends StackProps {
  readonly env: Environment;
  readonly namespace: string;
  readonly apiName: string;
  readonly apiKeyString?: string;

  readonly stageName?: string;
  readonly throttle?: apigw.ThrottleSettings;
  readonly quota?: apigw.QuotaSettings;
}

export class ApiGwApiKeyConstruct extends Construct {
  readonly restApi: apigw.RestApi;
  readonly apiKey: string;
  readonly apiKeyId: string;
  readonly parameterValidator: apigw.RequestValidator;
  readonly bodyValidator: apigw.RequestValidator;

  constructor(scope: Construct, id: string, props: ApiGwApiKeyConstructProps) {
    super(scope, id);

    const { namespace, apiName, stageName, throttle, quota, apiKeyString } = props;

    // Default values
    const apiStageName = stageName ? stageName : "dev";

    // Throttle
    // ref : https://docs.aws.amazon.com/ko_kr/apigateway/latest/developerguide/api-gateway-request-throttling.html
    const apiThrottle = throttle
      ? throttle
      : {
          burstLimit: 100,
          rateLimit: 600,
        };
    const apiQuota = quota
      ? quota
      : {
          limit: 10 * (60 * 60 * 24), // = 10 req/sec = 864,000 req/day
          period: apigw.Period.DAY,
        };

    //-------------------------------------------------------
    // API Gateway (RestApi)
    //-------------------------------------------------------
    const restApiAccessLogGroup = new logs.LogGroup(this, `${apiName}AccessLogGroup`, {
      logGroupName: `/aws/apigateway/${namespace}/${apiName}/access-log`,
      retention: 365,

      // TO-DO: check removal policy in production
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const restApi = new apigw.RestApi(this, `${apiName}Api`, {
      restApiName: namespaced(apiName, namespace),
      // CORS
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
      },
      deployOptions: {
        // Access Logs
        dataTraceEnabled: true,
        loggingLevel: apigw.MethodLoggingLevel.ERROR,
        accessLogDestination: new apigw.LogGroupLogDestination(restApiAccessLogGroup),
        accessLogFormat: apigw.AccessLogFormat.clf(),
        // stage
        stageName: apiStageName,
      },
    });
    this.restApi = restApi;

    new CfnOutput(this, `${apiName}Endpoint`, {
      exportName: namespaced(`${apiName}-endpoint-url`, namespace),
      value: restApi.url,
    });

    //-------------------------------------------------------
    // Validators for request data
    //-------------------------------------------------------
    // Parameter validation
    this.parameterValidator = new apigw.RequestValidator(this, "stringParamValidator", {
      restApi: restApi,
      requestValidatorName: namespaced(`stringParamValidator`, namespace),
      validateRequestParameters: true,
    });
    // Body Validator
    this.bodyValidator = new apigw.RequestValidator(this, "bodyValidator", {
      restApi: restApi,
      requestValidatorName: namespaced(`bodyValidator`, namespace),
      validateRequestBody: true,
    });

    //-------------------------------------------------------
    // API Key & UsagePlan
    //-------------------------------------------------------
    this.apiKey = apiKeyString ? apiKeyString : namespaced("default-api-key", namespace);
    const apiKey = new apigw.ApiKey(this, `${apiName}ApiKey`, {
      apiKeyName: namespaced(`${apiName}-key`, namespace),
      value: this.apiKey,
      enabled: true,
    });

    const plan = restApi.addUsagePlan(`${apiName}ApiUsagePlan`, {
      name: namespaced(apiName, namespace),
      description: `${apiName} API usage plan`,
      apiStages: [
        {
          api: restApi,
          stage: restApi.deploymentStage,
        },
      ],
      throttle: apiThrottle,
      quota: apiQuota,
    });
    plan.addApiKey(apiKey);
    this.apiKeyId = apiKey.keyId;

    new CfnOutput(this, `${apiName}ApiKeyId`, {
      exportName: namespaced(`${apiName}-apikey-id`, namespace),
      value: apiKey.keyId,
    });

    //-------------------------------------------------------
    // WAF
    //-------------------------------------------------------
    const wafAcl = new RegionalWafConstruct(this, `${apiName}WafAcl`, props);
    new wafv2.CfnWebACLAssociation(this, `${apiName}WebACLAssociation`, {
      resourceArn: this.restApi.deploymentStage.stageArn,
      webAclArn: wafAcl.cfnWebACL.attrArn,
    });

    //-------------------------------------------------------
    // NagSuppression
    //-------------------------------------------------------
    const stack = Stack.of(this);
    const stackPrefix = stack.stackName.replace(`${namespace}-`, "").replace("-", "/");
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      `/${stackPrefix}/${this.node.id}/${apiName}Api/CloudWatchRole/Resource`,
      [{ id: "AwsPrototyping-IAMNoManagedPolicies", reason: "Cloudwatch log role by API Gateway" }],
      true,
    );
  }
}

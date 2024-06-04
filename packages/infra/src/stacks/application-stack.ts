/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { UserIdentity } from "@aws/pdk/identity";
import { Stack, StackProps, Environment, aws_apigateway as apigw, aws_dynamodb as ddb, RemovalPolicy } from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { ApiInferenceModelLambda } from "./constructs/api-inference-model-lambda";
import { ApiGwApiKeyConstruct } from "./constructs/apigw-apikey";
import { WebSiteDeploy } from "./constructs/website-deploy";
import { namespaced, toCamelCase } from "../util/common";

export interface SagemakerEndpointApiConfig {
  apiName: string;
  endpointName: string;
  reqModelName?: string;
}

export interface ApplicationStackProps extends StackProps {
  readonly env: Environment;
  readonly namespace: string;
  readonly parameterStoreKeys?: Record<string, string>;
  readonly sagemakerEndpointAPIs?: SagemakerEndpointApiConfig[];
}

interface ApiModels {
  [key: string]: apigw.Model;
}

export class ApplicationStack extends Stack {
  readonly apiRegisteredModels: Map<string, apigw.Model>;

  constructor(scope: Construct, id: string, props: ApplicationStackProps) {
    super(scope, id, props);

    const { env, namespace, parameterStoreKeys, sagemakerEndpointAPIs } = props;

    //-------------------------------------------------------
    // API Gateway with APIKey
    //-------------------------------------------------------
    const api = new ApiGwApiKeyConstruct(this, "InferenceApiConstruct", {
      apiName: `inference`,
      apiKeyString: `mlops-${namespace}-apikey-H3wi8xb7pUzi`,
      stageName: "proto",
      ...props,
    });

    const apiRoot = api.restApi.root;

    //-------------------------------------------------------
    // Cognito Authorization
    //-------------------------------------------------------
    // // Create Cognito user pool and identitiy pool
    const userIdentity = new UserIdentity(this, "CognitoUserIdentity");
    // Create cognito authorizer
    const cognitoAuthorizer = new apigw.CfnAuthorizer(this, `ApiCognitoAuthorizer`, {
      name: namespaced(`api-inference-cognito-authorizer`, namespace),
      identitySource: "method.request.header.Authorization",
      providerArns: [userIdentity.userPool?.userPoolArn],
      restApiId: api.restApi.restApiId,
      type: apigw.AuthorizationType.COGNITO,
    });
    const authorizerMethodOpt: apigw.MethodOptions = {
      authorizer: { authorizerId: cognitoAuthorizer.ref },
      authorizationType: apigw.AuthorizationType.COGNITO,
    };

    //-------------------------------------------------------
    // [GET] Model Inference
    //-------------------------------------------------------
    // create parameter model (model name canbe alpha-numeric value)
    this.apiRegisteredModels = this.registerApiRequestModel(api.restApi, namespace);

    // create api endpoint
    if (sagemakerEndpointAPIs) {
      for (const epConf of sagemakerEndpointAPIs) {
        const { endpointName, apiName } = epConf;

        // get api model
        let apiModel: apigw.IModel;
        if (this.apiRegisteredModels.has(epConf.reqModelName!)) {
          apiModel = this.apiRegisteredModels.get(epConf.reqModelName!)!;
        } else {
          apiModel = this.apiRegisteredModels.get("default")!;
        }

        // inference lambda
        const inferenceLambda = new ApiInferenceModelLambda(this, `Api${apiName}Lambda`, {
          namespace,
          sagemakerEndpointName: endpointName,
        });
        const apiIntegration = new apigw.LambdaIntegration(inferenceLambda.func);

        // method option
        const methodOptions = {
          apiKeyRequired: true,
          requestValidator: api.bodyValidator,
          requestModels: { "application/json": apiModel },
          // for cognito auth.
          authorizer: { authorizerId: cognitoAuthorizer.ref },
          authorizationType: apigw.AuthorizationType.COGNITO,
        };

        // rest api
        const ingestEndpoint = apiRoot.addResource(apiName);
        ingestEndpoint.addMethod("POST", apiIntegration, methodOptions);
      }
    }

    //-------------------------------------------------------
    // Frontend Website
    //-------------------------------------------------------
    new WebSiteDeploy(this, "WebsiteDeploy", {
      identityPoolId: userIdentity.identityPool?.identityPoolId,
      userPoolId: userIdentity.userPool?.userPoolId,
      userPoolWebClientId: userIdentity.userPoolClient?.userPoolClientId,
      apiUrl: api.restApi.url,
      apiKey: api.apiKey,
      ncfEndpoints: sagemakerEndpointAPIs?.map((ep) => ep.endpointName)
    });

    //-------------------------------------------------------
    // NagSuppressions
    //-------------------------------------------------------
    NagSuppressions.addResourceSuppressions(
      api,
      [
        { id: "AwsPrototyping-APIGWAuthorization", reason: "API Gateway interfaced with API key" },
        { id: "AwsPrototyping-CognitoUserPoolAPIGWAuthorizer", reason: "API Gateway interfaced with API key" },
        { id: "AwsPrototyping-APIGWRequestValidation", reason: "root resource of API Gateway has no attached methods" },
      ],
      true,
    );
  }

  // API 요청 검증 > 데이터 모델 이해
  // ref: https://docs.aws.amazon.com/ko_kr/apigateway/latest/developerguide/models-mappings-models.html
  public registerApiRequestModel(api: apigw.RestApi, namespace: string) {
    const models = new Map<string, apigw.Model>();

    // Recommendation sample model
    const recommSampleModelName = toCamelCase(namespaced("ncf-input", namespace))!;
    const recommSample = api.addModel(`ApiModel${recommSampleModelName}`, {
      contentType: "application/json",
      modelName: recommSampleModelName,
      schema: {
        type: apigw.JsonSchemaType.OBJECT,
        properties: {
          user: {
            type: apigw.JsonSchemaType.ARRAY,
            items: {
              type: apigw.JsonSchemaType.INTEGER,
            },
          },
          item: {
            type: apigw.JsonSchemaType.ARRAY,
            items: {
              type: apigw.JsonSchemaType.INTEGER,
            },
          },
        },
        required: ["user", "item"],
      },
    });
    models.set("ncf-input", recommSample);

    // Json Default Model
    const jsonDefaultModelName = toCamelCase(namespaced("default", namespace))!;
    const jsonDefault = api.addModel(`ApiModel${jsonDefaultModelName}`, {
      contentType: "application/json",
      modelName: jsonDefaultModelName,
      schema: {
        type: apigw.JsonSchemaType.OBJECT,
      },
    });
    models.set("default", jsonDefault);

    return models;
  }
}

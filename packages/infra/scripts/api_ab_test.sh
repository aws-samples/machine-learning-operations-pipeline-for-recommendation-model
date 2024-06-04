#!/bin/bash

# config
REGION=ap-northeast-2
STACK=protoDev-protoApplication
APIKEY_EXPORT_NAME=proto-inference-apikey-id
APIGW_EXPORT_NAME=proto-inference-endpoint-url
SESSION_FILE=user_session.json

API=abtest
DATA_FILE=ncf-data-abtest.json

# Chech cognito user login
if ! [ -f "$SESSION_FILE" ]
then
    echo "ERROR : User not logged in"
    exit 1
fi

# User ID Token
ID_TOKEN=$(jq -r .AuthenticationResult.IdToken < $SESSION_FILE)

# get api gateway url and api key
echo "=== Retrieve API Gateway ApiKey ==="
echo "Region: "$REGION
echo "Stack: "$STACK
echo "==================================="
API_ROOT=$(aws cloudformation --region $REGION describe-stacks --stack-name $STACK --query "Stacks[0].Outputs[?ExportName=='$APIGW_EXPORT_NAME'].OutputValue"  --output text)
echo "API Root: "$API_ROOT
API_KEY_ID=$(aws cloudformation --region $REGION describe-stacks --stack-name $STACK --query "Stacks[0].Outputs[?ExportName=='$APIKEY_EXPORT_NAME'].OutputValue"  --output text)
API_KEY=$(aws apigateway get-api-key --api-key $API_KEY_ID --include-value --query "value" --output text)
echo "API Key: "$API_KEY

# execute request
echo "=== API Gateway Endpoint ==="
API_ENDPOINT=$API_ROOT/$API
echo $API_ENDPOINT

echo "=== Input Data ==="
cat $DATA_FILE
echo ""

echo "=== Response ==="
curl -s -X POST \
     -H "x-api-key: $API_KEY" \
     -H 'Authorization:'$ID_TOKEN \
     -H "Content-Type: application/json" \
     -d @$DATA_FILE \
     $API_ENDPOINT | jq .

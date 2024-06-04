#!/bin/bash

AWS_PROFILE=proto-mlops
AWS_REGION=ap-northeast-2
USER_POOL_ID=ap-northeast-2_pcsKN0wq

USER_POOL_CLIENT_ID=$(jq -r .ClientId auth.json)
USERNAME=$(jq -r .AuthParameters.USERNAME auth.json)

curl -s -X POST --data @auth.json \
  -H 'X-Amz-Target: AWSCognitoIdentityProviderService.InitiateAuth' \
  -H 'Content-Type: application/x-amz-json-1.1' \
  https://cognito-idp.$AWS_REGION.amazonaws.com/ > mfa_session.json

MFA_SESSION=$(jq -r .Session mfa_session.json)
rm mfa_session.json

echo "mfa : "
read MFA_VAL

aws cognito-idp admin-respond-to-auth-challenge \
 --profile $AWS_PROFILE \
 --user-pool-id $USER_POOL_ID \
 --client-id $USER_POOL_CLIENT_ID \
 --challenge-name SOFTWARE_TOKEN_MFA \
 --challenge-responses USERNAME=$USERNAME,SOFTWARE_TOKEN_MFA_CODE=$MFA_VAL \
 --session $MFA_SESSION > user_session.json


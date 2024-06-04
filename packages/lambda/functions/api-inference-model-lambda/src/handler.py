import os
import json
from ssl import Options
import boto3

sm_runtime = boto3.client('sagemaker-runtime')
sagemaker_endpoint_name = os.environ['SAGEMAKER_ENDPOINT_NAME']

def handle(event, context):
    print('\nevent====>', json.dumps(event))

    # Invoke Endpoint
    response = sm_runtime.invoke_endpoint(
        EndpointName=sagemaker_endpoint_name, 
        ContentType='application/json', 
        Body=event['body'],
    )

    # Result
    recomm = response['Body'].read().decode("utf-8")
    print("Result====>", recomm)
    
    return {
        'statusCode': 200,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': recomm
    }
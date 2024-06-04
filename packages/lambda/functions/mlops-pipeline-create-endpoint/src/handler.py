import os
import json
from ssl import Options
import boto3

ssm = boto3.client('ssm')
sm_client = boto3.client("sagemaker")

# 참고 : 모델 패키지 승인 이벤트 및 SageMaker Endpoint 생성 방법
# event : https://docs.aws.amazon.com/sagemaker/latest/dg/automating-sagemaker-with-eventbridge.html#eventbridge-model-package
# code ref : https://docs.aws.amazon.com/ko_kr/sagemaker/latest/dg/neo-deployment-hosting-services-boto3.html

def handle(event, context):
    print('\nevent====>', json.dumps(event))

    # 모델 정보 가져오기
    mkdel_pkg_grp= event['detail']['ModelPackageGroupName']
    mkdel_pkg_ver= event['detail']['ModelPackageVersion']  

    # 컨테이너 정보 가져오기
    primary_container_image = event['detail']['InferenceSpecification']['Containers'][0]['Image']
    model_data_url = event['detail']['InferenceSpecification']['Containers'][0]['ModelDataUrl']
    instance_type = event['detail']['InferenceSpecification']['SupportedRealtimeInferenceInstanceTypes'][0]

    # SageMaker 실행 역할
    exec_role_arn = os.environ['SAGEMAKER_EXEC_ROLE']

    # 엔드포인트 이름 구성
    model_name = f'{mkdel_pkg_grp}-v{mkdel_pkg_ver}'
    endpoint_config_name = f'{mkdel_pkg_grp}-v{mkdel_pkg_ver}-cfg'
    endpoint_name = f'{mkdel_pkg_grp}-endpoint'

    print('mkdel_pkg_grp : ',mkdel_pkg_grp)
    print('mkdel_pkg_ver : ',mkdel_pkg_ver)
    print('primary_container_image : ',primary_container_image)
    print('model_data_url : ',model_data_url)

    # 1. 배포 모델 생성
    create_model_api_response = sm_client.create_model(
        ModelName= model_name,
        PrimaryContainer={
            'Image': primary_container_image,
            'ModelDataUrl': model_data_url,
        },
        ExecutionRoleArn=exec_role_arn
    )
    print(create_model_api_response)

    # 2. 엔드포인트 설정
    existing_configs = sm_client.list_endpoint_configs(NameContains=endpoint_config_name)['EndpointConfigs']
    print(existing_configs)

    if not existing_configs:    
        create_endpoint_config_response = sm_client.create_endpoint_config(
            EndpointConfigName=endpoint_config_name,
            ProductionVariants=[
                {
                    "InstanceType": instance_type,
                    "InitialVariantWeight": 1,
                    "InitialInstanceCount": 1,
                    "ModelName": model_name,
                    "VariantName": "AllTraffic",
                }
            ],
        )
        print(create_endpoint_config_response)
        print("endpoint configuration created")
    else: 
        print("endpoint configuration exists. skip to create.")
    
    # 3. 엔드포인트 생성
    # model update : https://docs.aws.amazon.com/ko_kr/sagemaker/latest/dg/deployment-guardrails.html
    try:
        update_endpoint_response = sm_client.update_endpoint(
            EndpointName=endpoint_name, 
            EndpointConfigName=endpoint_config_name
        )
        print(update_endpoint_response)
        print(f'UPDATE :: endpoint "{endpoint_name}" update')
    except Exception as e:
        try:
            create_endpoint_response= sm_client.create_endpoint(
                EndpointName=endpoint_name,
                EndpointConfigName=endpoint_config_name
            )
            print(create_endpoint_response)
            print(f'CREATE :: endpoint "{endpoint_name}" create')
        except Exception as e:
            print(f'ERROR: cannot create/update endpoint "{endpoint_name}"')
            print(e) 

    return {
        'statusCode': 200,
        'body': 'OK'
    }
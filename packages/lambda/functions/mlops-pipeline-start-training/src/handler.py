import boto3
import json
s3 = boto3.client('s3')
sagemaker = boto3.client('sagemaker')

def handle(event, context):
    print('\nevent====>', json.dumps(event))

    # 변경된 pipeline manifest 파일 정보
    bucket_name = event['Records'][0]['s3']['bucket']['name']
    obj_key = event['Records'][0]['s3']['object']['key']
    print(f'\nevent source====>{bucket_name}/{obj_key}')

    # 실행할 pipeline manifest 파일 정보 가져오기
    _res = s3.get_object(Bucket=bucket_name, Key=obj_key)
    _body = _res['Body'].read().decode("utf-8")
    data = json.loads(_body)
    print(f'\npipeline execution data===>{_body}')

    # sagemaker pipeline 실행하기
    _exec_res = sagemaker.start_pipeline_execution(**data)
    print(f'\npipeline execution result===>{_exec_res}')
    
    return {
        'statusCode': _exec_res['ResponseMetadata']['HTTPStatusCode'],
        'body': json.dumps(_exec_res)
    }
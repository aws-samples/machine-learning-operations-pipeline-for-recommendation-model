# coding: utf-8
import os
import tarfile
import json
import boto3
import botocore


def handle(event, context):
    ###################################
    # 입력 변수 저장
    ###################################
    output_path = event["output_path"]
    metric_file = event["metric_file"]
    model_package_group = event["model_package_group"]

    print("Display Input Arguments:\n")
    print("output_path: \n", output_path)
    print("metric_file: \n", metric_file)        


    ####################################
    ## 기본 폴더 이하의 파일 폴더 구조 확인 하기
    ####################################    
    base_dir = '/tmp'

    show_files_folder("\n###### Display Current Folder: ", base_dir)


    ####################################
    ## 다운로드 output file
    ####################################   
    output_file = f"{output_path}/output.tar.gz"
    os.makedirs(base_dir, exist_ok=True)

    output_download_path = download_s3_object(base_dir, output_file)

    logTitle = "\n### Downloading output.tar.gz"
    show_files_folder(logTitle, base_dir)
    
    ####################################
    ## output file의 압축 해제
    ####################################    
    temp_dir = f"{base_dir}/temp"
    os.makedirs(temp_dir, exist_ok=True)
    
    with tarfile.open(output_download_path) as tar:
        tar.extractall(path= temp_dir)
    
    logTitle = "\n### Folder Status After untaring output artifact "
    show_files_folder(logTitle, temp_dir)    

    ####################################
    ## metric file  조회
    ####################################
    metric_file_name = f"{temp_dir}/metrics.json"
    with open(metric_file_name, 'r') as f:
        metric_data = json.load(f)
    print("Metric Data")
    print(metric_data)
    
    ####################################
    ## Uplaod final metrics.json
    ####################################    
    s3_metric_url = upload_s3_object_url(output_path, metric_file_name)

    ####################################
    ## Log CloudWatch Metrics
    ####################################
    cloudwatch = boto3.client('cloudwatch')
    
    # Hit Ratio
    cloudwatch.put_metric_data(
        MetricData = [
            {
                'MetricName': 'HR',
                'Unit': 'None',
                'Dimensions': [
                    {
                        'Name': 'ModelPackageGroup',
                        'Value': model_package_group
                    },
                ],
                'Value': metric_data["recommendation_metrics"]["validation:best_hr"]["value"]
            },
        ],
        Namespace=f'/MLOps/Recommendation/ValidationBestMetrics'
    )
    # NDCG
    cloudwatch.put_metric_data(
        MetricData = [
            {
                'MetricName': 'NDCG',
                'Unit': 'None',
                'Dimensions': [
                    {
                        'Name': 'ModelPackageGroup',
                        'Value': model_package_group
                    },
                ],
                'Value': metric_data["recommendation_metrics"]["validation:best_ndcg"]["value"]
            },
        ],
        Namespace=f'/MLOps/Recommendation/ValidationBestMetrics'
    )

    return_msg = {
        "statusCode": 200,
        "body": f"Uploading is Done : {s3_metric_url}",
        "S3_Metric_URI": s3_metric_url,
    }
    print(return_msg)    

    return return_msg



def create_tar_dir(path, target_file_name):
    '''
    path = 'code_pkg'
    target_file_name = 'model.tar.gz'
    create_tar_dir(path, target_file_name)
    '''
    tar = tarfile.open(target_file_name, 'w:gz')
   
    for i, (root, dirs, files) in enumerate(os.walk(path)):
        # 현재 폴더에 code 폴더, XXX.pth 일 경우
        if (len(files) > 0) & (len(dirs) > 0) :
            print("i:", i, root)
            print("dirs: ", dirs)
            print("files: ", files)            
            print("root: ", root)
            
            for file_name in files:
                tar.add(os.path.join(root, file_name), file_name)
                print("i: ",i,  " Adding file_name : ",file_name)                
        # code 폴더 처리
        else:
            print("i:", i)
            print("dirs: ", dirs)
            print("files: ", files)            
            print("root: ", root)
            subfolder = root.split("/")[-1]
            print("subfolder: ", subfolder)
            for file_name in files:
                tar.add(os.path.join(root, file_name), f"{subfolder}/{file_name}")
                print("i: ",i,  "Adding file_name : ",file_name)                

    tar.close()
    
    return None


def upload_s3_object(bucket, prefix, file_path):
    '''
    upload model file
    '''    
    file_name = file_path.split("/")[-1]
    Target = f"s3://{bucket}/{prefix}/{file_name}"
    key = f"{prefix}/{file_name}"
    
    s3 = boto3.resource('s3')

    print("##### Target: ", Target)        
    

    try:
        s3.Bucket(bucket).upload_file(
            file_path,
            key)
            
        return Target
        
    except botocore.exceptions.ClientError as e:
        if e.response['Error']['Code'] == "404":
            print("The object does not exist.")
        else:
            raise

def upload_s3_object_url(target_url, local_file_path):
    tokens = target_url.split('/')
    BUCKET_NAME = tokens[2]

    new_delimiter = BUCKET_NAME + '/'
    tokens = target_url.split(new_delimiter)     
    KEY_PREFIX = tokens[-1]

    return upload_s3_object(BUCKET_NAME, KEY_PREFIX, local_file_path)


def download_s3_object(destination, s3_url):
    '''
    Parsing s3_url and download_file
    '''    
    # s3_Uri parsing to bucket , key, file name
    tokens = s3_url.split('/')
    
    # print("####### tokens: ", tokens)
    
    BUCKET_NAME = tokens[2]
    file_name = tokens[-1]
    
    new_delimiter = BUCKET_NAME + '/'
    tokens = s3_url.split(new_delimiter)    
    # print("####### tokens: ", tokens)    
    
    KEY = tokens[-1]
     
    Target = f"{destination}/{file_name}"
    
    s3 = boto3.resource('s3')
    
    try:
        s3.Bucket(BUCKET_NAME).download_file(KEY, Target)
        return Target
        
    except botocore.exceptions.ClientError as e:
        if e.response['Error']['Code'] == "404":
            print("The object does not exist.")
        else:
            raise


def show_files_folder(logTitle, folder):
    # Traverse all files
    print(logTitle)
    for file in os.walk(folder):
        # logger.info(f"{file}")
        print(f"{file}")        

    return None
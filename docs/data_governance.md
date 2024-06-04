# Standardize Repositories and Data Structure

## 1. DevOps - scaffolding
* \<packages> : Project sources
    * \<infra>
        * \<config>
        * \<src>
            * \<config>
            * \<devops>
            * \<stacks>
            * main.ts
    * \<lambda>
        * \<function>
            * \<func_1>
                * <\src>
                    * handler.py
            * \<func_2>
* \<notebooks> : Sample MLOps pipeline notebooks
    * \<ml-project-1> 
* .projenrc.ts : Manage project template


## 2. \<Git source code> ML project  scaffolding

* \<data> : Sample data(small set)
    * \<sample1>
* \<notebooks> : Notebook files to experiment and analyze data
    * xxxxxx.ipynb
* \<mlpipelines> : MLOps pipelines
    * \<pipeline_name_1>
        * training_pipeline.ipynb : build SageMaker Pipeline
        * pipeline_config.json : manifest file of this pipeline
        * \<code_pkg> : temporary directory to deploy code
        * \<src_ver_1> : trainig/inference source code
            * train.py
            * inference.py
            * requirements.txt
            * model_config.json
        * \<src_ver_2>
            * ...
    * \<pipeline_name_2>
        * ...



#### 2.1 pipeline-config.json
```javascript
// sample
{
    "PipelineName" : "<training_pipeline_name>",
    "PipelineParameters" : [
        { 
            "Name": "InputData", 
            "Value": "s3://<your-mlops-data-bucket-name>/data/ncf-sample"
        },
        { 
            "Name": "TrainCode", 
            "Value": "s3://<your-mlops-code-bucket-name>/code/ncf-sample/source.tar.gz"
        },
        { 
            "Name": "ModelApprovalStatus", 
            "Value": "PendingManualApproval"
        },
    ]
}
```

#### 2.2 model-config.json
```javascript
// Sample
{
    "user_num": "6040",
    "item_num": "3706",
    "factor_num": "32",
    "num_layers": "3",
    "dropout": "0.0",
    "model_type": "NeuMF-end"
}
```


## 3. \<S3 Bucket> Data Structure

* \<data> : Data for training job
    * \<data_ver_1>
* \<code> : training/inference source codes
    * \<pipeline_name_1>
        * source.tar.gz
    * \<pipeline_name_2>
        * source.tar.gz
* \<model> : result of training job. the compressed file contains only training job output(```model.pth```)
    * \<pipeline_name_1>
        * \<pipeline_job_execution_id_1>
            * output
                * model.tar.gz
            * debug-output
        * \<pipeline_job_execution_id_2>
            * ...
    * \<pipeline_name_2>
* \<repackage> : packaged file to build Sagemaker Inference Toolkit. the ```model.pth``` and ```inderence.py`` files are compressed in single file.
    * \<pipeline_name_1>
        * \<YYYY-MM-DD-HH-mm-ss>
            * model.tar.gz
        * \<YYYY-MM-DD-HH-mm-ss>
            * model.tar.gz


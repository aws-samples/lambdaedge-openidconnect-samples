# Deploy this Solution

**Please note the Pre-requisites on the landing page before continuing forward!**

## 1. Set up the following environment variables in your environment:

Please export the following variables before running the steps below:
- `SAM_DEPLOYMENT_BUCKET` = this is an **existing** AWS S3 bucket in the same region for SAM artifacts to be staged in
- `NEW_LOG_BUCKET_NAME` = the name of the **new** AWS S3 Bucket to create for logging and auditing
- `NEW_STATIC_SITE_BUCKET_NAME` = the name of the **new** AWS S3 Bucket to store all static content to be served up by the Amazon CloudFront Distribution
- `SECRETS_MANAGER_KEY_ARN` = the ARN of the AWS Secrets Manager Key created for storing relevant OIDC Application Information. This is the Secrets Manager Secret ARN copied from the prior step.

### Example Export of Environment Variables

**NOTE: Replace the corresponding 

**Mac/Linux/Unix:**

```sh
export SAM_DEPLOYMENT_BUCKET=my-bucket-name
export NEW_LOG_BUCKET_NAME=my-new-logging-bucket
export NEW_STATIC_SITE_BUCKET_NAME=my-new-static-content-bucket
export SECRETS_MANAGER_KEY_ARN=arn:aws:secretsmanager:us-east-1:012345678910:secret:secretName
```

**Windows:**

```cmd
set SAM_DEPLOYMENT_BUCKET=my-bucket-name
set NEW_LOG_BUCKET_NAME=my-new-logging-bucket
set NEW_STATIC_SITE_BUCKET_NAME=my-new-static-content-bucket
set SECRETS_MANAGER_KEY_ARN=arn:aws:secretsmanager:us-east-1:012345678910:secret:secretName
```

## 2. AWS SAM Deployment Commands
  a. Build lambda function, and prepare them for subsequent steps in the workflow
  
```sh
sam build -b ./build -s . -t template.yaml -u
```

  b. Packages the above LambdaFunction. It creates a ZIP file of the code and dependencies, and uploads it to Amazon S3 (please create the S3 bucket and mention the bucket name in the command below). It then returns a copy of AWS SAM template, replacing references to local artifacts with the Amazon S3 location where the command uploaded the artifacts

  ```sh
sam package \
    --template-file build/template.yaml \
    --s3-bucket ${SAM_DEPLOYMENT_BUCKET} \
    --output-template-file build/packaged.yaml
```

  c. Deploy Lambda functions through AWS CloudFormation from the S3 bucket created above. AWS SAM CLI now creates and manages this Amazon S3 bucket for you.

  ```sh
sam deploy \
    --template-file build/packaged.yaml \
    --stack-name oidc-auth \
    --capabilities CAPABILITY_NAMED_IAM \
	--parameter-overrides BucketName=${NEW_STATIC_SITE_BUCKET_NAME} LogBucketName=${NEW_LOG_BUCKET_NAME} SecretKeyArn=${SECRETS_MANAGER_KEY_ARN}
```

### Next Step

Navigate to [Set up Registered OIDC Application](registerapplication.md) for the next step.

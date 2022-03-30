# Amazon CloudFront and Lambda@Edge OIDC Function

## Purpose

Create a globally-distributed Amazon CloudFront Distribution (CDN) that will securely serve-up static files from an Amazon S3 Bucket using OpenID Connect. The purpose of this repository is to allow organizations or users to integrate with their preferred OpenID Connect compliant Identity Provider (IdP). 

## Request Flow

![request_flow](images/request_flow.png)

1. User requests content from Amazon CloudFront Distribution
2. AWS Lambda@Edge Viewer Request invoked
	1. If valid authentication cookie present in header, redirect to Amazon S3 Bucket.
	2. If no authentication cookie is present or expired/invalid cookie header is present, continue to step 3.
3. AWS Lambda@Edge Function redirects request to IdP for Authentication request.
	1. If Authentication challenge fails - deny access and exit.
	2. If Authentication challenge succeeds - continue on.
4. Retrieve object from Amazon S3 bucket and return content to requestor via Amazon CloudFront Distribution. User is happy :)


## Dependencies

- AWS SAM CLI
- AWS Credentials in Environment

### TL;DR

#### This will create the following AWS infrastructure

- S3 Data Bucket
- S3 Logging Bucket
- CloudFront Distribution
- Lambda@Edge Function for OIDC Auth


#### 1. Prerequisites/Assumptions

  Assumption : Secret Manager has the base64 encoded Okta configuration file (sample of the original configuration file is shown below with the dummy values, please replace the dummy values after setting up the values in Okta)

  ```json
{
	"AUTH_REQUEST": {
		"client_id": "${CLIENT_ID_FROM_OKTA}",
		"response_type": "code",
		"scope": "openid email",
		"redirect_uri": "https://${CLOUDFRONT_DIST_URL}/_callback"
	},
	"TOKEN_REQUEST": {
		"client_id": "${CLIENT_ID_FROM_OKTA}",
		"redirect_uri": "https://${CLOUDFRONT_DIST_URL}/_callback",
		"grant_type": "authorization_code",
		"client_secret": "${CLIENT_SECRET_FROM_OKTA}"
	},
	"DISTRIBUTION": "amazon-oai",
	"AUTHN": "OKTA",
	"PRIVATE_KEY": "${PRIVATE_KEY_GOES_HERE}",
	"PUBLIC_KEY": "${PUBLIC_KEY_GOES_HERE}",
	"DISCOVERY_DOCUMENT": "https://${OKTA_DOMAIN_NAME}/.well-known/openid-configuration",
	"SESSION_DURATION": 30,
	"BASE_URL": "https://${OKTA_DOMAIN_NAME}/",
	"CALLBACK_PATH": "/_callback",
	"AUTHZ": "OKTA"
}
```

  Prerequisite: Create a file in `src/js` called okta-key.txt which is the key for the secret manager path pointing to the base 64 encoded file as mentioned above.

#### 1a. SAM Template Parameters

Please export the following variables before running the steps below:
- `SAM_DEPLOYMENT_BUCKET` = this is an **existing** AWS S3 bucket in the same region for SAM artifacts to be staged in
- `NEW_LOG_BUCKET_NAME` = the name of the **new** AWS S3 Bucket to create for logging and auditing
- `NEW_STATIC_SITE_BUCKET_NAME` = the name of the **new** AWS S3 Bucket to store all static content to be served up by the Amazon CloudFront Distribution
- `SECRETS_MANAGER_KEY_NAME` = the name of the AWS Secrets Manager Key created for storing relevant OIDC Application Information


#### 2. Steps to set up the Distribution

  a. Build lambda function, and prepare them for subsequent steps in the workflow
  
      Command: sam build -b ./build -s . -t template.yaml -u

  b. Packages the above LambdaFunction. It creates a ZIP file of the code and dependencies, and uploads it to Amazon S3 (please create the S3 bucket and mention the bucket name in the command below). It then returns a copy of AWS SAM template, replacing references to local artifacts with the Amazon S3 location where the command uploaded the artifacts

      Command: sam package \
                --template-file build/template.yaml \
                --s3-bucket ${SAM_DEPLOYMENT_BUCKET} \
                --output-template-file build/packaged.yaml

  c. Deploy Lambda functions through AWS CloudFormation from the S3 bucket created above. AWS SAM CLI now creates and manages this Amazon S3 bucket for you.

      Command:  sam deploy \
                --template-file build/packaged.yaml \
                --stack-name oidc-auth \
                --capabilities CAPABILITY_NAMED_IAM \
				--parameter-overrides BucketName=${NEW_STATIC_SITE_BUCKET_NAME} LogBucketName=${NEW_LOG_BUCKET_NAME} SecretKeyName=${SECRETS_MANAGER_KEY_NAME}

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

## Contributors

- Matt Noyce
- Viyoma Sachdeva


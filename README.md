# Automate Deployment of Lambda Function

## Purpose

Automate the deployment of CloudFront and Lambda@edge Function

## Dependencies

- AWS SAM CLI
- AWS Credentials in Environment

### TL;DR

#### This will create the following AWS infrastructure

- S3 Bucket
- CloudFront Distribution
- Lambda@Edge Function
- Attaching Lambda@Edge Function to CloudFront for OpenID Connect Flow to Okta.


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

#### 2. Steps to set up the Distribution

  a. Build lambda function, and prepare them for subsequent steps in the workflow
  
      Command: sam build -b ./build -s . -t template.yaml -u

  b. Packages the above LambdaFunction. It creates a ZIP file of the code and dependencies, and uploads it to Amazon S3 (please create the S3 bucket and mention the bucket name in the command below). It then returns a copy of AWS SAM template, replacing references to local artifacts with the Amazon S3 location where the command uploaded the artifacts

      Command: sam package \
                --template-file build/template.yaml \
                --s3-bucket ${YOUR_S3_SAM_BUCKET} \
                --output-template-file build/packaged.yaml

  c. Deploy Lambda functions through AWS CloudFormation from the S3 bucket created above. AWS SAM CLI now creates and manages this Amazon S3 bucket for you.

      Command:  sam deploy \
                --template-file build/packaged.yaml \
                --stack-name oidc-auth \
                --capabilities CAPABILITY_NAMED_IAM \
				--parameter-overrides BucketName=${YOUR_NEW_STATIC_SITE_BUCKET_NAME} LogBucketName=${YOUR_LOG_BUCKET_NAME} SecretKeyName=${YOUR_SECRETS_MANAGER_KEY_NAME}

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

## Contributors

- Matt Noyce
- Viyoma Sachdeva


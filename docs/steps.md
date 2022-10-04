# Steps to Deploy Manually

1. Register a new application with your IdP identified.
2. Create an S3 Bucket for the SAM deployment staging in the same region you are deploying the distribution to.
3. Create a key-value pair secret in AWS Secrets Manager with a placeholder value.
4. Deploy the SAM template to the AWS target account.
5. Capture the Amazon CloudFront Distribution HTTPS Endpoint and store it somewhere to reference.
6. Update your registered Application's callback URL list to include the Amazon CloudFront Distribution URL in the following format: `https://xxxx.cloudfront.net/_callback`.
7. Update the AWS Secrets Manager secret to include the Amazon CloudFront distribution URL in the JSON document and base64 encode it.

## Automation

Generate the configuration by supplying the necessary arguments to generate and base64 encode the JSON document and store it into AWS Secrets Manager.








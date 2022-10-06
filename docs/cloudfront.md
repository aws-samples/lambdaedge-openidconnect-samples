# CloudFront Testing / Troubleshooting

After all configuration and deployments have completed, navigate to the HTTPS Amazon CloudFront endpoint generated from the AWS SAM template. You should be redirected to your IdP to perform Authentication. 

## Troubleshooting


### HTTP 4xx or 5xx Errors

If you encounter an HTTP 4xx or HTTP 5xx error, trying opening up a new browser or browsing in private mode. Sometimes there may be cached configurations that are causing the problems.

### Check IdP Configurations

If there are issues, ensure that all IdP configurations are set up correctly, including the Callback URIs.

### AWS Secrets Manager Configuration

Ensure that the `src/js/sm-key.txt` file is set up with the correct AWS Secrets Manager Secret name. Also, ensure that the Key-Value pair is set up correctly in AWS Secrets Manager including a Base64-encoded value that is the JSON configuration.

### AWS Secrets Manager Customer-Managed KMS Key Policy

If using an AWS Customer-Managed KMS Key, ensure that the Lambda@Edge Function Execution role is in the list of KMS key users.


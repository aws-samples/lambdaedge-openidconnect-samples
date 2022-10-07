# Create OIDC Configuration

In order to use this solution a configuration document must be generated. Here are two ways that this configuration can be generated:

## 1. Use the Configuration CLI

The configuration CLI is a Python3 script that will automate the generation of the Amazon CloudFront Distribution configuration. 

In the [CLI Directory](../cli) there is a CLI utility that will help generate the JSON configuration and then Base64 encode it. This utility will also generated OpenSSL private and public key pairs that are required.

### Example CLI Execution

```sh
python cli.py \
	--client_id client-id \ 
	--client_secret client-secret \
	--cloudfront_host cloudfront-host \
	--idp_domain_name idp-domain-name \
	--idp_name idp
```

This will produce the following two files in the same directory:
1. `cloudfront_config_rendered.json` = this is the rendered configuration file with all of the supplied parameters from the CLI above.
2. `encoded_cloudfront_config_rendered.json` = this is the key-value pair JSON document with the Base64 encoded JSON document from the first file. It is a key-value pair in the format that this should be stored in AWS Secrets Manager.

Copy the encoded value from `encoded_cloudfront_config_rendered.json` and move on to the next step.

## 2. ALTERNATE: Manually Create the Configuration

The decoded JSON configuration document looks like the following:

```json
{
	"AUTH_REQUEST": {
		"client_id": "${CLIENT_ID_FROM_IDP}",
		"response_type": "code",
		"scope": "openid email",
		"redirect_uri": "https://${CLOUDFRONT_DIST_URL}/_callback"
	},
	"TOKEN_REQUEST": {
		"client_id": "${CLIENT_ID_FROM_IDP}",
		"redirect_uri": "https://${CLOUDFRONT_DIST_URL}/_callback",
		"grant_type": "authorization_code",
		"client_secret": "${CLIENT_SECRET_FROM_OKTA}"
	},
	"DISTRIBUTION": "amazon-oai",
	"AUTHN": "OKTA",
	"PRIVATE_KEY": "${PRIVATE_KEY_GOES_HERE}",
	"PUBLIC_KEY": "${PUBLIC_KEY_GOES_HERE}",
	"DISCOVERY_DOCUMENT": "https://${IDP_DOMAIN_NAME}/.well-known/openid-configuration",
	"SESSION_DURATION": 30,
	"BASE_URL": "https://${IDP_DOMAIN_NAME}/",
	"CALLBACK_PATH": "/_callback",
	"AUTHZ": "OKTA"
}
```

In each of the sections above, notice there are key-value pairs. The values that contain `${}` must be filled-in and replaced accordingly. 

### Document Arguments

- `CLIENT_ID_FROM_IDP` = This is the Client ID generated from the registered application from the IdP.
- `CLOUDFRONT_DIST_URL` = This is the Amazon CloudFront Distribution hostname for the distribution created. This will be in the form of `xyz.cloudfront.net`.
- `PRIVATE_KEY_GOES_HERE` = This is a private key that is generated using a tool such as `openssl`. See the example below for the formatting.
- `PUBLIC_KEY_GOES_HERE` = This is a public key that is generated using a tool such as `openssl`. See the example below for the formatting.
- `IDP_DOMAIN_NAME` = This is the generated host name from the IdP you have selected. An example would be `dev-xyz-okta.com`.

### Generate 

### Example Document Manually Created

For an example, the manually-created example document would look like the following:


```json
{
	"AUTH_REQUEST": {
		"client_id": "abcdefghijklmnop",
		"response_type": "code",
		"scope": "openid email",
		"redirect_uri": "https://xyz.cloudfront.net/_callback"
	},
	"TOKEN_REQUEST": {
		"client_id": "abcdefghijklmnop",
		"redirect_uri": "https://xyz.cloudfront.net/_callback",
		"grant_type": "authorization_code",
		"client_secret": "secretvalue"
	},
	"DISTRIBUTION": "amazon-oai",
	"AUTHN": "IDP",
	"PRIVATE_KEY": "-----BEGIN RSA PRIVATE KEY-----\nMIIJKQIBAAKCAgEAn9XzZ+C...xzU\n-----END RSA PRIVATE KEY-----\n",
	"PUBLIC_KEY": "----BEGIN PUBLIC KEY-----\nMIICIjANBg...AAQ==\n-----END PUBLIC KEY-----\n",
	"DISCOVERY_DOCUMENT": "https://idp-generated-hostname/.well-known/openid-configuration",
	"SESSION_DURATION": 30,
	"BASE_URL": "https://idp-generated-hostname/",
	"CALLBACK_PATH": "/_callback",
	"AUTHZ": "IDP"
}
```
### Base64 Encode the Configuration

1. Store this JSON document to a file called `configuration.json`. 
2. Run the following command:
```sh
openssl base64 -in configuration.json -out configuration-encoded.json
```
3. Copy the contents of `configuration-encoded.json` and move on to the next step of updating the AWS Secrets Manager OIDC Secret.


### Next Step

Navigate to [Update AWS Secrets Manager](secretsmanager.md) for the next step.

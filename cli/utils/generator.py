import json
import base64

configuration = {
    "AUTH_REQUEST": {
	    "client_id": "$CLIENT_ID_FROM_IDP",
	    "response_type": "code",
	    "scope": "openid email",
	    "redirect_uri": "https://$CLOUDFRONT_DIST_URL/_callback"
	},
	"TOKEN_REQUEST": {
		"client_id": "$CLIENT_ID_FROM_IDP",
		"redirect_uri": "https://$CLOUDFRONT_DIST_URL/_callback",
		"grant_type": "authorization_code",
		"client_secret": "$CLIENT_SECRET_FROM_IDP"
	},
	"DISTRIBUTION": "amazon-oai",
	"AUTHN": "$IDP_NAME",
	"PRIVATE_KEY": "$PRIVATE_KEY_GOES_HERE",
	"PUBLIC_KEY": "$PUBLIC_KEY_GOES_HERE",
	"DISCOVERY_DOCUMENT": "https://$IDP_DOMAIN_NAME/.well-known/openid-configuration",
	"SESSION_DURATION": 30,
	"BASE_URL": "https://$IDP_DOMAIN_NAME/",
	"CALLBACK_PATH": "/_callback",
	"AUTHZ": "$IDP_NAME"
}

def scaffold_base_config_file():
    """
    Scaffolds out config file.

    Returns:
        config (file) = a base config file written to disk.
    """

    with open('cloudfront_config.json', 'w') as file:
        file.write(
            json.dumps(
                configuration,
                indent = 4
            )
        )

def generate_rendered_config_file(
    client_id: str,
    client_secret: str,
    cloudfront_host: str,
    idp_domain_name: str,
    openssl_private_key: str,
    openssl_public_key: str,
    idp_name="idp"
):
    """
    Generates full configuration file with real values.

    Returns:
        config (file) = rendered configuration file.
    """

    base_config = configuration

    base_config['AUTH_REQUEST']['client_id'] = client_id
    base_config['AUTH_REQUEST']['redirect_uri'] = f"https://{cloudfront_host}/_callback"
    base_config['TOKEN_REQUEST']['client_id'] = client_id
    base_config['TOKEN_REQUEST']['client_secret'] = client_secret
    base_config['TOKEN_REQUEST']['redirect_uri'] = f"https://{cloudfront_host}/_callback"
    base_config['AUTHN'] = idp_name
    base_config['AUTHZ'] = idp_name
    base_config['PRIVATE_KEY'] = openssl_private_key
    base_config['PUBLIC_KEY'] = openssl_public_key

    if idp_name.lower() == 'cognito':
        base_config['DISCOVERY_DOCUMENT'] = f"https://cognito-idp.us-east-1.amazonaws.com/userPoolId/.well-known/openid-configuration"
    else:
        base_config['DISCOVERY_DOCUMENT'] = f"https://{idp_domain_name}/.well-known/openid-configuration",
    
    base_config['BASE_URL'] = f"https://{idp_domain_name}/"

    with open('cloudfront_config_rendered.json', 'w') as file:
        file.write(
            json.dumps(
                configuration,
                indent = 4
            )
        )

def base_64_encode_config(
    config_file
):
    with open(config_file, 'r') as file:
        config_contents = file.read()
        config_bytes = config_contents.encode()
        file.close()
    
    with open(f"encoded_{config_file}", 'w') as file:
        encoded_config = base64.b64encode(config_bytes).decode('ASCII')
        file.write(
            json.dumps({
                "config": encoded_config
            }, indent = 4)
        )

generate_rendered_config_file(
    client_id='test_client_id',
    client_secret='test_client_secret',
    cloudfront_host='cloudfront-host',
    idp_domain_name='idp-domain',
    openssl_private_key='privatekey',
    openssl_public_key='publickey'
)

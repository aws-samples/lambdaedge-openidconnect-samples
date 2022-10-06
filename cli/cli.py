import json
import click
import base64
from utils import keys
from utils import generator

"""
client_id: str,
    client_secret: str,
    cloudfront_host: str,
    idp_domain_name: str,
    openssl_private_key: str,
    openssl_public_key: str,
    idp_name="idp"
"""

@click.command()
@click.option('--client_id', help='The Registered Application Client ID')
@click.option('--client_secret', help='The Registered Application Client Secret')
@click.option('--cloudfront_host', help='The hostname of the Amazon CloudFront distribution')
@click.option('--idp_domain_name', help='The hostname for the IdP')
@click.option('--idp_name', default='idp', help='The type of the IdP - e.g. cognito')
def generate_configuration(
    client_id: str,
    client_secret: str,
    cloudfront_host: str,
    idp_domain_name: str,
    idp_name="idp"
):
    # generate public/private key pair
    key_pair = keys.generate_keys()

    # extract public and private keys individually
    public_key = key_pair['PUBLIC_KEY']
    private_key = key_pair['PRIVATE_KEY']

    generator.generate_rendered_config_file(
        client_id=client_id,
        client_secret=client_secret,
        cloudfront_host=cloudfront_host,
        idp_domain_name=idp_domain_name,
        openssl_private_key=private_key,
        openssl_public_key=public_key,
        idp_name=idp_name
    )

    generator.base_64_encode_config(
        config_file='cloudfront_config_rendered.json'
    )

if __name__ == '__main__':
    generate_configuration()

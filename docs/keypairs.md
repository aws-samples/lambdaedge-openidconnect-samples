# Generate Public and Private Key Pairs

This solution requires public and private key pairs to be generated.
There are a couple of ways to generate these keys.

## OpenSSL

The first mechanism to generate the key pair is to use [OpenSSL](https://www.openssl.org/). Once you have setup OpenSSL, run the following commands:

```sh
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -outform PEM -pubout -out public.pem
```

This will output two files:
1. `private.pem` = this is the private key.
2. `public.pem` = this is the public key.

## Configuration CLI

The Configuration CLI found in the [CLI Directory](../cli/) will generate the private and public key pairs and append it to the configuration file for you.

## Programmatic Libraries

There are a suite of programming languages and supporting libraries that will also be able to generate these key pairs. Search for OpenSSL libraries to generate the public and private key pairs.
# Register OIDC Application

In order to move forward, please register a new application with the Identity Provider (IdP) of your choice. Please see the following instructions for some common IdP's. Your IdP should have instructions on how to set up and register an application with them.

- [Amazon Cognito Application Registration](cognito.md)
- [Okta Application Registration](okta.md)
- [Keycloak Client Creation and Registration](keycloak.md)

## Important!
Take note of the `Client ID` and `Client Secret` (Optional) values that are generated after this registration process.
Also, ensure that you have added the correct `Callback URIs` to the registered Application. It should include the Amazon CloudFront distribution URL with `/_callback` appended.

### Next Step

Navigate to [Generate OIDC Configuration](configuration.md) for the next step.

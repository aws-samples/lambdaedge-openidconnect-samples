// eslint-disable-next-line import/no-extraneous-dependencies
// Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const AWS = require('aws-sdk');
const Axios = require('axios');
const Cookie = require('cookie');
const Crypto = require('crypto');
const JsonWebToken = require('jsonwebtoken');
const JwkToPem = require('jwk-to-pem');
const QueryString = require('querystring');
const fs = require('fs');
const Log = require('./lib/log');

let discoveryDocument;
let secretId;
let jwks;
let config;
let deps;
let log;

/**
 * handle is the starting point for the lambda.
 *
 * @param {Object} event is the event that initiates the handler
 * @param {AWS.Context} ctx is the aws lambda context
 * @param {(Error, any) => undefined} cb is the aws callback to signal completion.  This is used
 * instead of the async method because it has more predictable behavior.
 * @param {object} setDependencies is a function that sets the dependencies  If this is undefined
 * (as it will be in production) the setDependencies function in the module will set the
 * dependencies.  If this value is specified (as it will be in tests) then deps will be
 * overwritten with the specified dependencies.
 */
exports.handle = async (event, ctx, cb, setDeps = setDependencies) => {
	log = new Log(event, ctx);
	// log.info('init lambda', { event: event });
	deps = setDeps(deps);
	try {
		await prepareConfigGlobals();
		return await authenticate(event);
	} catch (err) {
		log.error(err.message, { event: event }, err);
		return getInternalServerErrorPayload(cb);
	}
};

// setDepedencies is used to allow the overwriting of module-level dependencies for the purpose of
// testing.  It's basically dependency injection.
function setDependencies(dependencies) {
	if (dependencies === undefined || dependencies === null) {
		// log.info('setting up dependencies');
		return {
			axios: Axios,
			sm: new AWS.SecretsManager({ apiVersion: '2017-10-17', region: 'us-east-1' })
		};
	}
	return dependencies;
}

// authenticate authenticates the user if they are a valid user, otherwise redirects accordingly.
async function authenticate(evt) {
	const { request } = evt.Records[0].cf;
	const { headers, querystring } = request;
	const queryString = QueryString.parse(querystring);
	log.info(config.CALLBACK_PATH);
	log.info(request.uri);
	if (request.uri.startsWith(config.CALLBACK_PATH)) {
		// log.info('callback from OIDC provider received');
		if (queryString.error) {
			return handleInvalidQueryString(queryString);
		}
		log.info(queryString.code);
		if (queryString.code === undefined || queryString.code === null) {
			return getUnauthorizedPayload('No Code Found', '', '');
		}
		return getNewJwtResponse({ evt, request, queryString, headers });
	}
	if ('cookie' in headers && 'TOKEN' in Cookie.parse(headers.cookie[0].value)) {
		return getVerifyJwtResponse(request, headers);
	} // log.info('redirecting to OIDC provider');
	return getOidcRedirectPayload(request, headers);
}

// getVerifyJwtResponse gets the appropriate response for verified Jwt.
async function getVerifyJwtResponse(request, headers) {
	// log.info('request received with TOKEN cookie', { request, headers });
	try {
		// log.info('verifying JWT Response');
		await verifyJwt(Cookie.parse(headers.cookie[0].value).TOKEN, config.PUBLIC_KEY.trim(), {
			algorithms: ['RS256']
		}); // log.info('verified JWT Response');
		return request;
	} catch (err) {
		switch (err.name) {
			case 'TokenExpiredError':
				log.warn('token expired, redirecting to OIDC provider', undefined, err);
				return getOidcRedirectPayload(request, headers);
			case 'JsonWebTokenError':
				log.warn('jwt error, unauthorized', undefined, err);
				return getUnauthorizedPayload('Json Web Token Error', err.message, '');
			default:
				log.warn('unknown JWT error, unauthorized', undefined, err);
				return getUnauthorizedPayload('Unauthorized.', `User is not permitted`, '');
		}
	}
}

// getNewJwtResponse returns the response required to redirect and get a new Jwt.
async function getNewJwtResponse({ evt, request, queryString, headers }) {
	try {
		config.TOKEN_REQUEST.code = queryString.code; // log.info('details', { config, queryString });
		const { idToken, decodedToken } = await getIdAndDecodedToken(); // log.info('searching for JWK from discovery document', { jwks, decodedToken, idToken });
		const rawPem = jwks.keys.filter((k) => k.kid === decodedToken.header.kid)[0];
		if (rawPem === undefined) {
			throw new Error('unable to find expected pem in jwks keys');
		}
		const pem = JwkToPem(rawPem); // log.info('verifying JWT', { rawPem, pem });
		try {
			const decoded = await verifyJwt(idToken, pem, { algorithms: ['RS256'] }); // log.info('decoded Jwt', { decoded });
			if (
				'cookie' in headers &&
				'NONCE' in Cookie.parse(headers.cookie[0].value) &&
				validateNonce(decoded.nonce, Cookie.parse(headers.cookie[0].value).NONCE)
			) {
				return getRedirectPayload({ evt, queryString, decodedToken, headers });
			}
			return getUnauthorizedPayload('Nonce Verification Failed', '', '');
		} catch (err) {
			if (err === undefined || err === null || err.name === undefined || err.name === null) {
				log.warn('unknown named JWT error, unauthorized.', undefined, err);
				return getUnauthorizedPayload(
					'Unknown JWT',
					`User ${decodedToken.payload.email || 'user'} is not permitted`,
					''
				);
			}
			switch (err.name) {
				case 'TokenExpiredError':
					log.warn('token expired, redirecting to OIDC provider', undefined, err);
					return getOidcRedirectPayload(request, headers);
				case 'JsonWebTokenError':
					log.warn('jwt error, unauthorized', undefined, err);
					return getUnauthorizedPayload('Json Web Token Error', err.message, '');
				default:
					log.warn('unknown JWT error, unauthorized', undefined, err);
					return getUnauthorizedPayload(
						'Unknown JWT',
						`User ${decodedToken.payload.email || 'user'} is not permitted`,
						''
					);
			}
		}
	} catch (error) {
		log.error('internal server error', undefined, error);
		return getInternalServerErrorPayload();
	}
}

// getIdAndDecodedToken gets the id token and decoded version fo the token from the token
// endpoint.
async function getIdAndDecodedToken() {
	const tokenRequest = QueryString.stringify(config.TOKEN_REQUEST); // log.info('requesting access token.', { discoveryDocument, tokenRequest, config });
	const response = await deps.axios.post(discoveryDocument.token_endpoint, tokenRequest); // log.info('response', { response });
	const decodedToken = JsonWebToken.decode(response.data.id_token, {
		complete: true
	}); // log.info('decodedToken', { decodedToken });
	return { idToken: response.data.id_token, decodedToken };
}

// verifyJwt wraps the callback-based JsonWebToken.verify function in a promise.
async function verifyJwt(token, pem, algorithms) {
	return new Promise((resolve, reject) => {
		JsonWebToken.verify(token, pem, algorithms, (err, decoded) => {
			if (err) {
				log.error('verifyJwt failed', { token, pem, algorithms }, err);
				return reject(err);
			}
			return resolve(decoded);
		});
	});
}

// handleInvalidQueryString creates an unauthorized response with the proper formatting when
// a querysting contains an error.
function handleInvalidQueryString(queryString) {
	const errors = {
		invalid_request: 'Invalid Request',
		unauthorized_client: 'Unauthorized Client',
		access_denied: 'Access Denied',
		unsupported_response_type: 'Unsupported Response Type',
		invalid_scope: 'Invalid Scope',
		server_error: 'Server Error',
		temporarily_unavailable: 'Temporarily Unavailable'
	};

	let error = '';
	let errorDescription = '';
	let errorUri = '';

	if (errors[queryString.error] != null) {
		error = errors[queryString.error];
	} else {
		error = queryString.error;
	}
	if (queryString.error_description != null) {
		errorDescription = queryString.error_description;
	} else {
		errorDescription = '';
	}

	if (queryString.error_uri != null) {
		errorUri = queryString.error_uri;
	} else {
		errorUri = '';
	}

	return getUnauthorizedPayload(error, errorDescription, errorUri);
}

// getNonceAndHash gets a nonce and hash.
function getNonceAndHash() {
	const nonce = Crypto.randomBytes(32).toString('hex');
	const hash = Crypto.createHmac('sha256', nonce).digest('hex');
	return { nonce, hash };
}

// validateNonce validates a nonce.
function validateNonce(nonce, hash) {
	const other = Crypto.createHmac('sha256', nonce).digest('hex');
	return other === hash;
}

// fetchConfigFromSecretsManager pulls the specified configuration from SecretsManager
async function fetchConfigFromSecretsManager() {
	// Get Secrets Manager Config Key from File since we cannot use environment variables.
	if (secretId == undefined) {
		try {
			secretId = fs.readFileSync('./okta-key.txt', 'utf-8');
			secretId = secretId.replace(/(\r\n|\n|\r)/gm, '');
		} catch (err) {
			log.error(err);
		}
	} // Attempted to read from CloudFront Custom Header due to Environment variable limitations // Must be an Origin Request, but we need this to be a Viewer Request.
	const secret = await deps.sm.getSecretValue({ SecretId: secretId }).promise(); // eslint-disable-next-line no-buffer-constructor
	const buff = new Buffer(JSON.parse(secret.SecretString).config, 'base64');
	const decodedval = JSON.parse(buff.toString('utf-8'));
	return decodedval;
}

// setConfig sets the config object to the value from SecretsManager if it wasn't already set.
async function setConfig() {
	if (config === undefined) {
		config = await fetchConfigFromSecretsManager();
	}
}

// setDiscoveryDocument sets the discoveryDocument object if it wasn't already set.
async function setDiscoveryDocument() {
	if (discoveryDocument === undefined) {
		discoveryDocument = (await deps.axios.get(config.DISCOVERY_DOCUMENT)).data;
	}
}

// setJwks sets the jwks object if it wasn't already set.
async function setJwks() {
	if (jwks === undefined) {
		if (
			discoveryDocument &&
			(discoveryDocument.jwks_uri === undefined || discoveryDocument.jwks_uri === null)
		) {
			throw new Error('Unable to find JWK in discovery document');
		}
		jwks = (await deps.axios.get(discoveryDocument.jwks_uri)).data;
	}
}

// prepareConfigGlobals sets up all the lambda globals if they are not already set.
async function prepareConfigGlobals() {
	await setConfig();
	await setDiscoveryDocument();
	await setJwks();
}

// getRedirectPayload gets the actual 302 redirect payload
function getRedirectPayload({ evt, queryString, decodedToken, headers }) {
	const response = {
		status: '302',
		statusDescription: 'Found',
		body: 'ID token retrieved.',
		headers: {
			location: [
				{
					key: 'Location',
					value:
						evt.Records[0].cf.config.test !== undefined
							? config.AUTH_REQUEST.redirect_uri + queryString.state
							: queryString.state
				}
			],
			'set-cookie': [
				{
					key: 'Set-Cookie',
					value: Cookie.serialize(
						'TOKEN',
						JsonWebToken.sign({}, config.PRIVATE_KEY.trim(), {
							audience: headers.host[0].value,
							subject: decodedToken.payload.email,
							expiresIn: config.SESSION_DURATION,
							algorithm: 'RS256'
						}),
						{
							path: '/',
							maxAge: config.SESSION_DURATION
						}
					)
				},
				{
					key: 'Set-Cookie',
					value: Cookie.serialize('NONCE', '', {
						path: '/',
						expires: new Date(1970, 1, 1, 0, 0, 0, 0)
					})
				}
			]
		}
	}; // log.info('setting cookie and redirecting', { response });
	return response;
}

// redirect generates an appropriate redirect response.
function getOidcRedirectPayload(request) {
	const { nonce, hash } = getNonceAndHash();
	config.AUTH_REQUEST.nonce = nonce;
	config.AUTH_REQUEST.state = request.uri; // Redirect to Authorization Server

	return {
		status: '302',
		statusDescription: 'Found',
		body: 'Redirecting to OIDC provider',
		headers: {
			location: [
				{
					key: 'Location',
					value: `${discoveryDocument.authorization_endpoint}?${QueryString.stringify(
						config.AUTH_REQUEST
					)}`
				}
			],
			'set-cookie': [
				{
					key: 'Set-Cookie',
					value: Cookie.serialize('TOKEN', '', {
						path: '/',
						expires: new Date(1970, 1, 1, 0, 0, 0, 0)
					})
				},
				{
					key: 'Set-Cookie',
					value: Cookie.serialize('NONCE', hash, {
						path: '/',
						httpOnly: true
					})
				}
			]
		}
	};
}

// getUnauthorizedPayload generates an appropriate unauthorized response.
function getUnauthorizedPayload(error, errorDescription, errorUri) {
	const body = `<!DOCTYPE html>
  <html lang="en">
  <head>
      <!-- Simple HttpErrorPages | MIT License | https://github.com/AndiDittrich/HttpErrorPages -->
      <meta charset="utf-8" /><meta http-equiv="X-UA-Compatible" content="IE=edge" /><meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>We've got some trouble | 401 - Unauthorized</title>
      <style type="text/css">/*! normalize.css v5.0.0 | MIT License | github.com/necolas/normalize.css */html{font-family:sans-serif;line-height:1.15;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%}body{margin:0}article,aside,footer,header,nav,section{display:block}h1{font-size:2em;margin:.67em 0}figcaption,figure,main{display:block}figure{margin:1em 40px}hr{box-sizing:content-box;height:0;overflow:visible}pre{font-family:monospace,monospace;font-size:1em}a{background-color:transparent;-webkit-text-decoration-skip:objects}a:active,a:hover{outline-width:0}abbr[title]{border-bottom:none;text-decoration:underline;text-decoration:underline dotted}b,strong{font-weight:inherit}b,strong{font-weight:bolder}code,kbd,samp{font-family:monospace,monospace;font-size:1em}dfn{font-style:italic}mark{background-color:#ff0;color:#000}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sub{bottom:-.25em}sup{top:-.5em}audio,video{display:inline-block}audio:not([controls]){display:none;height:0}img{border-style:none}svg:not(:root){overflow:hidden}button,input,optgroup,select,textarea{font-family:sans-serif;font-size:100%;line-height:1.15;margin:0}button,input{overflow:visible}button,select{text-transform:none}[type=reset],[type=submit],button,html [type=button]{-webkit-appearance:button}[type=button]::-moz-focus-inner,[type=reset]::-moz-focus-inner,[type=submit]::-moz-focus-inner,button::-moz-focus-inner{border-style:none;padding:0}[type=button]:-moz-focusring,[type=reset]:-moz-focusring,[type=submit]:-moz-focusring,button:-moz-focusring{outline:1px dotted ButtonText}fieldset{border:1px solid silver;margin:0 2px;padding:.35em .625em .75em}legend{box-sizing:border-box;color:inherit;display:table;max-width:100%;padding:0;white-space:normal}progress{display:inline-block;vertical-align:baseline}textarea{overflow:auto}[type=checkbox],[type=radio]{box-sizing:border-box;padding:0}[type=number]::-webkit-inner-spin-button,[type=number]::-webkit-outer-spin-button{height:auto}[type=search]{-webkit-appearance:textfield;outline-offset:-2px}[type=search]::-webkit-search-cancel-button,[type=search]::-webkit-search-decoration{-webkit-appearance:none}::-webkit-file-upload-button{-webkit-appearance:button;font:inherit}details,menu{display:block}summary{display:list-item}canvas{display:inline-block}template{display:none}[hidden]{display:none}/*! Simple HttpErrorPages | MIT X11 License | https://github.com/AndiDittrich/HttpErrorPages */body,html{width:100%;height:100%;background-color:#21232a}body{color:#fff;text-align:center;text-shadow:0 2px 4px rgba(0,0,0,.5);padding:0;min-height:100%;-webkit-box-shadow:inset 0 0 100px rgba(0,0,0,.8);box-shadow:inset 0 0 100px rgba(0,0,0,.8);display:table;font-family:"Open Sans",Arial,sans-serif}h1{font-family:inherit;font-weight:500;line-height:1.1;color:inherit;font-size:36px}h1 small{font-size:68%;font-weight:400;line-height:1;color:#777}a{text-decoration:none;color:#fff;font-size:inherit;border-bottom:dotted 1px #707070}.lead{color:silver;font-size:21px;line-height:1.4}.cover{display:table-cell;vertical-align:middle;padding:0 20px}footer{position:fixed;width:100%;height:40px;left:0;bottom:0;color:#a0a0a0;font-size:14px}</style>
  </head>
  <body>
      <div class="cover"><h1>${error}</h1><small>Error 401</small><p class="lead">${errorDescription}</p><p>${errorUri}</p></div>
      <footer><p><a href="https://github.com/widen/cloudfront-auth">cloudfront-auth</a></p></footer>
  </body>
  </html>
  `;

	return {
		body,
		status: '401',
		statusDescription: 'Unauthorized',
		headers: {
			'set-cookie': [
				{
					key: 'Set-Cookie',
					value: Cookie.serialize('TOKEN', '', {
						path: '/',
						expires: new Date(1970, 1, 1, 0, 0, 0, 0)
					})
				},
				{
					key: 'Set-Cookie',
					value: Cookie.serialize('NONCE', '', {
						path: '/',
						expires: new Date(1970, 1, 1, 0, 0, 0, 0)
					})
				}
			]
		}
	};
}

// getInternalServerErrorPayload returns an appropriate InternalServerError response.
function getInternalServerErrorPayload() {
	const body = `<!DOCTYPE html>
  <html lang="en">
  <head>
      <!-- Simple HttpErrorPages | MIT License | https://github.com/AndiDittrich/HttpErrorPages -->
      <meta charset="utf-8" /><meta http-equiv="X-UA-Compatible" content="IE=edge" /><meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>We've got some trouble | 500 - Internal Server Error</title>
      <style type="text/css">/*! normalize.css v5.0.0 | MIT License | github.com/necolas/normalize.css */html{font-family:sans-serif;line-height:1.15;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%}body{margin:0}article,aside,footer,header,nav,section{display:block}h1{font-size:2em;margin:.67em 0}figcaption,figure,main{display:block}figure{margin:1em 40px}hr{box-sizing:content-box;height:0;overflow:visible}pre{font-family:monospace,monospace;font-size:1em}a{background-color:transparent;-webkit-text-decoration-skip:objects}a:active,a:hover{outline-width:0}abbr[title]{border-bottom:none;text-decoration:underline;text-decoration:underline dotted}b,strong{font-weight:inherit}b,strong{font-weight:bolder}code,kbd,samp{font-family:monospace,monospace;font-size:1em}dfn{font-style:italic}mark{background-color:#ff0;color:#000}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sub{bottom:-.25em}sup{top:-.5em}audio,video{display:inline-block}audio:not([controls]){display:none;height:0}img{border-style:none}svg:not(:root){overflow:hidden}button,input,optgroup,select,textarea{font-family:sans-serif;font-size:100%;line-height:1.15;margin:0}button,input{overflow:visible}button,select{text-transform:none}[type=reset],[type=submit],button,html [type=button]{-webkit-appearance:button}[type=button]::-moz-focus-inner,[type=reset]::-moz-focus-inner,[type=submit]::-moz-focus-inner,button::-moz-focus-inner{border-style:none;padding:0}[type=button]:-moz-focusring,[type=reset]:-moz-focusring,[type=submit]:-moz-focusring,button:-moz-focusring{outline:1px dotted ButtonText}fieldset{border:1px solid silver;margin:0 2px;padding:.35em .625em .75em}legend{box-sizing:border-box;color:inherit;display:table;max-width:100%;padding:0;white-space:normal}progress{display:inline-block;vertical-align:baseline}textarea{overflow:auto}[type=checkbox],[type=radio]{box-sizing:border-box;padding:0}[type=number]::-webkit-inner-spin-button,[type=number]::-webkit-outer-spin-button{height:auto}[type=search]{-webkit-appearance:textfield;outline-offset:-2px}[type=search]::-webkit-search-cancel-button,[type=search]::-webkit-search-decoration{-webkit-appearance:none}::-webkit-file-upload-button{-webkit-appearance:button;font:inherit}details,menu{display:block}summary{display:list-item}canvas{display:inline-block}template{display:none}[hidden]{display:none}/*! Simple HttpErrorPages | MIT X11 License | https://github.com/AndiDittrich/HttpErrorPages */body,html{width:100%;height:100%;background-color:#21232a}body{color:#fff;text-align:center;text-shadow:0 2px 4px rgba(0,0,0,.5);padding:0;min-height:100%;-webkit-box-shadow:inset 0 0 100px rgba(0,0,0,.8);box-shadow:inset 0 0 100px rgba(0,0,0,.8);display:table;font-family:"Open Sans",Arial,sans-serif}h1{font-family:inherit;font-weight:500;line-height:1.1;color:inherit;font-size:36px}h1 small{font-size:68%;font-weight:400;line-height:1;color:#777}a{text-decoration:none;color:#fff;font-size:inherit;border-bottom:dotted 1px #707070}.lead{color:silver;font-size:21px;line-height:1.4}.cover{display:table-cell;vertical-align:middle;padding:0 20px}footer{position:fixed;width:100%;height:40px;left:0;bottom:0;color:#a0a0a0;font-size:14px}</style>
  </head>
  <body>
      <div class="cover"><h1>Internal Server Error <small>Error 500</small></h1></div>
  </body>
  </html>
  `;

	return { status: '500', statusDescription: 'Internal Server Error', body };
}

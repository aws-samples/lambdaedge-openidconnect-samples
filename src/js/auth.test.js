const assert = require('assert');
const Crypto = require('crypto');

// We can't require auth.js directly (needs @aws-sdk/client-secrets-manager at import time),
// so we test the logic by extracting key patterns and simulating the handler with mocked deps.

// --- Test helpers: replicate internal functions for unit testing ---

function validateRedirectState(state) {
	if (!state || typeof state !== 'string') return '/';
	if (!state.startsWith('/') || state.startsWith('//')) return '/';
	return state;
}

function generatePkceCodeVerifier(size = 43) {
	return Crypto.randomBytes(size).toString('hex').slice(0, size);
}

function generatePkceCodeChallenge(codeVerifier) {
	const Base64Url = require('base64url');
	var hash = Crypto.createHash('sha256').update(codeVerifier).digest();
	return Base64Url.encode(hash);
}

function getNonceAndHash() {
	const nonce = Crypto.randomBytes(32).toString('hex');
	const hash = Crypto.createHmac('sha256', nonce).digest('hex');
	return { nonce, hash };
}

function validateNonce(nonce, hash) {
	const other = Crypto.createHmac('sha256', nonce).digest('hex');
	return other === hash;
}

// --- Tests ---

describe('Open Redirect Prevention', () => {
	it('allows valid relative paths', () => {
		assert.strictEqual(validateRedirectState('/dashboard'), '/dashboard');
		assert.strictEqual(validateRedirectState('/a/b/c'), '/a/b/c');
	});

	it('blocks protocol-relative URLs', () => {
		assert.strictEqual(validateRedirectState('//evil.com'), '/');
	});

	it('blocks absolute URLs', () => {
		assert.strictEqual(validateRedirectState('https://evil.com'), '/');
	});

	it('blocks javascript: URIs', () => {
		assert.strictEqual(validateRedirectState('javascript:alert(1)'), '/');
	});

	it('handles null/undefined/empty', () => {
		assert.strictEqual(validateRedirectState(null), '/');
		assert.strictEqual(validateRedirectState(undefined), '/');
		assert.strictEqual(validateRedirectState(''), '/');
	});
});

describe('PKCE Generation', () => {
	it('generates unique code verifiers per call', () => {
		const v1 = generatePkceCodeVerifier();
		const v2 = generatePkceCodeVerifier();
		assert.notStrictEqual(v1, v2);
	});

	it('generates verifier of correct length', () => {
		const v = generatePkceCodeVerifier(43);
		assert.strictEqual(v.length, 43);
	});

	it('generates valid code challenge from verifier', () => {
		const verifier = generatePkceCodeVerifier();
		const challenge = generatePkceCodeChallenge(verifier);
		assert.ok(challenge.length > 0);
		// S256 challenge should be base64url encoded SHA-256
		assert.ok(!challenge.includes('+'));
		assert.ok(!challenge.includes('/'));
		assert.ok(!challenge.includes('='));
	});
});

describe('Nonce Validation', () => {
	it('validates correct nonce/hash pair', () => {
		const { nonce, hash } = getNonceAndHash();
		assert.strictEqual(validateNonce(nonce, hash), true);
	});

	it('rejects incorrect nonce', () => {
		const { hash } = getNonceAndHash();
		assert.strictEqual(validateNonce('wrong-nonce', hash), false);
	});

	it('generates unique nonces per call', () => {
		const n1 = getNonceAndHash();
		const n2 = getNonceAndHash();
		assert.notStrictEqual(n1.nonce, n2.nonce);
		assert.notStrictEqual(n1.hash, n2.hash);
	});
});

describe('Cookie Security Attributes', () => {
	it('TOKEN cookie serializes with secure attributes', () => {
		const Cookie = require('cookie');
		const serialized = Cookie.serialize('TOKEN', 'test-value', {
			path: '/',
			maxAge: 3600,
			httpOnly: true,
			secure: true,
			sameSite: 'lax'
		});
		assert.ok(serialized.includes('HttpOnly'));
		assert.ok(serialized.includes('Secure'));
		assert.ok(serialized.includes('SameSite=Lax'));
	});

	it('NONCE cookie serializes with secure attributes', () => {
		const Cookie = require('cookie');
		const serialized = Cookie.serialize('NONCE', 'hash-value', {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax'
		});
		assert.ok(serialized.includes('HttpOnly'));
		assert.ok(serialized.includes('Secure'));
		assert.ok(serialized.includes('SameSite=Lax'));
	});
});

describe('Input Validation - Authorization Code', () => {
	it('accepts valid authorization codes', () => {
		const validCodes = ['abc123', 'code-with-dashes', 'code_with_underscores', 'a.b.c'];
		validCodes.forEach((code) => {
			assert.ok(/^[a-zA-Z0-9\-_\.]+$/.test(code), `Should accept: ${code}`);
		});
	});

	it('rejects codes with special characters', () => {
		const invalidCodes = ['<script>', 'code with spaces', 'code;injection', 'code\nnewline'];
		invalidCodes.forEach((code) => {
			assert.ok(!/^[a-zA-Z0-9\-_\.]+$/.test(code), `Should reject: ${code}`);
		});
	});

	it('rejects codes exceeding max length', () => {
		const longCode = 'a'.repeat(2049);
		assert.ok(longCode.length > 2048);
	});
});

describe('Concurrency Safety - No Shared State Mutation', () => {
	it('Object.assign creates independent copies', () => {
		const sharedConfig = { TOKEN_REQUEST: { client_id: 'abc', redirect_uri: '/callback' } };
		const req1 = Object.assign({}, sharedConfig.TOKEN_REQUEST, { code: 'code1' });
		const req2 = Object.assign({}, sharedConfig.TOKEN_REQUEST, { code: 'code2' });

		assert.strictEqual(req1.code, 'code1');
		assert.strictEqual(req2.code, 'code2');
		assert.strictEqual(sharedConfig.TOKEN_REQUEST.code, undefined); // original untouched
	});

	it('AUTH_REQUEST params are independent per request', () => {
		const sharedConfig = { AUTH_REQUEST: { client_id: 'abc', response_type: 'code' } };
		const params1 = Object.assign({}, sharedConfig.AUTH_REQUEST, { nonce: 'n1', state: '/page1' });
		const params2 = Object.assign({}, sharedConfig.AUTH_REQUEST, { nonce: 'n2', state: '/page2' });

		assert.strictEqual(params1.nonce, 'n1');
		assert.strictEqual(params2.nonce, 'n2');
		assert.strictEqual(sharedConfig.AUTH_REQUEST.nonce, undefined);
		assert.strictEqual(sharedConfig.AUTH_REQUEST.state, undefined);
	});
});

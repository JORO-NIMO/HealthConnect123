const test = require('node:test');
const assert = require('node:assert');
const { resolveFrontendBaseUrl } = require('../controllers/auth.controller');

test.describe('resolveFrontendBaseUrl', () => {
  let originalFrontendUrl;

  test.before(() => {
    originalFrontendUrl = process.env.FRONTEND_URL;
  });

  test.after(() => {
    // Restore the original FRONTEND_URL env var
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }
  });

  // Helper to construct a mock request object
  const createMockReq = (protocol = 'http', host = 'localhost:5000') => {
    return {
      protocol,
      get: (header) => {
        if (header.toLowerCase() === 'host') {
          return host;
        }
        return null;
      }
    };
  };

  test.it('should fall back to request origin when FRONTEND_URL is undefined', () => {
    delete process.env.FRONTEND_URL;
    const req = createMockReq('https', 'healthconnect.com/');
    const result = resolveFrontendBaseUrl(req);
    assert.strictEqual(result, 'https://healthconnect.com');
  });

  test.it('should fall back to request origin when FRONTEND_URL is empty string', () => {
    process.env.FRONTEND_URL = '';
    const req = createMockReq('http', 'localhost:5000');
    const result = resolveFrontendBaseUrl(req);
    assert.strictEqual(result, 'http://localhost:5000');
  });

  test.it('should fall back to request origin when FRONTEND_URL is whitespace', () => {
    process.env.FRONTEND_URL = '   ';
    const req = createMockReq('https', 'api.test.com');
    const result = resolveFrontendBaseUrl(req);
    assert.strictEqual(result, 'https://api.test.com');
  });

  test.it('should fall back to request origin when FRONTEND_URL is a wildcard "*"', () => {
    process.env.FRONTEND_URL = '*';
    const req = createMockReq('https', 'example.com/');
    const result = resolveFrontendBaseUrl(req);
    assert.strictEqual(result, 'https://example.com');
  });

  test.it('should return FRONTEND_URL without trailing slash when it starts with http://', () => {
    process.env.FRONTEND_URL = 'http://my-front-end.com/';
    const req = createMockReq('https', 'fallback.com');
    const result = resolveFrontendBaseUrl(req);
    assert.strictEqual(result, 'http://my-front-end.com');
  });

  test.it('should return FRONTEND_URL without trailing slash when it starts with https://', () => {
    process.env.FRONTEND_URL = 'https://cool-app.io';
    const req = createMockReq('http', 'fallback.com');
    const result = resolveFrontendBaseUrl(req);
    assert.strictEqual(result, 'https://cool-app.io');
  });

  test.it('should automatically prepend https:// to candidate that does not start with http/https protocol', () => {
    process.env.FRONTEND_URL = 'dashboard.healthconnect.com';
    const req = createMockReq('http', 'fallback.com');
    const result = resolveFrontendBaseUrl(req);
    assert.strictEqual(result, 'https://dashboard.healthconnect.com');
  });

  test.it('should select first valid candidate when FRONTEND_URL is a list of comma-separated origins', () => {
    process.env.FRONTEND_URL = '*, https://app-one.com, http://app-two.com';
    const req = createMockReq('http', 'fallback.com');
    const result = resolveFrontendBaseUrl(req);
    assert.strictEqual(result, 'https://app-one.com');
  });

  test.it('should ignore invalid URL candidates and fall back to the next valid candidate', () => {
    process.env.FRONTEND_URL = 'not a valid url, http://valid-http-app.com';
    const req = createMockReq('http', 'fallback.com');
    const result = resolveFrontendBaseUrl(req);
    assert.strictEqual(result, 'http://valid-http-app.com');
  });

  test.it('should fall back to request origin when all candidates in FRONTEND_URL are invalid', () => {
    process.env.FRONTEND_URL = 'not a valid url, another invalid url';
    const req = createMockReq('https', 'fallback.com');
    const result = resolveFrontendBaseUrl(req);
    assert.strictEqual(result, 'https://fallback.com');
  });
});

#!/usr/bin/env node

/**
 * Endpoint Test Script
 * Tests all API endpoints to ensure they respond correctly
 * Run: node backend/scripts/test-endpoints.js [BASE_URL]
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.argv[2] || 'http://localhost:5000';

// ═══════════════════════════════════════════════════════════════════════════
// TEST DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const tests = [
  // Health checks
  { method: 'GET', path: '/api/health/live', expectedStatus: 200, description: 'Liveness check' },
  { method: 'GET', path: '/api/health/ready', expectedStatus: 200, description: 'Readiness check' },
  { method: 'GET', path: '/api/health/detailed', expectedStatus: [200, 503], description: 'Detailed health check' },
  { method: 'GET', path: '/api/v1/health', expectedStatus: 200, description: 'V1 Health check' },

  // Auth endpoints (should return 400 without body)
  { method: 'POST', path: '/api/v1/auth/register', expectedStatus: [400, 429], description: 'Register (no body)' },
  { method: 'POST', path: '/api/v1/auth/login', expectedStatus: [400, 429], description: 'Login (no body)' },
  { method: 'GET', path: '/api/v1/auth/me', expectedStatus: 401, description: 'Get me (no token)' },

  // Public hospital endpoints
  { method: 'GET', path: '/api/v1/hospitals', expectedStatus: 200, description: 'List hospitals' },
  { method: 'GET', path: '/api/v1/hospitals/nearby?latitude=0.347596&longitude=32.582520', expectedStatus: 200, description: 'Nearby hospitals' },

  // Protected endpoints (should return 401 without token)
  { method: 'GET', path: '/api/v1/patients/me', expectedStatus: 401, description: 'Patient profile (no token)' },
  { method: 'GET', path: '/api/v1/doctors/me', expectedStatus: 401, description: 'Doctor profile (no token)' },
  { method: 'GET', path: '/api/v1/appointments', expectedStatus: 401, description: 'Appointments (no token)' },
  { method: 'GET', path: '/api/v1/vitals', expectedStatus: 401, description: 'Vitals (no token)' },
  { method: 'GET', path: '/api/v1/documents', expectedStatus: 401, description: 'Documents (no token)' },
  { method: 'GET', path: '/api/v1/notifications', expectedStatus: 401, description: 'Notifications (no token)' },
  { method: 'GET', path: '/api/v1/health-records', expectedStatus: 401, description: 'Health records (no token)' },
  { method: 'GET', path: '/api/v1/waitlist', expectedStatus: 401, description: 'Waitlist (no token)' },
  { method: 'GET', path: '/api/v1/payments', expectedStatus: 401, description: 'Payments (no token)' },

  // Public doctor list
  { method: 'GET', path: '/api/v1/doctors', expectedStatus: 200, description: 'List doctors' },

  // Frontend SPA
  { method: 'GET', path: '/', expectedStatus: 200, description: 'Frontend index' },
];

// ═══════════════════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════

async function makeRequest(method, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const client = url.protocol === 'https:' ? https : http;

    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'HealthConnect-EndpointTest/1.0',
      },
    };

    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body.substring(0, 200), // truncate
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });

    if (method === 'POST') {
      req.write(JSON.stringify({}));
    }
    req.end();
  });
}

async function runTests() {
  console.log(`\n🧪 Testing HealthConnect API Endpoints`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log('='.repeat(70) + '\n');

  let passed = 0;
  let failed = 0;
  let errors = 0;

  for (const test of tests) {
    try {
      const result = await makeRequest(test.method, test.path);
      const expectedStatuses = Array.isArray(test.expectedStatus) ? test.expectedStatus : [test.expectedStatus];
      const ok = expectedStatuses.includes(result.status);

      if (ok) {
        console.log(`  ✅ ${test.method.padEnd(6)} ${test.path.padEnd(55)} → ${result.status} (${test.description})`);
        passed++;
      } else {
        console.log(`  ❌ ${test.method.padEnd(6)} ${test.path.padEnd(55)} → ${result.status} expected ${test.expectedStatus} (${test.description})`);
        failed++;
      }
    } catch (err) {
      console.log(`  ⚠️  ${test.method.padEnd(6)} ${test.path.padEnd(55)} → ERROR: ${err.message} (${test.description})`);
      errors++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${errors} errors out of ${tests.length} tests`);

  if (failed === 0 && errors === 0) {
    console.log('✅ All endpoint tests PASSED!\n');
  } else if (errors > 0) {
    console.log('⚠️  Some tests had errors (server may not be running)\n');
  } else {
    console.log('❌ Some tests FAILED\n');
  }

  process.exit(failed + errors > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

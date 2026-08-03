/**
 * Comprehensive test script to verify authentication flow
 *
 * Run with: node test-auth.js
 *
 * Tests:
 * 1. Login creates session with Set-Cookie header
 * 2. Session cookie persists across requests
 * 3. Protected endpoints require authentication
 * 4. Wrong password is rejected
 * 5. Logout destroys session
 */

import http from 'http';

const BASE_URL = 'http://localhost:5000';
const PASSWORD = 'password'; // default APP_PASSWORD

async function makeRequest(method, path, body = null, cookies = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 5000,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    if (cookies) {
      options.headers['Cookie'] = cookies;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : null
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function log(title, status, message) {
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '📋';
  console.log(`${icon} ${title}: ${message}`);
}

async function runTests() {
  console.log('\n🧪 Authentication Flow Tests\n');
  console.log('Testing at:', BASE_URL);
  console.log('---\n');

  let sessionCookie = null;
  let passed = 0;
  let failed = 0;

  try {
    // Test 1: Check server is running
    console.log('Test 1: Server connectivity');
    try {
      const healthRes = await makeRequest('GET', '/api/health');
      if (healthRes.status === 200) {
        log('Server', 'pass', 'Server is running');
        passed++;
      } else {
        throw new Error('Unexpected status: ' + healthRes.status);
      }
    } catch (e) {
      log('Server', 'fail', 'Cannot connect to server at ' + BASE_URL);
      console.log('Make sure the server is running: npm run dev\n');
      return;
    }

    // Test 2: Login with correct password
    console.log('\nTest 2: Login with password');
    const loginRes = await makeRequest('POST', '/api/auth/login', { password: PASSWORD });

    if (loginRes.status !== 200) {
      log('Login', 'fail', `Status ${loginRes.status}: ${loginRes.body?.error}`);
      failed++;
    } else {
      log('Login', 'pass', 'Password accepted');
      passed++;

      // Extract Set-Cookie header
      const setCookieHeader = loginRes.headers['set-cookie'];
      if (!setCookieHeader || !setCookieHeader[0]) {
        log('Set-Cookie', 'fail', 'No Set-Cookie header in response');
        failed++;
      } else {
        sessionCookie = setCookieHeader[0].split(';')[0];
        log('Set-Cookie', 'pass', `Session cookie created: ${sessionCookie.substring(0, 40)}...`);
        passed++;
      }
    }

    if (!sessionCookie) {
      log('Continue', 'fail', 'Cannot continue without session cookie');
      console.log('\n❌ Tests stopped\n');
      return;
    }

    // Test 3: Check debug endpoint with cookie
    console.log('\nTest 3: Verify session on debug endpoint');
    const debugRes = await makeRequest('GET', '/api/debug/session', null, sessionCookie);

    if (debugRes.status === 200) {
      const sessionState = debugRes.body;
      if (sessionState.session?.userId) {
        log('Session state', 'pass', `userId is set to: ${sessionState.session.userId}`);
        passed++;
      } else {
        log('Session state', 'fail', `userId is not set. Session: ${JSON.stringify(sessionState.session)}`);
        failed++;
      }
    } else {
      log('Debug endpoint', 'fail', `Status ${debugRes.status}`);
      failed++;
    }

    // Test 4: Check auth status with cookie
    console.log('\nTest 4: Auth status endpoint');
    const statusRes = await makeRequest('GET', '/api/auth/status', null, sessionCookie);

    if (statusRes.status === 200 && statusRes.body.authenticated) {
      log('Auth status', 'pass', 'Authenticated confirmed');
      passed++;
    } else {
      log('Auth status', 'fail', `Not authenticated. Response: ${JSON.stringify(statusRes.body)}`);
      failed++;
    }

    // Test 5: Access protected endpoint
    console.log('\nTest 5: Protected endpoint (/api/uploads)');
    const uploadsRes = await makeRequest('GET', '/api/uploads', null, sessionCookie);

    if (uploadsRes.status === 401) {
      log('Protected endpoint', 'fail', 'Got 401 - session not recognized on protected endpoint');
      failed++;
    } else if (uploadsRes.status === 200) {
      log('Protected endpoint', 'pass', 'Accessible with valid session');
      passed++;
    } else {
      log('Protected endpoint', 'fail', `Unexpected status ${uploadsRes.status}`);
      failed++;
    }

    // Test 6: Wrong password
    console.log('\nTest 6: Wrong password rejection');
    const wrongRes = await makeRequest('POST', '/api/auth/login', { password: 'wrongpassword' });

    if (wrongRes.status === 401) {
      log('Wrong password', 'pass', 'Correctly rejected');
      passed++;
    } else {
      log('Wrong password', 'fail', `Expected 401, got ${wrongRes.status}`);
      failed++;
    }

    // Test 7: Logout
    console.log('\nTest 7: Logout');
    const logoutRes = await makeRequest('POST', '/api/auth/logout', null, sessionCookie);

    if (logoutRes.status === 200) {
      log('Logout', 'pass', 'Session destroyed');
      passed++;
    } else {
      log('Logout', 'fail', `Status ${logoutRes.status}`);
      failed++;
    }

    // Test 8: Verify logout worked
    console.log('\nTest 8: Verify session destroyed');
    const statusAfterRes = await makeRequest('GET', '/api/auth/status', null, sessionCookie);

    if (statusAfterRes.body.authenticated === false) {
      log('Post-logout status', 'pass', 'Properly unauthenticated');
      passed++;
    } else {
      log('Post-logout status', 'fail', 'Still authenticated after logout');
      failed++;
    }

  } catch (error) {
    log('Unexpected error', 'fail', error.message);
    console.error(error);
    failed++;
  }

  // Summary
  console.log('\n---');
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

  if (failed === 0) {
    console.log('✅ All tests passed! Authentication is working correctly.\n');
  } else {
    console.log('❌ Some tests failed. Check the output above for details.\n');
  }
}

runTests();

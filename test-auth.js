/**
 * Simple test script to verify authentication flow
 *
 * Run with: node test-auth.js
 *
 * This test:
 * 1. Makes a login request with password
 * 2. Extracts the session cookie from the response
 * 3. Makes an authenticated request using the cookie
 * 4. Verifies the session persists across requests
 */

import http from 'http';

const BASE_URL = 'http://localhost:5000';
const PASSWORD = 'password'; // or whatever APP_PASSWORD is set to

async function makeRequest(method, path, body = null, cookies = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
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

async function runTests() {
  console.log('🧪 Starting authentication tests...\n');

  try {
    // Test 1: Login with password
    console.log('Test 1: Login with password');
    const loginRes = await makeRequest('POST', '/api/auth/login', { password: PASSWORD });

    if (loginRes.status !== 200) {
      console.error('❌ Login failed:', loginRes.status, loginRes.body);
      return;
    }

    console.log('✅ Login successful');
    console.log('   Response:', loginRes.body);

    // Extract Set-Cookie header
    const setCookieHeader = loginRes.headers['set-cookie'];
    if (!setCookieHeader) {
      console.error('❌ No Set-Cookie header in response!');
      return;
    }

    const sessionCookie = setCookieHeader[0].split(';')[0];
    console.log('   Session cookie:', sessionCookie.substring(0, 50) + '...');

    // Test 2: Check auth status with cookie
    console.log('\nTest 2: Check auth status with cookie');
    const statusRes = await makeRequest('GET', '/api/auth/status', null, sessionCookie);

    if (statusRes.status !== 200) {
      console.error('❌ Auth status check failed:', statusRes.status);
      return;
    }

    if (!statusRes.body.authenticated) {
      console.error('❌ Not authenticated! Response:', statusRes.body);
      return;
    }

    console.log('✅ Auth status confirmed');
    console.log('   Response:', statusRes.body);

    // Test 3: Access protected endpoint (/api/uploads)
    console.log('\nTest 3: Access protected endpoint');
    const uploadsRes = await makeRequest('GET', '/api/uploads', null, sessionCookie);

    if (uploadsRes.status === 401) {
      console.error('❌ Session cookie not recognized on protected endpoint!');
      console.error('   Response:', uploadsRes.body);
      return;
    }

    if (uploadsRes.status !== 200) {
      console.error('❌ Protected endpoint failed:', uploadsRes.status, uploadsRes.body);
      return;
    }

    console.log('✅ Protected endpoint accessible');
    console.log('   Response: Array of', Array.isArray(uploadsRes.body) ? uploadsRes.body.length : '?', 'uploads');

    // Test 4: Verify wrong password is rejected
    console.log('\nTest 4: Verify wrong password is rejected');
    const wrongPwRes = await makeRequest('POST', '/api/auth/login', { password: 'wrongpassword' });

    if (wrongPwRes.status === 401) {
      console.log('✅ Wrong password correctly rejected');
    } else {
      console.error('❌ Wrong password was not rejected! Status:', wrongPwRes.status);
      return;
    }

    // Test 5: Logout
    console.log('\nTest 5: Logout');
    const logoutRes = await makeRequest('POST', '/api/auth/logout', null, sessionCookie);

    if (logoutRes.status !== 200) {
      console.error('❌ Logout failed:', logoutRes.status);
      return;
    }

    console.log('✅ Logout successful');

    // Test 6: Verify session is destroyed
    console.log('\nTest 6: Verify session is destroyed after logout');
    const statusAfterLogoutRes = await makeRequest('GET', '/api/auth/status', null, sessionCookie);

    if (statusAfterLogoutRes.body.authenticated) {
      console.error('❌ Still authenticated after logout!');
      return;
    }

    console.log('✅ Session properly destroyed');

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

runTests();

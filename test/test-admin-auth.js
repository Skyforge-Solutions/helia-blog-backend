/**
 * Simple test script to verify admin authentication functionality
 */
require('dotenv').config();
const fetch = require('node-fetch');
const fetchCookie = require('fetch-cookie');
const { Cookie } = require('tough-cookie');

// Base URL for API
const API_URL = 'http://localhost:3000/api';

// Create a cookie-enabled fetch
const cookieFetch = fetchCookie(fetch);

async function testAuthRoutes() {
    console.log('🧪 Testing admin authentication routes\n');

    try {
        // Test 1: Validate without login (should fail)
        console.log('Test 1: Validate without login');
        const validateResponse1 = await cookieFetch(`${API_URL}/auth/validate`);
        const validateData1 = await validateResponse1.json();

        console.log(`  Status: ${validateResponse1.status}`);
        console.log(`  Response: ${JSON.stringify(validateData1)}`);
        console.log(`  Result: ${validateResponse1.status === 401 ? '✅ PASS' : '❌ FAIL'}\n`);

        // Test 2: Login with invalid credentials (should fail)
        console.log('Test 2: Login with invalid credentials');
        const loginResponse1 = await cookieFetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'invaliduser',
                password: 'invalidpassword'
            })
        });

        const loginData1 = await loginResponse1.json();

        console.log(`  Status: ${loginResponse1.status}`);
        console.log(`  Response: ${JSON.stringify(loginData1)}`);
        console.log(`  Result: ${loginResponse1.status === 401 ? '✅ PASS' : '❌ FAIL'}\n`);

        // Test 3: Login with valid credentials (should succeed)
        // Note: Replace with actual test admin credentials
        console.log('Test 3: Login with valid credentials');
        const loginResponse2 = await cookieFetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'admin',  // Replace with actual test username
                password: 'admin'   // Replace with actual test password
            })
        });

        const loginData2 = await loginResponse2.json();

        console.log(`  Status: ${loginResponse2.status}`);
        console.log(`  Response: ${JSON.stringify(loginData2)}`);
        const loginPassed = loginResponse2.status === 200 && loginData2.success === true;
        console.log(`  Result: ${loginPassed ? '✅ PASS' : '❌ FAIL'}\n`);

        if (!loginPassed) {
            console.log('⚠️ Login failed, skipping remaining tests');
            return;
        }

        // Test 4: Validate after login (should succeed)
        console.log('Test 4: Validate after login');
        const validateResponse2 = await cookieFetch(`${API_URL}/auth/validate`);
        const validateData2 = await validateResponse2.json();

        console.log(`  Status: ${validateResponse2.status}`);
        console.log(`  Response: ${JSON.stringify(validateData2)}`);
        const validatePassed = validateResponse2.status === 200 &&
            validateData2.success === true &&
            validateData2.data?.authenticated === true;
        console.log(`  Result: ${validatePassed ? '✅ PASS' : '❌ FAIL'}\n`);

        // Test 5: Logout (should succeed)
        console.log('Test 5: Logout');
        const logoutResponse = await cookieFetch(`${API_URL}/auth/logout`, {
            method: 'POST'
        });

        const logoutData = await logoutResponse.json();

        console.log(`  Status: ${logoutResponse.status}`);
        console.log(`  Response: ${JSON.stringify(logoutData)}`);
        const logoutPassed = logoutResponse.status === 200 && logoutData.success === true;
        console.log(`  Result: ${logoutPassed ? '✅ PASS' : '❌ FAIL'}\n`);

        // Test 6: Validate after logout (should fail)
        console.log('Test 6: Validate after logout');
        const validateResponse3 = await cookieFetch(`${API_URL}/auth/validate`);
        const validateData3 = await validateResponse3.json();

        console.log(`  Status: ${validateResponse3.status}`);
        console.log(`  Response: ${JSON.stringify(validateData3)}`);
        console.log(`  Result: ${validateResponse3.status === 401 ? '✅ PASS' : '❌ FAIL'}\n`);

        // Overall result
        console.log(`Overall test result: ${validateResponse1.status === 401 &&
            loginResponse1.status === 401 &&
            loginPassed &&
            validatePassed &&
            logoutPassed &&
            validateResponse3.status === 401 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'
            }`);

    } catch (error) {
        console.error('Error running tests:', error);
    }
}

// Run the tests
testAuthRoutes(); 
const axios = require('axios');
const assert = require('assert');
const FormData = require('form-data');

const BASE_URL = 'http://localhost:3001';
const API_VERSION = 'v1';
const API_BASE = `${BASE_URL}/api/${API_VERSION}`;

// Add default headers for all requests
axios.defaults.headers.common['x-api-version'] = API_VERSION;

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getAuthToken() {
    try {
        console.log('Attempting to get auth token...');
        const response = await axios.post(`${API_BASE}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        console.log('Auth token response:', response.status);
        return response.data.token;
    } catch (error) {
        console.error('Failed to get auth token:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        return null;
    }
}

async function runTests() {
    try {
        // Check if server is running
        console.log('Attempting to connect to server...');
        const healthCheck = await axios.get(`${BASE_URL}/health`);
        if (healthCheck.status === 200) {
            console.log('✅ Server is running, starting tests...\n');
        }

        // Get auth token for protected routes
        const authToken = await getAuthToken();
        console.log('Auth token obtained:', authToken ? 'Yes' : 'No');

        console.log('🧪 Starting Error Scenario Tests...\n');

        // Test 1: Invalid Login
        console.log('1️⃣ Testing Invalid Login...');
        try {
            await axios.post(`${API_BASE}/auth/login`, {
                username: 'invalid',
                password: 'invalid'
            });
            throw new Error('Should have failed with 401');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('✅ Invalid login handled correctly\n');
            } else {
                console.log('❌ Unexpected error:', error.message);
                console.log('Response status:', error.response?.status);
                console.log('Response data:', error.response?.data, '\n');
            }
        }

        await delay(1000);

        // Test 2: Invalid Token
        console.log('2️⃣ Testing Invalid Token...');
        try {
            await axios.get(`${API_BASE}/parts`, {
                headers: { 
                    'Authorization': 'Bearer invalid_token'
                }
            });
            throw new Error('Should have failed with 401');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('✅ Invalid token handled correctly\n');
            } else {
                console.log('❌ Unexpected error:', error.message, '\n');
            }
        }

        await delay(1000);

        // Test 3: Rate Limiting
        console.log('3️⃣ Testing Rate Limiting...');
        const requests = Array(10).fill().map(() => 
            axios.post(`${API_BASE}/auth/login`, {
                username: 'test',
                password: 'test'
            })
        );
        
        try {
            await Promise.all(requests);
            throw new Error('Should have been rate limited');
        } catch (error) {
            if (error.response && error.response.status === 429) {
                console.log('✅ Rate limiting working correctly\n');
            } else {
                console.log('❌ Unexpected error:', error.message, '\n');
            }
        }

        await delay(1000);

        // Test 4: Invalid Part ID
        console.log('4️⃣ Testing Invalid Part ID...');
        try {
            await axios.get(`${API_BASE}/parts/99999999`, {
                headers: { 
                    'Authorization': `Bearer ${authToken}`
                }
            });
            throw new Error('Should have failed with 404');
        } catch (error) {
            if (error.response && error.response.status === 404) {
                console.log('✅ Invalid part ID handled correctly\n');
            } else {
                console.log('❌ Unexpected error:', error.message, '\n');
            }
        }

        await delay(1000);

        // Test 5: Invalid File Upload
        console.log('5️⃣ Testing Invalid File Upload...');
        try {
            const form = new FormData();
            form.append('file', Buffer.from('invalid data'), {
                filename: 'test.csv',
                contentType: 'text/csv',
            });
            
            await axios.post(`${API_BASE}/parts/import`, form, {
                headers: { 
                    ...form.getHeaders(),
                    'Authorization': `Bearer ${authToken}`
                }
            });
            throw new Error('Should have failed with 400');
        } catch (error) {
            if (error.response && error.response.status === 400) {
                console.log('✅ Invalid file upload handled correctly\n');
            } else {
                console.log('❌ Unexpected error:', error.message, '\n');
            }
        }

        console.log('✅ All error scenario tests completed!\n');
    } catch (error) {
        console.error('❌ Test execution error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        } else if (error.request) {
            console.error('No response received. Server might not be running.');
        }
        process.exit(1);
    }
}

runTests(); 
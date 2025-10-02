// Test script for Toast POS API connection
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Toast POS credentials from your .env file
const TOAST_CLIENT_ID = 'w4VqyDar5aAFOLCBN8AHuud5zQFz3BgU';
const TOAST_CLIENT_SECRET = 'mnErHrh3vb06_T_fSN_TyU6y7442weGXJTYUYgGQS8-miDII98A8Z6naEd3qVvil';
const TOAST_RESTAURANT_GUID = 'baf303dc-9062-48aa-8ecd-ae20c765022e';

// Correct Toast API endpoints
const AUTH_URL = 'https://ws-api.toasttab.com';
const API_URL = 'https://ws-api.toasttab.com';

async function testToastConnection() {
  console.log('🔄 Testing Toast POS API Connection...\n');

  try {
    // Step 1: Test Authentication
    console.log('1. Testing Authentication...');
    const authResponse = await fetch(`${AUTH_URL}/authentication/v1/authentication/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientId: TOAST_CLIENT_ID,
        clientSecret: TOAST_CLIENT_SECRET,
        userAccessType: 'TOAST_MACHINE_CLIENT'
      })
    });

    if (!authResponse.ok) {
      console.error('❌ Authentication failed:', authResponse.status, authResponse.statusText);
      return;
    }

    const authData = await authResponse.json();
    console.log('✅ Authentication successful');
    console.log('   Token type:', authData.token?.tokenType);
    console.log('   Expires in:', authData.token?.expiresIn, 'seconds');

    const accessToken = authData.token?.accessToken;
    if (!accessToken) {
      console.error('❌ No access token in response');
      return;
    }

    // Step 2: Test Orders API (last 1 hour - Toast API limit)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setHours(endDate.getHours() - 1);

    const ordersResponse = await fetch(
      `${API_URL}/orders/v2/orders?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&pageSize=10`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Toast-Restaurant-External-ID': TOAST_RESTAURANT_GUID
        }
      }
    );

    if (!ordersResponse.ok) {
      console.error('❌ Orders API failed:', ordersResponse.status, ordersResponse.statusText);
      const errorText = await ordersResponse.text();
      console.error('Error details:', errorText);
      return;
    }

    const ordersData = await ordersResponse.json();
    console.log('✅ Orders API successful');
    console.log('   Found orders:', Array.isArray(ordersData) ? ordersData.length : 'Data received');

    if (Array.isArray(ordersData) && ordersData.length > 0) {
      const sampleOrder = ordersData[0];
      console.log('   Sample order:', {
        orderNumber: sampleOrder.orderNumber,
        paidDate: sampleOrder.paidDate,
        selections: sampleOrder.selections ? sampleOrder.selections.length : 0
      });
    }

    console.log('\n🎉 All tests passed! Toast POS integration is working correctly.');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testToastConnection();
const https = require('https');

// Test direct connection to Odoo
function testOdooConnection() {
  const data = JSON.stringify({
    jsonrpc: '2.0',
    method: 'call',
    params: {
      service: 'common',
      method: 'version',
      args: []
    }
  });

  const options = {
    hostname: 'noe-usa-llc.odoo.com',
    port: 443,
    path: '/jsonrpc',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length,
      'Accept': 'application/json'
    }
  };

  console.log('Testing connection to Odoo...');
  
  const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);
    
    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      console.log('Response:', responseData);
      try {
        const parsed = JSON.parse(responseData);
        console.log('Parsed response:', JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('Could not parse JSON response');
      }
    });
  });

  req.on('error', (error) => {
    console.error('Request error:', error);
  });

  req.write(data);
  req.end();
}

testOdooConnection();
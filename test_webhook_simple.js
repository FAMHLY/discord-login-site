// Simple webhook test - replace YOUR_VERCEL_DOMAIN with your actual domain
const https = require('https');

function testWebhookEndpoint(domain) {
  const webhookUrl = `https://${domain}/api/stripe/webhook`;
  
  console.log(`🔍 Testing webhook endpoint: ${webhookUrl}`);
  
  const postData = JSON.stringify({
    type: 'test',
    data: { object: { id: 'test' } }
  });
  
  const options = {
    hostname: domain,
    port: 443,
    path: '/api/stripe/webhook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Response:', data);
      if (res.statusCode === 400) {
        console.log('✅ Webhook endpoint is accessible (400 is expected without proper Stripe signature)');
      } else if (res.statusCode === 200) {
        console.log('✅ Webhook endpoint is working');
      } else {
        console.log(`⚠️  Unexpected status code: ${res.statusCode}`);
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('❌ Error testing webhook:', error.message);
  });
  
  req.write(postData);
  req.end();
}

// Usage: node test_webhook_simple.js YOUR_VERCEL_DOMAIN
const domain = process.argv[2];

if (!domain) {
  console.log('Usage: node test_webhook_simple.js YOUR_VERCEL_DOMAIN');
  console.log('Example: node test_webhook_simple.js my-app.vercel.app');
  process.exit(1);
}

testWebhookEndpoint(domain);

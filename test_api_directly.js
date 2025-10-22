// Test the API directly to see what it returns
const https = require('https');
const http = require('http');

async function testAPIDirectly() {
  try {
    console.log('🔍 Testing API directly...\n');
    
    // Test the API endpoint directly
    const apiUrl = 'https://discord-login-site.vercel.app/api/servers';
    
    console.log(`Testing API endpoint: ${apiUrl}`);
    console.log('Note: This will likely return 401 Unauthorized since we need authentication');
    console.log('But it will help us see if there are any server-side issues.\n');
    
    // Make a request to the API
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log(`Response body: ${responseText}`);
    
    if (response.status === 401) {
      console.log('\n✅ Expected 401 Unauthorized - API is working correctly');
      console.log('The issue is likely browser caching or the user needs to log in again.');
    } else if (response.status === 200) {
      console.log('\n⚠️  Unexpected 200 response - might be cached data');
    } else {
      console.log(`\n❌ Unexpected status: ${response.status}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

// Alternative: Test with curl command
console.log('🧪 Testing API with curl command...\n');

const { exec } = require('child_process');

exec('curl -v https://discord-login-site.vercel.app/api/servers', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Curl error:', error.message);
    return;
  }
  
  console.log('📡 Curl response:');
  console.log('STDOUT:', stdout);
  console.log('STDERR:', stderr);
  
  if (stderr.includes('401')) {
    console.log('\n✅ Expected 401 Unauthorized - API is working correctly');
    console.log('The issue is likely browser caching.');
  }
});

testAPIDirectly();

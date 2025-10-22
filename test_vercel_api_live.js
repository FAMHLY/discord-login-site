// Test the live Vercel API to see what it's actually returning
const https = require('https');

async function testVercelAPI() {
  try {
    console.log('🔍 Testing live Vercel API...\n');
    
    const apiUrl = 'https://discord-login-site.vercel.app/api/servers';
    
    console.log(`Testing: ${apiUrl}`);
    console.log('Note: This will return 401 since we need authentication, but we can check the response structure\n');
    
    // Make a request to the live API
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response headers:`);
    for (const [key, value] of response.headers.entries()) {
      console.log(`   ${key}: ${value}`);
    }
    
    const responseText = await response.text();
    console.log(`\nResponse body: ${responseText}`);
    
    // Check if there are any caching headers
    const cacheControl = response.headers.get('cache-control');
    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');
    
    console.log('\n📋 Caching headers:');
    console.log(`   Cache-Control: ${cacheControl || 'Not set'}`);
    console.log(`   ETag: ${etag || 'Not set'}`);
    console.log(`   Last-Modified: ${lastModified || 'Not set'}`);
    
    if (cacheControl && cacheControl.includes('max-age')) {
      console.log('   ⚠️  API responses might be cached by Vercel');
    }
    
    // Check if the response includes any deployment info
    if (responseText.includes('configured_servers')) {
      console.log('\n✅ API response includes configured_servers - this is the expected structure');
    } else {
      console.log('\n❌ API response structure is unexpected');
    }
    
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

// Also test with curl to see raw response
console.log('🧪 Testing with curl...\n');

const { exec } = require('child_process');

exec('curl -I https://discord-login-site.vercel.app/api/servers', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Curl error:', error.message);
    return;
  }
  
  console.log('📡 Curl response headers:');
  console.log(stdout);
  
  if (stdout.includes('cache-control')) {
    console.log('⚠️  Vercel is setting cache headers - this might be the issue');
  }
});

testVercelAPI();

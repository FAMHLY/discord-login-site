// Test cache busting to see if that fixes the issue
console.log('🔍 Testing cache busting solutions...\n');

console.log('📋 Possible solutions:');
console.log('1. Add cache-busting parameter to API calls');
console.log('2. Add no-cache headers to API responses');
console.log('3. Force Vercel to not cache API responses');

console.log('\n🔧 Let me check if we can add no-cache headers to the API...\n');

// Read the API code to see if we can add no-cache headers
const fs = require('fs');
const path = require('path');

try {
  const apiCode = fs.readFileSync(path.join(__dirname, 'api/index.js'), 'utf8');
  
  // Check if we already have no-cache headers
  if (apiCode.includes('no-cache') || apiCode.includes('Cache-Control')) {
    console.log('✅ API already has cache control headers');
  } else {
    console.log('❌ API does not have cache control headers');
    console.log('We need to add no-cache headers to prevent Vercel from caching responses');
  }
  
  // Look for the servers endpoint
  const serversEndpointMatch = apiCode.match(/app\.get\('\/api\/servers'.*?res\.json\(/s);
  
  if (serversEndpointMatch) {
    console.log('\n📊 Found servers endpoint - checking response structure');
    
    // Check if the response includes the user-specific tracking data
    if (serversEndpointMatch[0].includes('configured_servers')) {
      console.log('✅ API response includes configured_servers');
    } else {
      console.log('❌ API response does not include configured_servers');
    }
  }
  
} catch (error) {
  console.error('❌ Error reading API code:', error.message);
}

console.log('\n🎯 Next steps:');
console.log('1. Add no-cache headers to API responses');
console.log('2. Test with cache-busting parameter');
console.log('3. Check if Vercel deployment is complete');

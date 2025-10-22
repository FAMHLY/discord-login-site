// Check if the API deployment has the latest code
console.log('🔍 Checking API deployment status...\n');

// Check if the API has the latest code by looking at the response structure
const apiUrl = 'https://discord-login-site.vercel.app/api/servers';

console.log('Testing API endpoint structure...\n');

// Since we can't make authenticated requests, let's check if there are any deployment issues
console.log('📋 Possible issues:');
console.log('1. API deployment might not have the latest code');
console.log('2. Service worker might be caching responses');
console.log('3. Vercel might be caching API responses');
console.log('4. The user-specific tracking columns might not be included in the API response');

console.log('\n🔧 Let me check the API code to see if it includes the user-specific columns...\n');

// Read the API code to see what columns are being selected
const fs = require('fs');
const path = require('path');

try {
  const apiCode = fs.readFileSync(path.join(__dirname, 'api/index.js'), 'utf8');
  
  // Look for the server query in the API
  const serverQueryMatch = apiCode.match(/\.select\([^)]+\)/g);
  
  console.log('📊 API Server Query:');
  if (serverQueryMatch) {
    console.log('Found select queries:', serverQueryMatch);
  } else {
    console.log('No select queries found in API code');
  }
  
  // Check if the API is selecting all columns or specific columns
  const selectAllMatch = apiCode.match(/\.select\('\\*'\)/);
  const selectSpecificMatch = apiCode.match(/\.select\(\[([^\]]+)\]\)/);
  
  if (selectAllMatch) {
    console.log('✅ API is selecting all columns (*) - should include user-specific columns');
  } else if (selectSpecificMatch) {
    console.log('⚠️  API is selecting specific columns:', selectSpecificMatch[1]);
    console.log('This might not include the user-specific tracking columns');
  } else {
    console.log('❓ Could not determine what columns the API is selecting');
  }
  
} catch (error) {
  console.error('❌ Error reading API code:', error.message);
}

console.log('\n🎯 Next steps:');
console.log('1. Check if the API deployment has the latest code');
console.log('2. Check if the user-specific tracking columns are being selected');
console.log('3. Check if there are any service workers caching responses');
console.log('4. Check Vercel deployment logs for any errors');

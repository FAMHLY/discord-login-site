// Test script for click tracking functionality
// Run this with: node test_click_tracking.js

const axios = require('axios');

async function testClickTracking() {
  console.log('🧪 Testing Click Tracking...\n');
  
  // Test parameters - replace with your actual values
  const baseUrl = 'http://localhost:3000'; // or your deployed URL
  const testInviteCode = 'test123'; // Replace with a real invite code from your database
  const testAffiliateId = '123456789'; // Replace with a real Discord user ID
  
  const testUrl = `${baseUrl}/invite/${testInviteCode}?affiliate=${testAffiliateId}`;
  
  console.log('Test URL:', testUrl);
  console.log('Making request...\n');
  
  try {
    // Make the request (this should trigger click tracking)
    const response = await axios.get(testUrl, {
      maxRedirects: 0, // Don't follow redirects
      validateStatus: function (status) {
        // Accept redirect status codes (301, 302, etc.)
        return status >= 200 && status < 400;
      }
    });
    
    console.log('✅ Request successful!');
    console.log('Status:', response.status);
    console.log('Headers:', response.headers);
    
    if (response.status === 302 || response.status === 301) {
      console.log('🔄 Redirect detected - this is expected');
      console.log('Redirect location:', response.headers.location);
    }
    
  } catch (error) {
    if (error.response && (error.response.status === 302 || error.response.status === 301)) {
      console.log('✅ Redirect detected (this is expected)');
      console.log('Redirect location:', error.response.headers.location);
    } else {
      console.error('❌ Error:', error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      }
    }
  }
  
  console.log('\n📊 Check your server logs for tracking messages:');
  console.log('- Look for "=== trackInviteClick called ==="');
  console.log('- Look for "✅ Successfully created affiliate tracking record"');
  console.log('- Check your Supabase affiliate_tracking table for new records');
}

// Run the test
testClickTracking().catch(console.error);

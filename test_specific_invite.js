// Test specific invite code to see what's happening
require('dotenv').config();

async function testSpecificInvite() {
  console.log('🧪 Testing Specific Invite Code...\n');
  
  const inviteCode = 'e04f5002e99e3397';
  const affiliateId = '210250076281372673';
  const baseUrl = 'http://localhost:3000'; // or your deployed URL
  
  console.log('Testing invite code:', inviteCode);
  console.log('Testing affiliate ID:', affiliateId);
  console.log('Base URL:', baseUrl);
  console.log('');
  
  // Test the invite endpoint
  const testUrl = `${baseUrl}/invite/${inviteCode}?affiliate=${affiliateId}`;
  console.log('Test URL:', testUrl);
  console.log('');
  
  try {
    console.log('Making request to invite endpoint...');
    const response = await fetch(testUrl, {
      method: 'GET',
      redirect: 'manual' // Don't follow redirects automatically
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.status === 302 || response.status === 301) {
      const redirectLocation = response.headers.get('location');
      console.log('✅ Redirect detected!');
      console.log('Redirect location:', redirectLocation);
      
      if (redirectLocation && redirectLocation.includes('discord.gg')) {
        console.log('✅ Valid Discord invite redirect!');
      } else {
        console.log('⚠️ Redirect but not to Discord invite');
      }
    } else if (response.status === 404) {
      console.log('❌ 404 - Invite code not found in database');
      console.log('This means the invite code is not in your discord_servers table');
    } else if (response.status === 500) {
      console.log('❌ 500 - Server error');
      const text = await response.text();
      console.log('Error response:', text);
    } else {
      console.log('Unexpected status:', response.status);
      const text = await response.text();
      console.log('Response body:', text);
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 Your local server is not running');
      console.log('Start your server with: npm start');
    } else if (error.message.includes('fetch failed')) {
      console.log('💡 Network error - check if the URL is correct');
    }
  }
  
  console.log('\n📋 Troubleshooting steps:');
  console.log('1. Make sure your server is running (npm start)');
  console.log('2. Run the database fix in Supabase');
  console.log('3. Check if the invite code exists in your database');
  console.log('4. Verify the Discord bot is properly configured');
}

testSpecificInvite();

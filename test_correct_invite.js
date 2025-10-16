// Test with the correct invite code from database
require('dotenv').config();

async function testCorrectInvite() {
  console.log('🎯 Testing Correct Invite Code...\n');
  
  const correctInviteCode = '1dfe022a4c3a68b2'; // From database
  const affiliateId = '210250076281372673';
  const deployedUrl = 'https://discord-login-site.vercel.app';
  
  console.log('Using CORRECT invite code:', correctInviteCode);
  console.log('Affiliate ID:', affiliateId);
  console.log('');
  
  const testUrl = `${deployedUrl}/invite/${correctInviteCode}?affiliate=${affiliateId}`;
  console.log('Test URL:', testUrl);
  console.log('');
  
  try {
    console.log('Making request with correct invite code...');
    const response = await fetch(testUrl, {
      method: 'GET',
      redirect: 'manual'
    });
    
    console.log('Response status:', response.status);
    
    if (response.status === 302 || response.status === 301) {
      const redirectLocation = response.headers.get('location');
      console.log('✅ SUCCESS! Redirect detected!');
      console.log('Redirect location:', redirectLocation);
      
      if (redirectLocation && redirectLocation.includes('discord.gg')) {
        console.log('🎉 PERFECT! Valid Discord invite redirect!');
        console.log('Your affiliate tracking should now work!');
      } else {
        console.log('⚠️ Redirect but not to Discord invite');
      }
    } else if (response.status === 404) {
      console.log('❌ Still 404 - there might be a deployment delay');
      console.log('Vercel might not have redeployed yet with the new environment variables');
    } else {
      console.log('Unexpected status:', response.status);
      const text = await response.text();
      console.log('Response body:', text);
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
  
  console.log('\n📋 Your CORRECT invite URL is:');
  console.log(`${deployedUrl}/invite/${correctInviteCode}?affiliate=${affiliateId}`);
}

testCorrectInvite();

// Test the current invite code from database
require('dotenv').config();

async function testCurrentInvite() {
  console.log('🎯 Testing Current Invite Code...\n');
  
  const currentInviteCode = '4d9d5097d59fbe1c'; // From database
  const affiliateId = '210250076281372673';
  const deployedUrl = 'https://discord-login-site.vercel.app';
  
  console.log('Using current invite code:', currentInviteCode);
  console.log('Affiliate ID:', affiliateId);
  console.log('');
  
  const testUrl = `${deployedUrl}/invite/${currentInviteCode}?affiliate=${affiliateId}`;
  console.log('Test URL:', testUrl);
  console.log('');
  
  try {
    console.log('Making request with current invite code...');
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
      } else {
        console.log('⚠️ Redirect but not to Discord invite');
      }
    } else if (response.status === 404) {
      console.log('❌ 404 - Invite code not found');
    } else {
      console.log('Unexpected status:', response.status);
      const text = await response.text();
      console.log('Response body:', text);
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
  
  console.log('\n📋 Your CURRENT invite URL is:');
  console.log(`${deployedUrl}/invite/${currentInviteCode}?affiliate=${affiliateId}`);
}

testCurrentInvite();

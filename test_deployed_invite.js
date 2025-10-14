// Test invite on deployed version
require('dotenv').config();

async function testDeployedInvite() {
  console.log('🌐 Testing Deployed Invite...\n');
  
  const inviteCode = 'e04f5002e99e3397';
  const affiliateId = '210250076281372673';
  const deployedUrl = 'https://discord-login-site.vercel.app';
  
  console.log('Testing deployed URL:', deployedUrl);
  console.log('Invite code:', inviteCode);
  console.log('Affiliate ID:', affiliateId);
  console.log('');
  
  const testUrl = `${deployedUrl}/invite/${inviteCode}?affiliate=${affiliateId}`;
  console.log('Test URL:', testUrl);
  console.log('');
  
  try {
    console.log('Making request to deployed invite endpoint...');
    const response = await fetch(testUrl, {
      method: 'GET',
      redirect: 'manual'
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.status === 302 || response.status === 301) {
      const redirectLocation = response.headers.get('location');
      console.log('✅ Redirect detected!');
      console.log('Redirect location:', redirectLocation);
      
      if (redirectLocation && redirectLocation.includes('discord.gg')) {
        console.log('✅ Valid Discord invite redirect!');
        console.log('The invite should work in a browser');
      } else {
        console.log('⚠️ Redirect but not to Discord invite');
      }
    } else if (response.status === 404) {
      console.log('❌ 404 - Invite code not found');
      console.log('This means:');
      console.log('1. The invite code is not in the database');
      console.log('2. The database fix was not applied');
      console.log('3. The environment variables are wrong');
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
  }
  
  console.log('\n📋 Next steps:');
  console.log('1. Run the database fix in Supabase');
  console.log('2. Update Vercel environment variables with correct Supabase URL');
  console.log('3. Redeploy the application');
}

testDeployedInvite();

// Test script to verify Supabase credentials are working
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testSupabaseSetup() {
  console.log('🗄️ Testing Supabase Setup...\n');
  
  // Check if all required environment variables are set
  const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key] || process.env[key].includes('your_'));
  
  if (missing.length > 0) {
    console.error('❌ Missing or invalid Supabase credentials:');
    missing.forEach(key => {
      console.error(`   - ${key}`);
    });
    console.log('\nPlease update your .env file with real Supabase credentials from:');
    console.log('https://supabase.com → Your Project → Settings → API');
    return;
  }
  
  console.log('✅ All Supabase credentials found');
  console.log(`   - URL: ${process.env.SUPABASE_URL}`);
  console.log(`   - Anon Key: ${process.env.SUPABASE_ANON_KEY.substring(0, 20)}...`);
  console.log(`   - Service Role Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`);
  console.log('');
  
  // Test anon client connection
  console.log('🔌 Testing anon client connection...');
  try {
    const anonClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    const { data, error } = await anonClient
      .from('discord_servers')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('⚠️ Anon client test (expected - RLS restrictions):', error.message);
    } else {
      console.log('✅ Anon client connected successfully');
    }
  } catch (error) {
    console.error('❌ Anon client connection failed:', error.message);
  }
  
  // Test service role client connection
  console.log('\n🔌 Testing service role client connection...');
  try {
    const serviceClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data, error } = await serviceClient
      .from('discord_servers')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Service role client test failed:', error.message);
    } else {
      console.log('✅ Service role client connected successfully');
      console.log('   - Can bypass RLS policies');
      console.log('   - Ready for affiliate tracking');
    }
  } catch (error) {
    console.error('❌ Service role client connection failed:', error.message);
  }
  
  console.log('\n📋 Next steps:');
  console.log('1. Run the database fix: fix_affiliate_tracking_complete.sql');
  console.log('2. Test Discord credentials: node test_discord_credentials.js');
  console.log('3. Start your server: npm start');
}

testSupabaseSetup().catch(console.error);

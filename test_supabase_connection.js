// Simple test to check Supabase connection
require('dotenv').config();

async function testConnection() {
  console.log('🔌 Testing Supabase Connection...\n');
  
  console.log('Current SUPABASE_URL:', process.env.SUPABASE_URL);
  
  // Test if the URL is accessible
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
      }
    });
    
    if (response.ok) {
      console.log('✅ Supabase connection successful!');
      console.log('Your URL and credentials are working correctly.');
    } else {
      console.log('⚠️ Connection failed with status:', response.status);
      console.log('This might be normal - checking if project is active...');
    }
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.log('\nPossible issues:');
    console.log('1. Wrong Supabase URL');
    console.log('2. Project is paused/inactive');
    console.log('3. Network connectivity issues');
    console.log('\nDouble-check your Supabase URL in the dashboard:');
    console.log('https://supabase.com → Your Project → Settings → API');
  }
}

testConnection();

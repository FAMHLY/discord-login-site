// Debug script to test webhook functionality
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testSupabaseConnection() {
  try {
    console.log('🔍 Testing Supabase connection...');
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Missing Supabase environment variables:');
      console.error('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing');
      console.error('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
      return;
    }
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Test connection by querying subscriptions table
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      return;
    }
    
    console.log('✅ Supabase connection successful');
    console.log(`📊 Found ${data.length} existing subscriptions`);
    
    if (data.length > 0) {
      console.log('Recent subscriptions:');
      data.forEach(sub => {
        console.log(`  - ${sub.stripe_subscription_id}: ${sub.status} (Server: ${sub.discord_server_id})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error testing Supabase:', error.message);
  }
}

async function testStripeConnection() {
  try {
    console.log('\n🔍 Testing Stripe connection...');
    
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('❌ Missing Stripe environment variable:');
      console.error('   STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? '✅ Set' : '❌ Missing');
      return;
    }
    
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    // Test connection by listing recent events
    const events = await stripe.events.list({ limit: 3 });
    
    console.log('✅ Stripe connection successful');
    console.log(`📊 Found ${events.data.length} recent events`);
    
    if (events.data.length > 0) {
      console.log('Recent events:');
      events.data.forEach(event => {
        console.log(`  - ${event.type}: ${event.id}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error testing Stripe:', error.message);
  }
}

async function main() {
  console.log('🚀 Testing webhook dependencies...\n');
  
  await testSupabaseConnection();
  await testStripeConnection();
  
  console.log('\n📋 Environment Variables Status:');
  console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing');
  console.log('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
  console.log('   STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? '✅ Set' : '❌ Missing');
  console.log('   STRIPE_WEBHOOK_SECRET:', process.env.STRIPE_WEBHOOK_SECRET ? '✅ Set' : '❌ Missing');
}

main().catch(console.error);

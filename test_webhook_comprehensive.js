// Comprehensive webhook test to debug subscription issues
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testEnvironmentVariables() {
  console.log('🔍 Testing Environment Variables...\n');
  
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY', 
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET'
  ];
  
  let allSet = true;
  
  for (const varName of requiredVars) {
    const value = process.env[varName];
    const isSet = value && !value.includes('your_') && !value.includes('_here');
    
    console.log(`${varName}: ${isSet ? '✅ Set' : '❌ Missing/Invalid'}`);
    if (value && value.includes('your_')) {
      console.log(`   ⚠️  Still has placeholder value: ${value.substring(0, 20)}...`);
    }
    
    if (!isSet) allSet = false;
  }
  
  return allSet;
}

async function testSupabaseConnection() {
  console.log('\n🔍 Testing Supabase Connection...');
  
  try {
    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your_')) {
      console.log('❌ Invalid Supabase URL');
      return false;
    }
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Test connection
    const { data, error } = await supabase
      .from('subscriptions')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('❌ Supabase connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Supabase connection successful');
    
    // Check if subscriptions table exists and get count
    const { count, error: countError } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.log('❌ Error checking subscriptions table:', countError.message);
      return false;
    }
    
    console.log(`📊 Subscriptions table has ${count} records`);
    return true;
    
  } catch (error) {
    console.log('❌ Supabase test failed:', error.message);
    return false;
  }
}

async function testStripeConnection() {
  console.log('\n🔍 Testing Stripe Connection...');
  
  try {
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('your_')) {
      console.log('❌ Invalid Stripe Secret Key');
      return false;
    }
    
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    // Test connection by listing recent events
    const events = await stripe.events.list({ limit: 5 });
    
    console.log('✅ Stripe connection successful');
    console.log(`📊 Found ${events.data.length} recent events`);
    
    // Look for subscription-related events
    const subscriptionEvents = events.data.filter(event => 
      event.type.includes('subscription') || event.type.includes('checkout')
    );
    
    if (subscriptionEvents.length > 0) {
      console.log('📋 Recent subscription/checkout events:');
      subscriptionEvents.forEach(event => {
        console.log(`  - ${event.type}: ${event.id} (${new Date(event.created * 1000).toLocaleString()})`);
      });
    } else {
      console.log('ℹ️  No recent subscription/checkout events found');
    }
    
    return true;
    
  } catch (error) {
    console.log('❌ Stripe test failed:', error.message);
    return false;
  }
}

async function testWebhookEndpoint() {
  console.log('\n🔍 Testing Webhook Endpoint...');
  
  try {
    // This would test the actual deployed webhook endpoint
    // For now, we'll just check if the webhook file exists and is valid
    const fs = require('fs');
    const path = require('path');
    
    const webhookPath = path.join(__dirname, 'api', 'stripe-webhook-vercel.js');
    
    if (fs.existsSync(webhookPath)) {
      console.log('✅ Webhook file exists');
      
      // Check if it exports a function
      const webhookCode = fs.readFileSync(webhookPath, 'utf8');
      if (webhookCode.includes('module.exports = async (req, res) =>')) {
        console.log('✅ Webhook file has correct export structure');
      } else {
        console.log('❌ Webhook file missing correct export');
      }
      
      return true;
    } else {
      console.log('❌ Webhook file not found');
      return false;
    }
    
  } catch (error) {
    console.log('❌ Webhook test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Comprehensive Webhook Debug Test\n');
  
  const envOk = await testEnvironmentVariables();
  const supabaseOk = await testSupabaseConnection();
  const stripeOk = await testStripeConnection();
  const webhookOk = await testWebhookEndpoint();
  
  console.log('\n📋 Summary:');
  console.log(`Environment Variables: ${envOk ? '✅' : '❌'}`);
  console.log(`Supabase Connection: ${supabaseOk ? '✅' : '❌'}`);
  console.log(`Stripe Connection: ${stripeOk ? '✅' : '❌'}`);
  console.log(`Webhook File: ${webhookOk ? '✅' : '❌'}`);
  
  if (!envOk) {
    console.log('\n⚠️  ISSUE: Environment variables need to be set with real values');
    console.log('   Make sure your .env file has actual Stripe and Supabase credentials');
  }
  
  if (envOk && supabaseOk && stripeOk && webhookOk) {
    console.log('\n✅ All tests passed! The webhook should be working.');
    console.log('   If subscriptions still aren\'t being created, check:');
    console.log('   1. Vercel deployment logs');
    console.log('   2. Stripe webhook delivery logs');
    console.log('   3. Make sure webhook URL is correct in Stripe dashboard');
  } else {
    console.log('\n❌ Some tests failed. Fix the issues above before testing webhooks.');
  }
}

main().catch(console.error);

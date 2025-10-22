// Test script to check if Vercel webhook endpoint is accessible
const https = require('https');

async function testVercelWebhook() {
  console.log('🔍 Testing Vercel Webhook Endpoint...\n');
  
  // You'll need to replace this with your actual Vercel domain
  const webhookUrl = 'https://your-app-name.vercel.app/api/stripe/webhook';
  
  console.log('⚠️  To test your webhook endpoint:');
  console.log('1. Replace "your-app-name" in the script with your actual Vercel domain');
  console.log('2. Make sure your app is deployed to Vercel');
  console.log('3. Run this script to test the endpoint\n');
  
  console.log('Current webhook URL would be:', webhookUrl);
  console.log('\nTo test manually:');
  console.log('1. Go to your Vercel dashboard');
  console.log('2. Find your deployed app URL');
  console.log('3. Test: curl -X POST https://your-domain.vercel.app/api/stripe/webhook');
  console.log('4. Check Vercel function logs for any errors');
  
  console.log('\n📋 Checklist for webhook debugging:');
  console.log('✅ Code deployed to Vercel');
  console.log('✅ Environment variables set in Vercel dashboard');
  console.log('✅ Stripe webhook endpoint configured');
  console.log('✅ Webhook events enabled in Stripe dashboard');
  console.log('✅ Test checkout completed');
  console.log('✅ Check Vercel function logs');
  console.log('✅ Check Stripe webhook delivery logs');
}

testVercelWebhook().catch(console.error);

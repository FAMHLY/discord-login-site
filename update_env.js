// Script to help update .env file with real credentials
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function updateEnvFile() {
  console.log('🔧 Environment Variables Setup\n');
  console.log('Please provide your actual credentials (press Enter to skip if you want to keep current value):\n');
  
  // Read current .env file
  let envContent = '';
  try {
    envContent = fs.readFileSync('.env', 'utf8');
  } catch (error) {
    console.log('No existing .env file found, creating new one...\n');
  }
  
  const envVars = {
    SUPABASE_URL: 'your_supabase_url_here',
    SUPABASE_SERVICE_ROLE_KEY: 'your_supabase_service_role_key_here',
    STRIPE_SECRET_KEY: 'sk_test_your_stripe_secret_key_here',
    STRIPE_WEBHOOK_SECRET: 'whsec_your_webhook_secret_here'
  };
  
  // Extract current values
  for (const [key, defaultValue] of Object.entries(envVars)) {
    const match = envContent.match(new RegExp(`${key}=(.+)`));
    if (match) {
      envVars[key] = match[1].trim();
    }
  }
  
  console.log('Current values:');
  for (const [key, value] of Object.entries(envVars)) {
    console.log(`${key}: ${value.substring(0, 20)}${value.length > 20 ? '...' : ''}`);
  }
  console.log('');
  
  // Ask for updates
  for (const [key, currentValue] of Object.entries(envVars)) {
    if (currentValue.includes('your_') || currentValue.includes('_here')) {
      const newValue = await askQuestion(`Enter ${key}: `);
      if (newValue.trim()) {
        envVars[key] = newValue.trim();
      }
    }
  }
  
  // Write new .env file
  const newEnvContent = `# Supabase Configuration
SUPABASE_URL=${envVars.SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=${envVars.SUPABASE_SERVICE_ROLE_KEY}

# Stripe Configuration
STRIPE_SECRET_KEY=${envVars.STRIPE_SECRET_KEY}
STRIPE_WEBHOOK_SECRET=${envVars.STRIPE_WEBHOOK_SECRET}
`;
  
  fs.writeFileSync('.env', newEnvContent);
  console.log('\n✅ .env file updated successfully!');
  
  rl.close();
}

updateEnvFile().catch(console.error);

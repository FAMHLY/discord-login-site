// Quick test to verify cron scheduling is working
require('dotenv').config();
const cron = require('node-cron');

console.log('Testing cron schedule...');

// Test schedule - run every minute for testing
const testJob = cron.schedule('* * * * *', () => {
    const now = new Date();
    const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    console.log(`⏰ Cron triggered at: ${estTime.toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`);
}, {
    timezone: 'America/New_York'
});

console.log('✅ Test cron job scheduled (runs every minute)');
console.log('Current EST time:', new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));

// Test the actual schedules
console.log('\n📅 Scheduled times:');
console.log('  - Midnight: 00:00 EST/EDT');
console.log('  - Noon: 12:00 EST/EDT');

// Keep process running for 2 minutes to test
setTimeout(() => {
    testJob.stop();
    console.log('\n✅ Test complete. If you saw cron messages, cron is working!');
    process.exit(0);
}, 120000);



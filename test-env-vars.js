// Simple test to verify environment variables are loaded in React context
console.log('🔍 Testing React Environment Variables...\n');

// Simulate what the React app would see
const envVars = {
  REACT_APP_TOAST_CLIENT_ID: process.env.REACT_APP_TOAST_CLIENT_ID,
  REACT_APP_TOAST_CLIENT_SECRET: process.env.REACT_APP_TOAST_CLIENT_SECRET,
  REACT_APP_TOAST_RESTAURANT_GUID: process.env.REACT_APP_TOAST_RESTAURANT_GUID
};

console.log('Environment Variables Found:');
Object.entries(envVars).forEach(([key, value]) => {
  if (value) {
    console.log(`✅ ${key}: ${key.includes('SECRET') ? value.substring(0, 8) + '...' : value}`);
  } else {
    console.log(`❌ ${key}: NOT FOUND`);
  }
});

console.log('\nAll REACT_APP environment variables:');
const allReactEnvVars = Object.keys(process.env).filter(key => key.startsWith('REACT_APP'));
console.log(allReactEnvVars);

// Check if .env file exists and is readable
const fs = require('fs');
const path = require('path');

try {
  const envPath = path.join(__dirname, 'noe-sushi-operations', '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log('\n✅ .env file exists and is readable');

  const toastLines = envContent.split('\n').filter(line => line.includes('TOAST'));
  console.log('Toast POS lines in .env:');
  toastLines.forEach(line => console.log('  ', line));
} catch (error) {
  console.log('\n❌ Error reading .env file:', error.message);
}
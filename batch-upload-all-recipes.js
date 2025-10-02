const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function uploadAllRecipes() {
  const recipesDir = './noe_recipes';
  const csvFiles = fs.readdirSync(recipesDir).filter(file => file.endsWith('.csv') && !file.includes('INDEX') && !file.includes('Ingredient_Database'));

  console.log(`🚀 Found ${csvFiles.length} recipe files to upload`);
  console.log('📁 Files to process:', csvFiles.slice(0, 10).join(', ') + (csvFiles.length > 10 ? '...' : ''));

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < csvFiles.length; i++) {
    const file = csvFiles[i];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 Processing ${i + 1}/${csvFiles.length}: ${file}`);
    console.log(`${'='.repeat(60)}`);

    try {
      const result = execSync(`node advanced-csv-upload-script.js noe_recipes/${file}`, {
        encoding: 'utf8',
        stdio: 'inherit'
      });
      successCount++;
      console.log(`✅ Successfully processed ${file}`);
    } catch (error) {
      errorCount++;
      console.error(`❌ Error processing ${file}:`, error.message);
    }

    // Add delay between uploads to avoid rate limits
    if (i < csvFiles.length - 1) {
      console.log('⏳ Waiting 2 seconds before next upload...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('🎉 BATCH UPLOAD COMPLETE!');
  console.log(`${'='.repeat(60)}`);
  console.log(`✅ Successful uploads: ${successCount}`);
  console.log(`❌ Failed uploads: ${errorCount}`);
  console.log(`📊 Total files processed: ${csvFiles.length}`);
  console.log(`${'='.repeat(60)}`);
}

uploadAllRecipes().catch(console.error);
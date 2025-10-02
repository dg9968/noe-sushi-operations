require('dotenv').config({ path: './api/.env' });
const Airtable = require('airtable');

const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

async function testRecipeComponentsTable() {
  console.log('🔍 Testing Recipe Components Table\n');

  try {
    // Test if table exists
    console.log('1️⃣ Checking if Recipe Components table exists...');
    const records = await base('Recipe Components').select({ maxRecords: 5 }).all();
    console.log(`   ✅ Table exists! Found ${records.length} records`);

    if (records.length > 0) {
      console.log('\n   📋 Sample records:');
      records.forEach(rec => {
        console.log(`      - ID: ${rec.id}`);
        console.log(`        Parent Recipe: ${rec.fields['Parent Recipe']}`);
        console.log(`        Sub-Recipe: ${rec.fields['Sub-Recipe']}`);
        console.log(`        Servings: ${rec.fields['Servings']}`);
        console.log(`        All fields: ${Object.keys(rec.fields).join(', ')}`);
        console.log('');
      });
    } else {
      console.log('   ⚠️ Table is empty - no records yet');
    }

    // Try to create a test record
    console.log('\n2️⃣ Attempting to create a test record...');
    const testRecipes = await base('Recipes').select({ maxRecords: 2 }).all();

    if (testRecipes.length >= 2) {
      try {
        const testRecord = await base('Recipe Components').create({
          'Parent Recipe': [testRecipes[0].id],
          'Sub-Recipe': [testRecipes[1].id],
          'Servings': 1
        });
        console.log(`   ✅ Successfully created test record: ${testRecord.id}`);

        // Clean up
        await base('Recipe Components').destroy(testRecord.id);
        console.log(`   🗑️ Test record deleted`);
      } catch (createError) {
        console.log(`   ❌ Failed to create test record:`);
        console.log(`      Error: ${createError.message}`);
        console.log(`      Statuscode: ${createError.statusCode}`);
      }
    }

    console.log('\n✅ Test complete!\n');

  } catch (error) {
    console.error('❌ Table does not exist or error accessing it:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Status: ${error.statusCode}`);
    console.error('\n💡 Please create the "Recipe Components" table in Airtable');
    console.error('   See AIRTABLE_SUB_RECIPE_SETUP.md for instructions\n');
  }
}

testRecipeComponentsTable().then(() => process.exit(0));
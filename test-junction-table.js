require('dotenv').config({ path: './api/.env' });
const Airtable = require('airtable');

const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

async function testJunctionTable() {
  console.log('🔍 Testing Junction Table Setup\n');

  try {
    // Test 1: Get sample Recipes
    console.log('1️⃣ Fetching sample recipes...');
    const recipes = await base('Recipes').select({ maxRecords: 3 }).all();
    console.log(`   ✅ Found ${recipes.length} recipes`);
    if (recipes.length > 0) {
      console.log(`   📝 Sample recipe: ${recipes[0].fields.Name} (ID: ${recipes[0].id})`);
    }

    // Test 2: Get sample Ingredients
    console.log('\n2️⃣ Fetching sample ingredients...');
    const ingredients = await base('Ingredients').select({ maxRecords: 3 }).all();
    console.log(`   ✅ Found ${ingredients.length} ingredients`);
    if (ingredients.length > 0) {
      console.log(`   📝 Sample ingredient: ${ingredients[0].fields['Ingredient Name']} (ID: ${ingredients[0].id})`);
    }

    // Test 3: Check Recipe Ingredients junction table
    console.log('\n3️⃣ Checking Recipe Ingredients junction table...');
    const junctionRecords = await base('Recipe Ingredients').select({ maxRecords: 5 }).all();
    console.log(`   ✅ Found ${junctionRecords.length} junction records`);

    if (junctionRecords.length > 0) {
      console.log('\n   📋 Sample junction record:');
      const sample = junctionRecords[0];
      console.log(`      - Record ID: ${sample.id}`);
      console.log(`      - Recipe field: ${JSON.stringify(sample.fields['Recipe'])}`);
      console.log(`      - Ingredient field: ${JSON.stringify(sample.fields['Ingredient'])}`);
      console.log(`      - Quantity: ${sample.fields['Quantity']}`);
      console.log(`      - Unit: ${sample.fields['Unit']}`);
      console.log(`      - All fields: ${Object.keys(sample.fields).join(', ')}`);
    }

    // Test 4: Try to create a test junction record
    if (recipes.length > 0 && ingredients.length > 0) {
      console.log('\n4️⃣ Attempting to create a test junction record...');
      try {
        const testRecord = await base('Recipe Ingredients').create({
          'Recipe': [recipes[0].id],
          'Ingredient': [ingredients[0].id],
          'Quantity': 1,
          'Unit': 'oz'
        });
        console.log(`   ✅ Successfully created test junction record: ${testRecord.id}`);

        // Clean up - delete the test record
        await base('Recipe Ingredients').destroy(testRecord.id);
        console.log(`   🗑️ Test record deleted`);
      } catch (createError) {
        console.log(`   ❌ Failed to create junction record:`);
        console.log(`      Error: ${createError.message}`);
      }
    }

    console.log('\n✅ Test complete!\n');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testJunctionTable();
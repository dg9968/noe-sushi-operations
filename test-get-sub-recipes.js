require('dotenv').config({ path: './api/.env' });
const Airtable = require('airtable');

const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

async function testGetSubRecipes() {
  const comboPlateId = 'recsTPQGXbPY2UmYc';

  console.log(`🔍 Testing getRecipeSubRecipes for Combo Plate (${comboPlateId})\n`);

  try {
    // Method 1: Using FIND with ARRAYJOIN (current method)
    console.log('1️⃣ Testing with FIND/ARRAYJOIN formula...');
    const formula1 = `FIND("${comboPlateId}", ARRAYJOIN({Parent Recipe}))`;
    console.log(`   Formula: ${formula1}`);

    const records1 = await base('Recipe Components').select({
      filterByFormula: formula1
    }).all();
    console.log(`   ✅ Found ${records1.length} records`);

    // Method 2: Get all records and filter manually
    console.log('\n2️⃣ Testing manual filtering...');
    const allRecords = await base('Recipe Components').select().all();
    console.log(`   Total records in table: ${allRecords.length}`);

    const filtered = allRecords.filter(record => {
      const parentRecipe = record.fields['Parent Recipe'];
      console.log(`   Checking record ${record.id}:`);
      console.log(`     Parent Recipe field: ${JSON.stringify(parentRecipe)}`);
      console.log(`     Type: ${typeof parentRecipe}, isArray: ${Array.isArray(parentRecipe)}`);

      if (Array.isArray(parentRecipe)) {
        const matches = parentRecipe.includes(comboPlateId);
        console.log(`     Includes ${comboPlateId}? ${matches}`);
        return matches;
      }
      return parentRecipe === comboPlateId;
    });

    console.log(`   ✅ Manually filtered: ${filtered.length} records`);

    if (filtered.length > 0) {
      console.log('\n   📋 Found sub-recipe:');
      const rec = filtered[0];
      console.log(`     Sub-Recipe ID: ${rec.fields['Sub-Recipe']?.[0]}`);
      console.log(`     Servings: ${rec.fields['Servings']}`);

      const subRecipeId = rec.fields['Sub-Recipe']?.[0];
      if (subRecipeId) {
        const subRecipe = await base('Recipes').find(subRecipeId);
        console.log(`     Sub-Recipe Name: ${subRecipe.fields.Name}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testGetSubRecipes().then(() => process.exit(0));
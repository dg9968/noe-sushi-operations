require('dotenv').config({ path: './api/.env' });
const Airtable = require('airtable');

const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

async function testComboPlate() {
  console.log('🔍 Testing Combo Plate Recipe\n');

  try {
    // Find Combo Plate recipe
    console.log('1️⃣ Finding Combo Plate recipe...');
    const recipes = await base('Recipes').select({
      filterByFormula: `SEARCH("Combo Plate", {Name})`
    }).all();

    if (recipes.length === 0) {
      console.log('   ❌ No Combo Plate recipe found');
      return;
    }

    const comboPlate = recipes[0];
    console.log(`   ✅ Found: ${comboPlate.fields.Name} (ID: ${comboPlate.id})`);

    // Check Recipe Ingredients
    console.log('\n2️⃣ Checking Recipe Ingredients table...');
    const ingredientRecords = await base('Recipe Ingredients').select({
      filterByFormula: `FIND("${comboPlate.id}", ARRAYJOIN({Recipe}))`
    }).all();
    console.log(`   ✅ Found ${ingredientRecords.length} regular ingredients`);
    ingredientRecords.forEach(rec => {
      console.log(`      - ${rec.fields['Ingredient']}: ${rec.fields['Quantity']} ${rec.fields['Unit']}`);
    });

    // Check Recipe Components
    console.log('\n3️⃣ Checking Recipe Components table...');
    const componentRecords = await base('Recipe Components').select({
      filterByFormula: `FIND("${comboPlate.id}", ARRAYJOIN({Parent Recipe}))`
    }).all();
    console.log(`   ✅ Found ${componentRecords.length} sub-recipes`);

    if (componentRecords.length > 0) {
      for (const rec of componentRecords) {
        const subRecipeId = rec.fields['Sub-Recipe']?.[0];
        const servings = rec.fields['Servings'];

        if (subRecipeId) {
          const subRecipe = await base('Recipes').find(subRecipeId);
          console.log(`      - [Recipe] ${subRecipe.fields.Name} (${servings} servings)`);
        }
      }
    } else {
      console.log('      ⚠️ No sub-recipes found in Recipe Components table');
      console.log('      💡 Make sure the Recipe Components table exists with correct field names');
    }

    // Test the API endpoint
    console.log('\n4️⃣ Testing API endpoint...');
    const http = require('http');

    return new Promise((resolve) => {
      http.get(`http://localhost:5000/api/recipes/${comboPlate.id}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const response = JSON.parse(data);
          if (response.success) {
            console.log(`   ✅ API returned ${response.data.ingredients.length} total ingredients/sub-recipes`);
            response.data.ingredients.forEach(ing => {
              console.log(`      - ${ing.name} (${ing.quantity} ${ing.unit}) - $${ing.totalCost?.toFixed(2)}`);
            });
          } else {
            console.log(`   ❌ API error: ${response.message}`);
          }
          resolve();
        });
      });
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testComboPlate().then(() => process.exit(0));
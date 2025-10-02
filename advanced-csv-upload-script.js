const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
require('dotenv').config();

// Configure Airtable
const Airtable = require('airtable');
if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
  console.error('❌ Please set AIRTABLE_API_KEY and AIRTABLE_BASE_ID in your .env file');
  process.exit(1);
}

Airtable.configure({
  endpointUrl: 'https://api.airtable.com',
  apiKey: process.env.AIRTABLE_API_KEY
});

const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

class AdvancedRecipeUploader {
  constructor() {
    this.ingredients = new Map();
    this.recipes = new Map();
    this.stats = {
      ingredientsCreated: 0,
      ingredientsUpdated: 0,
      recipesCreated: 0,
      junctionRecordsCreated: 0,
      errors: 0,
      recipesProcessed: 0
    };
    this.currentRecipe = null;
    this.currentRecipeData = {
      ingredients: [],
      totalCost: 0,
      qFactor: 0,
      portionCost: 0,
      additionalCost: 0,
      currentPrice: 0,
      category: '',
      servings: 1
    };
  }

  // Parse CSV with flexible column detection
  async parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv({
          separator: ',',
          skipEmptyLines: true,
          headers: false // Don't treat first row as headers since format varies
        }))
        .on('data', (data) => {
          // Convert array-like object to actual array
          const row = Object.values(data);
          if (row.some(cell => cell && cell.trim())) { // Skip empty rows
            results.push(row);
          }
        })
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  // Parse unit cost from your format
  parseUnitCost(costStr) {
    if (!costStr || costStr === '') return 0;
    const cost = parseFloat(costStr);
    return isNaN(cost) ? 0 : cost;
  }

  // Parse quantity
  parseQuantity(qtyStr) {
    if (!qtyStr || qtyStr === '') return 0;
    const qty = parseFloat(qtyStr);
    return isNaN(qty) ? 0 : qty;
  }

  // Normalize units to standard Airtable units
  normalizeUnit(unit) {
    const unitMapping = {
      'Oz(w)': 'oz',
      'Oz(v)': 'oz',
      'Un': 'each',
      'LB': 'lb',
      'cups': 'cup',
      'piece': 'piece',
      'each': 'each',
      'tsp': 'tsp',
      'tbsp': 'tbsp',
      'kg': 'kg',
      'g': 'g'
    };

    return unitMapping[unit] || 'oz'; // Default to 'oz' if unit not found
  }

  // Get or create ingredient with actual cost data
  async getOrCreateIngredient(ingredientName, unitCost = 0, unit = 'oz') {
    // Normalize the unit
    const normalizedUnit = this.normalizeUnit(unit);
    if (this.ingredients.has(ingredientName)) {
      const existing = this.ingredients.get(ingredientName);

      // Update cost if we have better data
      if (unitCost > 0 && unitCost !== existing.fields['Unit Cost']) {
        try {
          await base('Ingredients').update(existing.id, {
            'Unit Cost': unitCost
          });
          console.log(`💰 Updated cost for ${ingredientName}: $${unitCost}/${unit}`);
          this.stats.ingredientsUpdated++;
        } catch (error) {
          console.error(`❌ Error updating ingredient cost:`, error.message);
        }
      }

      return existing;
    }

    try {
      // Search for existing ingredient
      const existingIngredients = await base('Ingredients').select({
        filterByFormula: `{Ingredient Name} = "${ingredientName.replace(/"/g, '\\"')}"`,
        maxRecords: 1
      }).all();

      if (existingIngredients.length > 0) {
        const ingredient = existingIngredients[0];
        this.ingredients.set(ingredientName, ingredient);

        // Update cost if we have better data
        if (unitCost > 0 && unitCost !== ingredient.fields['Unit Cost']) {
          try {
            await base('Ingredients').update(ingredient.id, {
              'Unit Cost': unitCost
            });
            console.log(`💰 Updated existing ingredient ${ingredientName}: $${unitCost}/${unit}`);
            this.stats.ingredientsUpdated++;
          } catch (error) {
            console.error(`❌ Error updating ingredient:`, error.message);
          }
        }

        console.log(`✓ Found existing ingredient: ${ingredientName}`);
        return ingredient;
      }

      // Create new ingredient
      const newIngredient = await base('Ingredients').create({
        'Ingredient Name': ingredientName,
        'Unit Cost': unitCost || 0,
        'Unit': normalizedUnit,
        'From Odoo': false
      });

      this.ingredients.set(ingredientName, newIngredient);
      this.stats.ingredientsCreated++;
      console.log(`✅ Created ingredient: ${ingredientName} ($${unitCost}/${normalizedUnit})`);
      return newIngredient;

    } catch (error) {
      console.error(`❌ Error with ingredient ${ingredientName}:`, error.message);
      this.stats.errors++;
      return null;
    }
  }

  // Create recipe with full cost data
  async createRecipeWithCosts(recipeName, recipeData) {
    try {
      // Search for existing recipe
      const existingRecipes = await base('Recipes').select({
        filterByFormula: `{Name} = "${recipeName.replace(/"/g, '\\"')}"`,
        maxRecords: 1
      }).all();

      if (existingRecipes.length > 0) {
        const recipe = existingRecipes[0];
        console.log(`✓ Found existing recipe: ${recipeName}`);
        return recipe;
      }

      // Create new recipe with all the cost data
      const newRecipe = await base('Recipes').create({
        'Name': recipeName,
        'Description': `${recipeName} - imported with full costing data`,
        'Category': recipeData.category || 'Hot Entrees',
        'Servings': recipeData.servings || 1,
        'Prep Time': 30, // Default
        'Cook Time': 20  // Default
      });

      this.stats.recipesCreated++;
      console.log(`✅ Created recipe: ${recipeName}`);
      console.log(`   💰 Total Cost: $${recipeData.totalCost.toFixed(4)}`);
      console.log(`   📊 Q Factor: ${recipeData.qFactor}%`);
      console.log(`   🍽️ Portion Cost: $${recipeData.portionCost.toFixed(4)}`);

      return newRecipe;

    } catch (error) {
      console.error(`❌ Error creating recipe ${recipeName}:`, error.message);
      this.stats.errors++;
      return null;
    }
  }

  // Process the complex CSV format
  async processAdvancedCSV(filePath) {
    console.log(`\n🔄 Processing advanced CSV file: ${filePath}`);

    try {
      const rows = await this.parseCSV(filePath);
      console.log(`📊 Found ${rows.length} rows to process\n`);

      // Extract recipe name from filename (remove path and .csv extension)
      const filename = filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
      let currentRecipeName = filename.replace('.csv', '').replace(/_/g, ' ');

      console.log(`🍜 Recipe name from filename: ${currentRecipeName}`);

      let currentRecipeData = {
        ingredients: [],
        category: 'Hot Entrees',
        servings: 1,
        totalCost: 0,
        qFactor: 0,
        portionCost: 0,
        additionalCost: 0,
        currentPrice: 0
      };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // Skip empty rows
        if (!row || row.every(cell => !cell || cell.trim() === '')) {
          continue;
        }

        const firstCol = (row[0] || '').trim();
        const secondCol = (row[1] || '').trim();
        const thirdCol = (row[2] || '').trim();
        const fourthCol = (row[3] || '').trim();

        // Detect category from MENU CATEGORY row
        if (secondCol === 'MENU CATEGORY:' && fourthCol) {
          // Map categories to valid Airtable options
          const categoryMapping = {
            'Combinations': 'Mains',
            'Hot Entrees': 'Mains',
            'Cold Appetizers': 'Appetizers',
            'Hot Appetizers': 'Appetizers',
            'Desserts': 'Desserts',
            'Beverages': 'Beverages',
            'Sides': 'Sides',
            'Sauces': 'Sauces'
          };

          currentRecipeData.category = categoryMapping[fourthCol] || 'Mains';
          console.log(`   📋 Category: ${fourthCol} → ${currentRecipeData.category}`);
          continue;
        }

        // Detect ingredient row (has quantity, unit, ingredient name, and costs)
        if (firstCol && firstCol !== '__Recipe' && row.length >= 11) {
          const qty = this.parseQuantity(row[1]); // QTY
          const unit = (row[2] || '').trim(); // UNIT
          const ingredient = (row[5] || '').trim(); // INGREDIENT
          const cost = this.parseUnitCost(row[6]); // COST
          const unitCost = (row[7] || '').trim(); // UNIT
          const ingredientCost = this.parseUnitCost(row[10]); // INGREDIENT COST

          if (ingredient && qty > 0) {
            currentRecipeData.ingredients.push({
              name: ingredient,
              quantity: qty,
              unit: unit,
              cost: cost,
              ingredientCost: ingredientCost
            });

            console.log(`   📝 ${ingredient}: ${qty} ${unit} @ $${cost}/${unit}`);
          }
          continue;
        }

        // Detect cost summary rows
        if (secondCol && secondCol.includes('INGREDIENT COST')) {
          currentRecipeData.totalCost = this.parseUnitCost(fourthCol);
          console.log(`   💰 Total Ingredient Cost: $${currentRecipeData.totalCost.toFixed(4)}`);
          continue;
        }

        if (secondCol && secondCol.includes('Q FACTOR')) {
          const qFactorCost = this.parseUnitCost(fourthCol);
          currentRecipeData.qFactor = 15; // From your example
          console.log(`   📊 Q Factor (15%): $${qFactorCost.toFixed(4)}`);
          continue;
        }

        if (secondCol && secondCol.includes('PORTION COST')) {
          currentRecipeData.portionCost = this.parseUnitCost(fourthCol);
          continue;
        }

        if (secondCol && secondCol.includes('ADDITIONAL COST')) {
          currentRecipeData.additionalCost = this.parseUnitCost(fourthCol);
          continue;
        }

        if (secondCol && secondCol.includes('CURRENT PRICE')) {
          currentRecipeData.currentPrice = this.parseUnitCost(fourthCol);
          continue;
        }
      }

      // Save the recipe (there should only be one per file)
      if (currentRecipeData.ingredients.length > 0) {
        await this.saveRecipe(currentRecipeName, currentRecipeData);
      } else {
        console.log(`⚠️ No ingredients found for recipe: ${currentRecipeName}`);
      }

    } catch (error) {
      console.error('❌ Error processing CSV:', error);
      this.stats.errors++;
    }
  }

  // Save recipe and create all relationships
  async saveRecipe(recipeName, recipeData) {
    console.log(`\n💾 Saving recipe: ${recipeName}`);

    try {
      // Create recipe
      const recipe = await this.createRecipeWithCosts(recipeName, recipeData);
      if (!recipe) return;

      // Create ingredients and junction records
      for (const ing of recipeData.ingredients) {
        const ingredient = await this.getOrCreateIngredient(ing.name, ing.cost, ing.unit);
        if (!ingredient) continue;

        // Create junction record
        try {
          const normalizedUnit = this.normalizeUnit(ing.unit);
          await base('Recipe Ingredients').create({
            'Recipe': [recipe.id],
            'Ingredient': [ingredient.id],
            'Quantity': ing.quantity,
            'Unit': normalizedUnit
          });

          this.stats.junctionRecordsCreated++;
        } catch (error) {
          console.error(`❌ Error creating junction record:`, error.message);
          this.stats.errors++;
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.stats.recipesProcessed++;
      console.log(`✅ Recipe ${recipeName} saved with ${recipeData.ingredients.length} ingredients`);

    } catch (error) {
      console.error(`❌ Error saving recipe ${recipeName}:`, error);
      this.stats.errors++;
    }
  }

  // Print final stats
  printStats() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 ADVANCED CSV UPLOAD SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Recipes processed: ${this.stats.recipesProcessed}`);
    console.log(`✅ Recipes created: ${this.stats.recipesCreated}`);
    console.log(`✅ Ingredients created: ${this.stats.ingredientsCreated}`);
    console.log(`💰 Ingredients updated with costs: ${this.stats.ingredientsUpdated}`);
    console.log(`✅ Junction records created: ${this.stats.junctionRecordsCreated}`);
    console.log(`❌ Errors encountered: ${this.stats.errors}`);
    console.log('='.repeat(60));
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node advanced-csv-upload-script.js <path-to-csv-file>');
    console.log('Example: node advanced-csv-upload-script.js beef-ramen-recipe.csv');
    process.exit(1);
  }

  const csvFile = args[0];

  if (!fs.existsSync(csvFile)) {
    console.error(`❌ File not found: ${csvFile}`);
    process.exit(1);
  }

  console.log('🚀 Starting advanced CSV upload to Airtable...');
  console.log(`📁 File: ${csvFile}`);

  const uploader = new AdvancedRecipeUploader();

  try {
    await uploader.processAdvancedCSV(csvFile);
    uploader.printStats();
    console.log('\n🎉 Upload completed with full costing data!');
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = AdvancedRecipeUploader;
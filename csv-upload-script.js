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

class RecipeUploader {
  constructor() {
    this.ingredients = new Map(); // Cache ingredients by name
    this.recipes = new Map(); // Cache recipes by name
    this.stats = {
      ingredientsCreated: 0,
      recipesCreated: 0,
      junctionRecordsCreated: 0,
      errors: 0
    };
  }

  // Parse CSV file
  async parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  // Get or create ingredient
  async getOrCreateIngredient(ingredientName, unit = 'oz') {
    if (this.ingredients.has(ingredientName)) {
      return this.ingredients.get(ingredientName);
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
        console.log(`✓ Found existing ingredient: ${ingredientName}`);
        return ingredient;
      }

      // Create new ingredient with estimated cost
      const estimatedCost = this.estimateIngredientCost(ingredientName);
      const newIngredient = await base('Ingredients').create({
        'Ingredient Name': ingredientName,
        'Unit Cost': estimatedCost,
        'Unit': unit,
        'From Odoo': false
      });

      this.ingredients.set(ingredientName, newIngredient);
      this.stats.ingredientsCreated++;
      console.log(`✅ Created ingredient: ${ingredientName} ($${estimatedCost}/${unit})`);
      return newIngredient;

    } catch (error) {
      console.error(`❌ Error with ingredient ${ingredientName}:`, error.message);
      this.stats.errors++;
      return null;
    }
  }

  // Simple cost estimation based on ingredient name
  estimateIngredientCost(name) {
    const lowerName = name.toLowerCase();

    // Seafood - higher cost
    if (lowerName.includes('salmon') || lowerName.includes('tuna') || lowerName.includes('crab')) {
      return Math.random() * 5 + 8; // $8-13
    }

    // Vegetables - lower cost
    if (lowerName.includes('lettuce') || lowerName.includes('cucumber') || lowerName.includes('carrot')) {
      return Math.random() * 1 + 0.5; // $0.50-1.50
    }

    // Rice/grains - medium-low cost
    if (lowerName.includes('rice') || lowerName.includes('noodle')) {
      return Math.random() * 2 + 1; // $1-3
    }

    // Sauces/seasonings - medium cost
    if (lowerName.includes('sauce') || lowerName.includes('oil') || lowerName.includes('vinegar')) {
      return Math.random() * 3 + 2; // $2-5
    }

    // Default estimation
    return Math.random() * 4 + 1; // $1-5
  }

  // Get or create recipe
  async getOrCreateRecipe(recipeName, category = 'Mains') {
    if (this.recipes.has(recipeName)) {
      return this.recipes.get(recipeName);
    }

    try {
      // Search for existing recipe
      const existingRecipes = await base('Recipes').select({
        filterByFormula: `{Name} = "${recipeName.replace(/"/g, '\\"')}"`,
        maxRecords: 1
      }).all();

      if (existingRecipes.length > 0) {
        const recipe = existingRecipes[0];
        this.recipes.set(recipeName, recipe);
        console.log(`✓ Found existing recipe: ${recipeName}`);
        return recipe;
      }

      // Create new recipe
      const newRecipe = await base('Recipes').create({
        'Name': recipeName,
        'Description': `${recipeName} - imported from CSV`,
        'Category': category,
        'Servings': this.estimateServings(recipeName),
        'Prep Time': Math.floor(Math.random() * 30) + 15, // 15-45 min
        'Cook Time': Math.floor(Math.random() * 20) + 10   // 10-30 min
      });

      this.recipes.set(recipeName, newRecipe);
      this.stats.recipesCreated++;
      console.log(`✅ Created recipe: ${recipeName}`);
      return newRecipe;

    } catch (error) {
      console.error(`❌ Error with recipe ${recipeName}:`, error.message);
      this.stats.errors++;
      return null;
    }
  }

  // Estimate servings based on recipe name
  estimateServings(recipeName) {
    const lowerName = recipeName.toLowerCase();

    if (lowerName.includes('roll') || lowerName.includes('sushi')) {
      return 8; // Typical sushi roll serves 8 pieces
    }

    if (lowerName.includes('soup') || lowerName.includes('salad')) {
      return 4;
    }

    return 6; // Default serving size
  }

  // Create junction table record
  async createJunctionRecord(recipeId, ingredientId, quantity, unit) {
    try {
      const junctionRecord = await base('Recipe Ingredients').create({
        'Recipe': [recipeId],
        'Ingredient': [ingredientId],
        'Quantity': parseFloat(quantity) || 1,
        'Unit': unit || 'oz'
      });

      this.stats.junctionRecordsCreated++;
      return junctionRecord;

    } catch (error) {
      console.error(`❌ Error creating junction record:`, error.message);
      this.stats.errors++;
      return null;
    }
  }

  // Process CSV data
  async processCSV(filePath) {
    console.log(`\n🔄 Processing CSV file: ${filePath}`);

    try {
      const data = await this.parseCSV(filePath);
      console.log(`📊 Found ${data.length} rows to process\n`);

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        console.log(`\n📋 Processing row ${i + 1}/${data.length}`);

        // Expected format: Recipe Name, qty, unit, qty purchased, unit purchased, Ingredient
        const recipeName = row['Recipe Name'] || row.recipeName || Object.values(row)[0];
        const quantity = row.qty || row.quantity || Object.values(row)[1];
        const unit = row.unit || Object.values(row)[2];
        const ingredientName = row.Ingredient || row.ingredient || Object.values(row)[5];

        if (!recipeName || !ingredientName) {
          console.log(`⚠️ Skipping row ${i + 1}: Missing recipe name or ingredient`);
          continue;
        }

        // Get or create ingredient
        const ingredient = await this.getOrCreateIngredient(ingredientName, unit);
        if (!ingredient) continue;

        // Get or create recipe
        const recipe = await this.getOrCreateRecipe(recipeName);
        if (!recipe) continue;

        // Create junction record
        await this.createJunctionRecord(recipe.id, ingredient.id, quantity, unit);

        console.log(`✅ Linked ${ingredientName} (${quantity} ${unit}) to ${recipeName}`);

        // Add small delay to avoid rate limits
        if (i % 10 === 0) {
          console.log('⏳ Taking a short break to avoid rate limits...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

    } catch (error) {
      console.error('❌ Error processing CSV:', error);
      this.stats.errors++;
    }
  }

  // Print final stats
  printStats() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 UPLOAD SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Ingredients created: ${this.stats.ingredientsCreated}`);
    console.log(`✅ Recipes created: ${this.stats.recipesCreated}`);
    console.log(`✅ Junction records created: ${this.stats.junctionRecordsCreated}`);
    console.log(`❌ Errors encountered: ${this.stats.errors}`);
    console.log('='.repeat(50));
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node csv-upload-script.js <path-to-csv-file>');
    console.log('Example: node csv-upload-script.js recipes.csv');
    process.exit(1);
  }

  const csvFile = args[0];

  if (!fs.existsSync(csvFile)) {
    console.error(`❌ File not found: ${csvFile}`);
    process.exit(1);
  }

  console.log('🚀 Starting CSV upload to Airtable...');
  console.log(`📁 File: ${csvFile}`);

  const uploader = new RecipeUploader();

  try {
    await uploader.processCSV(csvFile);
    uploader.printStats();
    console.log('\n🎉 Upload completed!');
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = RecipeUploader;
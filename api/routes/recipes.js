const express = require('express');
const Airtable = require('airtable');
const router = express.Router();

// Configure Airtable with API key
Airtable.configure({
  apiKey: process.env.AIRTABLE_API_KEY
});
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

// Cache for ingredients to avoid repeated API calls
let ingredientsCache = null;
let ingredientsCacheTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Helper function to get ingredients with caching
async function getCachedIngredients() {
  const now = Date.now();

  if (ingredientsCache && ingredientsCacheTime && (now - ingredientsCacheTime < CACHE_DURATION)) {
    return ingredientsCache;
  }

  try {
    const records = await base('Ingredients').select().all();
    ingredientsCache = records.map(record => ({
      id: record.id,
      name: record.fields['Ingredient Name'],
      unitCost: record.fields['Unit Cost'] || 0,
      fromOdoo: record.fields['From Odoo'] || false
    }));
    ingredientsCacheTime = now;
    return ingredientsCache;
  } catch (error) {
    console.error('Error fetching ingredients:', error);
    return ingredientsCache || []; // Return cached version if available
  }
}

// Cache for junction records to reduce API calls
let junctionRecordsCache = null;
let junctionCacheTime = null;

// Helper function to get junction records with caching
async function getCachedJunctionRecords() {
  const now = Date.now();

  if (junctionRecordsCache && junctionCacheTime && (now - junctionCacheTime < CACHE_DURATION)) {
    return junctionRecordsCache;
  }

  try {
    const records = await base('Recipe Ingredients').select().all();
    junctionRecordsCache = records;
    junctionCacheTime = now;
    return junctionRecordsCache;
  } catch (error) {
    console.error('Error fetching junction records:', error);
    return junctionRecordsCache || [];
  }
}

// Optimized: batch fetch ingredients for multiple recipes
async function getRecipeIngredientsBatch(recipeIds, depth = 0, maxDepth = 3) {
  // Prevent infinite recursion for circular recipe dependencies
  if (depth > maxDepth) {
    console.warn(`⚠️ Max recursion depth ${maxDepth} reached, stopping sub-recipe loading`);
    return {};
  }

  try {
    const allJunctionRecords = await getCachedJunctionRecords();
    const cachedIngredients = await getCachedIngredients();
    const recipeIngredientsMap = {};

    // Create ingredient lookup map
    const ingredientMap = {};
    cachedIngredients.forEach(ing => {
      ingredientMap[ing.id] = ing;
    });

    // Group junction records by recipe
    allJunctionRecords.forEach(record => {
      const recipes = record.fields['Recipe'] || [];
      recipes.forEach(recipeId => {
        if (recipeIds.includes(recipeId)) {
          if (!recipeIngredientsMap[recipeId]) {
            recipeIngredientsMap[recipeId] = [];
          }

          // Check for regular ingredient
          const ingredientId = record.fields['Ingredient']?.[0];
          if (ingredientId && ingredientMap[ingredientId]) {
            const recipeQuantity = record.fields['Quantity'] || 0;
            const unitCost = ingredientMap[ingredientId].unitCost || 0;
            const totalCost = recipeQuantity * unitCost;

            recipeIngredientsMap[recipeId].push({
              id: ingredientId,
              name: ingredientMap[ingredientId].name,
              quantity: recipeQuantity,
              unit: record.fields['Unit'] || 'oz',
              cost: unitCost,
              totalCost: totalCost,
              fromOdoo: ingredientMap[ingredientId].fromOdoo || false,
              odooProductName: undefined,
              isRecipe: false
            });
          }

          // Check for sub-recipe
          const subRecipeId = record.fields['Sub Recipe']?.[0];
          if (subRecipeId) {
            // Sub-recipes will need to be loaded separately to get their costs
            const recipeQuantity = record.fields['Quantity'] || 1;

            recipeIngredientsMap[recipeId].push({
              id: subRecipeId,
              name: '[Recipe] Loading...', // Placeholder, will be replaced
              quantity: recipeQuantity,
              unit: record.fields['Unit'] || 'servings',
              cost: 0, // Will be calculated
              totalCost: 0, // Will be calculated
              isRecipe: true,
              recipeId: subRecipeId
            });
          }
        }
      });
    });

    // CRITICAL: Deduplicate ingredients by ID for each recipe to handle duplicate junction records
    Object.keys(recipeIngredientsMap).forEach(recipeId => {
      const ingredients = recipeIngredientsMap[recipeId];
      const ingredientMap = new Map();

      ingredients.forEach(ingredient => {
        const key = ingredient.id;
        if (!ingredientMap.has(key)) {
          ingredientMap.set(key, ingredient);
        } else {
          // If duplicate, sum the quantities and costs
          const existing = ingredientMap.get(key);
          existing.quantity += ingredient.quantity;
          existing.totalCost += ingredient.totalCost;
        }
      });

      recipeIngredientsMap[recipeId] = Array.from(ingredientMap.values());

      if (ingredients.length !== recipeIngredientsMap[recipeId].length) {
        console.log(`🔧 DEDUPLICATION: Recipe ${recipeId} had ${ingredients.length} duplicate ingredients, reduced to ${recipeIngredientsMap[recipeId].length}`);
      }
    });

    // Load sub-recipe details (name and cost per serving)
    for (const recipeId of Object.keys(recipeIngredientsMap)) {
      const ingredients = recipeIngredientsMap[recipeId];

      for (let i = 0; i < ingredients.length; i++) {
        const ingredient = ingredients[i];

        if (ingredient.isRecipe && ingredient.recipeId) {
          try {
            // Fetch the sub-recipe details from Airtable
            const subRecipeRecord = await base('Recipes').find(ingredient.recipeId);
            const subRecipeName = subRecipeRecord.fields.Name;
            const subRecipeServings = subRecipeRecord.fields.Servings || 1;

            // Get the sub-recipe's ingredients to calculate its cost (with depth tracking)
            const subRecipeBatch = await getRecipeIngredientsBatch([ingredient.recipeId], depth + 1, maxDepth);
            const subRecipeIngredients = subRecipeBatch[ingredient.recipeId] || [];
            const subRecipeTotalCost = subRecipeIngredients.reduce((sum, ing) => sum + (ing.totalCost || 0), 0);
            const subRecipeCostPerServing = subRecipeTotalCost / subRecipeServings;

            // Update the ingredient with actual data
            ingredients[i] = {
              ...ingredient,
              name: `[Recipe] ${subRecipeName}`,
              cost: subRecipeCostPerServing,
              totalCost: subRecipeCostPerServing * ingredient.quantity
            };

            console.log(`📦 Loaded sub-recipe: ${subRecipeName} (cost per serving: $${subRecipeCostPerServing.toFixed(4)})`);
          } catch (error) {
            console.error(`❌ Failed to load sub-recipe ${ingredient.recipeId}:`, error.message);
            // Keep the placeholder if loading fails
          }
        }
      }
    }

    return recipeIngredientsMap;
  } catch (error) {
    console.error('Error in getRecipeIngredientsBatch:', error);
    return {};
  }
}

// Helper function to get recipe ingredients from junction table (single recipe)
async function getRecipeIngredients(recipeId) {
  const batchResult = await getRecipeIngredientsBatch([recipeId]);
  return batchResult[recipeId] || [];
}

// GET /api/recipes/list - Get lightweight recipe list by category (FAST)
router.get('/list', async (req, res) => {
  try {
    const { q } = req.query; // Get search query parameter
    console.log(`Recipe list request - Query: "${q || 'none'}"`);

    const records = await base('Recipes').select({
      view: 'Grid view',
      fields: ['Name', 'Category', 'Description', 'Servings', 'Image'], // Only fetch essential fields
      sort: [{ field: 'Name', direction: 'asc' }]
    }).all();

    // Filter records based on search query if provided
    let filteredRecords = records;
    if (q && q.trim().length > 0) {
      const searchTerm = q.toLowerCase().trim();
      filteredRecords = records.filter(record => {
        const name = String(record.fields.Name || '').toLowerCase();
        const description = String(record.fields.Description || '').toLowerCase();

        // Prioritize recipe name and description search
        return name.includes(searchTerm) || description.includes(searchTerm);
      });

      console.log(`Search for "${q}": found ${filteredRecords.length} recipes out of ${records.length} total`);
    }

    // Group recipes by category
    const recipesByCategory = {};

    filteredRecords.forEach(record => {
      const category = record.fields.Category || 'Uncategorized';

      if (!recipesByCategory[category]) {
        recipesByCategory[category] = [];
      }

      recipesByCategory[category].push({
        id: record.id,
        name: record.fields.Name,
        description: record.fields.Description || '',
        servings: record.fields.Servings || 1
      });
    });

    res.json({
      success: true,
      data: recipesByCategory,
      totalRecipes: filteredRecords.length,
      categories: Object.keys(recipesByCategory).sort(),
      query: q || null
    });

  } catch (error) {
    console.error('Error fetching recipe list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recipe list',
      message: error.message
    });
  }
});

// GET /api/recipes - Get all recipes with optimized loading (HEAVY - use sparingly)
router.get('/', async (req, res) => {
  try {
    const { qFactor = 10, limit = 10 } = req.query; // Default 10% Q Factor, limit 10 recipes
    const qFactorNum = parseFloat(qFactor) || 10;
    const limitNum = parseInt(limit) || 10;

    const records = await base('Recipes').select({
      view: 'Grid view',
      sort: [{ field: 'Created Date', direction: 'desc' }],
      maxRecords: limitNum // Limit records for performance
    }).all();

    // Extract recipe IDs for batch ingredient loading
    const recipeIds = records.map(record => record.id);

    // Batch load all ingredients for all recipes at once
    const allRecipeIngredients = await getRecipeIngredientsBatch(recipeIds);

    const recipes = records.map((record) => {
      const ingredients = allRecipeIngredients[record.id] || [];
      const servings = record.fields.Servings || 1;

      // Use stored Q Factor from record, fallback to query parameter, then default
      const storedQFactor = record.fields['Q Factor %'];
      const recipeQFactor = storedQFactor !== undefined ? storedQFactor : qFactorNum;

      // Calculate costs with Q Factor
      const costCalculation = calculateRecipeCostsWithQFactor(ingredients, servings, recipeQFactor);

      return {
        id: record.id,
        name: record.fields.Name,
        description: record.fields.Description || '',
        servings: servings,
        ingredients: ingredients,
        instructions: record.fields.Instructions || '',
        totalCost: costCalculation.totalCost,
        costPerServing: costCalculation.costPerServing,
        category: record.fields.Category || 'Uncategorized',
        prepTime: record.fields['Prep Time'] || 0,
        cookTime: record.fields['Cook Time'] || 0,
        image: record.fields.Image && record.fields.Image.length > 0
          ? record.fields.Image[0].url
          : undefined,
        // Map Q Factor data to interface fields
        qFactorPercentage: costCalculation.qFactor,
        qFactorCost: costCalculation.qFactorAmount,
        totalCostWithQFactor: costCalculation.totalCost,
        costPerServingWithQFactor: costCalculation.costPerServing,
        // Add Q Factor breakdown for additional detail
        costBreakdown: costCalculation.breakdown
      };
    });

    res.json({
      success: true,
      data: recipes,
      count: recipes.length,
      qFactor: qFactorNum,
      limited: true,
      limit: limitNum
    });

  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recipes',
      message: error.message
    });
  }
});

// GET /api/recipes/clear-cache - Clear all caches (for browser access)
router.get('/clear-cache', (req, res) => {
  junctionRecordsCache = null;
  junctionCacheTime = null;
  ingredientsCache = null;
  ingredientsCacheTime = null;

  res.json({
    success: true,
    message: 'All caches cleared successfully - recipes will now show fresh data from Airtable'
  });
});

// GET /api/recipes/duplicates - Find duplicate recipe names
router.get('/duplicates', async (req, res) => {
  try {
    console.log(`🔍 DUPLICATE CHECK: Searching for duplicate recipe names`);

    const allRecipes = await base('Recipes').select({
      fields: ['Name', 'Category', 'Description']
    }).all();

    // Group recipes by name (case-insensitive)
    const recipeGroups = {};
    allRecipes.forEach(recipe => {
      const name = String(recipe.fields.Name || '').toLowerCase().trim();
      if (name) {
        if (!recipeGroups[name]) {
          recipeGroups[name] = [];
        }
        recipeGroups[name].push({
          id: recipe.id,
          name: recipe.fields.Name,
          category: recipe.fields.Category,
          description: recipe.fields.Description
        });
      }
    });

    // Find groups with more than one recipe (duplicates)
    const duplicates = [];
    Object.entries(recipeGroups).forEach(([name, recipes]) => {
      if (recipes.length > 1) {
        duplicates.push({
          name: recipes[0].name, // Use original case
          count: recipes.length,
          recipes: recipes
        });
      }
    });

    console.log(`🔍 Found ${duplicates.length} duplicate recipe names affecting ${duplicates.reduce((sum, d) => sum + d.count, 0)} total recipes`);

    res.json({
      success: true,
      duplicates: duplicates,
      totalDuplicateGroups: duplicates.length,
      totalAffectedRecipes: duplicates.reduce((sum, d) => sum + d.count, 0),
      message: duplicates.length > 0 ?
        `Found ${duplicates.length} recipe names with duplicates` :
        'No duplicate recipe names found'
    });

  } catch (error) {
    console.error('Error finding duplicate recipes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find duplicate recipes',
      message: error.message
    });
  }
});

// GET /api/recipes/:id - Get single recipe
router.get('/:id', async (req, res) => {
  try {
    const record = await base('Recipes').find(req.params.id);
    const ingredients = await getRecipeIngredients(req.params.id);
    const servings = record.fields.Servings || 1;

    // Use stored Q Factor from record, fallback to query parameter, then default
    const storedQFactor = record.fields['Q Factor %'];
    const { qFactor } = req.query;
    const qFactorNum = storedQFactor !== undefined ? storedQFactor :
                      (qFactor ? parseFloat(qFactor) : 10);

    console.log(`📊 Using Q Factor: ${qFactorNum}% (stored: ${storedQFactor}, query: ${qFactor})`);

    // Calculate costs with Q Factor
    const costCalculation = calculateRecipeCostsWithQFactor(ingredients, servings, qFactorNum);

    const recipe = {
      id: record.id,
      name: record.fields.Name,
      description: record.fields.Description || '',
      servings: servings,
      ingredients: ingredients,
      instructions: record.fields.Instructions || '',
      totalCost: costCalculation.totalCost,
      costPerServing: costCalculation.costPerServing,
      category: record.fields.Category || 'Uncategorized',
      prepTime: record.fields['Prep Time'] || 0,
      cookTime: record.fields['Cook Time'] || 0,
      image: record.fields.Image && record.fields.Image.length > 0
        ? record.fields.Image[0].url
        : undefined,
      // Map Q Factor data to interface fields
      qFactorPercentage: costCalculation.qFactor,
      qFactorCost: costCalculation.qFactorAmount,
      totalCostWithQFactor: costCalculation.totalCost,
      costPerServingWithQFactor: costCalculation.costPerServing,
      // Add Q Factor breakdown for additional detail
      costBreakdown: costCalculation.breakdown
    };

    res.json({
      success: true,
      data: recipe,
      qFactor: qFactorNum
    });

  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recipe',
      message: error.message
    });
  }
});

// Helper function to apply Q Factor to costs
function applyQFactor(baseCost, qFactor = 10) {
  return baseCost * (1 + qFactor / 100);
}

// Helper function to calculate recipe costs with Q Factor
function calculateRecipeCostsWithQFactor(ingredients, servings = 1, qFactor = 10) {
  const baseCost = ingredients.reduce((sum, ingredient) => sum + (ingredient.totalCost || 0), 0);
  const totalCostWithQFactor = applyQFactor(baseCost, qFactor);
  const costPerServing = servings > 0 ? totalCostWithQFactor / servings : 0;


  return {
    baseCost,
    qFactor,
    qFactorAmount: totalCostWithQFactor - baseCost,
    totalCost: totalCostWithQFactor,
    costPerServing,
    breakdown: {
      baseCost,
      qFactorPercentage: qFactor,
      qFactorAmount: totalCostWithQFactor - baseCost,
      totalWithQFactor: totalCostWithQFactor
    }
  };
}

// GET /api/recipes/ingredients/search - Search ingredients
router.get('/ingredients/search', async (req, res) => {
  try {
    const { q } = req.query;
    const ingredients = await getCachedIngredients();

    let filteredIngredients = ingredients;

    if (q && q.length > 0) {
      filteredIngredients = ingredients.filter(ing =>
        ing.name && String(ing.name).toLowerCase().includes(q.toLowerCase())
      );
    }

    res.json({
      success: true,
      data: filteredIngredients.slice(0, 50), // Limit results
      query: q,
      totalCount: filteredIngredients.length
    });

  } catch (error) {
    console.error('Error searching ingredients:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search ingredients',
      message: error.message
    });
  }
});

// POST /api/recipes - Create new recipe
router.post('/', async (req, res) => {
  try {
    const recipeData = req.body;

    // Check for duplicate recipe names
    const existingRecipes = await base('Recipes').select({
      filterByFormula: `{Name} = "${recipeData.name}"`
    }).all();

    if (existingRecipes.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Duplicate recipe name',
        message: `A recipe named "${recipeData.name}" already exists`,
        existingRecipe: {
          id: existingRecipes[0].id,
          name: existingRecipes[0].fields.Name
        }
      });
    }

    // Create basic recipe record - only send fields with valid values
    const createFields = {
      Name: recipeData.name,
      Servings: recipeData.servings || 1,
      'Q Factor %': recipeData.qFactorPercentage || 10
    };

    // Only add optional fields if they have non-empty values
    if (recipeData.description && typeof recipeData.description === 'string' && recipeData.description.trim()) {
      createFields.Description = recipeData.description;
    }
    // Note: Instructions field is computed in Airtable and cannot be written to
    if (recipeData.category && typeof recipeData.category === 'string' && recipeData.category.trim()) {
      createFields.Category = recipeData.category;
    }
    if (recipeData.prepTime !== undefined) {
      createFields['Prep Time'] = recipeData.prepTime;
    }
    if (recipeData.cookTime !== undefined) {
      createFields['Cook Time'] = recipeData.cookTime;
    }

    const recipeRecord = await base('Recipes').create(createFields);

    // If ingredients are provided, create junction table entries
    if (recipeData.ingredients && recipeData.ingredients.length > 0) {
      const junctionPromises = recipeData.ingredients.map(ingredient => {
        // Check if this is a sub-recipe or regular ingredient
        const isSubRecipe = ingredient.isRecipe || (ingredient.name && ingredient.name.startsWith('[Recipe]'));

        const junctionRecord = {
          'Recipe': [recipeRecord.id],
          'Quantity': ingredient.quantity || 1,
          'Unit': ingredient.unit || (isSubRecipe ? 'servings' : 'oz')
        };

        // Add either Sub Recipe or Ingredient field
        if (isSubRecipe) {
          junctionRecord['Sub Recipe'] = [ingredient.id];
        } else {
          junctionRecord['Ingredient'] = [ingredient.id];
        }

        return base('Recipe Ingredients').create(junctionRecord);
      });

      await Promise.all(junctionPromises);
    }

    // Invalidate caches since we modified junction table
    junctionRecordsCache = null;
    junctionCacheTime = null;
    ingredientsCache = null;
    ingredientsCacheTime = null;

    // Return the created recipe with ingredients
    const ingredients = await getRecipeIngredients(recipeRecord.id);

    const recipe = {
      id: recipeRecord.id,
      name: recipeData.name,
      description: recipeData.description || '',
      servings: recipeData.servings,
      ingredients: ingredients,
      instructions: recipeData.instructions || '',
      totalCost: 0,
      costPerServing: 0,
      category: recipeData.category || 'Uncategorized',
      prepTime: recipeData.prepTime || 0,
      cookTime: recipeData.cookTime || 0
    };

    res.status(201).json({
      success: true,
      data: recipe
    });

  } catch (error) {
    console.error('Error creating recipe:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create recipe',
      message: error.message
    });
  }
});

// PUT /api/recipes/:id - Update existing recipe
router.put('/:id', async (req, res) => {
  try {
    const recipeId = req.params.id;
    const recipeData = req.body;

    console.log(`🔄 PUT /recipes/${recipeId} - Updating recipe: ${recipeData.name}`);
    console.log(`📦 Received ${recipeData.ingredients?.length || 0} ingredients:`,
      recipeData.ingredients?.map(i => `${i.name} (id: ${i.id})`));

    // Update basic recipe record - only send fields with valid values
    const updateFields = {
      Name: recipeData.name,
      Servings: recipeData.servings,
      'Q Factor %': recipeData.qFactorPercentage || 10
    };

    // Only add optional fields if they have non-empty values
    if (recipeData.description && typeof recipeData.description === 'string' && recipeData.description.trim()) {
      updateFields.Description = recipeData.description;
    }
    // Note: Instructions field is computed in Airtable and cannot be written to
    if (recipeData.category && typeof recipeData.category === 'string' && recipeData.category.trim()) {
      updateFields.Category = recipeData.category;
    }
    if (recipeData.prepTime !== undefined) {
      updateFields['Prep Time'] = recipeData.prepTime;
    }
    if (recipeData.cookTime !== undefined) {
      updateFields['Cook Time'] = recipeData.cookTime;
    }

    const recipeRecord = await base('Recipes').update(recipeId, updateFields);

    // Handle ingredient updates - first get existing junction records
    console.log(`🔍 Searching for junction records with Recipe ID: ${recipeId}`);

    // Fetch all junction records and filter in JavaScript (since Airtable filters aren't working)
    const allJunctionRecords = await base('Recipe Ingredients').select().all();
    const existingJunctionRecords = allJunctionRecords.filter(record => {
      const recipeField = record.fields['Recipe'];
      if (Array.isArray(recipeField)) {
        return recipeField.includes(recipeId);
      }
      return recipeField === recipeId;
    });

    console.log(`🔍 JavaScript filter found ${existingJunctionRecords.length} existing junction records`);

    // Debug: show sample of all records for troubleshooting
    console.log(`🔬 Sample junction records:`, allJunctionRecords.map(r => ({
      id: r.id,
      recipeField: r.fields['Recipe'],
      recipeFieldType: typeof r.fields['Recipe'],
      recipeFieldValue: JSON.stringify(r.fields['Recipe']),
      ingredientField: r.fields['Ingredient']
    })));

    // Try to find any records that might match our recipe ID
    const debugRecords = allJunctionRecords.filter(r => {
      const recipeField = r.fields['Recipe'];
      if (Array.isArray(recipeField)) {
        return recipeField.includes(recipeId);
      }
      return recipeField === recipeId;
    });
    console.log(`🔍 DEBUG: Found ${debugRecords.length} records that should match our recipe ID ${recipeId}`);

    // Also try a direct search to see if our records exist at all
    const directSearch = await base('Recipe Ingredients').select({
      filterByFormula: `{Recipe} = "${recipeId}"`
    }).all();
    console.log(`🔍 DIRECT SEARCH: Found ${directSearch.length} records with exact match {Recipe} = "${recipeId}"`);

    if (debugRecords.length > 0) {
      console.log(`📋 Found matching records:`, debugRecords.map(r => ({
        id: r.id,
        recipe: r.fields['Recipe'],
        ingredient: r.fields['Ingredient']
      })));
    }

    // Delete existing junction records for this recipe
    console.log(`🗑️ Found ${existingJunctionRecords.length} existing junction records to delete`);
    if (existingJunctionRecords.length > 0) {
      const deletePromises = existingJunctionRecords.map(record =>
        base('Recipe Ingredients').destroy(record.id)
      );
      await Promise.all(deletePromises);
      console.log(`✅ Deleted ${existingJunctionRecords.length} junction records`);
    }

    // Create new junction table entries if ingredients are provided
    if (recipeData.ingredients && recipeData.ingredients.length > 0) {
      const validIngredients = recipeData.ingredients
        .filter(ingredient => ingredient.id && ingredient.name); // Only include valid ingredients

      // CRITICAL: Deduplicate ingredients by ID to prevent massive duplication
      console.log(`🔍 RAW INGREDIENTS RECEIVED:`, validIngredients.map(i => `${i.name} (${i.id}) - Qty: ${i.quantity}`));

      const ingredientMap = new Map();
      validIngredients.forEach((ingredient, index) => {
        const key = ingredient.id;
        if (!ingredientMap.has(key)) {
          console.log(`✅ NEW: Adding ingredient ${ingredient.name} (${key}) with qty ${ingredient.quantity}`);
          ingredientMap.set(key, ingredient);
        } else {
          // If duplicate, sum the quantities
          const existing = ingredientMap.get(key);
          const oldQty = existing.quantity || 0;
          const newQty = ingredient.quantity || 0;
          existing.quantity = oldQty + newQty;
          console.log(`🔧 DUPLICATE: ${ingredient.name} (${key}) - merging qty ${oldQty} + ${newQty} = ${existing.quantity}`);
        }
      });

      const deduplicatedIngredients = Array.from(ingredientMap.values());

      console.log(`⚠️ DEDUPLICATION SUMMARY: Received ${validIngredients.length} ingredients, deduplicated to ${deduplicatedIngredients.length}`);
      console.log(`➕ Creating ${deduplicatedIngredients.length} new junction records for ingredients:`,
        deduplicatedIngredients.map(i => `${i.name} (${i.id}) - Qty: ${i.quantity}`));

      const junctionPromises = deduplicatedIngredients.map(ingredient => {
        // Check if this is a sub-recipe or regular ingredient
        const isSubRecipe = ingredient.isRecipe || (ingredient.name && ingredient.name.startsWith('[Recipe]'));

        const junctionRecord = {
          'Recipe': [recipeId],
          'Quantity': ingredient.quantity || 1,
          'Unit': ingredient.unit || (isSubRecipe ? 'servings' : 'oz')
        };

        // Add either Sub Recipe or Ingredient field
        if (isSubRecipe) {
          junctionRecord['Sub Recipe'] = [ingredient.id];
          console.log(`📦 Adding sub-recipe: ${ingredient.name} (${ingredient.id})`);
        } else {
          junctionRecord['Ingredient'] = [ingredient.id];
        }

        return base('Recipe Ingredients').create(junctionRecord);
      });

      await Promise.all(junctionPromises);
      console.log(`✅ Created ${deduplicatedIngredients.length} new junction records`);
    } else {
      console.log(`ℹ️ No valid ingredients to create (ingredients array length: ${recipeData.ingredients?.length || 0})`);
    }

    // Invalidate caches since we modified junction table
    junctionRecordsCache = null;
    junctionCacheTime = null;
    ingredientsCache = null;
    ingredientsCacheTime = null;

    // Return the updated recipe with ingredients
    const ingredients = await getRecipeIngredients(recipeId);
    const servings = recipeData.servings || 1;

    // Use the Q Factor that was just saved to the record
    const qFactor = recipeData.qFactorPercentage || 10;

    // Calculate costs with Q Factor
    const costCalculation = calculateRecipeCostsWithQFactor(ingredients, servings, qFactor);

    const recipe = {
      id: recipeId,
      name: recipeData.name,
      description: recipeData.description || '',
      servings: servings,
      ingredients: ingredients,
      instructions: recipeData.instructions || '',
      totalCost: costCalculation.totalCost,
      costPerServing: costCalculation.costPerServing,
      category: recipeData.category || 'Uncategorized',
      prepTime: recipeData.prepTime || 0,
      cookTime: recipeData.cookTime || 0,
      qFactorPercentage: costCalculation.qFactor,
      qFactorCost: costCalculation.qFactorAmount,
      totalCostWithQFactor: costCalculation.totalCost,
      costPerServingWithQFactor: costCalculation.costPerServing,
      costBreakdown: costCalculation.breakdown
    };

    res.json({
      success: true,
      data: recipe
    });

  } catch (error) {
    console.error('Error updating recipe:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update recipe',
      message: error.message
    });
  }
});

// DELETE /api/recipes/:id - Delete recipe
router.delete('/:id', async (req, res) => {
  try {
    const recipeId = req.params.id;

    console.log(`🗑️ DELETE /recipes/${recipeId} - Deleting recipe`);

    // First delete all junction records for this recipe
    console.log(`🔍 Searching for junction records with Recipe ID: ${recipeId}`);

    // Use JavaScript filtering since Airtable filters aren't working reliably
    const allJunctionRecords = await base('Recipe Ingredients').select().all();
    const existingJunctionRecords = allJunctionRecords.filter(record => {
      const recipeField = record.fields['Recipe'];
      if (Array.isArray(recipeField)) {
        return recipeField.includes(recipeId);
      }
      return recipeField === recipeId;
    });

    console.log(`🗑️ Found ${existingJunctionRecords.length} junction records to delete`);
    if (existingJunctionRecords.length > 0) {
      const deletePromises = existingJunctionRecords.map(record =>
        base('Recipe Ingredients').destroy(record.id)
      );
      await Promise.all(deletePromises);
      console.log(`✅ Deleted ${existingJunctionRecords.length} junction records`);
    }

    // Invalidate caches since we modified junction table
    junctionRecordsCache = null;
    junctionCacheTime = null;
    ingredientsCache = null;
    ingredientsCacheTime = null;

    // Then delete the recipe record
    await base('Recipes').destroy(recipeId);
    console.log(`✅ Recipe ${recipeId} deleted successfully`);

    res.json({
      success: true,
      message: 'Recipe deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting recipe:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete recipe',
      message: error.message
    });
  }
});

// POST /api/recipes/:id/cleanup - Clean up duplicate junction records for a recipe
router.post('/:id/cleanup', async (req, res) => {
  try {
    const recipeId = req.params.id;

    console.log(`🧹 CLEANUP: Starting cleanup for recipe ${recipeId}`);

    // Get all junction records for this recipe using JavaScript filtering
    const allRecords = await base('Recipe Ingredients').select().all();
    const existingJunctionRecords = allRecords.filter(record => {
      const recipeField = record.fields['Recipe'];
      if (Array.isArray(recipeField)) {
        return recipeField.includes(recipeId);
      }
      return recipeField === recipeId;
    });

    console.log(`🔍 Found ${existingJunctionRecords.length} junction records`);

    // Group by ingredient ID to find duplicates
    const ingredientGroups = {};
    existingJunctionRecords.forEach(record => {
      const ingredientId = record.fields['Ingredient']?.[0];
      if (ingredientId) {
        if (!ingredientGroups[ingredientId]) {
          ingredientGroups[ingredientId] = [];
        }
        ingredientGroups[ingredientId].push(record);
      }
    });

    let totalDeleted = 0;
    let totalKept = 0;

    // For each ingredient, keep the first record and delete duplicates
    for (const [ingredientId, records] of Object.entries(ingredientGroups)) {
      if (records.length > 1) {
        console.log(`🔧 Ingredient ${ingredientId} has ${records.length} duplicates`);

        // Keep the first record, delete the rest
        const recordsToDelete = records.slice(1);
        const deletePromises = recordsToDelete.map(record =>
          base('Recipe Ingredients').destroy(record.id)
        );

        await Promise.all(deletePromises);
        totalDeleted += recordsToDelete.length;
        totalKept += 1;

        console.log(`✅ Kept 1 record, deleted ${recordsToDelete.length} duplicates for ingredient ${ingredientId}`);
      } else {
        totalKept += 1;
      }
    }

    // Invalidate caches
    junctionRecordsCache = null;
    junctionCacheTime = null;
    ingredientsCache = null;
    ingredientsCacheTime = null;

    console.log(`🎉 CLEANUP COMPLETE: Kept ${totalKept} records, deleted ${totalDeleted} duplicates`);

    res.json({
      success: true,
      message: `Cleanup completed for recipe ${recipeId}`,
      stats: {
        totalRecordsFound: existingJunctionRecords.length,
        recordsKept: totalKept,
        recordsDeleted: totalDeleted,
        ingredientTypes: Object.keys(ingredientGroups).length
      }
    });

  } catch (error) {
    console.error('Error cleaning up recipe:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup recipe',
      message: error.message
    });
  }
});

module.exports = router;
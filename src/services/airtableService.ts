import Airtable from 'airtable';
import { Recipe, Ingredient } from '../types';

// Airtable record interfaces
export interface AirtableRecipeRecord {
  id: string;
  fields: {
    Name: string;
    Description?: string;
    Servings?: number;
    Instructions?: string;
    Ingredients?: string[]; // Array of linked ingredient record IDs
    'Total Cost'?: number;
    'Cost Per Serving'?: number;
    'Q Factor %'?: number; // Quality Factor percentage (1-15%)
    'Q Factor Cost'?: number; // Calculated: Total Cost * (Q Factor % / 100)
    'Total Cost with Q Factor'?: number; // Calculated: Total Cost + Q Factor Cost
    'Cost Per Serving with Q Factor'?: number; // Calculated: Total Cost with Q Factor / Servings
    Category?: string;
    'Prep Time'?: number;
    'Cook Time'?: number;
    Image?: Airtable.Attachment[]; // Airtable attachment field for recipe images
    'Created Date'?: string;
    'Last Modified'?: string;
  };
}

export interface AirtableIngredientRecord {
  id: string;
  fields: {
    'Ingredient Name': string;
    Quantity: number;
    Unit: string;
    'Unit Cost'?: number;
    'Total Cost'?: number;
    'Recipes'?: string[];
    'Odoo Product Name'?: string;
    'From Odoo'?: boolean;
    Category?: string;
    Notes?: string;
  };
}

export interface AirtableCOGSCalculatorRecord {
  id: string;
  fields: {
    'Session Name': string;
    'Recipe Name': string;
    'Recipe ID': string;
    'Unit Cost': number;
    'Quantity Sold': number;
    'Total Cost': number;
    'Created Date'?: string;
    'Last Modified'?: string;
    'Notes'?: string;
  };
}

export interface COGSCalculatorEntry {
  sessionName: string;
  recipeName: string;
  recipeId: string;
  unitCost: number;
  quantitySold: number;
  totalCost: number;
  notes?: string;
}

class AirtableService {
  private base: Airtable.Base | null = null;
  private isInitialized = false;
  private cachedJunctionRecords: readonly any[] | null = null;
  private cachedIngredients: readonly any[] | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;
    const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
    const isEnabled = process.env.REACT_APP_ENABLE_AIRTABLE === 'true';

    if (!isEnabled) {
      console.log('Airtable integration is disabled');
      return;
    }

    if (!apiKey || !baseId || apiKey === 'your_personal_access_token' || baseId === 'your_airtable_base_id') {
      console.warn('Airtable credentials not configured. Please set REACT_APP_AIRTABLE_API_KEY (Personal Access Token) and REACT_APP_AIRTABLE_BASE_ID in your .env file');
      return;
    }

    try {
      Airtable.configure({
        endpointUrl: 'https://api.airtable.com',
        apiKey: apiKey
      });

      this.base = Airtable.base(baseId);
      this.isInitialized = true;
      console.log('Airtable service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Airtable service:', error);
    }
  }

  private checkInitialization(): boolean {
    if (!this.isInitialized || !this.base) {
      console.warn('Airtable service not initialized');
      return false;
    }
    return true;
  }

  // Clear cached data to force fresh API calls
  public clearCache(): void {
    console.log('🧹 Clearing Airtable cache...');
    this.cachedJunctionRecords = null;
    this.cachedIngredients = null;
  }

  // Q Factor calculation helpers
  private applyQFactor(baseCost: number, qFactor: number = 10): number {
    return baseCost * (1 + qFactor / 100);
  }

  private calculateQFactorBreakdown(ingredients: Ingredient[], servings: number = 1, qFactor: number = 10) {
    const baseCost = ingredients.reduce((sum, ingredient) => sum + (ingredient.totalCost || 0), 0);
    const totalCostWithQFactor = this.applyQFactor(baseCost, qFactor);
    const costPerServing = servings > 0 ? totalCostWithQFactor / servings : 0;
    const qFactorAmount = totalCostWithQFactor - baseCost;

    return {
      baseCost,
      qFactor,
      qFactorAmount,
      totalCost: totalCostWithQFactor,
      costPerServing,
      breakdown: {
        baseCost,
        qFactorPercentage: qFactor,
        qFactorAmount,
        totalWithQFactor: totalCostWithQFactor
      }
    };
  }

  // Recipe Methods
  async getRecipes(): Promise<Recipe[]> {
    if (!this.checkInitialization()) return [];

    try {
      const records = await this.base!('Recipes').select({
        view: 'Grid view',
        sort: [{ field: 'Created Date', direction: 'desc' }]
      }).all();

      const recipes: Recipe[] = [];

      for (const record of records) {
        const recipeRecord = record as unknown as AirtableRecipeRecord;
        const ingredients = await this.getRecipeIngredients(recipeRecord.id);
        const servings = recipeRecord.fields.Servings || 1;
        const qFactor = recipeRecord.fields['Q Factor %'] || 10;

        // Calculate Q Factor costs
        const costCalculation = this.calculateQFactorBreakdown(ingredients, servings, qFactor);

        recipes.push({
          id: recipeRecord.id,
          name: recipeRecord.fields.Name,
          description: recipeRecord.fields.Description || '',
          servings: servings,
          ingredients: ingredients,
          instructions: recipeRecord.fields.Instructions || '',
          totalCost: costCalculation.totalCost,
          costPerServing: costCalculation.costPerServing,
          qFactorPercentage: qFactor,
          qFactorCost: costCalculation.qFactorAmount,
          totalCostWithQFactor: costCalculation.totalCost,
          costPerServingWithQFactor: costCalculation.costPerServing,
          costBreakdown: costCalculation.breakdown,
          category: recipeRecord.fields.Category || 'Uncategorized',
          prepTime: recipeRecord.fields['Prep Time'] || 0,
          cookTime: recipeRecord.fields['Cook Time'] || 0,
          image: recipeRecord.fields.Image && recipeRecord.fields.Image.length > 0
            ? recipeRecord.fields.Image[0].url
            : undefined
        });
      }

      return recipes;
    } catch (error) {
      console.error('Error fetching recipes from Airtable:', error);
      return [];
    }
  }

  // Lightweight method for Cost Management - only fetches essential fields
  async getRecipesBasic(): Promise<Recipe[]> {
    if (!this.checkInitialization()) return [];

    try {
      console.log('📋 Fetching basic recipe data for Cost Management...');

      const records = await this.base!('Recipes').select({
        fields: ['Name', 'Category', 'Prep Time', 'Servings', 'Q Factor %'],
        sort: [{ field: 'Name', direction: 'asc' }]
      }).all();

      const recipes: Recipe[] = records.map(record => {
        const recipeRecord = record as unknown as AirtableRecipeRecord;
        const servings = recipeRecord.fields.Servings || 1;
        // Set placeholder costs - actual costs will be calculated when ingredients are loaded
        const totalCost = 0; // Will be calculated in full recipe load
        const totalCostWithQFactor = 0; // Will be calculated in full recipe load

        return {
          id: recipeRecord.id,
          name: recipeRecord.fields.Name,
          description: '', // Not needed for Cost Management
          category: recipeRecord.fields.Category || 'Uncategorized',
          servings: servings,
          ingredients: [], // Not needed for Cost Management
          instructions: '', // Not needed for Cost Management
          prepTime: recipeRecord.fields['Prep Time'] || 0,
          totalCost: totalCost,
          costPerServing: servings > 0 ? totalCost / servings : 0,
          totalCostWithQFactor: totalCostWithQFactor,
          costPerServingWithQFactor: servings > 0 ? totalCostWithQFactor / servings : 0,
          qFactor: recipeRecord.fields['Q Factor %'] || 10,
          qFactorBreakdown: {
            laborCost: 0,
            overheadCost: 0,
            totalCost: totalCost,
            totalCostWithQFactor: totalCostWithQFactor
          },
          image: undefined // Not needed for Cost Management
        };
      });

      console.log(`📋 Loaded ${recipes.length} basic recipes in fast mode`);
      return recipes;

    } catch (error) {
      console.error('Error fetching basic recipes from Airtable:', error);
      return [];
    }
  }

  async getRecipeById(id: string): Promise<Recipe | null> {
    if (!this.checkInitialization()) return null;

    try {
      const record = await this.base!('Recipes').find(id);
      const recipeRecord = record as unknown as AirtableRecipeRecord;
      const ingredients = await this.getRecipeIngredients(id);

      return {
        id: recipeRecord.id,
        name: recipeRecord.fields.Name,
        description: recipeRecord.fields.Description || '',
        servings: recipeRecord.fields.Servings || 1,
        ingredients: ingredients,
        instructions: recipeRecord.fields.Instructions || '',
        totalCost: recipeRecord.fields['Total Cost'] || 0,
        costPerServing: recipeRecord.fields['Cost Per Serving'] || 0,
        category: recipeRecord.fields.Category || 'Uncategorized',
        prepTime: recipeRecord.fields['Prep Time'] || 0,
        cookTime: recipeRecord.fields['Cook Time'] || 0,
        image: recipeRecord.fields.Image && recipeRecord.fields.Image.length > 0
          ? recipeRecord.fields.Image[0].url
          : undefined
      };
    } catch (error) {
      console.error('Error fetching recipe from Airtable:', error);
      return null;
    }
  }

  async createRecipe(recipe: Omit<Recipe, 'id'>): Promise<Recipe | null> {
    if (!this.checkInitialization()) return null;

    try {

      // Create minimal recipe record first to test field names
      const recipeRecord = await this.base!('Recipes').create({
        Name: recipe.name,
        Description: recipe.description,
        Servings: recipe.servings,
        Instructions: recipe.instructions,
        Category: recipe.category,
        'Prep Time': recipe.prepTime,
        'Cook Time': recipe.cookTime,
        'Q Factor %': recipe.qFactorPercentage || 10
      });

      console.log('✅ Basic recipe created successfully:', recipeRecord.id);

      // If ingredients are provided, sync them to the junction table
      if (recipe.ingredients && recipe.ingredients.length > 0) {
        console.log(`🔄 Syncing ${recipe.ingredients.length} ingredients to junction table for new recipe ${recipeRecord.id}`);
        await this.syncRecipeIngredientsToJunctionTable(recipeRecord.id, recipe.ingredients);
      } else {
        console.log('⚠️ No ingredients provided for new recipe');
      }

      // Calculate costs if ingredients were provided
      let totalCost = 0;
      let costPerServing = 0;
      if (recipe.ingredients && recipe.ingredients.length > 0) {
        totalCost = await this.calculateRecipeCost(recipeRecord.id);
        costPerServing = recipe.servings > 0 ? totalCost / recipe.servings : 0;
      }

      return {
        id: recipeRecord.id,
        name: recipe.name,
        description: recipe.description || '',
        servings: recipe.servings,
        ingredients: recipe.ingredients || [], // Use provided ingredients
        instructions: recipe.instructions || '',
        totalCost,
        costPerServing,
        category: recipe.category || 'Uncategorized',
        prepTime: recipe.prepTime || 0,
        cookTime: recipe.cookTime || 0
      };

    } catch (error) {
      console.error('❌ Error creating recipe in Airtable:', error);
      return null;
    }
  }

  async updateRecipe(id: string, recipe: Partial<Recipe>): Promise<Recipe | null> {
    if (!this.checkInitialization()) return null;

    try {
      const updateFields: any = {};

      // Only add Last Modified if the field exists and accepts dates
      // Skip if it's a computed field

      if (recipe.name) updateFields.Name = recipe.name;
      if (recipe.description && typeof recipe.description === 'string' && recipe.description.trim()) {
        updateFields.Description = recipe.description;
      }
      if (recipe.servings) updateFields.Servings = recipe.servings;
      // Note: Instructions field is computed in Airtable and cannot be written to
      if (recipe.category && typeof recipe.category === 'string' && recipe.category.trim()) {
        updateFields.Category = recipe.category;
      }
      if (recipe.prepTime) updateFields['Prep Time'] = recipe.prepTime;
      if (recipe.cookTime) updateFields['Cook Time'] = recipe.cookTime;

      await this.base!('Recipes').update(id, updateFields);

      // If ingredients are being updated, sync with junction table

      if (recipe.ingredients && recipe.ingredients.length > 0) {
        console.log(`🔄 Syncing ${recipe.ingredients.length} ingredients to junction table for recipe ${id}`);
        await this.syncRecipeIngredientsToJunctionTable(id, recipe.ingredients);
      } else if (recipe.ingredients !== undefined) {
      }

      // Recalculate costs if servings changed or ingredients updated
      if (recipe.servings || recipe.ingredients) {
        const totalCost = await this.calculateRecipeCost(id);
        await this.updateRecipeCosts(id, totalCost, recipe.servings || 1);
      }

      return await this.getRecipeById(id);
    } catch (error) {
      console.error('Error updating recipe in Airtable:', error);
      return null;
    }
  }

  async deleteRecipe(id: string): Promise<boolean> {
    if (!this.checkInitialization()) return false;

    try {
      // Delete associated ingredients first
      const ingredients = await this.getRecipeIngredients(id);
      for (const ingredient of ingredients) {
        if (ingredient.id) {
          await this.deleteIngredient(ingredient.id);
        }
      }

      // Delete the recipe
      await this.base!('Recipes').destroy(id);
      return true;
    } catch (error) {
      console.error('Error deleting recipe from Airtable:', error);
      return false;
    }
  }

  // Ingredient Methods
  async getRecipeIngredients(recipeId: string): Promise<Ingredient[]> {
    if (!this.checkInitialization()) return [];

    try {
      // First try to use Recipe Ingredients junction table for recipe-specific quantities
      const junctionResults = await this.getRecipeIngredientsFromJunctionTable(recipeId);

      // If junction table exists but has no data, try legacy method
      if (junctionResults.length === 0) {
        // Reduced logging to avoid console spam
        return await this.getRecipeIngredientsLegacy(recipeId);
      }

      return junctionResults;
    } catch (error) {
      console.log('Junction table not found, using legacy method...');
      // Fallback to old method if Recipe Ingredients table doesn't exist
      return await this.getRecipeIngredientsLegacy(recipeId);
    }
  }

  // NEW: Get ingredients using Recipe Ingredients junction table (recommended)
  private async getRecipeIngredientsFromJunctionTable(recipeId: string): Promise<Ingredient[]> {

    // Use cached junction records if available
    if (!this.cachedJunctionRecords) {
      console.log('📊 Loading junction records from Airtable...');
      const junctionRecords = await this.base!('Recipe Ingredients').select().all();
      this.cachedJunctionRecords = junctionRecords;
      console.log(`📊 Cached ${junctionRecords.length} junction records`);
    }

    // Filter client-side for the specific recipe
    const recipeIngredients = this.cachedJunctionRecords.filter((record: any) => {
      const junctionRecord = record as any;
      const recipes = junctionRecord.fields['Recipe'] || [];
      return Array.isArray(recipes) && recipes.includes(recipeId);
    });

    // Use cached ingredients if available
    if (!this.cachedIngredients) {
      console.log('🥗 Loading all ingredients from Airtable...');
      const ingredients = await this.base!('Ingredients').select().all();
      this.cachedIngredients = ingredients;
      console.log(`🥗 Cached ${ingredients.length} ingredients`);
    }

    // Create a map for fast ingredient lookup
    const ingredientMap = new Map();
    if (this.cachedIngredients) {
      this.cachedIngredients.forEach((record: any) => {
        ingredientMap.set(record.id, record);
      });
    }

    const ingredients: Ingredient[] = [];

    for (const record of recipeIngredients) {
      const recipeIngredient = record as any;
      const ingredientId = recipeIngredient.fields['Ingredient']?.[0];

      if (ingredientId) {
        // Get the master ingredient data from cache
        const masterIngredient = ingredientMap.get(ingredientId);
        if (!masterIngredient) {
          console.warn(`⚠️ Ingredient ${ingredientId} not found in cache`);
          continue;
        }
        const masterData = masterIngredient as any;

        // Calculate cost using recipe-specific quantity and master unit cost
        const recipeQuantity = recipeIngredient.fields['Quantity'] || 0;
        const unitCost = masterData.fields['Unit Cost'] || 0;
        const totalCost = recipeQuantity * unitCost;

        ingredients.push({
          id: ingredientId, // Use master ingredient ID, not junction record ID
          name: masterData.fields['Ingredient Name'],
          quantity: recipeQuantity, // Recipe-specific quantity
          unit: recipeIngredient.fields['Unit'] || masterData.fields['Unit'],
          cost: unitCost,
          totalCost: totalCost,
          fromOdoo: masterData.fields['From Odoo'] || false,
          odooProductName: masterData.fields['Odoo Product Name'] || undefined
        });
      }
    }

    return ingredients;
  }

  // LEGACY: Fallback method for existing Airtable setups
  private async getRecipeIngredientsLegacy(recipeId: string): Promise<Ingredient[]> {
    try {
      // Use client-side filtering since Airtable filter formulas don't work reliably for linked records
      const allRecords = await this.base!('Ingredients').select().all();
      const filteredRecords = allRecords.filter((record: any) => {
        const ingredientRecord = record as unknown as AirtableIngredientRecord;
        const recipes = ingredientRecord.fields['Recipes'];
        return recipes && recipes.includes(recipeId);
      });

      return filteredRecords.map((record: any) => {
        const ingredientRecord = record as unknown as AirtableIngredientRecord;
        return {
          id: ingredientRecord.id,
          name: ingredientRecord.fields['Ingredient Name'],
          quantity: ingredientRecord.fields.Quantity,
          unit: ingredientRecord.fields.Unit,
          cost: ingredientRecord.fields['Unit Cost'] || 0,
          totalCost: ingredientRecord.fields['Total Cost'] || 0,
          fromOdoo: ingredientRecord.fields['From Odoo'] || false,
          odooProductName: ingredientRecord.fields['Odoo Product Name'] || undefined
        };
      });
    } catch (error) {
      console.error('Error in legacy ingredient fetching:', error);
      return [];
    }
  }

  async createIngredient(ingredient: Omit<Ingredient, 'id'>, recipeId: string): Promise<{ id: string } | null> {
    if (!this.checkInitialization()) return null;

    try {
      const record = await this.base!('Ingredients').create({
        'Ingredient Name': ingredient.name,
        Quantity: ingredient.quantity,
        Unit: ingredient.unit,
        'Unit Cost': ingredient.cost || 0,
        'Total Cost': (ingredient.quantity * (ingredient.cost || 0)),
        'Recipes': [recipeId],
        'From Odoo': ingredient.fromOdoo || false,
        'Odoo Product Name': ingredient.odooProductName || ''
      });

      return { id: record.id };
    } catch (error) {
      console.error('Error creating ingredient in Airtable:', error);
      return null;
    }
  }

  async updateIngredient(id: string, ingredient: Partial<Ingredient>): Promise<boolean> {
    if (!this.checkInitialization()) return false;

    try {
      const updateFields: any = {};

      if (ingredient.name) updateFields['Ingredient Name'] = ingredient.name;
      if (ingredient.quantity !== undefined) updateFields.Quantity = ingredient.quantity;
      if (ingredient.unit) updateFields.Unit = ingredient.unit;
      if (ingredient.cost !== undefined) {
        updateFields['Unit Cost'] = ingredient.cost;
        // Recalculate total cost
        const currentRecord = await this.base!('Ingredients').find(id);
        const currentQuantity = ingredient.quantity || (currentRecord as any).fields.Quantity;
        updateFields['Total Cost'] = currentQuantity * ingredient.cost;
      }
      if (ingredient.fromOdoo !== undefined) updateFields['From Odoo'] = ingredient.fromOdoo;
      if (ingredient.odooProductName) updateFields['Odoo Product Name'] = ingredient.odooProductName;

      await this.base!('Ingredients').update(id, updateFields);
      return true;
    } catch (error) {
      console.error('Error updating ingredient in Airtable:', error);
      return false;
    }
  }

  async deleteIngredient(id: string): Promise<boolean> {
    if (!this.checkInitialization()) return false;

    try {
      await this.base!('Ingredients').destroy(id);
      return true;
    } catch (error) {
      console.error('Error deleting ingredient from Airtable:', error);
      return false;
    }
  }

  // Get all available ingredients for dropdown selection
  async getAllIngredients(): Promise<{id: string, name: string, unitCost?: number}[]> {
    if (!this.checkInitialization()) return [];

    try {
      const allRecords = await this.base!('Ingredients').select().all();
      return allRecords.map((record: any) => ({
        id: record.id,
        name: (record as any).fields['Ingredient Name'] || 'Unnamed Ingredient',
        unitCost: (record as any).fields['Unit Cost'] || (record as any).fields['Cost'] || 0
      })).filter(ing => ing.name !== 'Unnamed Ingredient')
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error fetching ingredients from Airtable:', error);
      return [];
    }
  }

  // Cost Calculation Methods
  async calculateRecipeCost(recipeId: string): Promise<number> {
    const ingredients = await this.getRecipeIngredients(recipeId);
    return ingredients.reduce((total, ingredient) => total + (ingredient.totalCost || 0), 0);
  }

  // Calculate detailed cost breakdown from junction table
  async calculateRecipeCostBreakdown(recipeId: string): Promise<{
    totalCost: number;
    costPerServing: number;
    ingredientCosts: Array<{
      name: string;
      quantity: number;
      unit: string;
      unitCost: number;
      totalCost: number;
    }>;
    servings: number;
  }> {
    if (!this.checkInitialization()) {
      return { totalCost: 0, costPerServing: 0, ingredientCosts: [], servings: 1 };
    }

    try {
      // Get recipe details for servings
      const recipe = await this.getRecipeById(recipeId);
      const servings = recipe?.servings || 1;

      // Get ingredients with junction table data
      const ingredients = await this.getRecipeIngredients(recipeId);

      // Calculate detailed breakdown
      const ingredientCosts = ingredients.map(ingredient => ({
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        unitCost: ingredient.cost || 0,
        totalCost: ingredient.totalCost || 0
      }));

      const totalCost = ingredientCosts.reduce((sum, item) => sum + item.totalCost, 0);
      const costPerServing = servings > 0 ? totalCost / servings : 0;


      return {
        totalCost,
        costPerServing,
        ingredientCosts,
        servings
      };

    } catch (error) {
      console.error('Error calculating recipe cost breakdown:', error);
      return { totalCost: 0, costPerServing: 0, ingredientCosts: [], servings: 1 };
    }
  }

  // Calculate average cost across multiple recipes
  async calculateAverageRecipeCosts(recipeIds: string[]): Promise<{
    averageTotalCost: number;
    averageCostPerServing: number;
    recipeCosts: Array<{
      recipeId: string;
      recipeName: string;
      totalCost: number;
      costPerServing: number;
      servings: number;
    }>;
  }> {
    if (!this.checkInitialization()) {
      return { averageTotalCost: 0, averageCostPerServing: 0, recipeCosts: [] };
    }

    try {
      const recipeCosts = [];

      for (const recipeId of recipeIds) {
        const breakdown = await this.calculateRecipeCostBreakdown(recipeId);
        const recipe = await this.getRecipeById(recipeId);

        recipeCosts.push({
          recipeId,
          recipeName: recipe?.name || 'Unknown Recipe',
          totalCost: breakdown.totalCost,
          costPerServing: breakdown.costPerServing,
          servings: breakdown.servings
        });
      }

      const validCosts = recipeCosts.filter(r => r.totalCost > 0);
      const averageTotalCost = validCosts.length > 0
        ? validCosts.reduce((sum, r) => sum + r.totalCost, 0) / validCosts.length
        : 0;

      const averageCostPerServing = validCosts.length > 0
        ? validCosts.reduce((sum, r) => sum + r.costPerServing, 0) / validCosts.length
        : 0;

      console.log(`   Average Total Cost: $${averageTotalCost.toFixed(2)}`);
      console.log(`   Average Cost Per Serving: $${averageCostPerServing.toFixed(2)}`);

      return {
        averageTotalCost,
        averageCostPerServing,
        recipeCosts
      };

    } catch (error) {
      console.error('Error calculating average recipe costs:', error);
      return { averageTotalCost: 0, averageCostPerServing: 0, recipeCosts: [] };
    }
  }

  async updateRecipeCosts(recipeId: string, totalCost: number, servings: number): Promise<void> {
    if (!this.checkInitialization()) return;

    try {
      // Note: Total Cost and Cost Per Serving are computed fields in Airtable
      // They automatically update when ingredient costs change
      // So we don't need to manually update them
      console.log(`   Calculated total: $${totalCost.toFixed(2)}`);
      console.log(`   Calculated per serving: $${(servings > 0 ? totalCost / servings : 0).toFixed(2)}`);
    } catch (error) {
      console.error('Error in recipe cost calculation:', error);
    }
  }

  // Integration with Odoo
  async updateIngredientCostFromOdoo(ingredientId: string, odooProduct: any): Promise<boolean> {
    if (!this.checkInitialization()) return false;

    try {
      const ingredient = await this.base!('Ingredients').find(ingredientId);
      const currentQuantity = (ingredient as any).fields.Quantity || 1;

      // Debug: Show available fields
      console.log('🔍 Available ingredient fields:', Object.keys((ingredient as any).fields));
      console.log('🔍 Current ingredient data:', (ingredient as any).fields);

      // Use either standard_price or list_price from Odoo
      const unitCost = odooProduct.standard_price || odooProduct.list_price || 0;

      console.log(`💰 Attempting to update ingredient with cost: $${unitCost}`);

      // Check if any cost-related field exists (excluding computed fields)
      const fields = (ingredient as any).fields;
      const costFieldName = Object.keys(fields).find((key: string) =>
        (key.toLowerCase().includes('cost') || key.toLowerCase().includes('price')) &&
        !key.toLowerCase().includes('total') && // Exclude computed "Total Cost" fields
        !key.toLowerCase().includes('from') && // Exclude lookup fields like "Unit Cost (from Ingredient)"
        !key.toLowerCase().includes('(') // Exclude any field with parentheses (usually computed/lookup)
      );

      if (costFieldName) {
        console.log(`✅ Found cost field: "${costFieldName}"`);
        await this.base!('Ingredients').update(ingredientId, {
          [costFieldName]: Number(unitCost)
        });
      } else {
        console.warn('⚠️ No cost field found in ingredients table. Available fields:', Object.keys(fields));
        console.warn('⚠️ Skipping cost update - you may need to add a cost field to your Ingredients table');
        return false;
      }

      console.log(`✅ Updated ingredient ${(ingredient as any).fields['Ingredient Name']} with Odoo price: $${unitCost}`);
      return true;
    } catch (error) {
      console.error('Error updating ingredient cost from Odoo:', error);
      return false;
    }
  }

  // New method to update all ingredient prices from Odoo
  async updateAllIngredientPricesFromOdoo(odooProducts: any[]): Promise<{updated: number, notFound: number, errors: string[]}> {
    if (!this.checkInitialization()) return {updated: 0, notFound: 0, errors: ['Airtable not initialized']};

    const results = {updated: 0, notFound: 0, errors: [] as string[]};

    try {
      // Get all ingredients from Airtable
      const allIngredients = await this.base!('Ingredients').select().all();

      console.log(`🔄 Updating prices for ${allIngredients.length} ingredients from ${odooProducts.length} Odoo products`);

      for (const ingredientRecord of allIngredients) {
        const ingredient = ingredientRecord as unknown as AirtableIngredientRecord;
        const ingredientName = ingredient.fields['Ingredient Name'];
        const odooProductName = ingredient.fields['Odoo Product Name'];

        if (!ingredientName) {
          continue; // Skip ingredients without names
        }

        // Try to find matching Odoo product by name
        let matchingProduct = null;

        // First try exact match with Odoo Product Name field
        if (odooProductName) {
          matchingProduct = odooProducts.find((product: any) =>
            product.name === odooProductName
          );
        }

        // If no exact match, try fuzzy matching with ingredient name
        if (!matchingProduct) {
          matchingProduct = odooProducts.find((product: any) =>
            product.name.toLowerCase().includes(ingredientName.toLowerCase()) ||
            ingredientName.toLowerCase().includes(product.name.toLowerCase())
          );
        }

        if (matchingProduct) {
          // Update the ingredient with new price
          const success = await this.updateIngredientCostFromOdoo(ingredient.id, matchingProduct);
          if (success) {
            results.updated++;

            // Update recipe costs for all recipes using this ingredient
            const recipes = ingredient.fields['Recipes'];
            if (recipes && recipes.length > 0) {
              for (const recipeId of recipes) {
                await this.updateRecipeCostsForIngredientChange(recipeId);
              }
            }
          } else {
            results.errors.push(`Failed to update ${ingredientName}`);
          }
        } else {
          results.notFound++;
          console.log(`⚠️  No Odoo product found for ingredient: ${ingredientName}`);
        }
      }

      console.log(`✅ Price update complete: ${results.updated} updated, ${results.notFound} not found, ${results.errors.length} errors`);
      return results;
    } catch (error) {
      console.error('Error in bulk price update:', error);
      results.errors.push(`Bulk update failed: ${error}`);
      return results;
    }
  }

  // Helper method to recalculate recipe costs when ingredient price changes
  async updateRecipeCostsForIngredientChange(recipeId: string): Promise<void> {
    try {
      const totalCost = await this.calculateRecipeCost(recipeId);
      const recipe = await this.getRecipeById(recipeId);
      if (recipe) {
        await this.updateRecipeCosts(recipeId, totalCost, recipe.servings);
      }
    } catch (error) {
      console.error(`Error updating recipe ${recipeId} costs:`, error);
    }
  }

  async syncRecipeWithOdoo(recipeId: string, odooProducts: any[]): Promise<boolean> {
    if (!this.checkInitialization()) return false;

    try {
      const ingredients = await this.getRecipeIngredients(recipeId);
      let updated = false;

      for (const ingredient of ingredients) {
        if (ingredient.id) {
          // Try to find matching Odoo product
          const odooProduct = odooProducts.find((product: any) =>
            product.name.toLowerCase().includes(ingredient.name.toLowerCase()) ||
            ingredient.name.toLowerCase().includes(product.name.toLowerCase())
          );

          if (odooProduct) {
            await this.updateIngredientCostFromOdoo(ingredient.id, odooProduct);
            updated = true;
          }
        }
      }

      if (updated) {
        // Recalculate recipe costs
        const totalCost = await this.calculateRecipeCost(recipeId);
        const recipe = await this.getRecipeById(recipeId);
        if (recipe) {
          await this.updateRecipeCosts(recipeId, totalCost, recipe.servings);
        }
      }

      return updated;
    } catch (error) {
      console.error('Error syncing recipe with Odoo:', error);
      return false;
    }
  }

  // Add a recipe-specific ingredient to the Recipe Ingredients junction table
  async addRecipeIngredient(recipeId: string, ingredientId: string, quantity: number, unit?: string): Promise<boolean> {
    if (!this.checkInitialization()) return false;

    try {
      await this.base!('Recipe Ingredients').create({
        'Recipe': [recipeId],
        'Ingredient': [ingredientId],
        'Quantity': quantity,
        'Unit': unit || ''
      });

      console.log(`✅ Added ingredient to recipe with quantity: ${quantity} ${unit || ''}`);
      return true;
    } catch (error) {
      console.error('Error adding recipe ingredient:', error);
      return false;
    }
  }

  // Update recipe-specific ingredient quantity
  async updateRecipeIngredientQuantity(recipeIngredientId: string, newQuantity: number): Promise<boolean> {
    if (!this.checkInitialization()) return false;

    try {
      await this.base!('Recipe Ingredients').update(recipeIngredientId, {
        'Quantity': newQuantity
      });

      console.log(`✅ Updated recipe ingredient quantity to: ${newQuantity}`);
      return true;
    } catch (error) {
      console.error('Error updating recipe ingredient quantity:', error);
      return false;
    }
  }

  // Remove recipe ingredient from junction table
  async removeRecipeIngredient(recipeId: string, ingredientId: string): Promise<boolean> {
    if (!this.checkInitialization()) return false;

    try {
      // Find the junction record to delete
      const allJunctionRecords = await this.base!('Recipe Ingredients').select().all();
      const junctionRecord = allJunctionRecords.find((record: any) => {
        const data = record as any;
        const recipes = data.fields['Recipe'] || [];
        const ingredients = data.fields['Ingredient'] || [];
        return recipes.includes(recipeId) && ingredients.includes(ingredientId);
      });

      if (junctionRecord) {
        await this.base!('Recipe Ingredients').destroy(junctionRecord.id);
        console.log(`✅ Removed ingredient from recipe`);
        return true;
      } else {
        console.warn(`⚠️ Junction record not found for recipe ${recipeId} and ingredient ${ingredientId}`);
        return false;
      }
    } catch (error) {
      console.error('Error removing recipe ingredient:', error);
      return false;
    }
  }

  // Sync entire recipe ingredients with junction table
  async syncRecipeIngredientsToJunctionTable(recipeId: string, ingredients: Ingredient[]): Promise<boolean> {
    if (!this.checkInitialization()) return false;

    try {
      console.log(`🔄 Syncing ${ingredients.length} ingredients to junction table for recipe ${recipeId}`);

      // Get existing junction records for this recipe
      const allJunctionRecords = await this.base!('Recipe Ingredients').select().all();
      const existingRecords = allJunctionRecords.filter((record: any) => {
        const data = record as any;
        const recipes = data.fields['Recipe'] || [];
        return recipes.includes(recipeId);
      });


      // Delete existing records for this recipe
      for (const record of existingRecords) {
        await this.base!('Recipe Ingredients').destroy(record.id);
      }

      console.log(`🗑️ Removed ${existingRecords.length} existing records`);

      // Create new junction records for each ingredient
      let created = 0;
      for (const ingredient of ingredients) {
        // Find master ingredient by name
        const masterIngredient = await this.findMasterIngredientByName(ingredient.name);

        if (masterIngredient) {
          await this.addRecipeIngredient(
            recipeId,
            masterIngredient.id,
            ingredient.quantity,
            ingredient.unit
          );
          created++;
        } else {
          console.warn(`⚠️ Could not find master ingredient: ${ingredient.name}`);
        }
      }

      console.log(`✅ Created ${created} new junction records`);
      return true;

    } catch (error) {
      console.error('Error syncing recipe ingredients to junction table:', error);
      return false;
    }
  }

  // Helper to find master ingredient by name
  private async findMasterIngredientByName(ingredientName: string): Promise<{id: string, name: string} | null> {
    try {
      const allIngredients = await this.base!('Ingredients').select().all();
      const masterIngredient = allIngredients.find((ing: any) => {
        const name = (ing as any).fields['Ingredient Name'];
        return name?.toLowerCase().trim() === ingredientName.toLowerCase().trim();
      });

      if (masterIngredient) {
        return {
          id: masterIngredient.id,
          name: (masterIngredient as any).fields['Ingredient Name']
        };
      }

      return null;
    } catch (error) {
      console.error('Error finding master ingredient by name:', error);
      return null;
    }
  }

  // Migration script to populate Recipe Ingredients junction table
  async migrateToJunctionTable(): Promise<{success: boolean, created: number, errors: string[]}> {
    if (!this.checkInitialization()) return {success: false, created: 0, errors: ['Airtable not initialized']};

    const results = {success: false, created: 0, errors: [] as string[]};

    try {
      console.log('🚀 Starting migration to Recipe Ingredients junction table...');

      // Get all existing ingredient records
      const allIngredients = await this.base!('Ingredients').select().all();

      // Debug: Show sample ingredient structure
      if (allIngredients.length > 0) {
        const sampleIngredient = allIngredients[0] as any;
        console.log('🔍 Sample ingredient fields:', Object.keys(sampleIngredient.fields));
        console.log('🔍 Sample ingredient data:', sampleIngredient.fields);
      }

      const recordsToCreate: any[] = [];

      for (const ingredientRecord of allIngredients) {
        const ingredient = ingredientRecord as any;

        // Try different possible field names for recipes
        const recipes = ingredient.fields['Recipes'] ||
                       ingredient.fields['Recipe'] ||
                       ingredient.fields['recipes'] ||
                       ingredient.fields['Recipe Name'] || [];

        const quantity = ingredient.fields['Quantity'];
        const unit = ingredient.fields['Unit'];
        const ingredientName = ingredient.fields['Ingredient Name'];

        console.log(`🔍 Processing ingredient: ${ingredientName}, Recipes: ${recipes?.length || 0}, Quantity: ${quantity}`);

        // Create junction records for each recipe this ingredient is linked to
        if (Array.isArray(recipes) && recipes.length > 0) {
          for (const recipeId of recipes) {
            recordsToCreate.push({
              'Recipe': [recipeId],
              'Ingredient': [ingredient.id],
              'Quantity': quantity,
              'Unit': unit
            });
          }
        }
      }

      console.log(`📝 Creating ${recordsToCreate.length} recipe-ingredient relationships...`);

      if (recordsToCreate.length === 0) {
        console.warn('⚠️ No recipe-ingredient relationships found to migrate');
        console.warn('This might mean ingredients are not properly linked to recipes in the current structure');
        results.success = true;
        return results;
      }

      // Create records in batches (Airtable API limit is 10 per batch)
      const batchSize = 10;
      for (let i = 0; i < recordsToCreate.length; i += batchSize) {
        const batch = recordsToCreate.slice(i, i + batchSize);
        await this.base!('Recipe Ingredients').create(batch);
        results.created += batch.length;
        console.log(`✅ Created batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(recordsToCreate.length/batchSize)}`);
      }

      results.success = true;
      console.log(`🎉 Migration completed! Created ${results.created} junction records`);

    } catch (error) {
      console.error('❌ Migration failed:', error);
      results.errors.push(`Migration failed: ${error}`);
    }

    return results;
  }

  // Helper method to create sample recipe-ingredient relationships
  async createSampleRecipeIngredients(): Promise<{success: boolean, created: number, errors: string[]}> {
    if (!this.checkInitialization()) return {success: false, created: 0, errors: ['Airtable not initialized']};

    const results = {success: false, created: 0, errors: [] as string[]};

    try {
      console.log('🚀 Creating sample recipe-ingredient relationships...');

      // Get recipes and ingredients to work with
      const recipes = await this.base!('Recipes').select().all();
      const ingredients = await this.base!('Ingredients').select().all();


      // Find some common ingredients by name
      const findIngredient = (name: string) => ingredients.find((ing: any) =>
        (ing as any).fields['Ingredient Name']?.toLowerCase().includes(name.toLowerCase())
      );

      const sushiRice = findIngredient('Sushi Rice') || findIngredient('Rice');
      const avocado = findIngredient('Avocado');
      const cucumber = findIngredient('Cucumber');
      const salmon = findIngredient('Salmon');
      const nori = findIngredient('Nori');
      const tuna = findIngredient('Tuna');

      console.log('🔍 Found ingredients:', {
        sushiRice: sushiRice ? (sushiRice as any).fields['Ingredient Name'] : 'Not found',
        avocado: avocado ? (avocado as any).fields['Ingredient Name'] : 'Not found',
        cucumber: cucumber ? (cucumber as any).fields['Ingredient Name'] : 'Not found',
      });

      // Create sample relationships if we have recipes and ingredients
      const sampleRelationships = [];

      if (recipes.length > 0 && sushiRice) {
        const firstRecipe = recipes[0];

        // Add sushi rice to first recipe
        if (sushiRice) {
          sampleRelationships.push({
            'Recipe': [firstRecipe.id],
            'Ingredient': [sushiRice.id],
            'Quantity': 2,
            'Unit': 'cups'
          });
        }

        // Add avocado to first recipe
        if (avocado) {
          sampleRelationships.push({
            'Recipe': [firstRecipe.id],
            'Ingredient': [avocado.id],
            'Quantity': 1,
            'Unit': 'piece'
          });
        }

        // Add cucumber to first recipe
        if (cucumber) {
          sampleRelationships.push({
            'Recipe': [firstRecipe.id],
            'Ingredient': [cucumber.id],
            'Quantity': 0.5,
            'Unit': 'piece'
          });
        }
      }

      console.log(`📝 Creating ${sampleRelationships.length} sample relationships...`);

      // Create the sample relationships
      for (const relationship of sampleRelationships) {
        await this.base!('Recipe Ingredients').create(relationship);
        results.created++;
        console.log(`✅ Created relationship: ${relationship.Quantity} ${relationship.Unit}`);
      }

      results.success = true;
      console.log(`🎉 Sample relationships created! Total: ${results.created}`);

    } catch (error) {
      console.error('❌ Failed to create sample relationships:', error);
      results.errors.push(`Failed: ${error}`);
    }

    return results;
  }

  // Demonstration method showing how to sync prices from Odoo
  async syncIngredientsWithOdoo(): Promise<void> {
    console.log('🚀 Starting Odoo price synchronization...');

    try {
      // In a real implementation, you would fetch products from your Odoo API
      // For demonstration, here's how you would structure the Odoo data:
      const mockOdooProducts = [
        { name: 'Yellowfin Tuna Sashimi Grade', list_price: 3.75 },
        { name: 'Organic Chicken Thigh Boneless', list_price: 4.25 },
        { name: 'Miso Paste', list_price: 0.55 },
        { name: 'Silken Tofu', list_price: 0.65 }
      ];

      // Call the price update method
      const results = await this.updateAllIngredientPricesFromOdoo(mockOdooProducts);

      console.log('🎉 Synchronization Results:');
      console.log(`   ✅ Updated: ${results.updated} ingredients`);
      console.log(`   ⚠️  Not found: ${results.notFound} ingredients`);
      console.log(`   ❌ Errors: ${results.errors.length} ingredients`);

      if (results.errors.length > 0) {
        console.log('Error details:', results.errors);
      }

    } catch (error) {
      console.error('❌ Failed to sync with Odoo:', error);
    }
  }

  // Utility Methods
  isEnabled(): boolean {
    return this.isInitialized && this.base !== null;
  }

  getStatus(): string {
    if (!this.isInitialized) {
      return 'Not configured - check environment variables';
    }
    return 'Connected to Airtable';
  }

  // Debug method to inspect Airtable base structure
  async debugAirtableStructure(): Promise<string> {
    try {
      console.log('🔍 Debugging Airtable base structure...');

      if (!this.checkInitialization()) {
        return 'Airtable service not initialized';
      }

      // Try to get one record from each table to see field structure
      const tables = ['Recipes', 'Ingredients', 'Recipe Ingredients'];

      for (const tableName of tables) {
        try {
          console.log(`\n📋 Checking table: ${tableName}`);
          const records = await this.base!(tableName).select({
            maxRecords: 1
          }).all();

          if (records.length > 0) {
            const sampleRecord = records[0];
            console.log(`✅ Sample record from ${tableName}:`, {
              id: sampleRecord.id,
              fields: Object.keys(sampleRecord.fields),
              sampleData: sampleRecord.fields
            });
          } else {
            console.log(`⚠️ Table ${tableName} exists but is empty`);
          }
        } catch (tableError) {
          console.log(`❌ Table ${tableName} error:`, tableError);
        }
      }

      return 'Debug complete - check console for details';
    } catch (error) {
      console.error('Debug failed:', error);
      return `Debug failed: ${error}`;
    }
  }

  // ==================== COGS Calculator Backup Methods ====================

  /**
   * Save current Cost Management calculator state to Airtable
   */
  async saveCOGSCalculatorSession(sessionName: string, recipeRows: COGSCalculatorEntry[]): Promise<boolean> {
    if (!this.checkInitialization()) {
      throw new Error('Airtable service not initialized');
    }

    if (!sessionName || !sessionName.trim()) {
      throw new Error('Session name is required');
    }

    if (!Array.isArray(recipeRows) || recipeRows.length === 0) {
      throw new Error('No recipe data to save');
    }

    try {
      console.log(`💾 Saving COGS calculator session: "${sessionName}" with ${recipeRows.length} recipes`);

      // Filter out recipes with zero quantity
      const recipesToSave = recipeRows.filter(row => row.quantitySold > 0);

      if (recipesToSave.length === 0) {
        throw new Error('No recipes with quantities to save. Please enter some quantities before saving.');
      }

      // Prepare records for Airtable
      const records = recipesToSave.map(row => ({
        fields: {
          'Session Name': sessionName.trim(),
          'Recipe Name': row.recipeName,
          'Recipe ID': row.recipeId,
          'Unit Cost': row.unitCost,
          'Quantity Sold': row.quantitySold,
          'Total Cost': row.totalCost,
          'Notes': row.notes || ''
        }
      }));

      // Delete existing records with the same session name first
      await this.deleteCOGSCalculatorSession(sessionName);

      // Save new records in batches (Airtable limit is 10 records per request)
      const batchSize = 10;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        await this.base!('Customer COGS Calculator').create(batch);
        console.log(`💾 Saved batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);
      }

      console.log(`✅ COGS calculator session "${sessionName}" saved successfully with ${recipesToSave.length} recipes`);
      return true;

    } catch (error) {
      console.error('❌ Error saving COGS calculator session:', error);
      throw error;
    }
  }

  /**
   * Load a saved Cost Management calculator session from Airtable
   */
  async loadCOGSCalculatorSession(sessionName: string): Promise<COGSCalculatorEntry[]> {
    if (!this.checkInitialization()) {
      throw new Error('Airtable service not initialized');
    }

    if (!sessionName || !sessionName.trim()) {
      throw new Error('Session name is required');
    }

    try {
      console.log(`📂 Loading COGS calculator session: "${sessionName}"`);

      const records = await this.base!('Customer COGS Calculator')
        .select({
          filterByFormula: `{Session Name} = "${sessionName.trim()}"`,
          sort: [{ field: 'Recipe Name', direction: 'asc' }]
        })
        .all();

      if (records.length === 0) {
        throw new Error(`No saved session found with name: "${sessionName}"`);
      }

      const entries: COGSCalculatorEntry[] = records.map(record => {
        const fields = record.fields as AirtableCOGSCalculatorRecord['fields'];
        return {
          sessionName: fields['Session Name'],
          recipeName: fields['Recipe Name'],
          recipeId: fields['Recipe ID'],
          unitCost: fields['Unit Cost'] || 0,
          quantitySold: fields['Quantity Sold'] || 0,
          totalCost: fields['Total Cost'] || 0,
          notes: fields['Notes'] || ''
        };
      });

      console.log(`✅ Loaded COGS calculator session "${sessionName}" with ${entries.length} recipes`);
      return entries;

    } catch (error) {
      console.error('❌ Error loading COGS calculator session:', error);
      throw error;
    }
  }

  /**
   * Get list of all saved COGS calculator sessions
   */
  async getCOGSCalculatorSessions(): Promise<string[]> {
    if (!this.checkInitialization()) {
      throw new Error('Airtable service not initialized');
    }

    try {
      console.log('📋 Getting list of COGS calculator sessions...');

      const records = await this.base!('Customer COGS Calculator')
        .select({
          fields: ['Session Name']
          // Removed sort by 'Created Date' as field name may vary in Airtable
        })
        .all();

      // Get unique session names
      const sessionNames = new Set<string>();
      records.forEach(record => {
        const sessionName = record.fields['Session Name'] as string;
        if (sessionName && sessionName.trim()) {
          sessionNames.add(sessionName.trim());
        }
      });

      const sessions = Array.from(sessionNames).sort(); // Sort alphabetically
      console.log(`✅ Found ${sessions.length} COGS calculator sessions`);
      return sessions;

    } catch (error) {
      console.error('❌ Error getting COGS calculator sessions:', error);
      throw error;
    }
  }

  /**
   * Delete a COGS calculator session
   */
  async deleteCOGSCalculatorSession(sessionName: string): Promise<boolean> {
    if (!this.checkInitialization()) {
      throw new Error('Airtable service not initialized');
    }

    if (!sessionName || !sessionName.trim()) {
      throw new Error('Session name is required');
    }

    try {
      console.log(`🗑️ Deleting COGS calculator session: "${sessionName}"`);

      const records = await this.base!('Customer COGS Calculator')
        .select({
          filterByFormula: `{Session Name} = "${sessionName.trim()}"`
        })
        .all();

      if (records.length === 0) {
        console.log(`ℹ️ No records found for session "${sessionName}"`);
        return true;
      }

      // Delete records in batches (Airtable limit is 10 records per request)
      const batchSize = 10;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const recordIds = batch.map(record => record.id);
        await this.base!('Customer COGS Calculator').destroy(recordIds);
        console.log(`🗑️ Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);
      }

      console.log(`✅ Deleted COGS calculator session "${sessionName}" (${records.length} records)`);
      return true;

    } catch (error) {
      console.error('❌ Error deleting COGS calculator session:', error);
      throw error;
    }
  }

  // ==================== Ingredient Management Methods ====================

  /**
   * Create a new standalone ingredient in Airtable (not tied to a recipe)
   */
  async createStandaloneIngredient(ingredientData: {
    name: string;
    unitCost: number;
    unit: string;
    category?: string;
    notes?: string;
  }): Promise<{ success: boolean; ingredient?: any; error?: string }> {
    if (!this.checkInitialization()) {
      return { success: false, error: 'Airtable service not initialized' };
    }

    try {
      console.log(`➕ Creating ingredient: ${ingredientData.name}`);

      // Check for duplicate ingredient names
      const existingIngredients = await this.base!('Ingredients')
        .select({
          filterByFormula: `{Ingredient Name} = "${ingredientData.name}"`
        })
        .all();

      if (existingIngredients.length > 0) {
        return {
          success: false,
          error: `Ingredient "${ingredientData.name}" already exists`
        };
      }

      // Create the ingredient record
      const recordData: any = {
        'Ingredient Name': ingredientData.name,
        'Unit Cost': ingredientData.unitCost,
        'Unit': ingredientData.unit,
        'From Odoo': false
      };

      // Only add optional fields if they have values
      // Note: Category field commented out due to Airtable validation error
      // if (ingredientData.category && ingredientData.category.trim()) {
      //   recordData['Category'] = ingredientData.category;
      //   console.log(`📋 Adding Category: "${ingredientData.category}"`);
      // }
      if (ingredientData.notes && ingredientData.notes.trim()) {
        recordData['Notes'] = ingredientData.notes;
      }

      console.log('📤 Sending to Airtable:', JSON.stringify(recordData));

      const record = await this.base!('Ingredients').create(recordData) as any;

      // Clear the ingredients cache to force refresh
      this.cachedIngredients = null;

      console.log(`✅ Ingredient created: ${ingredientData.name} (ID: ${record.id})`);

      return {
        success: true,
        ingredient: {
          id: record.id,
          name: ingredientData.name,
          unitCost: ingredientData.unitCost,
          unit: ingredientData.unit,
          category: ingredientData.category,
          notes: ingredientData.notes
        }
      };

    } catch (error: any) {
      console.error('❌ Error creating ingredient:', error);
      return {
        success: false,
        error: error.message || 'Failed to create ingredient'
      };
    }
  }
}

export const airtableService = new AirtableService();

// Make available globally for testing
if (typeof window !== 'undefined') {
  (window as any).airtableService = airtableService;
}

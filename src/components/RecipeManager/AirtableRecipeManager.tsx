import React, { useState, useEffect } from 'react';
import { Recipe, Ingredient } from '../../types';
import { airtableService } from '../../services/airtableService';
import { apiService } from '../../services/apiService';
import { productionOdooService as odooService } from '../../services/productionOdooService';
import { initializeSampleData } from '../../data/sampleRecipes';
import './RecipeManager.css';

const AirtableRecipeManager: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [airtableStatus, setAirtableStatus] = useState<string>('');
  const [isCalculatingCosts, setIsCalculatingCosts] = useState(false);
  const [recipeBreakdown, setRecipeBreakdown] = useState<any>(null);
  const [availableIngredients, setAvailableIngredients] = useState<{id: string, name: string, unitCost?: number}[]>([]);
  const [ingredientSearchTerms, setIngredientSearchTerms] = useState<{[key: number]: string}>({});
  const [showIngredientDropdowns, setShowIngredientDropdowns] = useState<{[key: number]: boolean}>({});
  const [useApiService, setUseApiService] = useState<boolean>(false);
  // Q Factor is now handled in Airtable, no local state needed

  const categories = ['all', 'Appetizers', 'Mains', 'Desserts', 'Beverages', 'Sauces', 'Sides'];

  // Q Factor calculations are now handled by Airtable computed fields

  useEffect(() => {
    const initializeServices = async () => {
      // Check if API service is available
      const apiAvailable = await apiService.isAvailable();
      setUseApiService(apiAvailable);

      setAirtableStatus(airtableService.getStatus());

      if (apiAvailable) {
        console.log('✅ Using optimized API service');
        await loadRecipes();
        await loadAvailableIngredients();
      } else if (airtableService.isEnabled()) {
        console.log('⚠️ API service unavailable, falling back to direct Airtable');
        await loadRecipes();
        await loadAvailableIngredients();
      } else {
        // Fallback to localStorage if neither service is available
        loadLocalRecipes();
      }
    };

    initializeServices();
  }, []);

  // Calculate real-time costs when a recipe is selected
  useEffect(() => {
    if (selectedRecipe?.id && airtableService.isEnabled()) {
      calculateRealTimeCosts(selectedRecipe.id);
    }
  }, [selectedRecipe?.id]);

  const loadRecipes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (useApiService) {
        const apiRecipes = await apiService.getRecipes();
        setRecipes(apiRecipes);
      } else if (airtableService.isEnabled()) {
        const airtableRecipes = await airtableService.getRecipes();
        setRecipes(airtableRecipes);
      } else {
        loadLocalRecipes();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipes');
      loadLocalRecipes(); // Fallback to localStorage
    } finally {
      setIsLoading(false);
    }
  };

  const loadLocalRecipes = () => {
    const savedRecipes = localStorage.getItem('noe-sushi-recipes');
    if (savedRecipes) {
      setRecipes(JSON.parse(savedRecipes));
    } else {
      // Initialize with sample data if no recipes exist
      const sampleData = initializeSampleData();
      setRecipes(sampleData);
    }
  };

  const loadAvailableIngredients = async () => {
    try {
      if (useApiService) {
        const ingredients = await apiService.getAllIngredients();
        setAvailableIngredients(ingredients);
      } else if (airtableService.isEnabled()) {
        const ingredients = await airtableService.getAllIngredients();
        setAvailableIngredients(ingredients);
      }
    } catch (err) {
      console.error('Failed to load available ingredients:', err);
    }
  };

  const calculateRealTimeCosts = async (recipeId: string) => {
    try {
      const breakdown = await airtableService.calculateRecipeCostBreakdown(recipeId);
      setRecipeBreakdown(breakdown);

      // Update the recipe with calculated costs
      if (selectedRecipe && selectedRecipe.id === recipeId) {
        const updatedRecipe = {
          ...selectedRecipe,
          totalCost: breakdown.totalCost,
          costPerServing: breakdown.costPerServing
        };
        setSelectedRecipe(updatedRecipe);
      }
    } catch (error) {
      console.log('Could not calculate real-time costs:', error);
      // Fallback to existing costs if calculation fails
      setRecipeBreakdown(null);
    }
  };

  const createSampleRecipeInAirtable = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const sampleRecipe = {
        name: 'California Roll (Airtable)',
        description: 'Classic sushi roll with crab, avocado, and cucumber - created directly in Airtable',
        category: 'Sushi',
        servings: 2,
        prepTime: 30,
        cookTime: 20,
        instructions: 'Step 1: Prepare sushi rice according to package instructions and let cool.\n\nStep 2: Place nori sheet on bamboo mat, shiny side down.\n\nStep 3: Spread rice evenly over nori, leaving 1-inch border at top.\n\nStep 4: Place crab, avocado, and cucumber in a line across the center.\n\nStep 5: Using the bamboo mat, roll tightly from bottom to top.\n\nStep 6: Wet knife and slice into 6-8 pieces.\n\nStep 7: Sprinkle with sesame seeds and serve with soy sauce.',
        ingredients: [
          { name: 'Sushi Rice', quantity: 1, unit: 'cup', cost: 2.50, totalCost: 2.50 },
          { name: 'Nori (Seaweed)', quantity: 2, unit: 'sheets', cost: 0.75, totalCost: 1.50 },
          { name: 'Imitation Crab', quantity: 4, unit: 'oz', cost: 1.25, totalCost: 5.00 },
          { name: 'Avocado', quantity: 1, unit: 'piece', cost: 1.50, totalCost: 1.50 },
          { name: 'Cucumber', quantity: 0.5, unit: 'piece', cost: 1.00, totalCost: 0.50 }
        ]
      };

      const createdRecipe = await airtableService.createRecipe(sampleRecipe);
      if (createdRecipe) {
        setRecipes(prev => [...prev, createdRecipe]);
        setSelectedRecipe(createdRecipe);
        console.log('✅ Sample recipe created in Airtable:', createdRecipe);
      } else {
        setError('Failed to create sample recipe in Airtable');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sample recipe');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSampleData = () => {
    const sampleData = initializeSampleData();
    setRecipes(sampleData);
    saveToLocalStorage(sampleData);
    setError(null);
    setSelectedRecipe(null); // Reset selected recipe
    console.log('Sample data loaded:', sampleData.length, 'recipes');
  };

  const saveToLocalStorage = (updatedRecipes: Recipe[]) => {
    localStorage.setItem('noe-sushi-recipes', JSON.stringify(updatedRecipes));
  };

  const createNewRecipe = () => {
    const newRecipe: Recipe = {
      id: Date.now().toString(),
      name: 'New Recipe',
      description: '',
      category: 'Mains',
      ingredients: [],
      instructions: '',
      prepTime: 0,
      cookTime: 0,
      servings: 1,
      totalCost: 0,
      costPerServing: 0
    };
    setSelectedRecipe(newRecipe);
    setIsEditing(true);
  };

  const saveRecipe = async (recipe: Recipe) => {
    setIsLoading(true);
    setError(null);
    
    try {
      let savedRecipe: Recipe | null = null;

      if (airtableService.isEnabled()) {
        // Check if this is a valid Airtable record ID (starts with "rec")
        const isAirtableRecord = recipe.id && recipe.id.startsWith('rec');
        const existsInAirtable = isAirtableRecord && recipes.find(r => r.id === recipe.id);

        if (isAirtableRecord && existsInAirtable) {
          // Update existing Airtable recipe
          console.log(`Updating existing Airtable recipe: ${recipe.id}`);
          savedRecipe = await airtableService.updateRecipe(recipe.id, recipe);
        } else {
          // Create new recipe (either no ID, timestamp ID, or doesn't exist in Airtable)
          console.log(`Creating new recipe in Airtable. Original ID: ${recipe.id}`);
          const { id, ...recipeData } = recipe;
          savedRecipe = await airtableService.createRecipe(recipeData);
        }
      }

      if (savedRecipe) {
        // Handle case where we're replacing a local recipe (timestamp ID) with Airtable recipe (rec ID)
        const originalId = recipe.id;
        const existingIndex = recipes.findIndex(r => r.id === originalId || r.id === savedRecipe!.id);
        let updatedRecipes;

        if (existingIndex >= 0) {
          // Replace existing recipe (either same ID or replacing timestamp with Airtable ID)
          updatedRecipes = [...recipes];
          updatedRecipes[existingIndex] = savedRecipe;
        } else {
          // Add new recipe
          updatedRecipes = [...recipes, savedRecipe];
        }

        setRecipes(updatedRecipes);
        saveToLocalStorage(updatedRecipes);
        setSelectedRecipe(savedRecipe);
      } else {
        // Fallback to localStorage
        const existingIndex = recipes.findIndex(r => r.id === recipe.id);
        let updatedRecipes;
        
        if (existingIndex >= 0) {
          updatedRecipes = [...recipes];
          updatedRecipes[existingIndex] = recipe;
        } else {
          updatedRecipes = [...recipes, recipe];
        }
        
        setRecipes(updatedRecipes);
        saveToLocalStorage(updatedRecipes);
        setSelectedRecipe(recipe);
      }
      
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recipe');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteRecipe = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this recipe?')) return;

    setIsLoading(true);
    setError(null);

    try {
      if (airtableService.isEnabled()) {
        await airtableService.deleteRecipe(id);
      }

      const updatedRecipes = recipes.filter(r => r.id !== id);
      setRecipes(updatedRecipes);
      saveToLocalStorage(updatedRecipes);
      
      if (selectedRecipe?.id === id) {
        setSelectedRecipe(null);
        setIsEditing(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete recipe');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateCostWithOdoo = async (recipe: Recipe) => {
    if (!recipe.id) return;
    
    setIsCalculatingCosts(true);
    setError(null);

    try {
      // Get Odoo products for cost calculation
      await odooService.authenticate();
      const odooProducts = await odooService.getProducts();

      if (airtableService.isEnabled()) {
        // Sync with Airtable and Odoo
        const updated = await airtableService.syncRecipeWithOdoo(recipe.id, odooProducts);
        if (updated) {
          // Reload the recipe to get updated costs
          const updatedRecipe = await airtableService.getRecipeById(recipe.id);
          if (updatedRecipe) {
            setSelectedRecipe(updatedRecipe);
            // Update in local state
            const updatedRecipes = recipes.map(r => 
              r.id === updatedRecipe.id ? updatedRecipe : r
            );
            setRecipes(updatedRecipes);
            saveToLocalStorage(updatedRecipes);
          }
        }
      } else {
        // Manual calculation for localStorage mode
        let totalCost = 0;
        const updatedIngredients = recipe.ingredients.map(ingredient => {
          const odooProduct = odooProducts.find(product =>
            product.name?.toLowerCase().includes(ingredient.name?.toLowerCase() ?? '') ||
            ingredient.name?.toLowerCase().includes(product.name?.toLowerCase() ?? '')
          );

          if (odooProduct) {
            const cost = odooProduct.standard_price;
            const totalIngredientCost = ingredient.quantity * cost;
            totalCost += totalIngredientCost;
            
            return {
              ...ingredient,
              cost: cost,
              totalCost: totalIngredientCost,
              fromOdoo: true,
              odooProductName: odooProduct.name
            };
          }
          
          totalCost += ingredient.totalCost || 0;
          return ingredient;
        });

        const updatedRecipe = {
          ...recipe,
          ingredients: updatedIngredients,
          totalCost: totalCost,
          costPerServing: recipe.servings > 0 ? totalCost / recipe.servings : 0
        };

        setSelectedRecipe(updatedRecipe);
        const updatedRecipes = recipes.map(r => 
          r.id === updatedRecipe.id ? updatedRecipe : r
        );
        setRecipes(updatedRecipes);
        saveToLocalStorage(updatedRecipes);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate costs with Odoo');
    } finally {
      setIsCalculatingCosts(false);
    }
  };

  const addIngredient = (recipe: Recipe) => {
    const newIngredient: Ingredient = {
      id: Date.now().toString(),
      name: '',
      quantity: 0,
      unit: 'cup',
      cost: 0,
      totalCost: 0
    };
    
    const updatedRecipe = {
      ...recipe,
      ingredients: [...recipe.ingredients, newIngredient]
    };
    setSelectedRecipe(updatedRecipe);
  };

  const updateIngredient = (recipe: Recipe, index: number, ingredient: Ingredient) => {
    const updatedIngredients = [...recipe.ingredients];
    updatedIngredients[index] = {
      ...ingredient,
      totalCost: ingredient.quantity * (ingredient.cost || 0)
    };

    // Calculate base total cost (Q Factor will be handled by Airtable)
    const totalCost = updatedIngredients.reduce((sum, ing) => sum + (ing.totalCost || 0), 0);

    const updatedRecipe = {
      ...recipe,
      ingredients: updatedIngredients,
      totalCost: totalCost,
      costPerServing: recipe.servings > 0 ? totalCost / recipe.servings : 0
    };
    setSelectedRecipe(updatedRecipe);
  };

  const handleIngredientSelection = (recipe: Recipe, index: number, selectedIngredientId: string) => {
    const selectedAvailableIngredient = availableIngredients.find(ing => ing.id === selectedIngredientId);
    if (selectedAvailableIngredient) {
      const currentIngredient = recipe.ingredients[index];
      const updatedIngredient = {
        ...currentIngredient,
        id: selectedAvailableIngredient.id,
        name: selectedAvailableIngredient.name,
        cost: selectedAvailableIngredient.unitCost || currentIngredient.cost || 0
      };
      updateIngredient(recipe, index, updatedIngredient);
    }
  };

  const removeIngredient = (recipe: Recipe, index: number) => {
    const updatedIngredients = recipe.ingredients.filter((_, i) => i !== index);
    const totalCost = updatedIngredients.reduce((sum, ing) => sum + (ing.totalCost || 0), 0);
    
    const updatedRecipe = {
      ...recipe,
      ingredients: updatedIngredients,
      totalCost: totalCost,
      costPerServing: recipe.servings > 0 ? totalCost / recipe.servings : 0
    };
    setSelectedRecipe(updatedRecipe);
  };

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false;
    const matchesCategory = selectedCategory === 'all' || recipe.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="recipe-manager">
      <div className="recipe-manager-header">
        <h2>🍣 Recipe Manager</h2>
        <p className="recipe-manager-subtitle">
          {airtableService.isEnabled() ? 'Connected to Airtable' : 'Local Storage Mode'}
        </p>
      </div>

      {airtableStatus && (
        <div className={`status-banner ${airtableService.isEnabled() ? 'success' : 'warning'}`}>
          {airtableStatus}
        </div>
      )}

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)} className="close-error">×</button>
        </div>
      )}

      <div className="recipe-controls">
        <div className="search-section">
          <input
            type="text"
            placeholder="Search recipes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="category-select"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            ))}
          </select>
        </div>
        
        <div className="action-buttons">
          <button onClick={createNewRecipe} className="new-recipe-btn">
            ➕ New Recipe
          </button>
          <button
            onClick={loadRecipes}
            disabled={isLoading}
            className="refresh-btn"
          >
            {isLoading ? '⏳ Loading...' : '🔄 Refresh'}
          </button>
          <button
            onClick={loadSampleData}
            className="refresh-btn"
            style={{ backgroundColor: '#059669' }}
            title="Load demo recipes with ingredients for testing"
          >
            🍣 Load Sample Data
          </button>
          {airtableService.isEnabled() && (
            <button
              onClick={createSampleRecipeInAirtable}
              className="refresh-btn"
              style={{ backgroundColor: '#7c3aed' }}
              title="Create a sample recipe directly in Airtable"
            >
              📝 Create Airtable Sample
            </button>
          )}
        </div>
      </div>

      <div className="recipe-layout">
        <div className="recipe-list">
          <h3>Recipes ({filteredRecipes.length})</h3>
          {isLoading ? (
            <div className="loading">Loading recipes...</div>
          ) : filteredRecipes.length === 0 ? (
            <div className="empty-state">
              <p>No recipes found. Create your first recipe to get started!</p>
            </div>
          ) : (
            <div className="recipe-grid">
              {filteredRecipes.map(recipe => (
                <div
                  key={recipe.id}
                  className={`recipe-card ${selectedRecipe?.id === recipe.id ? 'selected' : ''}`}
                  onClick={() => setSelectedRecipe(recipe)}
                >
                  <h4>{recipe.name}</h4>
                  <p className="recipe-category">{recipe.category}</p>
                  <div className="recipe-cost-display">
                    <span className="total-cost-badge">Total Cost: ${recipe.totalCost?.toFixed(2) || '0.00'}</span>
                  </div>
                  {recipe.ingredients.some(ing => ing.fromOdoo) && (
                    <div className="odoo-badge">Odoo Synced</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedRecipe && (
          <div className="recipe-details">
            <div className="recipe-header">
              <h3>{isEditing ? 'Edit Recipe' : selectedRecipe.name}</h3>
              <div className="recipe-actions">
                {!isEditing && (
                  <>
                    <button
                      onClick={() => calculateCostWithOdoo(selectedRecipe)}
                      disabled={isCalculatingCosts}
                      className="cost-calc-btn"
                    >
                      {isCalculatingCosts ? '⏳ Calculating...' : '💰 Update Costs from Odoo'}
                    </button>
                    {airtableService.isEnabled() && (
                      <button
                        onClick={() => calculateRealTimeCosts(selectedRecipe.id!)}
                        disabled={isCalculatingCosts}
                        className="cost-calc-btn"
                        style={{ backgroundColor: '#059669' }}
                      >
                        🧮 Recalculate Costs
                      </button>
                    )}
                    <button onClick={() => setIsEditing(true)} className="edit-btn">
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => deleteRecipe(selectedRecipe.id!)}
                      className="delete-btn"
                    >
                      🗑️ Delete
                    </button>
                  </>
                )}
              </div>
            </div>

            {isEditing ? (
              <div className="recipe-form">
                <div className="form-section">
                  <label>
                    Recipe Name:
                    <input
                      type="text"
                      value={selectedRecipe.name}
                      onChange={(e) => setSelectedRecipe({...selectedRecipe, name: e.target.value})}
                    />
                  </label>
                  
                  <label>
                    Description:
                    <textarea
                      value={selectedRecipe.description || ''}
                      onChange={(e) => setSelectedRecipe({...selectedRecipe, description: e.target.value})}
                    />
                  </label>

                  <div className="form-row">
                    <label>
                      Category:
                      <select
                        value={selectedRecipe.category}
                        onChange={(e) => setSelectedRecipe({...selectedRecipe, category: e.target.value})}
                      >
                        {categories.slice(1).map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Servings:
                      <input
                        type="number"
                        min="1"
                        value={selectedRecipe.servings}
                        onChange={(e) => setSelectedRecipe({...selectedRecipe, servings: parseInt(e.target.value) || 1})}
                        className="quantity-input"
                      />
                    </label>

                    <label>
                      Prep Time (min):
                      <input
                        type="number"
                        min="0"
                        value={selectedRecipe.prepTime || 0}
                        onChange={(e) => setSelectedRecipe({...selectedRecipe, prepTime: parseInt(e.target.value) || 0})}
                        className="quantity-input"
                      />
                    </label>

                    <label>
                      Cook Time (min):
                      <input
                        type="number"
                        min="0"
                        value={selectedRecipe.cookTime || 0}
                        onChange={(e) => setSelectedRecipe({...selectedRecipe, cookTime: parseInt(e.target.value) || 0})}
                        className="quantity-input"
                      />
                    </label>
                  </div>
                </div>

                <div className="ingredients-section">
                  <div className="section-header">
                    <h4>Ingredients</h4>
                  </div>

                  {selectedRecipe.ingredients.length > 0 && (
                    <div className="ingredient-header-row">
                      <span className="ingredient-header">Ingredient</span>
                      <span className="ingredient-header">Quantity</span>
                      <span className="ingredient-header">Unit</span>
                      <span className="ingredient-header">Unit Cost</span>
                      <span className="ingredient-header">Total Cost</span>
                      <span className="ingredient-header">Actions</span>
                    </div>
                  )}

                  {selectedRecipe.ingredients.map((ingredient, index) => {
                    const searchTerm = ingredientSearchTerms[index] || '';
                    const showDropdown = showIngredientDropdowns[index] || false;
                    const isSelected = ingredient.id && ingredient.name;
                    const displayValue = isSelected ? ingredient.name : searchTerm;

                    const filteredIngredients = searchTerm.length > 0 ?
                      availableIngredients.filter(ing => {
                        const match = ing.name && ing.name.toLowerCase().includes(searchTerm.toLowerCase());
                        return match;
                      }) : [];


                    return (
                    <div key={index} className="ingredient-row">
                      <div className="ingredient-search-container">
                        <input
                          type="text"
                          placeholder={isSelected ? ingredient.name : "Search ingredients..."}
                          value={displayValue}
                          onChange={(e) => {
                            const value = e.target.value;
                            setIngredientSearchTerms({...ingredientSearchTerms, [index]: value});
                            setShowIngredientDropdowns({...showIngredientDropdowns, [index]: value.length > 0});

                            // If ingredient is selected and user starts typing, clear selection to enable search
                            if (isSelected && value !== ingredient.name) {
                              updateIngredient(selectedRecipe, index, {...ingredient, name: '', id: undefined});
                            } else if (!isSelected) {
                              // Update name for custom ingredients
                              updateIngredient(selectedRecipe, index, {...ingredient, name: value});
                            }
                          }}
                          onFocus={() => {
                            if (!isSelected && searchTerm.length > 0) {
                              setShowIngredientDropdowns({...showIngredientDropdowns, [index]: true});
                            }
                          }}
                          onBlur={() => {
                            // Simple delay to allow clicks
                            setTimeout(() => {
                              setShowIngredientDropdowns({...showIngredientDropdowns, [index]: false});
                            }, 150);
                          }}
                          className="ingredient-search-input"
                        />
                        {showDropdown && (
                            <div
                              className="ingredient-dropdown"
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              {filteredIngredients.length > 0 ? (
                                filteredIngredients.slice(0, 10).map(ing => (
                                  <div
                                    key={ing.id}
                                    className="ingredient-dropdown-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleIngredientSelection(selectedRecipe, index, ing.id);
                                      setIngredientSearchTerms({...ingredientSearchTerms, [index]: ''});
                                      setShowIngredientDropdowns({...showIngredientDropdowns, [index]: false});
                                    }}
                                  >
                                    <span className="ingredient-name">{ing.name}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="ingredient-dropdown-item no-results">
                                  <span className="ingredient-name">
                                    {availableIngredients.length === 0 ? 'No ingredients loaded from Airtable' : 'No matching ingredients found'}
                                  </span>
                                </div>
                              )}
                            </div>
                        )}
                      </div>
                      <input
                        type="number"
                        placeholder="Quantity"
                        value={ingredient.quantity}
                        onChange={(e) => updateIngredient(selectedRecipe, index, {...ingredient, quantity: parseFloat(e.target.value) || 0})}
                        className="quantity-input"
                      />
                      <select
                        value={ingredient.unit}
                        onChange={(e) => updateIngredient(selectedRecipe, index, {...ingredient, unit: e.target.value})}
                      >
                        <option value="cup">cup</option>
                        <option value="tbsp">tbsp</option>
                        <option value="tsp">tsp</option>
                        <option value="lb">lb</option>
                        <option value="oz">oz</option>
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="piece">piece</option>
                        <option value="each">each</option>
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={ingredient.cost ? ingredient.cost.toFixed(2) : '0.00'}
                        onChange={(e) => updateIngredient(selectedRecipe, index, {...ingredient, cost: parseFloat(e.target.value) || 0})}
                        className="cost-input"
                      />
                      <span className="total-cost">${ingredient.totalCost?.toFixed(2) || '0.00'}</span>
                      {ingredient.fromOdoo ? (
                        <span className="odoo-indicator">Odoo</span>
                      ) : (
                        <span className="est-indicator">ESTIM</span>
                      )}
                      <button
                        onClick={() => removeIngredient(selectedRecipe, index)}
                        className="remove-ingredient-btn"
                      >
                        ×
                      </button>
                    </div>
                    );
                  })}

                  <div className="add-ingredient-container">
                    <button onClick={() => addIngredient(selectedRecipe)} className="add-ingredient-btn">
                      ➕ Add Ingredient
                    </button>
                  </div>
                </div>

                <div className="instructions-section">
                  <label>
                    Instructions:
                    <textarea
                      value={selectedRecipe.instructions || ''}
                      onChange={(e) => setSelectedRecipe({...selectedRecipe, instructions: e.target.value})}
                      rows={6}
                    />
                  </label>
                </div>

                <div className="cost-breakdown-section">
                  <h4>Cost Breakdown</h4>
                  <div className="cost-summary">
                    <div className="cost-breakdown">
                      <div className="cost-item">
                        <span>Ingredients Cost:</span>
                        <span>${selectedRecipe.costBreakdown?.baseCost?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="cost-item q-factor-item">
                        <span>Q Factor Cost ({selectedRecipe.qFactorPercentage || 10}%):</span>
                        <span>+${selectedRecipe.qFactorCost?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="cost-item total-cost">
                        <span><strong>Total Cost with Q Factor:</strong></span>
                        <span><strong>${selectedRecipe.totalCostWithQFactor?.toFixed(2) || selectedRecipe.totalCost?.toFixed(2) || '0.00'}</strong></span>
                      </div>
                      <div className="cost-item">
                        <span><strong>Cost Per Serving:</strong></span>
                        <span><strong>${selectedRecipe.costPerServingWithQFactor?.toFixed(2) || selectedRecipe.costPerServing?.toFixed(2) || '0.00'}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    onClick={() => saveRecipe(selectedRecipe)}
                    disabled={isLoading}
                    className="save-btn"
                  >
                    {isLoading ? '⏳ Saving...' : '✓ Save Recipe'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      if (!recipes.find(r => r.id === selectedRecipe.id)) {
                        setSelectedRecipe(null);
                      }
                    }}
                    className="cancel-btn"
                  >
                    ✕ Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="recipe-view">
                <div className="recipe-info">
                  <p><strong>Category:</strong> {selectedRecipe.category}</p>
                  <p><strong>Servings:</strong> {selectedRecipe.servings}</p>
                  <p><strong>Prep Time:</strong> {selectedRecipe.prepTime || 0} minutes</p>
                  <p><strong>Cook Time:</strong> {selectedRecipe.cookTime || 0} minutes</p>
                  {selectedRecipe.description && (
                    <p><strong>Description:</strong> {selectedRecipe.description}</p>
                  )}
                </div>

                <div className="cost-summary">
                  <div className="cost-breakdown">
                    <div className="cost-item">
                      <span>Ingredients Cost:</span>
                      <span>${selectedRecipe.costBreakdown?.baseCost?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="cost-item q-factor-item">
                      <span>Q Factor Cost ({selectedRecipe.qFactorPercentage || 10}%):</span>
                      <span>+${selectedRecipe.qFactorCost?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="cost-item total-cost">
                      <span><strong>Total Cost with Q Factor:</strong></span>
                      <span><strong>${selectedRecipe.totalCostWithQFactor?.toFixed(2) || selectedRecipe.totalCost?.toFixed(2) || '0.00'}</strong></span>
                    </div>
                    <div className="cost-item">
                      <span><strong>Cost Per Serving:</strong></span>
                      <span><strong>${selectedRecipe.costPerServingWithQFactor?.toFixed(2) || selectedRecipe.costPerServing?.toFixed(2) || '0.00'}</strong></span>
                    </div>
                  </div>
                  {recipeBreakdown && recipeBreakdown.ingredientCosts && recipeBreakdown.ingredientCosts.length > 0 && (
                    <div className="cost-breakdown-details">
                      <h5>Cost Breakdown:</h5>
                      <div className="ingredient-costs">
                        {recipeBreakdown.ingredientCosts.map((ingredient: any, index: number) => (
                          <div key={index} className="ingredient-cost-row">
                            <span className="ingredient-name">{ingredient.name}</span>
                            <span className="ingredient-calc">
                              {ingredient.quantity} {ingredient.unit} × ${ingredient.unitCost?.toFixed(2) || '0.00'} = ${ingredient.totalCost?.toFixed(2) || '0.00'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="ingredients-display">
                  <h4>Ingredients</h4>
                  {selectedRecipe.ingredients && selectedRecipe.ingredients.length > 0 ? (
                    selectedRecipe.ingredients.map((ingredient, index) => (
                      <div key={`${ingredient.id}-${index}`} className="ingredient-item">
                        <span className="ingredient-name">{ingredient.name}</span>
                        <span className="ingredient-amount">{ingredient.quantity} {ingredient.unit}</span>
                        <span className="ingredient-cost">${ingredient.totalCost?.toFixed(2) || '0.00'}</span>
                        {ingredient.fromOdoo ? (
                          <span className="odoo-badge-small">Odoo</span>
                        ) : (
                          <span className="est-badge-small">ESTIM</span>
                        )}
                      </div>
                    ))
                  ) : (
                    <p style={{ color: '#6c757d', fontStyle: 'italic' }}>No ingredients added yet. Click "Edit" to add ingredients.</p>
                  )}
                </div>

                {selectedRecipe.instructions && (
                  <div className="instructions-display">
                    <h4>Instructions</h4>
                    <pre>{selectedRecipe.instructions}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AirtableRecipeManager;
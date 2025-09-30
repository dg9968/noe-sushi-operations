import React, { useState, useEffect } from 'react';
import { Recipe } from '../../types';
import { apiService } from '../../services/apiService';
import { airtableService } from '../../services/airtableService';
import './RecipeManager.css';

interface RecipeListItem {
  id: string;
  name: string;
  description: string;
  servings: number;
}

interface RecipesByCategory {
  [category: string]: RecipeListItem[];
}

const OptimizedRecipeManager: React.FC = () => {
  const [recipesByCategory, setRecipesByCategory] = useState<RecipesByCategory>({});
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingRecipe, setIsLoadingRecipe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useApiService, setUseApiService] = useState<boolean>(false);
  const [qFactor, setQFactor] = useState<number>(10);
  const [availableIngredients, setAvailableIngredients] = useState<{id: string, name: string, unitCost?: number}[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [ingredientSearchTerms, setIngredientSearchTerms] = useState<{[key: number]: string}>({});
  const [showIngredientDropdowns, setShowIngredientDropdowns] = useState<{[key: number]: boolean}>({});
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    const initializeServices = async () => {
      // Check if API service is available
      const apiAvailable = await apiService.isAvailable();
      setUseApiService(apiAvailable);

      if (apiAvailable) {
        console.log('✅ Using optimized API service');
        await loadRecipeList();
        await loadAvailableIngredients();
      } else if (airtableService.isEnabled()) {
        console.log('⚠️ API service unavailable, falling back to direct Airtable');
        await loadRecipeListFallback();
        await loadAvailableIngredients();
      } else {
        setError('No recipe service available');
      }
    };

    initializeServices();
  }, []);

  const loadRecipeList = async (searchQuery?: string) => {
    setIsLoadingList(true);
    setError(null);
    try {
      const recipeList = await apiService.getRecipeList(searchQuery);
      setRecipesByCategory(recipeList);

      // Auto-select first category if none selected
      const categories = Object.keys(recipeList);
      if (categories.length > 0 && !selectedCategory) {
        setSelectedCategory(categories[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipe list');
    } finally {
      setIsLoadingList(false);
    }
  };

  // Fallback to direct Airtable if API not available
  const loadRecipeListFallback = async () => {
    setIsLoadingList(true);
    setError(null);
    try {
      const recipes = await airtableService.getRecipes();

      // Group by category
      const grouped: RecipesByCategory = {};
      recipes.forEach(recipe => {
        const category = recipe.category || 'Uncategorized';
        if (!grouped[category]) {
          grouped[category] = [];
        }
        grouped[category].push({
          id: recipe.id,
          name: recipe.name,
          description: recipe.description || '',
          servings: recipe.servings || 1
        });
      });

      setRecipesByCategory(grouped);

      // Auto-select first category if none selected
      const categories = Object.keys(grouped);
      if (categories.length > 0 && !selectedCategory) {
        setSelectedCategory(categories[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipe list');
    } finally {
      setIsLoadingList(false);
    }
  };

  const loadAvailableIngredients = async () => {
    try {
      if (useApiService) {
        const ingredients = await apiService.getAllIngredients();
        setAvailableIngredients(ingredients);
      } else if (airtableService.isEnabled()) {
        const ingredients = await airtableService.getAllIngredients();
        setAvailableIngredients(ingredients.map((ing: any) => ({
          id: ing.id,
          name: ing.name,
          unitCost: ing.unitCost
        })));
      }
    } catch (err) {
      console.error('Failed to load ingredients:', err);
    }
  };

  const loadFullRecipeDetails = async (recipeId: string) => {
    if (!recipeId) return;

    setIsLoadingRecipe(true);
    setError(null);
    try {
      if (useApiService) {
        const recipe = await apiService.getRecipeById(recipeId, qFactor);
        setSelectedRecipe(recipe);
      } else if (airtableService.isEnabled()) {
        const recipe = await airtableService.getRecipeById(recipeId);
        setSelectedRecipe(recipe);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipe details');
    } finally {
      setIsLoadingRecipe(false);
    }
  };

  const handleRecipeSelect = (recipeId: string) => {
    setSelectedRecipeId(recipeId);
    loadFullRecipeDetails(recipeId);
  };

  const saveRecipe = async (recipe: Recipe) => {
    try {
      if (useApiService) {
        if (recipe.id) {
          await apiService.updateRecipe(recipe.id, recipe);
        } else {
          await apiService.createRecipe(recipe);
        }
      } else if (airtableService.isEnabled()) {
        if (recipe.id) {
          await airtableService.updateRecipe(recipe.id, recipe);
        } else {
          await airtableService.createRecipe(recipe);
        }
      }

      // Reload the recipe list to reflect changes
      await loadRecipeList();

      // Reload full details if this recipe is selected
      if (recipe.id && selectedRecipeId === recipe.id) {
        await loadFullRecipeDetails(recipe.id);
      }

      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recipe');
    }
  };

  const deleteRecipe = async (recipeId: string) => {
    if (!recipeId) return;

    if (!window.confirm('Are you sure you want to delete this recipe? This action cannot be undone.')) {
      return;
    }

    try {
      if (useApiService) {
        await apiService.deleteRecipe(recipeId);
      } else if (airtableService.isEnabled()) {
        await airtableService.deleteRecipe(recipeId);
      }

      // Clear selected recipe and reload list
      setSelectedRecipe(null);
      setSelectedRecipeId('');
      setIsEditing(false);
      await loadRecipeList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete recipe');
    }
  };

  const handleQFactorChange = (newQFactor: number) => {
    setQFactor(newQFactor);
    if (selectedRecipeId) {
      loadFullRecipeDetails(selectedRecipeId);
    }
  };

  const createNewRecipe = () => {
    const newRecipe: Recipe = {
      id: '', // Empty ID indicates this is a new recipe
      name: 'New Recipe',
      category: selectedCategory || 'Main Courses',
      prepTime: 0,
      cookTime: 0,
      servings: 1,
      ingredients: [
        {
          id: '',
          name: '',
          quantity: 0,
          unit: '',
          cost: 0,
          totalCost: 0
        }
      ],
      instructions: '',
      totalCost: 0,
      qFactorPercentage: qFactor
    };

    setSelectedRecipe(newRecipe);
    setSelectedRecipeId(''); // Clear selected recipe ID since this is new
    setIsEditing(true); // Start in edit mode for new recipes
  };

  const searchIngredients = async (query: string, index: number) => {
    setIngredientSearchTerms(prev => ({ ...prev, [index]: query }));
    setShowIngredientDropdowns(prev => ({ ...prev, [index]: true }));

    if (query.length > 0) {
      try {
        if (useApiService) {
          const results = await apiService.searchIngredients(query);
          setAvailableIngredients(results);
        } else {
          // Filter local ingredients
          const filtered = availableIngredients.filter(ing =>
            ing.name.toLowerCase().includes(query.toLowerCase())
          );
          setAvailableIngredients(filtered);
        }
      } catch (err) {
        console.error('Search failed:', err);
      }
    }
  };

  const refreshData = async () => {
    setIsLoadingList(true);
    setError(null);
    try {
      // Clear API cache if using API service
      if (useApiService) {
        await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/recipes/clear-cache`, {
          method: 'POST'
        });
      }

      // Reload recipe list
      await loadRecipeList();

      // Reload ingredients
      await loadAvailableIngredients();

      // Reload current recipe if one is selected
      if (selectedRecipeId) {
        await loadFullRecipeDetails(selectedRecipeId);
      }

      console.log('Data refreshed from Airtable');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh data');
    } finally {
      setIsLoadingList(false);
    }
  };

  const addIngredientToRecipe = (ingredient: {id: string, name: string, unitCost?: number}, index: number) => {
    if (!selectedRecipe) return;

    const newIngredients = [...selectedRecipe.ingredients];
    const fromOdoo = ingredient.unitCost !== undefined && ingredient.unitCost > 0;

    newIngredients[index] = {
      id: ingredient.id,
      name: ingredient.name,
      quantity: newIngredients[index]?.quantity || 1,
      unit: newIngredients[index]?.unit || 'oz',
      cost: ingredient.unitCost || 0,
      totalCost: (newIngredients[index]?.quantity || 1) * (ingredient.unitCost || 0),
      fromOdoo: fromOdoo
    };

    setSelectedRecipe({
      ...selectedRecipe,
      ingredients: newIngredients
    });

    setShowIngredientDropdowns(prev => ({ ...prev, [index]: false }));
    setIngredientSearchTerms(prev => ({ ...prev, [index]: '' }));
  };

  const removeIngredient = (index: number) => {
    if (!selectedRecipe) return;

    const newIngredients = selectedRecipe.ingredients.filter((_, i) => i !== index);
    setSelectedRecipe({
      ...selectedRecipe,
      ingredients: newIngredients
    });

    // Clean up state for removed ingredient
    setShowIngredientDropdowns(prev => {
      const updated = { ...prev };
      delete updated[index];
      return updated;
    });
    setIngredientSearchTerms(prev => {
      const updated = { ...prev };
      delete updated[index];
      return updated;
    });
  };

  // Handle search with debouncing to avoid too many API calls
  React.useEffect(() => {
    const debounceTimeout = setTimeout(() => {
      if (useApiService) {
        loadRecipeList(searchTerm || undefined);
      } else if (airtableService.isEnabled()) {
        loadRecipeListFallback();
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(debounceTimeout);
  }, [searchTerm, useApiService]);

  // Auto-expand categories when searching
  React.useEffect(() => {
    const categories = Object.keys(recipesByCategory);
    if (searchTerm && categories.length > 0) {
      // Auto-select first category when searching to show results
      if (!selectedCategory || !categories.includes(selectedCategory)) {
        setSelectedCategory(categories[0]);
      }
    }
  }, [recipesByCategory, searchTerm, selectedCategory]);

  const categories = Object.keys(recipesByCategory).sort();

  return (
    <div className="recipe-manager">
      <div className="recipe-manager-header">
        <h2>🍣 Recipe Manager</h2>
        <p className="recipe-manager-subtitle">Manage and cost your recipes with precision</p>
        <div className="header-controls">
          <div className="search-section">
            <input
              type="text"
              placeholder="Search recipes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="action-buttons">
            <button
              onClick={refreshData}
              disabled={isLoadingList}
              className="btn btn-secondary refresh-btn"
              title="Refresh data from Airtable"
            >
              {isLoadingList ? 'Refreshing...' : '🔄 Refresh'}
            </button>
            <button
              onClick={createNewRecipe}
              className="btn btn-success"
              title="Create a new recipe"
            >
              + New Recipe
            </button>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="btn btn-primary"
              disabled={!selectedRecipe}
            >
              {isEditing ? 'Cancel' : 'Edit Recipe'}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="recipe-layout">
        {/* Recipe List Panel */}
        <div className="recipe-list-panel">
          <h2>
            {searchTerm ? `Search Results for "${searchTerm}"` : 'Recipes by Category'}
            {isLoadingList && <span className="loading">Loading...</span>}
          </h2>

          {categories.length === 0 && searchTerm && !isLoadingList && (
            <div className="no-selection">
              <h3>No recipes found</h3>
              <p>No recipes match your search term "{searchTerm}". Try a different search.</p>
            </div>
          )}

          {categories.map(category => (
            <div key={category} className="category-section">
              <h3
                onClick={() => setSelectedCategory(selectedCategory === category ? '' : category)}
                className={`category-header ${selectedCategory === category ? 'expanded' : ''}`}
              >
                {category} ({recipesByCategory[category].length})
              </h3>

              {selectedCategory === category && (
                <div className="recipe-items">
                  {recipesByCategory[category].map(recipe => (
                    <div
                      key={recipe.id}
                      className={`recipe-item ${selectedRecipeId === recipe.id ? 'selected' : ''}`}
                      onClick={() => handleRecipeSelect(recipe.id)}
                    >
                      <div className="recipe-name">{recipe.name}</div>
                      {recipe.servings > 1 && (
                        <div className="recipe-meta">
                          Servings: {recipe.servings}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Recipe Details Panel */}
        <div className="recipe-details-panel">
          {isLoadingRecipe ? (
            <div className="loading-state">Loading recipe details...</div>
          ) : selectedRecipe ? (
            <div className="recipe-details">
              <div className="recipe-header-section">
                {isEditing ? (
                  <input
                    type="text"
                    value={selectedRecipe.name}
                    onChange={(e) => setSelectedRecipe({
                      ...selectedRecipe,
                      name: e.target.value
                    })}
                    className="recipe-name-input"
                    placeholder="Recipe Name"
                    style={{ fontSize: '1.5rem', fontWeight: 'bold', border: '2px solid #ddd', padding: '8px', borderRadius: '4px', width: '100%', marginBottom: '1rem' }}
                  />
                ) : (
                  <h2>{selectedRecipe.name}</h2>
                )}
                <div className="recipe-meta-grid">
                  <div className="recipe-meta-info">
                    {isEditing ? (
                      <>
                        <div>
                          Category:
                          <select
                            value={selectedRecipe.category}
                            onChange={(e) => setSelectedRecipe({
                              ...selectedRecipe,
                              category: e.target.value
                            })}
                            style={{ marginLeft: '8px', padding: '4px' }}
                          >
                            <option value="Appetizers">Appetizers</option>
                            <option value="Main Courses">Main Courses</option>
                            <option value="Desserts">Desserts</option>
                            <option value="Beverages">Beverages</option>
                            <option value="Sides">Sides</option>
                            <option value="Sauces">Sauces</option>
                          </select>
                        </div>
                        <div>
                          Prep Time:
                          <input
                            type="number"
                            value={selectedRecipe.prepTime || 0}
                            onChange={(e) => setSelectedRecipe({
                              ...selectedRecipe,
                              prepTime: parseInt(e.target.value) || 0
                            })}
                            style={{ marginLeft: '8px', padding: '4px', width: '60px' }}
                          /> min
                        </div>
                        <div>
                          Cook Time:
                          <input
                            type="number"
                            value={selectedRecipe.cookTime || 0}
                            onChange={(e) => setSelectedRecipe({
                              ...selectedRecipe,
                              cookTime: parseInt(e.target.value) || 0
                            })}
                            style={{ marginLeft: '8px', padding: '4px', width: '60px' }}
                          /> min
                        </div>
                        <div>
                          Servings:
                          <input
                            type="number"
                            value={selectedRecipe.servings || 1}
                            onChange={(e) => setSelectedRecipe({
                              ...selectedRecipe,
                              servings: parseInt(e.target.value) || 1
                            })}
                            style={{ marginLeft: '8px', padding: '4px', width: '60px' }}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>Category: {selectedRecipe.category}</div>
                        <div>Prep Time: {selectedRecipe.prepTime || 0} min</div>
                        <div>Cook Time: {selectedRecipe.cookTime || 0} min</div>
                        {selectedRecipe.servings > 1 && <div>Servings: {selectedRecipe.servings}</div>}
                      </>
                    )}
                  </div>
                  <div className="recipe-image-container">
                    {selectedRecipe.image ? (
                      <img
                        src={selectedRecipe.image}
                        alt={selectedRecipe.name}
                        className="recipe-image"
                      />
                    ) : (
                      <div className="no-image-placeholder">
                        <span>📷</span>
                        <p>No image available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Two-column grid layout for Ingredients and Instructions */}
              <div className="recipe-content-grid">
                {/* Ingredients Column */}
                <div className="ingredients-section">
                <h3>Ingredients ({selectedRecipe.ingredients.length})</h3>
                <div className="ingredients-grid">
                  {selectedRecipe.ingredients.map((ingredient, index) => (
                    <div key={`${ingredient.id}-${index}`} className="ingredient-row">
                      <div className="ingredient-input-group">
                        <input
                          type="text"
                          value={ingredientSearchTerms[index] || ingredient.name}
                          onChange={(e) => searchIngredients(e.target.value, index)}
                          onFocus={() => setShowIngredientDropdowns(prev => ({ ...prev, [index]: true }))}
                          placeholder="Search ingredients..."
                          disabled={!isEditing}
                          className="ingredient-search"
                        />

                        {showIngredientDropdowns[index] && isEditing && (
                          <div className="ingredient-dropdown">
                            {availableIngredients.slice(0, 10).map(ing => (
                              <div
                                key={ing.id}
                                className="ingredient-option"
                                onClick={() => addIngredientToRecipe(ing, index)}
                              >
                                <span className="ingredient-name">{ing.name}</span>
                                <span className="ingredient-cost">${ing.unitCost?.toFixed(4) || '0.0000'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <input
                        type="number"
                        value={ingredient.quantity}
                        onChange={(e) => {
                          if (!isEditing) return;
                          const newQuantity = parseFloat(e.target.value) || 0;
                          const newIngredients = [...selectedRecipe.ingredients];
                          newIngredients[index] = {
                            ...ingredient,
                            quantity: newQuantity,
                            totalCost: newQuantity * (ingredient.cost || 0)
                          };
                          setSelectedRecipe({
                            ...selectedRecipe,
                            ingredients: newIngredients
                          });
                        }}
                        disabled={!isEditing}
                        className="quantity-input"
                        step="0.01"
                        min="0"
                      />

                      <select
                        value={ingredient.unit}
                        onChange={(e) => {
                          if (!isEditing) return;
                          const newIngredients = [...selectedRecipe.ingredients];
                          newIngredients[index] = {
                            ...ingredient,
                            unit: e.target.value
                          };
                          setSelectedRecipe({
                            ...selectedRecipe,
                            ingredients: newIngredients
                          });
                        }}
                        disabled={!isEditing}
                        className="unit-select"
                      >
                        <option value="oz">oz</option>
                        <option value="lb">lb</option>
                        <option value="cup">cup</option>
                        <option value="tsp">tsp</option>
                        <option value="tbsp">tbsp</option>
                        <option value="each">each</option>
                        <option value="piece">piece</option>
                      </select>

                      <div className="cost-display">
                        ${ingredient.cost?.toFixed(4) || '0.0000'}
                      </div>

                      <div className="ingredient-source">
                        {ingredient.fromOdoo ? (
                          <span className="odoo-badge-small">Odoo</span>
                        ) : (
                          <span className="est-badge-small">ESTIM</span>
                        )}
                      </div>

                      {isEditing && (
                        <button
                          onClick={() => removeIngredient(index)}
                          className="btn-small btn-danger"
                          title="Remove ingredient"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {isEditing && (
                  <div className="recipe-actions">
                    <button
                      onClick={() => saveRecipe(selectedRecipe)}
                      className="btn btn-primary"
                    >
                      Save Recipe
                    </button>
                    <button
                      onClick={() => {
                        const newIngredients = [...selectedRecipe.ingredients, {
                          id: '',
                          name: '',
                          quantity: 1,
                          unit: 'oz',
                          cost: 0,
                          totalCost: 0
                        }];
                        setSelectedRecipe({
                          ...selectedRecipe,
                          ingredients: newIngredients
                        });
                      }}
                      className="btn btn-secondary"
                    >
                      Add Ingredient
                    </button>
                    {selectedRecipe.id && (
                      <button
                        onClick={() => deleteRecipe(selectedRecipe.id)}
                        className="btn btn-danger"
                        style={{ marginLeft: '10px' }}
                      >
                        Delete Recipe
                      </button>
                    )}
                  </div>
                )}
                </div>

                {/* Instructions Column */}
                <div className="instructions-section">
                  <h3>Instructions</h3>
                  {isEditing ? (
                    <textarea
                      value={Array.isArray(selectedRecipe.instructions)
                        ? selectedRecipe.instructions.join('\n')
                        : selectedRecipe.instructions || ''}
                      onChange={(e) => setSelectedRecipe({
                        ...selectedRecipe,
                        instructions: e.target.value
                      })}
                      placeholder="Enter cooking instructions, one step per line..."
                      className="instructions-textarea"
                      rows={6}
                    />
                  ) : (
                    <div className="instructions-display">
                      {selectedRecipe.instructions ? (
                        Array.isArray(selectedRecipe.instructions) ? (
                          <ol>
                            {selectedRecipe.instructions.map((step, index) => (
                              <li key={index}>{step}</li>
                            ))}
                          </ol>
                        ) : typeof selectedRecipe.instructions === 'string' ? (
                          <div className="instructions-text">
                            {selectedRecipe.instructions.split('\n').map((line, index) => (
                              <p key={index}>{line}</p>
                            ))}
                          </div>
                        ) : (
                          <p className="no-instructions">Instructions format not supported</p>
                        )
                      ) : (
                        <p className="no-instructions">No instructions provided</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Cost Breakdown and Controls Section */}
              <div className="cost-and-controls-section">
                {/* Cost Breakdown */}
                {selectedRecipe.costBreakdown && (
                  <div className="cost-summary">
                    <h3>Cost Breakdown</h3>
                    <div className="cost-grid">
                      <div>Ingredients Cost: ${selectedRecipe.costBreakdown.baseCost?.toFixed(4) || '0.0000'}</div>
                      <div>Q Factor ({selectedRecipe.qFactorPercentage || qFactor}%): ${selectedRecipe.costBreakdown.qFactorAmount?.toFixed(4) || '0.0000'}</div>
                      <div className="total-cost">Total Cost: ${selectedRecipe.costBreakdown.totalWithQFactor?.toFixed(4) || '0.0000'}</div>
                      <div>Cost Per Serving: ${selectedRecipe.costPerServing?.toFixed(4) || '0.0000'}</div>
                    </div>
                  </div>
                )}

                {/* Q Factor Control */}
                <div className="recipe-q-factor-control">
                  <h3>Cost Controls</h3>
                  <div className="q-factor-control">
                    <label>Q Factor (%):
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={selectedRecipe?.qFactorPercentage || qFactor}
                        onChange={async (e) => {
                          const newQFactor = parseFloat(e.target.value) || 10;
                          if (isEditing && selectedRecipe) {
                            setSelectedRecipe({...selectedRecipe, qFactorPercentage: newQFactor});
                            // Reload recipe details with the new Q Factor to get updated cost calculations
                            if (selectedRecipeId && useApiService) {
                              try {
                                const updatedRecipe = await apiService.getRecipeById(selectedRecipeId, newQFactor);
                                setSelectedRecipe({...updatedRecipe, qFactorPercentage: newQFactor});
                              } catch (err) {
                                console.error('Failed to update cost calculations:', err);
                              }
                            }
                          } else {
                            setQFactor(newQFactor);
                            if (selectedRecipeId) {
                              loadFullRecipeDetails(selectedRecipeId);
                            }
                          }
                        }}
                        disabled={!selectedRecipe}
                        className="quantity-input"
                      />
                    </label>
                    <div className="q-factor-note">
                      Adjust quality factor to see real-time cost changes
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <h3>Select a recipe to view details</h3>
              <p>Choose a category and recipe from the list on the left to see full details, ingredients, and cost breakdown.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OptimizedRecipeManager;
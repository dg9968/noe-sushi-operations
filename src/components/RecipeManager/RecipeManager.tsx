import React, { useState, useEffect } from 'react';
import { Recipe, Ingredient } from '../../types';
import { productionOdooService as odooService } from '../../services/productionOdooService';
import './RecipeManager.css';

const RecipeManager: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    const savedRecipes = localStorage.getItem('noe-sushi-recipes');
    if (savedRecipes) {
      setRecipes(JSON.parse(savedRecipes));
    }
  }, []);

  const saveRecipes = (updatedRecipes: Recipe[]) => {
    localStorage.setItem('noe-sushi-recipes', JSON.stringify(updatedRecipes));
    setRecipes(updatedRecipes);
  };

  const createNewRecipe = () => {
    const newRecipe: Recipe = {
      id: Date.now().toString(),
      name: 'New Recipe',
      category: 'other',
      ingredients: [],
      instructions: '',
      prepTime: 0,
      servings: 1,
    };
    setSelectedRecipe(newRecipe);
    setIsEditing(true);
  };

  const saveRecipe = (recipe: Recipe) => {
    const existingIndex = recipes.findIndex(r => r.id === recipe.id);
    let updatedRecipes;
    
    if (existingIndex >= 0) {
      updatedRecipes = [...recipes];
      updatedRecipes[existingIndex] = recipe;
    } else {
      updatedRecipes = [...recipes, recipe];
    }
    
    saveRecipes(updatedRecipes);
    setIsEditing(false);
  };

  const deleteRecipe = (id: string) => {
    const updatedRecipes = recipes.filter(r => r.id !== id);
    saveRecipes(updatedRecipes);
    if (selectedRecipe?.id === id) {
      setSelectedRecipe(null);
    }
  };

  const calculateRecipeCost = async (recipe: Recipe) => {
    let totalCost = 0;
    
    for (const ingredient of recipe.ingredients) {
      if (!ingredient.costPerUnit) {
        const odooProduct = await odooService.getProductByName(ingredient.name);
        if (odooProduct) {
          ingredient.costPerUnit = odooProduct.standard_price;
        }
      }
      
      if (ingredient.costPerUnit) {
        ingredient.totalCost = ingredient.quantity * ingredient.costPerUnit;
        totalCost += ingredient.totalCost;
      }
    }
    
    const updatedRecipe = { ...recipe, cost: totalCost };
    saveRecipe(updatedRecipe);
    setSelectedRecipe(updatedRecipe);
  };

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || recipe.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="recipe-manager">
      <div className="recipe-sidebar">
        <div className="sidebar-header">
          <h2>Recipes</h2>
          <button onClick={createNewRecipe} className="add-recipe-btn">
            + New Recipe
          </button>
        </div>

        <div className="recipe-controls">
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
            className="category-filter"
          >
            <option value="all">All Categories</option>
            <option value="appetizer">Appetizer</option>
            <option value="sushi">Sushi</option>
            <option value="sashimi">Sashimi</option>
            <option value="roll">Roll</option>
            <option value="dessert">Dessert</option>
            <option value="beverage">Beverage</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="recipe-list">
          {filteredRecipes.map(recipe => (
            <div
              key={recipe.id}
              className={`recipe-item ${selectedRecipe?.id === recipe.id ? 'selected' : ''}`}
              onClick={() => setSelectedRecipe(recipe)}
            >
              <h3>{recipe.name}</h3>
              <p className="recipe-category">{recipe.category}</p>
              {recipe.cost && (
                <p className="recipe-cost">${recipe.cost.toFixed(2)}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="recipe-content">
        {selectedRecipe ? (
          <RecipeEditor
            recipe={selectedRecipe}
            isEditing={isEditing}
            onSave={saveRecipe}
            onEdit={() => setIsEditing(true)}
            onCancel={() => setIsEditing(false)}
            onDelete={() => deleteRecipe(selectedRecipe.id)}
            onCalculateCost={() => calculateRecipeCost(selectedRecipe)}
          />
        ) : (
          <div className="empty-state">
            <h3>Select a recipe to view details</h3>
            <p>Choose a recipe from the list or create a new one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};

interface RecipeEditorProps {
  recipe: Recipe;
  isEditing: boolean;
  onSave: (recipe: Recipe) => void;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onCalculateCost: () => void;
}

const RecipeEditor: React.FC<RecipeEditorProps> = ({
  recipe,
  isEditing,
  onSave,
  onEdit,
  onCancel,
  onDelete,
  onCalculateCost,
}) => {
  // Helper functions to convert between string and array formats
  const instructionsToArray = (instructions: string | string[]): string[] => {
    if (Array.isArray(instructions)) return instructions;
    return instructions ? instructions.split('\n').filter(s => s.trim()) : [''];
  };
  
  const arrayToInstructions = (arr: string[]): string => {
    return arr.filter(s => s.trim()).join('\n');
  };

  const [editedRecipe, setEditedRecipe] = useState<Recipe>(recipe);
  const [instructionsArray, setInstructionsArray] = useState<string[]>(instructionsToArray(recipe.instructions));

  useEffect(() => {
    setEditedRecipe(recipe);
    setInstructionsArray(instructionsToArray(recipe.instructions));
  }, [recipe]);

  const addIngredient = () => {
    const newIngredient: Ingredient = {
      id: Date.now().toString(),
      name: '',
      quantity: 0,
      unit: '',
    };
    setEditedRecipe({
      ...editedRecipe,
      ingredients: [...editedRecipe.ingredients, newIngredient],
    });
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: any) => {
    const updatedIngredients = [...editedRecipe.ingredients];
    updatedIngredients[index] = { ...updatedIngredients[index], [field]: value };
    setEditedRecipe({ ...editedRecipe, ingredients: updatedIngredients });
  };

  const removeIngredient = (index: number) => {
    const updatedIngredients = editedRecipe.ingredients.filter((_, i) => i !== index);
    setEditedRecipe({ ...editedRecipe, ingredients: updatedIngredients });
  };

  const addInstruction = () => {
    const newArray = [...instructionsArray, ''];
    setInstructionsArray(newArray);
    setEditedRecipe({
      ...editedRecipe,
      instructions: arrayToInstructions(newArray),
    });
  };

  const updateInstruction = (index: number, value: string) => {
    const updatedInstructions = [...instructionsArray];
    updatedInstructions[index] = value;
    setInstructionsArray(updatedInstructions);
    setEditedRecipe({ ...editedRecipe, instructions: arrayToInstructions(updatedInstructions) });
  };

  const removeInstruction = (index: number) => {
    const updatedInstructions = instructionsArray.filter((_, i) => i !== index);
    setInstructionsArray(updatedInstructions);
    setEditedRecipe({ ...editedRecipe, instructions: arrayToInstructions(updatedInstructions) });
  };

  if (isEditing) {
    return (
      <div className="recipe-editor">
        <div className="editor-header">
          <input
            type="text"
            value={editedRecipe.name}
            onChange={(e) => setEditedRecipe({ ...editedRecipe, name: e.target.value })}
            className="recipe-name-input"
          />
          <div className="editor-actions">
            <button onClick={() => onSave(editedRecipe)} className="save-btn">
              Save
            </button>
            <button onClick={onCancel} className="cancel-btn">
              Cancel
            </button>
          </div>
        </div>

        <div className="recipe-form">
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select
                value={editedRecipe.category}
                onChange={(e) => setEditedRecipe({ ...editedRecipe, category: e.target.value })}
              >
                <option value="appetizer">Appetizer</option>
                <option value="sushi">Sushi</option>
                <option value="sashimi">Sashimi</option>
                <option value="roll">Roll</option>
                <option value="dessert">Dessert</option>
                <option value="beverage">Beverage</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Prep Time (minutes)</label>
              <input
                type="number"
                value={editedRecipe.prepTime}
                onChange={(e) => setEditedRecipe({ ...editedRecipe, prepTime: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label>Serving Size</label>
              <input
                type="number"
                value={editedRecipe.servings}
                onChange={(e) => setEditedRecipe({ ...editedRecipe, servings: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>

          <div className="ingredients-section">
            <div className="section-header">
              <h3>Ingredients</h3>
              <button onClick={addIngredient} className="add-btn">+ Add Ingredient</button>
            </div>
            {editedRecipe.ingredients.map((ingredient, index) => (
              <div key={ingredient.id} className="ingredient-row">
                <input
                  type="text"
                  placeholder="Ingredient name"
                  value={ingredient.name}
                  onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Quantity"
                  value={ingredient.quantity}
                  onChange={(e) => updateIngredient(index, 'quantity', parseFloat(e.target.value) || 0)}
                />
                <input
                  type="text"
                  placeholder="Unit"
                  value={ingredient.unit}
                  onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                />
                <button onClick={() => removeIngredient(index)} className="remove-btn">×</button>
              </div>
            ))}
          </div>

          <div className="instructions-section">
            <div className="section-header">
              <h3>Instructions</h3>
              <button onClick={addInstruction} className="add-btn">+ Add Step</button>
            </div>
            {instructionsArray.map((instruction, index) => (
              <div key={index} className="instruction-row">
                <span className="step-number">{index + 1}.</span>
                <textarea
                  value={instruction}
                  onChange={(e) => updateInstruction(index, e.target.value)}
                  placeholder="Enter instruction..."
                />
                <button onClick={() => removeInstruction(index)} className="remove-btn">×</button>
              </div>
            ))}
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              value={editedRecipe.notes || ''}
              onChange={(e) => setEditedRecipe({ ...editedRecipe, notes: e.target.value })}
              placeholder="Additional notes..."
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="recipe-viewer">
      <div className="viewer-header">
        <h1>{recipe.name}</h1>
        <div className="viewer-actions">
          <button onClick={onCalculateCost} className="cost-btn">
            Calculate Cost
          </button>
          <button onClick={onEdit} className="edit-btn">
            Edit
          </button>
          <button onClick={onDelete} className="delete-btn">
            Delete
          </button>
        </div>
      </div>

      <div className="recipe-details">
        <div className="recipe-meta">
          <span className="category-badge">{recipe.category}</span>
          <span>Prep Time: {recipe.prepTime} minutes</span>
          <span>Serves: {recipe.servings}</span>
          {recipe.cost && <span className="cost">Cost: ${recipe.cost.toFixed(2)}</span>}
        </div>

        <div className="ingredients-display">
          <h3>Ingredients</h3>
          <ul>
            {recipe.ingredients.map(ingredient => (
              <li key={ingredient.id}>
                {ingredient.quantity} {ingredient.unit} {ingredient.name}
                {ingredient.totalCost && (
                  <span className="ingredient-cost"> - ${ingredient.totalCost.toFixed(2)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="instructions-display">
          <h3>Instructions</h3>
          <ol>
            {(Array.isArray(recipe.instructions) ? recipe.instructions : recipe.instructions.split('\n').filter(s => s.trim())).map((instruction, index) => (
              <li key={index}>{instruction}</li>
            ))}
          </ol>
        </div>

        {recipe.notes && (
          <div className="notes-display">
            <h3>Notes</h3>
            <p>{recipe.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecipeManager;
# Airtable Sub-Recipe Setup Guide

## Step 1: Create the Recipe Components Table

1. Go to your Airtable base
2. Create a new table called: **`Recipe Components`**
3. Add the following fields:

### Required Fields:

| Field Name | Field Type | Configuration |
|------------|------------|---------------|
| **Name** | Single line text | Primary field (auto-filled formula optional) |
| **Parent Recipe** | Link to another record | Link to: `Recipes` table |
| **Sub-Recipe** | Link to another record | Link to: `Recipes` table |
| **Servings** | Number | Default: 1, Precision: 2 |
| **Date Created** | Created time | Auto-filled |

### Optional Formula for Name field:
```
{Parent Recipe} & " → " & {Sub-Recipe} & " (" & {Servings} & " servings)"
```

## Step 2: Add Linked Record Fields to Recipes Table

In your existing **`Recipes`** table, two new fields should appear automatically:

1. **Recipe Components** (from Recipe Components) - Shows where this recipe is used as a component
2. **Recipe Components 2** (from Recipe Components) - Shows sub-recipes used in this recipe

Rename them to:
- **Used In** (or keep as "Recipe Components")
- **Sub-Recipes** (or keep as "Recipe Components 2")

## Step 3: Test the Setup

Create a test record in Recipe Components:
1. Parent Recipe: Choose any recipe (e.g., "Combo Plate")
2. Sub-Recipe: Choose another recipe (e.g., "BENTO 15")
3. Servings: 1

## Example Data Structure

### Recipe Components Table:
| Name | Parent Recipe | Sub-Recipe | Servings |
|------|---------------|------------|----------|
| Combo Plate → BENTO 15 (1 serving) | Combo Plate | BENTO 15 | 1 |
| Special Roll → Spicy Tuna (0.5 servings) | Special Roll | Spicy Tuna | 0.5 |

### How It Works:

When you view "Combo Plate" recipe:
- Regular ingredients come from `Recipe Ingredients` table
- Sub-recipes come from `Recipe Components` table (where Parent Recipe = Combo Plate)
- The API will:
  1. Fetch regular ingredients
  2. Fetch sub-recipes from Recipe Components
  3. For each sub-recipe, calculate cost = (sub-recipe cost per serving) × servings
  4. Display sub-recipes with [Recipe] prefix in the ingredient list
  5. Include sub-recipe costs in total cost calculation

## Benefits of This Approach:

✅ Sub-recipes maintain their identity (not expanded into base ingredients)
✅ Easy to update sub-recipe ingredients - changes propagate automatically
✅ Can see which recipes use a specific recipe as a component
✅ Servings can be fractional (e.g., 0.5 servings of a sub-recipe)
✅ Clear separation between ingredients and sub-recipes
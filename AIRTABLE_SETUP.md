# Airtable Setup Guide for Noe Sushi Bar Operations

This guide will help you set up your Airtable base to work with the recipe cost calculation system.

## Step 1: Create Your Airtable Base

1. Go to [Airtable.com](https://airtable.com) and sign in/create an account
2. Create a new base called "Noe Sushi Bar Operations" 
3. Delete the default table and create the tables below

## Step 2: Create Tables and Fields

### Table 1: Recipes

**Table Name:** `Recipes`

**Fields:**
- `Name` (Single line text) - Primary field
- `Description` (Long text)
- `Servings` (Number)
- `Instructions` (Long text)
- `Ingredients` (Link to another record) - Links to Ingredients table
- `Total Cost` (Currency) - Formula or manually updated
- `Cost Per Serving` (Currency) - Formula or manually updated
- `Category` (Single select) - Options: Appetizers, Mains, Desserts, Beverages, Sauces, Sides
- `Prep Time` (Number) - Minutes
- `Cook Time` (Number) - Minutes
- `Created Date` (Date)
- `Last Modified` (Date)

### Table 2: Ingredients

**Table Name:** `Ingredients`

**Fields:**
- `Name` (Single line text) - Primary field
- `Quantity` (Number)
- `Unit` (Single select) - Options: lb, oz, kg, g, cup, tbsp, tsp, piece, each
- `Unit Cost` (Currency) - Cost per unit
- `Total Cost` (Currency) - Formula: {Quantity} * {Unit Cost}
- `Recipe Name` (Link to another record) - Links back to Recipes table
- `Odoo Product Name` (Single line text) - Name from Odoo if synced
- `From Odoo` (Checkbox) - Whether cost came from Odoo
- `Category` (Single select) - Options: Protein, Vegetables, Grains, Condiments, Spices, Dairy
- `Notes` (Long text)

## Step 3: Configure Formulas

### In Recipes Table:

**Total Cost Formula:**
```
SUM({Ingredients (from Ingredients)})
```

**Cost Per Serving Formula:**
```
IF({Servings} > 0, {Total Cost} / {Servings}, 0)
```

### In Ingredients Table:

**Total Cost Formula:**
```
{Quantity} * {Unit Cost}
```

## Step 4: Create Views

### Recipes Table Views:
1. **Grid view** (default) - All recipes
2. **By Category** - Group by Category field
3. **High Cost Recipes** - Filter where Total Cost > $20
4. **Recent Recipes** - Sort by Created Date (newest first)

### Ingredients Table Views:
1. **Grid view** (default) - All ingredients
2. **From Odoo** - Filter where From Odoo = true
3. **By Category** - Group by Category field
4. **Expensive Ingredients** - Sort by Unit Cost (highest first)

## Step 5: Get Your API Credentials

1. Go to [Airtable API Documentation](https://airtable.com/api)
2. Select your base
3. Copy your **Base ID** (starts with "app...")
4. Go to [Airtable Developer Hub](https://airtable.com/create/tokens) 
5. Click **"Create token"**
6. Give your token a name like "Noe Sushi Operations"
7. Add the following scopes:
   - `data.records:read` - Read records
   - `data.records:write` - Create/update records
   - `schema.bases:read` - Read base schema
8. Select your base in the "Access" section
9. Click **"Create token"** and copy your **Personal Access Token**

## Step 6: Configure Your App

Update your `.env` file with your credentials:

```env
REACT_APP_AIRTABLE_API_KEY=your_personal_access_token_here
REACT_APP_AIRTABLE_BASE_ID=your_actual_base_id_here
REACT_APP_ENABLE_AIRTABLE=true
```

**Note:** Despite the variable name saying "API_KEY", you should use your Personal Access Token here.

## Step 7: Test Data

Create some sample data to test:

### Sample Recipes:
1. **California Roll**
   - Servings: 8
   - Category: Mains
   - Description: Classic sushi roll with crab, avocado, and cucumber

2. **Miso Soup**
   - Servings: 4
   - Category: Appetizers
   - Description: Traditional Japanese soup with miso paste and tofu

### Sample Ingredients for California Roll:
- Sushi Rice: 2 cups, $0.50/cup
- Nori Seaweed: 4 sheets, $0.25/sheet
- Avocado: 1 piece, $1.50/piece
- Cucumber: 0.5 piece, $1.00/piece
- Imitation Crab: 6 oz, $3.00/oz

## Features

Once set up, your system will:

1. **Store Recipes in Airtable** - All recipe data persists in your Airtable base
2. **Calculate Costs Automatically** - Total cost and cost per serving update automatically
3. **Sync with Odoo** - Ingredient costs can be updated from your Odoo inventory
4. **Track Cost Changes** - See when costs were last updated and from which source
5. **Categorize Data** - Organize recipes and ingredients by category
6. **Real-time Updates** - Changes in Airtable reflect immediately in your app

## Odoo Integration

The system can automatically:
- Match ingredient names with Odoo products
- Update ingredient costs from Odoo pricing
- Mark which ingredients have Odoo-sourced pricing
- Recalculate recipe costs when Odoo prices change

## Benefits

- **Centralized Data** - All recipe data in one place
- **Cost Tracking** - Accurate recipe costing for pricing decisions
- **Collaboration** - Team members can update recipes in Airtable
- **Reporting** - Use Airtable's features for cost analysis and reporting
- **Backup** - Data is safely stored in Airtable's cloud
- **Scalability** - Easy to add more recipes and ingredients as you grow

## Troubleshooting

**"Airtable service not initialized"**
- Check your API key and Base ID in the .env file
- Make sure REACT_APP_ENABLE_AIRTABLE=true

**"No recipes found"**
- Verify your table names match exactly: "Recipes" and "Ingredients"
- Check that you have data in your tables
- Ensure field names match the specification above

**Cost calculations not working**
- Verify the formula fields are set up correctly
- Check that Unit Cost fields have numeric values
- Make sure the link between Recipes and Ingredients is working
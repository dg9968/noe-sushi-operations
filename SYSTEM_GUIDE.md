# Noe Sushi Bar - Operations Management System
## User Guide & System Overview

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Getting Started](#getting-started)
3. [Recipe Manager](#recipe-manager)
4. [Odoo Integration](#odoo-integration)
5. [Cost Management](#cost-management)
6. [COGS Calculator with Toast POS](#cogs-calculator-with-toast-pos)
7. [Workflow Examples](#workflow-examples)

---

## System Overview

The Noe Sushi Bar Operations Management System is a comprehensive tool designed to help you:

- **Manage Recipes** - Create, edit, and organize your restaurant recipes
- **Track Costs** - Automatically calculate recipe costs based on ingredient prices
- **Sync with Odoo** - Keep ingredient prices up-to-date from your Odoo ERP system
- **Calculate COGS** - Track Cost of Goods Sold using Toast POS sales data
- **Optimize Pricing** - Make data-driven decisions about menu pricing

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Web Browser                          │
│          (Recipe Manager, Cost Tools, Dashboards)            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend API Server                         │
│              (Port 5000 - Data Processing)                   │
└───────┬──────────────┬──────────────┬──────────────┬────────┘
        │              │               │              │
        ▼              ▼               ▼              ▼
   ┌────────┐    ┌─────────┐    ┌─────────┐   ┌──────────┐
   │Airtable│    │  Odoo   │    │  Toast  │   │  Local   │
   │Database│    │   ERP   │    │   POS   │   │ Storage  │
   └────────┘    └─────────┘    └─────────┘   └──────────┘
```

---

## Getting Started

### Starting the System

1. Open your terminal/command prompt
2. Navigate to the project folder: `cd C:\Users\danie\Documents\noe-operations`
3. Run: `bun dev`
4. Open your browser to: `http://localhost:3000`

### System Requirements

- **Backend Server**: Port 5000 (API & Data)
- **Frontend Client**: Port 3000 (User Interface)
- **Odoo Proxy**: Port 3001 (Optional - for direct Odoo access)

---

## Recipe Manager

The Recipe Manager is your central hub for creating and managing restaurant recipes.

### Key Features

#### 1. **Recipe Organization**
- Recipes are organized by categories (Appetizers, Main Courses, Desserts, etc.)
- Search functionality to quickly find recipes
- Visual recipe cards with images and descriptions

#### 2. **Recipe Details**
Each recipe includes:
- **Name & Description**: What the dish is
- **Servings**: How many portions the recipe makes
- **Prep/Cook Time**: Time needed to prepare
- **Ingredients**: List of ingredients with quantities
- **Cost Breakdown**: Automatic cost calculation
- **Q Factor**: Quality factor (wastage/overhead) - typically 10-15%

#### 3. **Ingredient Management**

**Adding Ingredients to Recipes:**
- Type to search existing ingredients
- Select from dropdown
- Specify quantity and unit
- Cost is automatically calculated

**Creating New Ingredients:**
1. Click "**+ New Ingredient**"
2. Fill in:
   - Ingredient Name
   - Unit Cost (price per ounce)
   - Unit (oz, lb, etc.)
   - Category (optional)
   - Notes (optional)
3. Click "Create Ingredient"
4. Ingredient is saved to Airtable and available immediately

#### 4. **Sub-Recipes**
You can use recipes as ingredients in other recipes!
- Example: Use "Spicy Mayo" recipe as an ingredient in "Spicy Tuna Roll"
- Toggle between ingredient mode and recipe mode
- Cost is automatically calculated from the sub-recipe

### Recipe Cost Calculation

The system automatically calculates:

```
Base Cost = Sum of all ingredient costs
Q Factor Cost = Base Cost × (Q Factor % ÷ 100)
Total Cost = Base Cost + Q Factor Cost
Cost Per Serving = Total Cost ÷ Number of Servings
```

**Example:**
- Base Cost: $12.50
- Q Factor: 10%
- Q Factor Cost: $1.25
- Total Cost: $13.75
- Servings: 4
- **Cost Per Serving: $3.44**

---

## Odoo Integration

Odoo is your ERP system where you manage inventory and purchasing. The system syncs ingredient prices from Odoo to keep costs accurate.

### How Odoo Integration Works

```
┌──────────────────────────────────────────────────────────┐
│  Step 1: Mark Ingredients in Airtable                    │
│  ✓ Check "From Odoo" checkbox for ingredients           │
│  ✓ Optionally specify "Odoo Product Name"               │
└──────────────────────────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────┐
│  Step 2: Click "🏪 Sync Odoo Prices"                     │
│  - System fetches all products from Odoo                 │
│  - Matches by product name                               │
│  - Converts Odoo prices to price per ounce               │
└──────────────────────────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────┐
│  Step 3: Airtable is Updated                             │
│  - "Unit Cost" field updated with price per ounce        │
│  - "Odoo Product Name" saved for reference               │
│  - All recipes using that ingredient auto-update         │
└──────────────────────────────────────────────────────────┘
```

### Setting Up Odoo Sync

#### In Airtable (Ingredients Table):
1. Find ingredients you want to sync from Odoo
2. Check the **"From Odoo"** checkbox
3. If the product name in Odoo is different, fill in **"Odoo Product Name"**

#### In the System:
1. Go to **Recipe Manager**
2. Click **"🏪 Sync Odoo Prices"** button
3. Wait for sync to complete
4. Review the summary:
   - Number of products fetched from Odoo
   - Number of ingredients matched
   - Number of prices updated

### Unit Conversion

The system automatically converts Odoo prices to price per ounce:

| Odoo Unit | Conversion | Example |
|-----------|------------|---------|
| **lb** (pound) | ÷ 16 | $12.50/lb → $0.78/oz |
| **kg** (kilogram) | ÷ 35.274 | $15.00/kg → $0.43/oz |
| **g** (gram) | ÷ 0.035274 | $0.50/g → $14.17/oz |
| **gal** (gallon) | ÷ 128 | $25.00/gal → $0.20/oz |
| **L** (liter) | ÷ 33.814 | $10.00/L → $0.30/oz |
| **oz** (ounce) | ÷ 1 | $2.00/oz → $2.00/oz |

### Best Practices

✅ **DO:**
- Keep ingredient names consistent between Airtable and Odoo
- Use the "Odoo Product Name" field when names differ
- Run sync regularly (weekly or when prices change)
- Review the sync summary to catch any issues

❌ **DON'T:**
- Manually edit prices for Odoo-linked ingredients (they'll be overwritten)
- Uncheck "From Odoo" without understanding the impact
- Forget to sync after major price changes in Odoo

---

## Cost Management

The Cost Management section helps you analyze recipe profitability and make pricing decisions.

### Key Metrics

1. **Recipe Cost**: Total cost to make the recipe
2. **Cost Per Serving**: Cost divided by servings
3. **Suggested Price**: Recommended menu price based on target food cost %
4. **Profit Margin**: Expected profit per serving

### Q Factor (Quality Factor)

The Q Factor accounts for:
- **Waste & Trim**: Food that's trimmed or spoiled
- **Spillage**: Ingredients lost during prep
- **Overhead**: Kitchen utilities, supplies
- **Quality Control**: Portions that don't meet standards

**Recommended Q Factor:**
- Standard recipes: 10%
- High-waste items (fish, produce): 12-15%
- Low-waste items (dry goods): 5-8%

### Food Cost Percentage

Target food cost percentage = (Cost / Selling Price) × 100

**Industry Standards:**
- Fine Dining: 28-35%
- Casual Dining: 28-32%
- Fast Casual: 25-30%
- Sushi: 30-35%

**Example:**
```
Recipe Cost: $8.50
Target Food Cost %: 30%
Suggested Price: $8.50 ÷ 0.30 = $28.33
Round to: $27.95 or $29.95
```

---

## COGS Calculator with Toast POS

The COGS (Cost of Goods Sold) Calculator integrates with Toast POS to track actual costs based on sales.

### How It Works

```
┌──────────────────────────────────────────────────────────┐
│  Toast POS: Customer orders Spicy Tuna Roll              │
│  - Sale recorded in Toast                                │
│  - Item sold: 1 × Spicy Tuna Roll                        │
└──────────────────────────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────┐
│  COGS Calculator: Fetches sales data                     │
│  - Retrieves orders from Toast API                       │
│  - Matches menu items to recipes                         │
│  - Calculates actual cost of items sold                  │
└──────────────────────────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────┐
│  Report Generated                                         │
│  Item: Spicy Tuna Roll                                   │
│  Quantity Sold: 1                                        │
│  Unit Cost: $3.44                                        │
│  Total Cost: $3.44                                       │
│  Revenue: $12.95                                         │
│  Profit: $9.51                                          │
└──────────────────────────────────────────────────────────┘
```

### Using the COGS Calculator

1. Navigate to **"COGS with Toast"** tab
2. Select a date range or session
3. Click **"Fetch Sales Data"**
4. Review the report:
   - Items sold by quantity
   - Cost per item
   - Total COGS
   - Revenue
   - Profit margins

### COGS Sessions

You can save COGS calculations as "sessions" to track costs over time:
- Daily COGS (e.g., "2024-01-15-Dinner")
- Weekly summaries (e.g., "Week-3-January")
- Event-specific (e.g., "New-Years-Eve")

---

## Workflow Examples

### Daily Operations Workflow

```
Morning:
┌────────────────────────────────────────┐
│ 1. Check inventory received            │
│ 2. Update Odoo with new prices         │
│ 3. Run Odoo sync in Recipe Manager     │
│ 4. Review any price changes            │
└────────────────────────────────────────┘

During Service:
┌────────────────────────────────────────┐
│ 1. Toast POS records all sales         │
│ 2. Kitchen uses recipes as guides      │
└────────────────────────────────────────┘

End of Day:
┌────────────────────────────────────────┐
│ 1. Run COGS Calculator                 │
│ 2. Review actual vs. expected costs    │
│ 3. Identify high-cost items            │
│ 4. Adjust portions or prices if needed │
└────────────────────────────────────────┘
```

### Creating a New Recipe Workflow

```
Step 1: Create Recipe
├─ Click "+ New Recipe"
├─ Enter name, description, servings
└─ Add prep/cook times

Step 2: Add Ingredients
├─ Search for existing ingredients
├─ OR create new ingredients
├─ Specify quantities
└─ Include sub-recipes if needed

Step 3: Calculate Costs
├─ System auto-calculates base cost
├─ Set Q Factor (10-15%)
├─ Review total cost per serving
└─ Note: Costs update when ingredients change!

Step 4: Set Menu Price
├─ Use suggested price from food cost %
├─ Consider competition & market
├─ Round to appealing price point
└─ Monitor sales performance

Step 5: Track Performance
├─ Monitor COGS from actual sales
├─ Compare to recipe cost
├─ Identify variances (over-portioning, waste)
└─ Adjust recipe or training as needed
```

### Menu Engineering Workflow

```
Monthly Analysis:
┌────────────────────────────────────────┐
│ 1. Export COGS data for all items     │
│ 2. Calculate actual food cost %       │
│ 3. Compare to target                  │
│ 4. Categorize items:                  │
│    • Stars: High profit, high sales   │
│    • Plowhorses: Low profit, high sales│
│    • Puzzles: High profit, low sales  │
│    • Dogs: Low profit, low sales      │
│ 5. Action plan:                       │
│    • Stars: Promote, maintain          │
│    • Plowhorses: Increase price        │
│    • Puzzles: Promote more             │
│    • Dogs: Remove or redesign          │
└────────────────────────────────────────┘
```

---

## Data Flow Overview

### Where Your Data Lives

```
┌─────────────────────────────────────────────────────────┐
│                    AIRTABLE DATABASE                     │
├─────────────────────────────────────────────────────────┤
│  Tables:                                                 │
│  • Recipes - All recipe information                     │
│  • Ingredients - Individual ingredients & costs         │
│  • Recipe Ingredients - Junction (links recipes to      │
│    ingredients with quantities)                         │
│  • COGS Calculator - Saved COGS sessions                │
├─────────────────────────────────────────────────────────┤
│  Syncs with:                                            │
│  • Odoo (ingredient prices)                             │
│  • Toast POS (sales data)                               │
│  • Your browser (real-time updates)                     │
└─────────────────────────────────────────────────────────┘
```

### Data Sync Process

1. **Odoo → Airtable**
   - You click "Sync Odoo Prices"
   - System fetches products from Odoo
   - Matches to Airtable ingredients
   - Updates "Unit Cost" field
   - Trigger: Manual button click

2. **Toast POS → System**
   - You click "Fetch Sales Data"
   - System queries Toast API
   - Retrieves orders for date range
   - Calculates costs from recipes
   - Trigger: Manual button click

3. **Airtable → Browser**
   - You make changes in Recipe Manager
   - Changes saved to Airtable
   - Cache cleared automatically
   - Fresh data loaded on next view
   - Trigger: Automatic on save

---

## Troubleshooting

### Common Issues

#### "Odoo sync not updating prices"

**Check:**
1. ✓ Odoo credentials in `.env` file
2. ✓ "From Odoo" checkbox enabled in Airtable
3. ✓ Ingredient names match Odoo products
4. ✓ Network access to Odoo server

**Solution:**
- Visit: `http://localhost:5000/api/odoo-sync/test`
- This shows connection status and sample data
- Review server logs for detailed error messages

#### "Ingredients not showing in dropdown"

**Check:**
1. ✓ Click "Refresh" button to clear cache
2. ✓ Ingredients exist in Airtable
3. ✓ API server is running

**Solution:**
- Click "🔄 Refresh" in Recipe Manager
- Check browser console for errors (F12)

#### "Recipe cost not updating"

**Reason:**
- Backend caches ingredient data for 5 minutes
- This improves performance

**Solution:**
- Click "🔄 Refresh" to clear cache
- Wait a moment and reload recipe

#### "Toast POS integration not working"

**Check:**
1. ✓ Toast API credentials configured
2. ✓ Date range has actual sales
3. ✓ Menu items match recipe names

**Solution:**
- Check server logs for API errors
- Verify Toast API access token
- Review menu item name mapping

---

## System Configuration

### Environment Variables

Located in: `packages/server/.env`

```env
# Airtable Configuration
AIRTABLE_API_KEY=pat5XfkV5K0N8zZtz...
AIRTABLE_BASE_ID=appporSrBMSoacJVZ

# Odoo Configuration
ODOO_URL=https://noe-usa-llc.odoo.com
ODOO_DATABASE=noe-usa-llc
ODOO_USERNAME=your-email@example.com
ODOO_PASSWORD=your-password-or-api-key

# Server Configuration
PORT=5000
NODE_ENV=development
```

### Getting Odoo API Credentials

1. Log into Odoo: https://noe-usa-llc.odoo.com
2. Click your profile (top right)
3. Go to "My Profile" → "Account Security"
4. Click "New API Key"
5. Name it "Recipe Manager Integration"
6. Copy the API key
7. Paste into `ODOO_PASSWORD` in `.env` file

---

## Best Practices

### Recipe Management
- ✅ Use consistent naming conventions
- ✅ Include detailed instructions
- ✅ Add recipe images for easy identification
- ✅ Review and update recipes quarterly
- ✅ Use sub-recipes for common components

### Cost Control
- ✅ Run Odoo sync at least weekly
- ✅ Monitor high-cost ingredients
- ✅ Review COGS reports daily
- ✅ Adjust Q Factor based on actual waste
- ✅ Track seasonal price fluctuations

### Data Quality
- ✅ Keep ingredient names consistent
- ✅ Use standard units (oz preferred)
- ✅ Document any manual price adjustments
- ✅ Archive old/unused recipes
- ✅ Backup Airtable data regularly

---

## Support & Maintenance

### Regular Maintenance Tasks

**Daily:**
- Clear cache if needed ("🔄 Refresh")
- Check for any error messages

**Weekly:**
- Sync Odoo prices
- Review COGS reports
- Update any changed recipes

**Monthly:**
- Review all ingredient costs
- Archive unused recipes
- Analyze menu profitability
- Update Q Factor if needed

**Quarterly:**
- Full recipe audit
- System backup
- Review and optimize workflows

---

## Appendix: System URLs

### Local Development
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- API Health Check: http://localhost:5000/health
- Odoo Sync Test: http://localhost:5000/api/odoo-sync/test

### Production (if deployed)
- Update these when deployed to production server

### API Endpoints
- `/api/recipes` - Recipe management
- `/api/products` - Odoo products
- `/api/odoo-sync/ingredients` - Sync Odoo prices
- `/api/toast` - Toast POS integration
- `/api/cogs` - COGS calculations

---

## Glossary

- **COGS**: Cost of Goods Sold - The direct costs of producing items sold
- **Q Factor**: Quality Factor - Percentage added for waste, spillage, and overhead
- **Food Cost %**: Percentage of menu price that goes to ingredient costs
- **Sub-Recipe**: A recipe used as an ingredient in another recipe
- **Unit Cost**: Price per standard unit (typically per ounce)
- **ERP**: Enterprise Resource Planning - Business management software (Odoo)
- **POS**: Point of Sale - Sales transaction system (Toast)

---

## Quick Reference Card

### Keyboard Shortcuts
- `Ctrl/Cmd + F` - Search recipes
- `Esc` - Close dialogs
- `Tab` - Navigate between fields

### Common Tasks
| Task | Steps |
|------|-------|
| Create Recipe | Recipe Manager → + New Recipe |
| Add Ingredient | Search or + New Ingredient |
| Sync Odoo | Recipe Manager → 🏪 Sync Odoo Prices |
| Calculate COGS | COGS with Toast → Fetch Sales Data |
| Refresh Data | Recipe Manager → 🔄 Refresh |

---

*Last Updated: January 2025*
*Version: 1.0*

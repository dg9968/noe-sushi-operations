# 🍣 NOE Sushi Operations - Recipe Management System

A comprehensive recipe management application for restaurant operations, featuring Airtable integration, cost calculation, and Odoo ERP synchronization.

## ✨ Features

### 🧾 Recipe Management
- **Smart Ingredient Selection**: Dropdown with available ingredients from Airtable database
- **Cost Calculation**: Automatic cost calculation with real-time updates
- **Junction Table System**: Proper normalization with Recipe-Ingredient relationships
- **Custom Ingredients**: Option to add ingredients not in the master catalog

### 📊 Integration Capabilities
- **Airtable Integration**: Full CRUD operations with Airtable as the backend
- **Odoo ERP Sync**: Price synchronization with production Odoo system
- **Local Storage Fallback**: Works offline with localStorage when Airtable is unavailable

### 💰 Cost Management
- **Real-time Cost Calculations**: Ingredient costs × quantities = total recipe cost
- **Cost Per Serving**: Automatic calculation based on servings
- **Detailed Breakdowns**: Ingredient-level cost analysis
- **Bulk Cost Updates**: Sync prices from Odoo to update all recipes

### 🔧 Technical Features
- **TypeScript**: Full type safety throughout the application
- **Modern React**: Hooks-based functional components
- **Professional UI**: Modern, responsive design with CSS variables
- **Error Handling**: Comprehensive error handling and user feedback

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Airtable account (optional, app works with localStorage)
- Odoo instance (optional, for price synchronization)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/noe-sushi-operations.git
   cd noe-sushi-operations
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```

   Configure your `.env` file:
   ```env
   # Airtable Configuration
   REACT_APP_ENABLE_AIRTABLE=true
   REACT_APP_AIRTABLE_BASE_ID=your_base_id
   REACT_APP_AIRTABLE_API_KEY=your_api_key

   # Odoo Configuration (Optional)
   REACT_APP_ODOO_URL=https://your-odoo-instance.com
   REACT_APP_ODOO_DB=your_database
   REACT_APP_ODOO_USERNAME=your_username
   REACT_APP_ODOO_PASSWORD=your_password
   ```

4. **Start the development server**
   ```bash
   npm start
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📋 Airtable Setup

### Required Tables

1. **Recipes Table**
   - `Name` (Single line text)
   - `Description` (Long text)
   - `Category` (Single select)
   - `Servings` (Number)
   - `Instructions` (Long text)
   - `Total Cost` (Currency)
   - `Cost Per Serving` (Currency)

2. **Ingredients Table**
   - `Ingredient Name` (Single line text)
   - `Unit Cost` (Currency)
   - `Odoo Product Name` (Single line text, optional)

3. **Recipe Ingredients Table** (Junction Table)
   - `Name` (Formula: combines recipe and ingredient names)
   - `Recipe` (Link to Recipes table)
   - `Ingredient` (Link to Ingredients table)
   - `Quantity` (Number)
   - `Unit` (Single select: cup, tbsp, tsp, lb, oz, kg, g, piece, each)
   - `Total Cost` (Currency)
   - `Unit Cost` (Lookup from Ingredient)
   - `Date Created` (Created time)

## 🛠️ Available Scripts

- **`npm start`** - Development server
- **`npm test`** - Run tests
- **`npm run build`** - Production build
- **`npm run eject`** - Eject from Create React App (irreversible)

## 🧪 Testing Features

Open the browser console and try these commands:

```javascript
// Test Airtable connectivity
await diagnoseAirtableIssues();

// Get available ingredients
await getValidCategories();

// Create a test recipe with ingredients
await testRecipeWithIngredients();

// Calculate all recipe costs
await getAllRecipeCosts();

// Get cost breakdown for a specific recipe
await getRecipeCostBreakdown('recipe_id');
```

## 📁 Project Structure

```
src/
├── components/
│   ├── RecipeManager/
│   │   ├── AirtableRecipeManager.tsx    # Main component with Airtable integration
│   │   ├── RecipeManager.tsx            # Base recipe manager
│   │   └── RecipeManager.css            # Comprehensive styling
│   └── OdooIntegration/
│       └── OdooIntegration.tsx          # Odoo price sync component
├── services/
│   ├── airtableService.ts               # Airtable API service
│   └── productionOdooService.ts         # Odoo API service
├── data/
│   └── sampleRecipes.ts                 # Sample data for testing
├── types/
│   └── index.ts                         # TypeScript type definitions
└── App.tsx                              # Main application component
```

## 🔄 Recent Updates

- ✅ Added ingredient dropdown with master catalog integration
- ✅ Implemented junction table for proper recipe-ingredient relationships
- ✅ Added column headers for better UX
- ✅ Enhanced cost calculation system
- ✅ Improved error handling and diagnostics
- ✅ Added TypeScript null safety
- ✅ Implemented smart category detection

## 🚧 Roadmap

- [ ] Add recipe search and filtering
- [ ] Implement recipe categories management
- [ ] Add nutrition information tracking
- [ ] Create recipe scaling functionality
- [ ] Add inventory management integration
- [ ] Implement user authentication
- [ ] Add recipe photo uploads
- [ ] Create mobile app version

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter issues:

1. Check the browser console for error messages
2. Verify your Airtable configuration
3. Test with the diagnostic functions provided
4. Open an issue on GitHub with detailed information

## 🏗️ Built With

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Airtable API** - Database backend
- **Odoo XML-RPC** - ERP integration
- **CSS Variables** - Modern styling approach
- **Create React App** - Build tooling

---

*Built with ❤️ for efficient restaurant operations*
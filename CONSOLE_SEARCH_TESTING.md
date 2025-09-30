# Console Search Testing Guide

## 🔍 Recipe Search Methods Available in Browser Console

This guide explains how to test the recipe search functionality using the browser console when the React application is running.

## 🚀 Setup Instructions

1. **Start the Application**
   ```bash
   npm start
   ```

2. **Open Browser Console**
   - Navigate to `http://localhost:3000`
   - Press `F12` or right-click → Inspect
   - Go to the "Console" tab

3. **Verify Services Are Available**
   ```javascript
   // Check if services are loaded
   console.log('API Service:', window.apiService);
   console.log('Airtable Service:', window.airtableService);
   ```

## 📋 Available Search Methods

### 1. Recipe List Search
Search all recipes with optional query parameter:

```javascript
// Search for specific recipes
await apiService.getRecipeList("sushi")
await apiService.getRecipeList("nigiri")
await apiService.getRecipeList("roll")

// Get all recipes (no search filter)
await apiService.getRecipeList()
```

### 2. Ingredient Search
Search for ingredients by name:

```javascript
// Search for specific ingredients
await apiService.searchIngredients("salmon")
await apiService.searchIngredients("tuna")
await apiService.searchIngredients("rice")

// Get all ingredients (empty query)
await apiService.searchIngredients("")
```

## 🧪 Test Helper Functions

Copy and paste these helper functions into the browser console for easier testing:

### Recipe Search Helper
```javascript
async function testSearch(query = '') {
    console.log(`🔍 Searching for: "${query}"`);
    try {
        const result = await apiService.getRecipeList(query);
        console.log('📊 Search Results:', result);

        // Count total recipes found
        let totalRecipes = 0;
        Object.values(result).forEach(category => {
            if (Array.isArray(category)) {
                totalRecipes += category.length;
            }
        });

        console.log(`📈 Total recipes found: ${totalRecipes}`);

        // Show categories with counts
        Object.keys(result).forEach(category => {
            if (Array.isArray(result[category])) {
                console.log(`📂 ${category}: ${result[category].length} recipes`);
            }
        });

        return result;
    } catch (error) {
        console.error('❌ Search failed:', error);
    }
}
```

### Ingredient Search Helper
```javascript
async function testIngredientSearch(query = '') {
    console.log(`🥗 Searching ingredients for: "${query}"`);
    try {
        const result = await apiService.searchIngredients(query);
        console.log('🥘 Ingredient Results:', result);
        console.log(`📈 Total ingredients found: ${result.length}`);

        // Show first few results
        if (result.length > 0) {
            console.log('🔤 Sample ingredients:', result.slice(0, 5).map(ing => ing.name));
        }

        return result;
    } catch (error) {
        console.error('❌ Ingredient search failed:', error);
    }
}
```

### Comprehensive Test Suite
```javascript
async function runAllTests() {
    console.log('🧪 Running Comprehensive Search Tests...\n');

    // Test recipe searches
    console.log('📋 Testing Recipe Searches:');
    await testSearch(''); // All recipes
    await testSearch('sushi');
    await testSearch('nigiri');
    await testSearch('roll');
    await testSearch('sashimi');

    console.log('\n🥗 Testing Ingredient Searches:');
    await testIngredientSearch(''); // All ingredients
    await testIngredientSearch('salmon');
    await testIngredientSearch('tuna');
    await testIngredientSearch('rice');
    await testIngredientSearch('nori');

    console.log('\n✅ All tests completed!');
}
```

## 🔧 Sample Test Commands

### Quick Tests
```javascript
// Quick recipe search tests
testSearch("salmon")
testSearch("roll")
testSearch("sushi")

// Quick ingredient tests
testIngredientSearch("fish")
testIngredientSearch("vegetable")
```

### Performance Tests
```javascript
// Test search performance
console.time('Recipe Search');
await testSearch('sushi');
console.timeEnd('Recipe Search');

console.time('Ingredient Search');
await testIngredientSearch('salmon');
console.timeEnd('Ingredient Search');
```

### Error Handling Tests
```javascript
// Test edge cases
await testSearch("nonexistentrecipe")
await testIngredientSearch("invalidingredient")
await testSearch("123!@#")
```

## 📊 Understanding Results

### Recipe Search Results
Results are returned as categorized objects:
```javascript
{
  "Appetizers": [
    { id: "rec123", name: "Salmon Nigiri", category: "Appetizers" }
  ],
  "Main Courses": [
    { id: "rec456", name: "Sushi Roll", category: "Main Courses" }
  ]
}
```

### Ingredient Search Results
Results are returned as arrays:
```javascript
[
  { id: "ing123", name: "Salmon", unitCost: 12.50 },
  { id: "ing456", name: "Tuna", unitCost: 15.00 }
]
```

## 🌐 API Endpoints Being Tested

- **Recipe List**: `GET /recipes/list?q=searchTerm`
- **Ingredient Search**: `GET /recipes/ingredients/search?q=searchTerm`

## 🎯 Search Features

- **Case-insensitive**: Searches work regardless of letter case
- **Partial matching**: Finds recipes containing the search term
- **URL encoding**: Special characters are properly encoded
- **Empty queries**: Returns all results when no query provided
- **Real-time**: Searches live data from the API

## 🐛 Troubleshooting

### Service Not Available
If `window.apiService` is undefined:
1. Refresh the page
2. Wait for the app to fully load
3. Check if there are any console errors

### Search Returning Empty
If searches return no results:
1. Verify the API server is running
2. Check network tab for failed requests
3. Try simpler search terms

### Performance Issues
If searches are slow:
1. Use more specific search terms
2. Check API server performance
3. Monitor network requests in DevTools

## 📝 Example Test Session

```javascript
// Start a test session
console.log('🚀 Starting Recipe Search Test Session');

// Test basic functionality
await testSearch('sushi');
await testIngredientSearch('salmon');

// Test edge cases
await testSearch('');  // All recipes
await testIngredientSearch(''); // All ingredients

// Test performance
console.time('Search Performance');
await testSearch('roll');
console.timeEnd('Search Performance');

console.log('✅ Test session complete!');
```

This guide provides comprehensive testing capabilities for the recipe search functionality through the browser console.
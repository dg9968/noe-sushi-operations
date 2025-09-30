// Console Test Script for Recipe Search Functionality
// This script demonstrates how to test recipe search queries using console methods

console.log('🔍 Testing Recipe Search Methods...\n');

// Test function to demonstrate search functionality
async function testRecipeSearch() {
    try {
        // Import the API service (this would be available in browser console when app is running)
        // For console testing, you would access it via: window.apiService or import it

        console.log('📋 Available Search Methods:');
        console.log('1. apiService.getRecipeList(searchQuery) - Search all recipes');
        console.log('2. apiService.searchIngredients(query) - Search ingredients');
        console.log('3. Client-side filtering in components\n');

        // Simulated test cases that would work in browser console
        console.log('🧪 Test Cases for Browser Console:');
        console.log('');

        console.log('// Test 1: Search for "sushi" recipes');
        console.log('await apiService.getRecipeList("sushi")');
        console.log('');

        console.log('// Test 2: Search for "salmon" ingredients');
        console.log('await apiService.searchIngredients("salmon")');
        console.log('');

        console.log('// Test 3: Get all recipes (no search query)');
        console.log('await apiService.getRecipeList()');
        console.log('');

        console.log('// Test 4: Search for specific recipe names');
        console.log('await apiService.getRecipeList("nigiri")');
        console.log('await apiService.getRecipeList("roll")');
        console.log('await apiService.getRecipeList("sashimi")');
        console.log('');

        console.log('🌐 How to test in Browser Console:');
        console.log('1. Open the React app in browser (localhost:3000)');
        console.log('2. Open Developer Tools (F12)');
        console.log('3. Go to Console tab');
        console.log('4. The apiService should be available globally');
        console.log('5. Run the test commands above');
        console.log('');

        console.log('📊 Search Query Features:');
        console.log('- Case-insensitive search');
        console.log('- Partial matching');
        console.log('- URL encoding for special characters');
        console.log('- Returns categorized results');
        console.log('- Supports empty query (returns all)');
        console.log('');

        console.log('🔗 API Endpoints Being Used:');
        console.log('- GET /recipes/list?q=searchTerm');
        console.log('- GET /recipes/ingredients/search?q=searchTerm');

    } catch (error) {
        console.error('❌ Error in test:', error);
    }
}

// Run the test
testRecipeSearch();

// Additional console helper functions for testing
console.log('🛠️  Helper Functions for Manual Testing:');
console.log('');
console.log('// Copy and paste these into browser console for live testing:');
console.log('');
console.log('// Function to test recipe search with logging');
console.log(`
async function testSearch(query = '') {
    console.log(\`🔍 Searching for: "\${query}"\`);
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

        console.log(\`📈 Total recipes found: \${totalRecipes}\`);
        return result;
    } catch (error) {
        console.error('❌ Search failed:', error);
    }
}
`);

console.log('');
console.log('// Function to test ingredient search');
console.log(`
async function testIngredientSearch(query = '') {
    console.log(\`🥗 Searching ingredients for: "\${query}"\`);
    try {
        const result = await apiService.searchIngredients(query);
        console.log('🥘 Ingredient Results:', result);
        console.log(\`📈 Total ingredients found: \${result.length}\`);
        return result;
    } catch (error) {
        console.error('❌ Ingredient search failed:', error);
    }
}
`);

console.log('✅ Test script completed! Use the browser console for live testing.');
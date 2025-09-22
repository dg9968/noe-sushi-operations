import { Recipe } from '../types';

export const sampleRecipes: Recipe[] = [
  {
    id: 'recipe_1',
    name: 'California Roll',
    description: 'Classic sushi roll with crab, avocado, and cucumber',
    category: 'Sushi',
    ingredients: [
      {
        id: 'ing_1',
        name: 'Sushi Rice',
        quantity: 1,
        unit: 'cup',
        cost: 2.50,
        totalCost: 2.50
      },
      {
        id: 'ing_2',
        name: 'Nori (Seaweed)',
        quantity: 2,
        unit: 'sheets',
        cost: 0.75,
        totalCost: 1.50
      },
      {
        id: 'ing_3',
        name: 'Imitation Crab',
        quantity: 4,
        unit: 'oz',
        cost: 1.25,
        totalCost: 5.00
      },
      {
        id: 'ing_4',
        name: 'Avocado',
        quantity: 1,
        unit: 'piece',
        cost: 1.50,
        totalCost: 1.50
      },
      {
        id: 'ing_5',
        name: 'Cucumber',
        quantity: 0.5,
        unit: 'piece',
        cost: 1.00,
        totalCost: 0.50
      },
      {
        id: 'ing_6',
        name: 'Sesame Seeds',
        quantity: 1,
        unit: 'tbsp',
        cost: 0.10,
        totalCost: 0.10
      }
    ],
    instructions: 'Step 1: Prepare sushi rice according to package instructions and let cool.\n\nStep 2: Place nori sheet on bamboo mat, shiny side down.\n\nStep 3: Spread rice evenly over nori, leaving 1-inch border at top.\n\nStep 4: Place crab, avocado, and cucumber in a line across the center.\n\nStep 5: Using the bamboo mat, roll tightly from bottom to top.\n\nStep 6: Wet knife and slice into 6-8 pieces.\n\nStep 7: Sprinkle with sesame seeds and serve with soy sauce.',
    prepTime: 30,
    cookTime: 20,
    servings: 2,
    totalCost: 11.10,
    costPerServing: 5.55,
    notes: 'For best results, use day-old sushi rice. Keep hands slightly wet when handling rice to prevent sticking.'
  },
  {
    id: 'recipe_2',
    name: 'Miso Soup',
    description: 'Traditional Japanese soup with tofu and wakame',
    category: 'Appetizers',
    ingredients: [
      {
        id: 'ing_7',
        name: 'Miso Paste',
        quantity: 3,
        unit: 'tbsp',
        cost: 0.50,
        totalCost: 1.50
      },
      {
        id: 'ing_8',
        name: 'Dashi Stock',
        quantity: 4,
        unit: 'cups',
        cost: 0.75,
        totalCost: 3.00
      },
      {
        id: 'ing_9',
        name: 'Silken Tofu',
        quantity: 4,
        unit: 'oz',
        cost: 0.60,
        totalCost: 2.40
      },
      {
        id: 'ing_10',
        name: 'Wakame Seaweed',
        quantity: 2,
        unit: 'tbsp',
        cost: 0.25,
        totalCost: 0.50
      },
      {
        id: 'ing_11',
        name: 'Green Onions',
        quantity: 2,
        unit: 'stalks',
        cost: 0.15,
        totalCost: 0.30
      }
    ],
    instructions: 'Step 1: Heat dashi stock in a medium saucepan over medium heat.\n\nStep 2: In a small bowl, whisk miso paste with a small amount of warm dashi until smooth.\n\nStep 3: Add miso mixture back to the pot and stir to combine.\n\nStep 4: Add cubed tofu and wakame seaweed.\n\nStep 5: Simmer gently for 2-3 minutes (do not boil).\n\nStep 6: Garnish with sliced green onions and serve immediately.',
    prepTime: 10,
    cookTime: 10,
    servings: 4,
    totalCost: 7.70,
    costPerServing: 1.93,
    notes: 'Never boil miso soup as it will destroy the beneficial probiotics. Serve immediately for best flavor.'
  },
  {
    id: 'recipe_3',
    name: 'Spicy Tuna Roll',
    description: 'Popular sushi roll with spicy tuna and tempura flakes',
    category: 'Sushi',
    ingredients: [
      {
        id: 'ing_12',
        name: 'Sushi Grade Tuna',
        quantity: 6,
        unit: 'oz',
        cost: 3.50,
        totalCost: 21.00,
        fromOdoo: true,
        odooProductName: 'Yellowfin Tuna Sashimi Grade'
      },
      {
        id: 'ing_13',
        name: 'Sushi Rice',
        quantity: 1.5,
        unit: 'cups',
        cost: 2.50,
        totalCost: 3.75
      },
      {
        id: 'ing_14',
        name: 'Nori Sheets',
        quantity: 3,
        unit: 'sheets',
        cost: 0.75,
        totalCost: 2.25
      },
      {
        id: 'ing_15',
        name: 'Spicy Mayo',
        quantity: 3,
        unit: 'tbsp',
        cost: 0.20,
        totalCost: 0.60
      },
      {
        id: 'ing_16',
        name: 'Tempura Flakes',
        quantity: 2,
        unit: 'tbsp',
        cost: 0.30,
        totalCost: 0.60
      },
      {
        id: 'ing_17',
        name: 'Scallions',
        quantity: 2,
        unit: 'stalks',
        cost: 0.15,
        totalCost: 0.30
      }
    ],
    instructions: 'Step 1: Dice sushi-grade tuna into small cubes.\n\nStep 2: Mix tuna with spicy mayo, tempura flakes, and chopped scallions.\n\nStep 3: Prepare sushi rice and let cool to room temperature.\n\nStep 4: Place nori on bamboo mat and spread rice evenly.\n\nStep 5: Add spicy tuna mixture in a line across center.\n\nStep 6: Roll tightly using bamboo mat.\n\nStep 7: Slice with sharp, wet knife into 6-8 pieces.\n\nStep 8: Garnish with additional tempura flakes and serve.',
    prepTime: 25,
    cookTime: 20,
    servings: 3,
    totalCost: 28.50,
    costPerServing: 9.50,
    notes: 'Only use sushi-grade tuna for safety. Keep tuna cold until ready to serve.'
  },
  {
    id: 'recipe_4',
    name: 'Teriyaki Chicken',
    description: 'Grilled chicken with homemade teriyaki sauce',
    category: 'Mains',
    ingredients: [
      {
        id: 'ing_18',
        name: 'Chicken Thigh',
        quantity: 2,
        unit: 'lbs',
        cost: 4.50,
        totalCost: 9.00,
        fromOdoo: true,
        odooProductName: 'Organic Chicken Thigh Boneless'
      },
      {
        id: 'ing_19',
        name: 'Soy Sauce',
        quantity: 0.5,
        unit: 'cup',
        cost: 0.25,
        totalCost: 0.25
      },
      {
        id: 'ing_20',
        name: 'Mirin',
        quantity: 0.25,
        unit: 'cup',
        cost: 1.00,
        totalCost: 1.00
      },
      {
        id: 'ing_21',
        name: 'Brown Sugar',
        quantity: 3,
        unit: 'tbsp',
        cost: 0.05,
        totalCost: 0.15
      },
      {
        id: 'ing_22',
        name: 'Fresh Ginger',
        quantity: 1,
        unit: 'tsp',
        cost: 0.10,
        totalCost: 0.10
      },
      {
        id: 'ing_23',
        name: 'Garlic',
        quantity: 2,
        unit: 'cloves',
        cost: 0.05,
        totalCost: 0.10
      },
      {
        id: 'ing_24',
        name: 'Sesame Oil',
        quantity: 1,
        unit: 'tsp',
        cost: 0.15,
        totalCost: 0.15
      }
    ],
    instructions: 'Step 1: Marinate chicken thighs in half of the teriyaki sauce for 30 minutes.\n\nStep 2: Make teriyaki sauce by combining soy sauce, mirin, brown sugar, ginger, and garlic in a small saucepan.\n\nStep 3: Simmer sauce over medium heat until thickened, about 10 minutes.\n\nStep 4: Heat grill or grill pan over medium-high heat.\n\nStep 5: Cook chicken for 6-7 minutes per side until internal temp reaches 165°F.\n\nStep 6: Brush with remaining teriyaki sauce during last 2 minutes of cooking.\n\nStep 7: Let rest for 5 minutes, then slice and serve.\n\nStep 8: Drizzle with sesame oil before serving.',
    prepTime: 40,
    cookTime: 25,
    servings: 4,
    totalCost: 10.75,
    costPerServing: 2.69,
    notes: 'For extra flavor, marinate chicken overnight. Sauce can be made ahead and stored in refrigerator for up to 1 week.'
  },
  {
    id: 'recipe_5',
    name: 'Edamame',
    description: 'Steamed young soybeans with sea salt',
    category: 'Appetizers',
    ingredients: [
      {
        id: 'ing_25',
        name: 'Frozen Edamame',
        quantity: 1,
        unit: 'lb',
        cost: 3.50,
        totalCost: 3.50
      },
      {
        id: 'ing_26',
        name: 'Sea Salt',
        quantity: 1,
        unit: 'tsp',
        cost: 0.02,
        totalCost: 0.02
      }
    ],
    instructions: 'Step 1: Bring a large pot of salted water to boil.\n\nStep 2: Add frozen edamame and cook for 4-5 minutes.\n\nStep 3: Drain well in colander.\n\nStep 4: Transfer to serving bowl and sprinkle with sea salt.\n\nStep 5: Serve immediately while warm.',
    prepTime: 5,
    cookTime: 5,
    servings: 4,
    totalCost: 3.52,
    costPerServing: 0.88,
    notes: 'Can also be prepared in microwave. Steam for 3-4 minutes in microwave-safe bowl with 2 tbsp water.'
  }
];

// Function to initialize sample data in localStorage
export const initializeSampleData = () => {
  const existingRecipes = localStorage.getItem('noe-sushi-recipes');
  if (!existingRecipes) {
    localStorage.setItem('noe-sushi-recipes', JSON.stringify(sampleRecipes));
    console.log('Sample recipe data initialized');
    return sampleRecipes;
  }
  return JSON.parse(existingRecipes);
};
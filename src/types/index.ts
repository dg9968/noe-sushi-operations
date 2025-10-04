export interface Document {
  id: string;
  name: string;
  type: 'policy' | 'procedure' | 'form' | 'menu' | 'other';
  url?: string;
  content?: string;
  fileData?: string; // Base64 encoded file data
  mimeType?: string; // MIME type of the file
  fileSize?: number; // File size in bytes
  uploadDate: Date;
  lastModified: Date;
}

export interface CostBreakdown {
  baseCost: number;
  qFactorPercentage: number;
  qFactorAmount: number;
  totalWithQFactor: number;
}

export interface Recipe {
  id: string;
  name: string;
  description?: string;
  category: string; // Allow any string for category flexibility
  ingredients: Ingredient[];
  instructions: string | string[]; // Support both formats
  prepTime: number; // in minutes
  cookTime?: number; // in minutes
  servings: number;
  servingSize?: number; // for backward compatibility
  cost?: number; // calculated from ingredients
  totalCost?: number;
  costPerServing?: number;
  qFactorPercentage?: number; // Q Factor percentage (1-15%)
  qFactorCost?: number; // Dollar amount added by Q Factor
  totalCostWithQFactor?: number; // Total cost including Q Factor
  costPerServingWithQFactor?: number; // Cost per serving including Q Factor
  costBreakdown?: CostBreakdown; // Detailed cost breakdown
  image?: string; // URL to recipe image from Airtable
  notes?: string;
}

export interface Ingredient {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  cost?: number; // unit cost
  costPerUnit?: number; // from Odoo - for backward compatibility
  totalCost?: number;
  fromOdoo?: boolean;
  odooProductName?: string;
  // Recipe as ingredient support
  isRecipe?: boolean; // true if this ingredient is actually a recipe
  recipeId?: string; // ID of the recipe when isRecipe is true
  recipeServings?: number; // how many servings of the recipe to use
  recipeCostPerServing?: number; // cost per serving of the sub-recipe
}

export interface OdooProduct {
  id: number;
  name: string;
  standard_price: number;
  uom_name?: string;
  categ_id?: [number, string];
  category_id?: [number, string]; // Keep both for compatibility
}

export interface OdooConnection {
  url: string;
  database: string;
  username: string;
  password: string;
}

// Cost Management Types
export interface SalesData {
  recipeId: string;
  recipeName: string;
  quantitySold: number;
  revenue: number;
  period: string;
  date: Date;
}

export interface CostAnalysis {
  recipeId: string;
  recipeName: string;
  totalCost: number;
  quantitySold: number;
  revenue: number;
  profit: number;
  profitMargin: number;
  period: string;
}

export interface ToasthubCredentials {
  apiKey: string;
  baseUrl: string;
  restaurantId?: string;
}

export interface ToasthubSalesItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  timestamp: Date;
  orderId: string;
}
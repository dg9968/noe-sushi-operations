export interface Document {
  id: string;
  name: string;
  type: 'policy' | 'procedure' | 'form' | 'menu' | 'other';
  url?: string;
  content?: string;
  uploadDate: Date;
  lastModified: Date;
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
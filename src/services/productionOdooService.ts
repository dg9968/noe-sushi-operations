import { OdooConnection, OdooProduct } from '../types';
import config from '../config/environment';

interface BackendResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

class ProductionOdooService {
  private baseURL: string;
  private apiBaseURL: string;
  private sessionToken: string | null = null;
  private connection: OdooConnection | null = null;
  private demoMode: boolean = false;

  constructor(baseURL: string = config.odoo.baseURL) {
    this.baseURL = baseURL;
    this.apiBaseURL = baseURL + '/api';
  }

  setConnection(connection: OdooConnection) {
    this.connection = connection;
  }

  enableDemoMode() {
    this.demoMode = true;
  }

  disableDemoMode() {
    this.demoMode = false;
  }

  async authenticate(): Promise<boolean> {
    if (this.demoMode) {
      // Simulate demo mode success
      return new Promise(resolve => setTimeout(() => resolve(true), 1000));
    }

    // In production mode, we authenticate with the backend API directly
    // No need for connection object since backend handles Odoo credentials
    try {
      const response = await fetch(`${this.baseURL}/api/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const data: BackendResponse<{ sessionId: string }> = await response.json();
      
      if (data.success && data.data?.sessionId) {
        this.sessionToken = data.data.sessionId;
        return true;
      }
      
      if (config.features.enableLogging) {
        console.error('Authentication failed:', data.message);
      }
      return false;
    } catch (error) {
      if (config.features.enableLogging) {
        console.error('Authentication error:', error);
      }
      return false;
    }
  }

  private getDemoProducts(): OdooProduct[] {
    return [
      { id: 1, name: 'Salmon', standard_price: 12.50, uom_name: 'lb', categ_id: [1, 'Fish'] },
      { id: 2, name: 'Tuna', standard_price: 15.00, uom_name: 'lb', categ_id: [1, 'Fish'] },
      { id: 3, name: 'Rice', standard_price: 2.50, uom_name: 'lb', categ_id: [2, 'Grains'] },
      { id: 4, name: 'Nori Seaweed', standard_price: 8.00, uom_name: 'pack', categ_id: [3, 'Vegetables'] },
      { id: 5, name: 'Avocado', standard_price: 4.00, uom_name: 'piece', categ_id: [3, 'Vegetables'] },
      { id: 6, name: 'Cucumber', standard_price: 1.50, uom_name: 'piece', categ_id: [3, 'Vegetables'] },
      { id: 7, name: 'Wasabi', standard_price: 20.00, uom_name: 'tube', categ_id: [4, 'Condiments'] },
      { id: 8, name: 'Soy Sauce', standard_price: 3.50, uom_name: 'bottle', categ_id: [4, 'Condiments'] },
      { id: 9, name: 'Ginger', standard_price: 2.00, uom_name: 'lb', categ_id: [3, 'Vegetables'] },
      { id: 10, name: 'Sesame Seeds', standard_price: 5.00, uom_name: 'lb', categ_id: [2, 'Grains'] }
    ];
  }

  async getProducts(): Promise<OdooProduct[]> {
    if (this.demoMode) {
      return new Promise(resolve => 
        setTimeout(() => resolve(this.getDemoProducts()), 1000)
      );
    }

    if (!this.sessionToken) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    try {
      const response = await fetch(`${this.apiBaseURL}/products`, {
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data: BackendResponse<OdooProduct[]> = await response.json();
      
      if (data.success && data.data) {
        return data.data;
      }
      
      if (config.features.enableLogging) {
        console.error('Failed to fetch products:', data.error);
      }
      return [];
    } catch (error) {
      if (config.features.enableLogging) {
        console.error('Products fetch error:', error);
      }
      return [];
    }
  }

  async getProductByName(name: string): Promise<OdooProduct | null> {
    if (this.demoMode) {
      return new Promise(resolve => {
        setTimeout(() => {
          const products = this.getDemoProducts();
          const found = products.find(p => 
            p.name.toLowerCase().includes(name.toLowerCase())
          );
          resolve(found || null);
        }, 500);
      });
    }

    if (!this.sessionToken) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    try {
      const response = await fetch(`${this.apiBaseURL}/products/search/${encodeURIComponent(name)}`, {
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data: BackendResponse<OdooProduct[]> = await response.json();
      
      if (data.success && data.data && data.data.length > 0) {
        return data.data[0];
      }
      
      return null;
    } catch (error) {
      if (config.features.enableLogging) {
        console.error('Product search error:', error);
      }
      return null;
    }
  }

  logout(): void {
    this.sessionToken = null;
  }
}

export const productionOdooService = new ProductionOdooService();
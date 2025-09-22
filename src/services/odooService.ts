import { OdooConnection, OdooProduct } from '../types';

class OdooService {
  private connection: OdooConnection | null = null;
  private sessionId: string | null = null;
  private demoMode: boolean = false;

  setConnection(connection: OdooConnection) {
    this.connection = connection;
  }

  enableDemoMode() {
    this.demoMode = true;
    this.sessionId = null;
    this.connection = null;
  }

  disableDemoMode() {
    this.demoMode = false;
    this.sessionId = null;
    // Don't clear connection here - it will be set by the component
  }

  private getDemoProducts(): OdooProduct[] {
    return [
      { id: 1, name: 'Salmon', standard_price: 12.50, uom_name: 'lb', category_id: [1, 'Fish'] },
      { id: 2, name: 'Tuna', standard_price: 15.00, uom_name: 'lb', category_id: [1, 'Fish'] },
      { id: 3, name: 'Rice', standard_price: 2.50, uom_name: 'lb', category_id: [2, 'Grains'] },
      { id: 4, name: 'Nori Seaweed', standard_price: 8.00, uom_name: 'pack', category_id: [3, 'Vegetables'] },
      { id: 5, name: 'Avocado', standard_price: 4.00, uom_name: 'piece', category_id: [3, 'Vegetables'] },
      { id: 6, name: 'Cucumber', standard_price: 1.50, uom_name: 'piece', category_id: [3, 'Vegetables'] },
      { id: 7, name: 'Wasabi', standard_price: 20.00, uom_name: 'tube', category_id: [4, 'Condiments'] },
      { id: 8, name: 'Soy Sauce', standard_price: 3.50, uom_name: 'bottle', category_id: [4, 'Condiments'] },
      { id: 9, name: 'Ginger', standard_price: 2.00, uom_name: 'lb', category_id: [3, 'Vegetables'] },
      { id: 10, name: 'Sesame Seeds', standard_price: 5.00, uom_name: 'lb', category_id: [2, 'Grains'] }
    ];
  }

  async authenticate(): Promise<boolean> {
    if (this.demoMode) {
      console.log('Demo mode authentication - returning true');
      return new Promise(resolve => setTimeout(() => resolve(true), 1000));
    }

    if (!this.connection) {
      throw new Error('No Odoo connection configured');
    }

    try {
      // For now, let's try direct connection and see what happens
      const url = `${this.connection.url}/jsonrpc`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            service: 'common',
            method: 'authenticate',
            args: [this.connection.database, this.connection.username, this.connection.password, {}]
          },
        }),
      });

      if (!response.ok) {
        console.error(`HTTP Error: ${response.status} ${response.statusText}`);
        console.error('Response headers:', response.headers);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Odoo authentication response:', data);
      
      if (data.result && data.result !== false) {
        this.sessionId = data.result; // For JSON-RPC, result contains the user ID
        console.log('Authentication successful, user ID:', this.sessionId);
        return true;
      }
      
      console.error('Authentication failed - no valid result:', data);
      return false;
    } catch (error) {
      console.error('Odoo authentication failed - detailed error:', error);
      if (error instanceof TypeError) {
        console.error('This might be a CORS issue or network connectivity problem');
      }
      return false;
    }
  }

  async getProducts(): Promise<OdooProduct[]> {
    if (this.demoMode) {
      console.log('Demo mode getProducts - returning demo products');
      const demoProducts = this.getDemoProducts();
      console.log('Demo products:', demoProducts);
      return new Promise(resolve => 
        setTimeout(() => resolve(demoProducts), 1000)
      );
    }

    if (!this.sessionId) {
      const authenticated = await this.authenticate();
      if (!authenticated) {
        throw new Error('Failed to authenticate with Odoo');
      }
    }

    try {
      const url = `${this.connection!.url}/jsonrpc`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            service: 'object',
            method: 'execute_kw',
            args: [
              this.connection!.database,
              this.sessionId,
              this.connection!.password,
              'product.product',
              'search_read',
              [[]],
              {
                fields: ['id', 'name', 'standard_price', 'uom_name', 'categ_id'],
                limit: 100
              }
            ]
          },
        }),
      });

      const data = await response.json();
      return data.result || [];
    } catch (error) {
      console.error('Failed to fetch products from Odoo:', error);
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

    if (!this.sessionId) {
      const authenticated = await this.authenticate();
      if (!authenticated) {
        throw new Error('Failed to authenticate with Odoo');
      }
    }

    try {
      const url = `${this.connection!.url}/jsonrpc`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            service: 'object',
            method: 'execute_kw',
            args: [
              this.connection!.database,
              this.sessionId,
              this.connection!.password,
              'product.product',
              'search_read',
              [[['name', 'ilike', name]]],
              {
                fields: ['id', 'name', 'standard_price', 'uom_name', 'categ_id'],
                limit: 1
              }
            ]
          },
        }),
      });

      const data = await response.json();
      return data.result && data.result.length > 0 ? data.result[0] : null;
    } catch (error) {
      console.error('Failed to fetch product from Odoo:', error);
      return null;
    }
  }
}

export const odooService = new OdooService();
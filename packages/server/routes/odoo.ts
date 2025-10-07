import express, { Request, Response } from 'express';
import fetch from 'node-fetch';

const router = express.Router();

const ODOO_URL = process.env.ODOO_URL || 'https://noe-usa-llc.odoo.com';
const ODOO_DB = process.env.ODOO_DATABASE || 'noe-usa-llc';
const ODOO_USERNAME = process.env.ODOO_USERNAME || '';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || '';

// In-memory session storage
let odooSession: { uid: number; sessionId: string } | null = null;

// Authenticate with Odoo
async function authenticateOdoo(): Promise<number | null> {
  if (!ODOO_USERNAME || !ODOO_PASSWORD) {
    console.error('Odoo credentials not configured in .env file');
    return null;
  }

  try {
    const response = await fetch(`${ODOO_URL}/jsonrpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          service: 'common',
          method: 'authenticate',
          args: [ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {}],
        },
        id: Date.now(),
      }),
    });

    const data: any = await response.json();

    if (data.result && typeof data.result === 'number') {
      odooSession = {
        uid: data.result,
        sessionId: `odoo-${Date.now()}`,
      };
      console.log('✅ Authenticated with Odoo, UID:', data.result);
      return data.result;
    }

    console.error('❌ Odoo authentication failed:', data.error || 'Unknown error');
    return null;
  } catch (error) {
    console.error('❌ Odoo authentication error:', error);
    return null;
  }
}

// Execute Odoo RPC call
async function executeOdooRPC(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
  if (!odooSession) {
    const uid = await authenticateOdoo();
    if (!uid) {
      throw new Error('Failed to authenticate with Odoo');
    }
  }

  try {
    const response = await fetch(`${ODOO_URL}/jsonrpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          service: 'object',
          method: 'execute_kw',
          args: [ODOO_DB, odooSession!.uid, ODOO_PASSWORD, model, method, args, kwargs],
        },
        id: Date.now(),
      }),
    });

    const data: any = await response.json();

    if (data.error) {
      console.error('Odoo RPC error:', data.error);
      // If authentication error, retry once
      if (data.error.data?.name === 'odoo.exceptions.AccessDenied') {
        odooSession = null;
        const uid = await authenticateOdoo();
        if (uid) {
          return executeOdooRPC(model, method, args, kwargs);
        }
      }
      throw new Error(data.error.data?.message || 'Odoo RPC call failed');
    }

    return data.result;
  } catch (error) {
    console.error('Odoo RPC error:', error);
    throw error;
  }
}

// GET /api/products - Get all products
router.get('/products', async (req: Request, res: Response) => {
  try {
    const products = await executeOdooRPC(
      'product.product',
      'search_read',
      [[]],
      {
        fields: ['id', 'name', 'standard_price', 'uom_name', 'categ_id'],
        limit: 100,
      }
    );

    res.json({
      success: true,
      data: products,
      message: 'Products fetched successfully',
    });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products from Odoo',
      message: error.message,
    });
  }
});

// GET /api/products/search/:name - Search products by name
router.get('/products/search/:name', async (req: Request, res: Response) => {
  const { name } = req.params;

  try {
    const products = await executeOdooRPC(
      'product.product',
      'search_read',
      [[['name', 'ilike', name]]],
      {
        fields: ['id', 'name', 'standard_price', 'uom_name', 'categ_id'],
        limit: 10,
      }
    );

    res.json({
      success: true,
      data: products,
      message: `Found ${products.length} products matching "${name}"`,
    });
  } catch (error: any) {
    console.error('Error searching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search products in Odoo',
      message: error.message,
    });
  }
});

export default router;

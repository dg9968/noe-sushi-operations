import express, { Request, Response } from 'express';
import fetch from 'node-fetch';
import Airtable from 'airtable';

const router = express.Router();

const ODOO_URL = process.env.ODOO_URL || 'https://noe-usa-llc.odoo.com';
const ODOO_DB = process.env.ODOO_DATABASE || 'noe-usa-llc';
const ODOO_USERNAME = process.env.ODOO_USERNAME || '';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || '';

// Lazy-loaded Airtable base instance
let baseInstance: ReturnType<typeof Airtable.base> | null = null;

function getBase(): ReturnType<typeof Airtable.base> {
  if (!baseInstance) {
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
      throw new Error('Airtable credentials not configured');
    }
    Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
    baseInstance = Airtable.base(process.env.AIRTABLE_BASE_ID);
  }
  return baseInstance;
}

// In-memory session storage
let odooSession: { uid: number; sessionId: string } | null = null;

async function authenticateOdoo(): Promise<number | null> {
  if (!ODOO_USERNAME || !ODOO_PASSWORD) {
    console.error('Odoo credentials not configured in .env file');
    return null;
  }

  try {
    const response = await fetch(`${ODOO_URL}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      odooSession = { uid: data.result, sessionId: `odoo-${Date.now()}` };
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

async function executeOdooRPC(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
  if (!odooSession) {
    const uid = await authenticateOdoo();
    if (!uid) throw new Error('Failed to authenticate with Odoo');
  }

  try {
    const response = await fetch(`${ODOO_URL}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      if (data.error.data?.name === 'odoo.exceptions.AccessDenied') {
        odooSession = null;
        const uid = await authenticateOdoo();
        if (uid) return executeOdooRPC(model, method, args, kwargs);
      }
      throw new Error(data.error.data?.message || 'Odoo RPC call failed');
    }

    return data.result;
  } catch (error) {
    console.error('Odoo RPC error:', error);
    throw error;
  }
}

// Unit conversion factors to ounces
const UNIT_TO_OZ: { [key: string]: number } = {
  'oz': 1,
  'lb': 16,
  'g': 0.035274,
  'kg': 35.274,
  'ml': 0.033814,
  'l': 33.814,
  'gal': 128,
  'qt': 32,
  'pt': 16,
  'cup': 8,
  'tbsp': 0.5,
  'tsp': 0.166667,
  'unit': 1, // Default for unit/piece
  'each': 1,
  'piece': 1,
  'pack': 1,
  'bottle': 1,
  'tube': 1,
};

// POST /api/odoo-sync/ingredients - Sync ingredient prices from Odoo to Airtable
router.post('/ingredients', async (req: Request, res: Response) => {
  try {
    console.log('🔄 Starting Odoo ingredient sync...');

    if (!ODOO_USERNAME || !ODOO_PASSWORD) {
      throw new Error('Odoo credentials not configured. Please set ODOO_USERNAME and ODOO_PASSWORD in .env file');
    }

    // Get all products from Odoo
    const odooProducts = await executeOdooRPC(
      'product.product',
      'search_read',
      [[]],
      {
        fields: ['id', 'name', 'standard_price', 'uom_name', 'categ_id'],
        limit: 1000,
      }
    );

    console.log(`✅ Fetched ${odooProducts.length} products from Odoo`);

    // Get all ingredients from Airtable - only those marked "From Odoo"
    const ingredientRecords = await getBase()('Ingredients')
      .select({
        filterByFormula: '{From Odoo} = TRUE()'
      })
      .all();
    console.log(`✅ Fetched ${ingredientRecords.length} Odoo-linked ingredients from Airtable`);

    if (ingredientRecords.length === 0) {
      return res.json({
        success: true,
        message: 'No ingredients with "From Odoo" checkbox enabled',
        data: {
          totalOdooProducts: odooProducts.length,
          totalAirtableIngredients: 0,
          matched: 0,
          updated: 0,
          skipped: 0,
        },
      });
    }

    // Create a map of Odoo products by name (case-insensitive)
    const odooProductMap = new Map<string, any>();
    odooProducts.forEach((product: any) => {
      const normalizedName = product.name.toLowerCase().trim();
      odooProductMap.set(normalizedName, product);
    });

    // Update ingredients that match Odoo products
    const updates: Array<{ id: string; fields: any }> = [];
    let matchCount = 0;
    let updateCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const record of ingredientRecords) {
      const ingredientName = record.fields['Ingredient Name'] as string;
      const odooProductName = record.fields['Odoo Product Name'] as string;

      if (!ingredientName) {
        skippedCount++;
        continue;
      }

      // Use Odoo Product Name if available, otherwise use ingredient name
      const searchName = odooProductName || ingredientName;
      const normalizedName = searchName.toLowerCase().trim();
      const odooProduct = odooProductMap.get(normalizedName);

      if (odooProduct) {
        matchCount++;

        // Get the Odoo unit and convert to ounces
        const odooUnit = (odooProduct.uom_name || 'unit').toLowerCase().trim();
        const odooPrice = odooProduct.standard_price;

        // Calculate price per ounce
        let pricePerOz = odooPrice;
        const conversionFactor = UNIT_TO_OZ[odooUnit];

        if (conversionFactor) {
          pricePerOz = odooPrice / conversionFactor;
        } else {
          // Unknown unit - use price as-is and log warning
          errors.push(`Unknown unit '${odooUnit}' for ${ingredientName}`);
        }

        const currentPrice = record.fields['Unit Cost'] as number || 0;

        // Only update if price has changed (tolerance of 0.001)
        if (Math.abs(currentPrice - pricePerOz) > 0.001) {
          updates.push({
            id: record.id,
            fields: {
              'Unit Cost': pricePerOz,
              'Odoo Product Name': odooProduct.name,
            },
          });
          updateCount++;
        }
      } else {
        skippedCount++;
        errors.push(`No Odoo product found for: ${searchName}`);
      }
    }

    // Perform batch updates (Airtable allows max 10 records per request)
    if (updates.length > 0) {
      const batchSize = 10;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        await getBase()('Ingredients').update(batch);
      }
    }

    console.log(`🎉 Sync complete: ${matchCount} matched, ${updateCount} updated, ${skippedCount} skipped`);

    res.json({
      success: true,
      message: `Synced ${updateCount} ingredient prices from Odoo`,
      data: {
        totalOdooProducts: odooProducts.length,
        totalAirtableIngredients: ingredientRecords.length,
        matched: matchCount,
        updated: updateCount,
        skipped: skippedCount,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error: any) {
    console.error('❌ Odoo sync failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync ingredient prices from Odoo',
      message: error.message,
    });
  }
});

// GET /api/odoo-sync/test - Test Airtable and Odoo connection
router.get('/test', async (req: Request, res: Response) => {
  try {
    const result: any = {
      airtable: { connected: false, ingredients: [] },
      odoo: { connected: false, credentials: {} },
    };

    // Test Airtable connection
    try {
      const ingredientRecords = await getBase()('Ingredients')
        .select({
          filterByFormula: '{From Odoo} = TRUE()',
          maxRecords: 3
        })
        .all();

      result.airtable.connected = true;
      result.airtable.count = ingredientRecords.length;
      result.airtable.ingredients = ingredientRecords.map(r => ({
        id: r.id,
        name: r.fields['Ingredient Name'],
        unitCost: r.fields['Unit Cost'],
        fromOdoo: r.fields['From Odoo'],
        odooProductName: r.fields['Odoo Product Name'],
      }));
    } catch (err) {
      result.airtable.error = err instanceof Error ? err.message : String(err);
    }

    // Test Odoo credentials
    result.odoo.credentials = {
      url: ODOO_URL,
      database: ODOO_DB,
      username: ODOO_USERNAME ? '✓ Set' : '✗ Not set',
      password: ODOO_PASSWORD ? '✓ Set' : '✗ Not set',
    };

    // Test Odoo connection
    if (ODOO_USERNAME && ODOO_PASSWORD) {
      try {
        const uid = await authenticateOdoo();
        if (uid) {
          result.odoo.connected = true;
          result.odoo.uid = uid;

          // Fetch a few products as test
          const products = await executeOdooRPC(
            'product.product',
            'search_read',
            [[]],
            {
              fields: ['id', 'name', 'standard_price', 'uom_name'],
              limit: 3,
            }
          );
          result.odoo.sampleProducts = products;
        }
      } catch (err) {
        result.odoo.error = err instanceof Error ? err.message : String(err);
      }
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

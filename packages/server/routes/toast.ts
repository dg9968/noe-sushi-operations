import express, { Router, Request, Response } from 'express';
import fetch from 'node-fetch';

const router: Router = express.Router();

// Toast POS API configuration
const TOAST_API_BASE = 'https://ws-api.toasttab.com';
const TOAST_AUTH_ENDPOINT = '/authentication/v1/authentication/login';
const TOAST_ORDERS_ENDPOINT = '/orders/v2/orders';

// Toast POS credentials from environment
const TOAST_CLIENT_ID = process.env.TOAST_CLIENT_ID || process.env.REACT_APP_TOAST_CLIENT_ID;
const TOAST_CLIENT_SECRET = process.env.TOAST_CLIENT_SECRET || process.env.REACT_APP_TOAST_CLIENT_SECRET;
const TOAST_RESTAURANT_GUID = process.env.TOAST_RESTAURANT_GUID || process.env.REACT_APP_TOAST_RESTAURANT_GUID;

// Type definitions
interface ToastAuthRequest {
  clientId: string;
  clientSecret: string;
  userAccessType: string;
}

interface ToastToken {
  accessToken: string;
  expiresIn: number;
}

interface ToastAuthResponse {
  token: ToastToken;
}

interface OrderSelection {
  displayName: string;
  quantity: number;
  price: number;
}

interface ToastOrder {
  selections?: OrderSelection[];
  paidDate?: string;
}

interface SalesData {
  recipeId: string;
  recipeName: string;
  quantitySold: number;
  revenue: number;
  period: string;
  date: Date;
}

interface SalesMeta {
  ordersCount: number;
  itemsCount: number;
  period: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

// In-memory token storage (in production, use Redis or database)
let cachedToken: string | null = null;
let tokenExpiry: Date | null = null;

console.log('🍞 Toast POS API Configuration:', {
  clientId: TOAST_CLIENT_ID ? `${TOAST_CLIENT_ID.substring(0, 8)}...` : 'NOT CONFIGURED',
  restaurantGuid: TOAST_RESTAURANT_GUID || 'NOT CONFIGURED',
  hasClientSecret: !!TOAST_CLIENT_SECRET
});

// Helper function to get valid access token
async function getValidAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && tokenExpiry && new Date() < new Date(tokenExpiry.getTime() - 5 * 60 * 1000)) {
    console.log('✅ Using cached Toast POS token');
    return cachedToken;
  }

  console.log('🔄 Refreshing Toast POS access token...');

  if (!TOAST_CLIENT_ID || !TOAST_CLIENT_SECRET) {
    throw new Error('Toast POS credentials not configured');
  }

  try {
    const authRequest: ToastAuthRequest = {
      clientId: TOAST_CLIENT_ID,
      clientSecret: TOAST_CLIENT_SECRET,
      userAccessType: 'TOAST_MACHINE_CLIENT'
    };

    const response = await fetch(`${TOAST_API_BASE}${TOAST_AUTH_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(authRequest)
    });

    if (!response.ok) {
      throw new Error(`Toast authentication failed: ${response.status} ${response.statusText}`);
    }

    const authData = await response.json() as ToastAuthResponse;

    if (!authData.token || !authData.token.accessToken) {
      throw new Error('Invalid authentication response from Toast POS');
    }

    cachedToken = authData.token.accessToken;
    tokenExpiry = new Date(Date.now() + (authData.token.expiresIn * 1000));

    console.log('✅ Toast POS access token refreshed successfully');
    console.log('   Token expires in:', authData.token.expiresIn, 'seconds');

    return cachedToken;
  } catch (error) {
    const err = error as Error;
    console.error('❌ Error getting Toast POS access token:', err.message);
    throw error;
  }
}

// Test Toast POS connection
router.get('/test', async (req: Request, res: Response) => {
  try {
    const accessToken = await getValidAccessToken();

    res.json({
      success: true,
      connected: true,
      message: 'Connected to Toast POS API',
      data: {
        restaurantGuid: TOAST_RESTAURANT_GUID,
        tokenAvailable: !!accessToken,
        tokenExpiry: tokenExpiry
      }
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      connected: false,
      message: 'Failed to connect to Toast POS',
      error: err.message
    });
  }
});

// Get sales data from Toast POS
router.get('/sales', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, pageSize = '100' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate parameters are required'
      });
    }

    // Validate date range (Toast API has 1-hour limit for single requests)
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    if (diffHours > 1) {
      return res.status(400).json({
        success: false,
        error: 'Date range cannot exceed 1 hour due to Toast API limitations. Use multiple requests for longer periods.',
        maxHours: 1,
        requestedHours: diffHours
      });
    }

    const accessToken = await getValidAccessToken();

    const ordersUrl = `${TOAST_API_BASE}${TOAST_ORDERS_ENDPOINT}?startDate=${startDate}&endDate=${endDate}&pageSize=${pageSize}`;

    console.log('📊 Fetching Toast POS sales data:', {
      startDate,
      endDate,
      pageSize,
      diffHours: diffHours.toFixed(2)
    });

    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Toast-Restaurant-External-ID': TOAST_RESTAURANT_GUID || ''
      }
    });

    if (!ordersResponse.ok) {
      throw new Error(`Toast orders API failed: ${ordersResponse.status} ${ordersResponse.statusText}`);
    }

    const ordersData = await ordersResponse.json() as ToastOrder[];

    // Process and aggregate sales data
    const salesMap = new Map<string, SalesData>();

    if (Array.isArray(ordersData)) {
      ordersData.forEach(order => {
        if (order.selections && order.paidDate) { // Only count paid orders
          order.selections.forEach(selection => {
            if (selection.displayName && selection.quantity && selection.price) {
              const key = selection.displayName.toLowerCase().trim();
              const revenue = selection.quantity * selection.price;

              if (salesMap.has(key)) {
                const existing = salesMap.get(key)!;
                existing.quantitySold += selection.quantity;
                existing.revenue += revenue;
              } else {
                salesMap.set(key, {
                  recipeId: mapMenuItemToRecipeId(selection.displayName),
                  recipeName: selection.displayName,
                  quantitySold: selection.quantity,
                  revenue: revenue,
                  period: getPeriodString(start, end),
                  date: new Date()
                });
              }
            }
          });
        }
      });
    }

    const salesData = Array.from(salesMap.values());

    console.log('✅ Toast POS sales data processed:', {
      ordersFound: Array.isArray(ordersData) ? ordersData.length : 0,
      uniqueItems: salesData.length,
      totalRevenue: salesData.reduce((sum, item) => sum + item.revenue, 0)
    });

    const meta: SalesMeta = {
      ordersCount: Array.isArray(ordersData) ? ordersData.length : 0,
      itemsCount: salesData.length,
      period: getPeriodString(start, end),
      dateRange: {
        startDate: startDate as string,
        endDate: endDate as string
      }
    };

    res.json({
      success: true,
      data: salesData,
      meta: meta
    });

  } catch (error) {
    const err = error as Error;
    console.error('❌ Error fetching Toast POS sales data:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sales data',
      message: err.message
    });
  }
});

// Get restaurant information
router.get('/restaurant', async (req: Request, res: Response) => {
  try {
    const accessToken = await getValidAccessToken();

    const restaurantResponse = await fetch(`${TOAST_API_BASE}/config/v1/restaurants`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Toast-Restaurant-External-ID': TOAST_RESTAURANT_GUID || ''
      }
    });

    if (!restaurantResponse.ok) {
      throw new Error(`Toast restaurant API failed: ${restaurantResponse.status} ${restaurantResponse.statusText}`);
    }

    const restaurantData = await restaurantResponse.json();

    res.json({
      success: true,
      data: restaurantData
    });

  } catch (error) {
    const err = error as Error;
    console.error('❌ Error fetching restaurant info:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch restaurant information',
      message: err.message
    });
  }
});

// Helper function to map menu item names to recipe IDs
function mapMenuItemToRecipeId(menuItemName: string): string {
  // Basic mapping - in production, this should be configurable
  const itemNameLower = menuItemName.toLowerCase();

  const mappings: { [key: string]: string } = {
    'salmon teriyaki': 'rec123',
    'chicken ramen': 'rec456',
    'beef teriyaki': 'rec789',
    'spicy tuna roll': 'rec101',
    'california roll': 'rec102',
    'miso soup': 'rec103'
  };

  return mappings[itemNameLower] || `rec_${itemNameLower.replace(/\s+/g, '_')}`;
}

// Helper function to determine period string
function getPeriodString(startDate: Date, endDate: Date): string {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 1) return 'daily';
  if (diffDays <= 7) return 'weekly';
  if (diffDays <= 31) return 'monthly';
  return 'custom';
}

export default router;

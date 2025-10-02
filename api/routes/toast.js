const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

// Toast POS API configuration
const TOAST_API_BASE = 'https://ws-api.toasttab.com';
const TOAST_AUTH_ENDPOINT = '/authentication/v1/authentication/login';
const TOAST_ORDERS_ENDPOINT = '/orders/v2/orders';

// Toast POS credentials from environment
const TOAST_CLIENT_ID = process.env.TOAST_CLIENT_ID || process.env.REACT_APP_TOAST_CLIENT_ID;
const TOAST_CLIENT_SECRET = process.env.TOAST_CLIENT_SECRET || process.env.REACT_APP_TOAST_CLIENT_SECRET;
const TOAST_RESTAURANT_GUID = process.env.TOAST_RESTAURANT_GUID || process.env.REACT_APP_TOAST_RESTAURANT_GUID;

// In-memory token storage (in production, use Redis or database)
let cachedToken = null;
let tokenExpiry = null;

console.log('🍞 Toast POS API Configuration:', {
  clientId: TOAST_CLIENT_ID ? `${TOAST_CLIENT_ID.substring(0, 8)}...` : 'NOT CONFIGURED',
  restaurantGuid: TOAST_RESTAURANT_GUID || 'NOT CONFIGURED',
  hasClientSecret: !!TOAST_CLIENT_SECRET
});

// Helper function to get valid access token
async function getValidAccessToken() {
  // Check if we have a valid cached token
  if (cachedToken && tokenExpiry && new Date() < new Date(tokenExpiry - 5 * 60 * 1000)) {
    console.log('✅ Using cached Toast POS token');
    return cachedToken;
  }

  console.log('🔄 Refreshing Toast POS access token...');

  if (!TOAST_CLIENT_ID || !TOAST_CLIENT_SECRET) {
    throw new Error('Toast POS credentials not configured');
  }

  try {
    const response = await fetch(`${TOAST_API_BASE}${TOAST_AUTH_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientId: TOAST_CLIENT_ID,
        clientSecret: TOAST_CLIENT_SECRET,
        userAccessType: 'TOAST_MACHINE_CLIENT'
      })
    });

    if (!response.ok) {
      throw new Error(`Toast authentication failed: ${response.status} ${response.statusText}`);
    }

    const authData = await response.json();

    if (!authData.token || !authData.token.accessToken) {
      throw new Error('Invalid authentication response from Toast POS');
    }

    cachedToken = authData.token.accessToken;
    tokenExpiry = new Date(Date.now() + (authData.token.expiresIn * 1000));

    console.log('✅ Toast POS access token refreshed successfully');
    console.log('   Token expires in:', authData.token.expiresIn, 'seconds');

    return cachedToken;
  } catch (error) {
    console.error('❌ Error getting Toast POS access token:', error.message);
    throw error;
  }
}

// Test Toast POS connection
router.get('/test', async (req, res) => {
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
    res.status(500).json({
      success: false,
      connected: false,
      message: 'Failed to connect to Toast POS',
      error: error.message
    });
  }
});

// Get sales data from Toast POS
router.get('/sales', async (req, res) => {
  try {
    const { startDate, endDate, pageSize = 100 } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate parameters are required'
      });
    }

    // Validate date range (Toast API has 1-hour limit for single requests)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffHours = (end - start) / (1000 * 60 * 60);

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
        'Toast-Restaurant-External-ID': TOAST_RESTAURANT_GUID
      }
    });

    if (!ordersResponse.ok) {
      throw new Error(`Toast orders API failed: ${ordersResponse.status} ${ordersResponse.statusText}`);
    }

    const ordersData = await ordersResponse.json();

    // Process and aggregate sales data
    const salesMap = new Map();

    if (Array.isArray(ordersData)) {
      ordersData.forEach(order => {
        if (order.selections && order.paidDate) { // Only count paid orders
          order.selections.forEach(selection => {
            if (selection.displayName && selection.quantity && selection.price) {
              const key = selection.displayName.toLowerCase().trim();
              const revenue = selection.quantity * selection.price;

              if (salesMap.has(key)) {
                const existing = salesMap.get(key);
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

    res.json({
      success: true,
      data: salesData,
      meta: {
        ordersCount: Array.isArray(ordersData) ? ordersData.length : 0,
        itemsCount: salesData.length,
        period: getPeriodString(start, end),
        dateRange: { startDate, endDate }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching Toast POS sales data:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sales data',
      message: error.message
    });
  }
});

// Get restaurant information
router.get('/restaurant', async (req, res) => {
  try {
    const accessToken = await getValidAccessToken();

    const restaurantResponse = await fetch(`${TOAST_API_BASE}/config/v1/restaurants`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Toast-Restaurant-External-ID': TOAST_RESTAURANT_GUID
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
    console.error('❌ Error fetching restaurant info:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch restaurant information',
      message: error.message
    });
  }
});

// Helper function to map menu item names to recipe IDs
function mapMenuItemToRecipeId(menuItemName) {
  // Basic mapping - in production, this should be configurable
  const itemNameLower = menuItemName.toLowerCase();

  const mappings = {
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
function getPeriodString(startDate, endDate) {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 1) return 'daily';
  if (diffDays <= 7) return 'weekly';
  if (diffDays <= 31) return 'monthly';
  return 'custom';
}

module.exports = router;
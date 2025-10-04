require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const Airtable = require('airtable');

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Configuration
const ODOO_CONFIG = {
  url: process.env.ODOO_URL || 'https://noe-usa-llc.odoo.com',
  database: process.env.ODOO_DB || 'noe-usa-llc',
  username: process.env.ODOO_USER || 'your_username',
  password: process.env.ODOO_PASSWORD || 'your_password'
};

// Airtable Configuration
const AIRTABLE_CONFIG = {
  apiKey: process.env.AIRTABLE_API_KEY,
  baseId: process.env.AIRTABLE_BASE_ID
};

// Initialize Airtable
let airtableBase = null;
if (AIRTABLE_CONFIG.apiKey && AIRTABLE_CONFIG.baseId) {
  Airtable.configure({ apiKey: AIRTABLE_CONFIG.apiKey });
  airtableBase = Airtable.base(AIRTABLE_CONFIG.baseId);
}

// Logging utility
const logger = {
  info: (message, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] INFO: ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  error: (message, error = null) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ERROR: ${message}`, error || '');
  },
  warn: (message, data = null) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] WARN: ${message}`, data || '');
  }
};

// Middleware
app.use(cors({
  origin: NODE_ENV === 'production' ?
    ['https://your-production-domain.com'] :
    ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.method === 'POST' ? req.body : undefined
  });
  next();
});

// In-memory session storage (use Redis in production)
const sessions = new Map();

// Session cleanup interval (cleanup expired sessions every hour)
setInterval(() => {
  const now = Date.now();
  const expiredSessions = [];

  sessions.forEach((session, sessionId) => {
    if (now - session.timestamp > 24 * 60 * 60 * 1000) { // 24 hours
      expiredSessions.push(sessionId);
    }
  });

  expiredSessions.forEach(sessionId => {
    sessions.delete(sessionId);
  });

  if (expiredSessions.length > 0) {
    logger.info(`Cleaned up ${expiredSessions.length} expired sessions`);
  }
}, 60 * 60 * 1000); // Every hour

class OdooAPI {
  constructor(config) {
    this.config = config;
    this.baseURL = `${config.url}/jsonrpc`;
  }

  async makeRequest(payload) {
    try {
      const response = await axios.post(this.baseURL, payload, {
        timeout: 30000, // 30 seconds timeout
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Noe-Sushi-Operations-API/1.0'
        }
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        logger.error('Odoo API Response Error', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      } else if (error.request) {
        logger.error('Odoo API Request Error', error.message);
      } else {
        logger.error('Odoo API General Error', error.message);
      }
      throw error;
    }
  }

  async authenticate() {
    try {
      logger.info('Attempting Odoo authentication', {
        url: this.baseURL,
        database: this.config.database,
        username: this.config.username
      });

      const response = await this.makeRequest({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          service: 'common',
          method: 'authenticate',
          args: [this.config.database, this.config.username, this.config.password, {}]
        }
      });

      if (response.result && response.result !== false) {
        logger.info('Odoo authentication successful', { uid: response.result });
        return response.result; // Returns user ID
      }

      logger.warn('Odoo authentication failed - invalid credentials');
      return null;
    } catch (error) {
      logger.error('Odoo authentication failed', error.message);
      return null;
    }
  }

  async searchRead(uid, model, domain = [], fields = [], limit = 100, offset = 0) {
    try {
      const response = await this.makeRequest({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          service: 'object',
          method: 'execute_kw',
          args: [
            this.config.database,
            uid,
            this.config.password,
            model,
            'search_read',
            [domain],
            { fields, limit, offset }
          ]
        }
      });

      return response.result || [];
    } catch (error) {
      logger.error(`Odoo search_read failed for model ${model}`, error.message);
      return [];
    }
  }

  async read(uid, model, ids, fields = []) {
    try {
      const response = await this.makeRequest({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          service: 'object',
          method: 'execute_kw',
          args: [
            this.config.database,
            uid,
            this.config.password,
            model,
            'read',
            [ids],
            { fields }
          ]
        }
      });

      return response.result || [];
    } catch (error) {
      logger.error(`Odoo read failed for model ${model}`, error.message);
      return [];
    }
  }

  async search(uid, model, domain = [], limit = 100, offset = 0) {
    try {
      const response = await this.makeRequest({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          service: 'object',
          method: 'execute_kw',
          args: [
            this.config.database,
            uid,
            this.config.password,
            model,
            'search',
            [domain],
            { limit, offset }
          ]
        }
      });

      return response.result || [];
    } catch (error) {
      logger.error(`Odoo search failed for model ${model}`, error.message);
      return [];
    }
  }
}

const odoo = new OdooAPI(ODOO_CONFIG);

// Authentication middleware
const requireAuth = (req, res, next) => {
  const sessionId = req.headers.authorization?.replace('Bearer ', '');
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or missing session token'
    });
  }

  // Check session expiry (24 hours)
  if (Date.now() - session.timestamp > 24 * 60 * 60 * 1000) {
    sessions.delete(sessionId);
    return res.status(401).json({
      success: false,
      error: 'Session expired'
    });
  }

  req.session = session;
  next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error', err);
  res.status(500).json({
    success: false,
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
};

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// API Info
app.get('/api', (req, res) => {
  res.json({
    name: 'Noe Sushi Operations API',
    version: '1.0.0',
    description: 'Backend API for Noe Sushi Bar Operations Management',
    endpoints: {
      auth: 'POST /api/auth',
      products: 'GET /api/products',
      product_search: 'GET /api/products/search/:name',
      categories: 'GET /api/categories',
      inventory: 'GET /api/inventory',
      health: 'GET /health'
    }
  });
});

// Authentication
app.post('/api/auth', async (req, res) => {
  try {
    logger.info('Authentication request received');
    const uid = await odoo.authenticate();

    if (uid) {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessions.set(sessionId, {
        uid,
        timestamp: Date.now(),
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      logger.info('Authentication successful', { uid, sessionId });
      res.json({
        success: true,
        data: {
          sessionId,
          expiresIn: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
        },
        message: 'Authentication successful'
      });
    } else {
      logger.warn('Authentication failed - invalid credentials');
      res.status(401).json({
        success: false,
        error: 'Authentication failed - check Odoo credentials'
      });
    }
  } catch (error) {
    logger.error('Authentication error', error);
    res.status(500).json({
      success: false,
      error: 'Server error during authentication'
    });
  }
});

// Session info
app.get('/api/session', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: {
      uid: req.session.uid,
      sessionAge: Date.now() - req.session.timestamp,
      expiresIn: 24 * 60 * 60 * 1000 - (Date.now() - req.session.timestamp)
    }
  });
});

// Logout
app.post('/api/logout', requireAuth, (req, res) => {
  const sessionId = req.headers.authorization?.replace('Bearer ', '');
  sessions.delete(sessionId);
  logger.info('Session logged out', { sessionId });
  res.json({ success: true, message: 'Logged out successfully' });
});

// Products
app.get('/api/products', requireAuth, async (req, res) => {
  try {
    const { limit = 100, offset = 0, category_id } = req.query;
    let domain = [];

    if (category_id) {
      domain.push(['categ_id', '=', parseInt(category_id)]);
    }

    const products = await odoo.searchRead(
      req.session.uid,
      'product.product',
      domain,
      ['id', 'name', 'standard_price', 'uom_name', 'categ_id', 'default_code', 'barcode'],
      parseInt(limit),
      parseInt(offset)
    );

    logger.info(`Fetched ${products.length} products`);
    res.json({ success: true, data: products });
  } catch (error) {
    logger.error('Failed to fetch products', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products'
    });
  }
});

// Product search
app.get('/api/products/search/:name', requireAuth, async (req, res) => {
  try {
    const { name } = req.params;
    const { limit = 10 } = req.query;

    const products = await odoo.searchRead(
      req.session.uid,
      'product.product',
      [['name', 'ilike', name]],
      ['id', 'name', 'standard_price', 'uom_name', 'categ_id', 'default_code', 'barcode'],
      parseInt(limit)
    );

    logger.info(`Search for "${name}" returned ${products.length} products`);
    res.json({ success: true, data: products });
  } catch (error) {
    logger.error(`Failed to search products for "${req.params.name}"`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to search products'
    });
  }
});

// Product by ID
app.get('/api/products/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const products = await odoo.read(
      req.session.uid,
      'product.product',
      [parseInt(id)],
      ['id', 'name', 'standard_price', 'uom_name', 'categ_id', 'default_code', 'barcode', 'description']
    );

    if (products.length > 0) {
      res.json({ success: true, data: products[0] });
    } else {
      res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
  } catch (error) {
    logger.error(`Failed to fetch product ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product'
    });
  }
});

// Product categories
app.get('/api/categories', requireAuth, async (req, res) => {
  try {
    const categories = await odoo.searchRead(
      req.session.uid,
      'product.category',
      [],
      ['id', 'name', 'parent_id', 'child_id'],
      100
    );

    logger.info(`Fetched ${categories.length} categories`);
    res.json({ success: true, data: categories });
  } catch (error) {
    logger.error('Failed to fetch categories', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

// Inventory/stock levels
app.get('/api/inventory', requireAuth, async (req, res) => {
  try {
    const { product_id, location_id } = req.query;
    let domain = [];

    if (product_id) {
      domain.push(['product_id', '=', parseInt(product_id)]);
    }
    if (location_id) {
      domain.push(['location_id', '=', parseInt(location_id)]);
    }

    const inventory = await odoo.searchRead(
      req.session.uid,
      'stock.quant',
      domain,
      ['id', 'product_id', 'location_id', 'quantity', 'reserved_quantity'],
      100
    );

    logger.info(`Fetched ${inventory.length} inventory records`);
    res.json({ success: true, data: inventory });
  } catch (error) {
    logger.error('Failed to fetch inventory', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory'
    });
  }
});

// Stock locations
app.get('/api/locations', requireAuth, async (req, res) => {
  try {
    const locations = await odoo.searchRead(
      req.session.uid,
      'stock.location',
      [['usage', '=', 'internal']],
      ['id', 'name', 'complete_name', 'parent_id'],
      100
    );

    logger.info(`Fetched ${locations.length} stock locations`);
    res.json({ success: true, data: locations });
  } catch (error) {
    logger.error('Failed to fetch locations', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch locations'
    });
  }
});

// Partners/customers
app.get('/api/partners', requireAuth, async (req, res) => {
  try {
    const { limit = 50, customer = true, supplier = false } = req.query;
    let domain = [];

    if (customer === 'true') domain.push(['is_company', '=', false]);
    if (supplier === 'true') domain.push(['supplier_rank', '>', 0]);

    const partners = await odoo.searchRead(
      req.session.uid,
      'res.partner',
      domain,
      ['id', 'name', 'email', 'phone', 'is_company', 'customer_rank', 'supplier_rank'],
      parseInt(limit)
    );

    logger.info(`Fetched ${partners.length} partners`);
    res.json({ success: true, data: partners });
  } catch (error) {
    logger.error('Failed to fetch partners', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch partners'
    });
  }
});

// Company info
app.get('/api/company', requireAuth, async (req, res) => {
  try {
    const companies = await odoo.searchRead(
      req.session.uid,
      'res.company',
      [],
      ['id', 'name', 'email', 'phone', 'website', 'currency_id'],
      1
    );

    if (companies.length > 0) {
      res.json({ success: true, data: companies[0] });
    } else {
      res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }
  } catch (error) {
    logger.error('Failed to fetch company info', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch company info'
    });
  }
});

// ========================
// RECIPE ENDPOINTS
// ========================

// Get lightweight recipe list by category (FAST)
app.get('/api/recipes/list', async (req, res) => {
  try {
    if (!airtableBase) {
      return res.status(503).json({
        success: false,
        error: 'Airtable not configured'
      });
    }

    const records = await airtableBase('Recipes').select({
      fields: ['Name', 'Category', 'Description', 'Servings'], // Only fetch essential fields
      sort: [{ field: 'Name', direction: 'asc' }]
    }).all();

    // Group recipes by category
    const recipesByCategory = {};

    records.forEach(record => {
      const category = record.get('Category') || 'Uncategorized';

      if (!recipesByCategory[category]) {
        recipesByCategory[category] = [];
      }

      recipesByCategory[category].push({
        id: record.id,
        name: record.get('Name'),
        description: record.get('Description') || '',
        servings: record.get('Servings') || 1
      });
    });

    logger.info(`Fetched recipe list: ${records.length} recipes in ${Object.keys(recipesByCategory).length} categories`);
    res.json({
      success: true,
      data: recipesByCategory,
      totalRecipes: records.length,
      categories: Object.keys(recipesByCategory).sort()
    });

  } catch (error) {
    logger.error('Failed to fetch recipe list', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recipe list'
    });
  }
});

// Get all recipes (limited for performance)
app.get('/api/recipes', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    if (!airtableBase) {
      return res.status(503).json({
        success: false,
        error: 'Airtable not configured'
      });
    }

    const records = await airtableBase('Recipes').select({
      maxRecords: limit,
      view: 'Grid view'
    }).all();

    const recipes = records.map(record => ({
      id: record.id,
      name: record.get('Name'),
      description: record.get('Description'),
      category: record.get('Category'),
      servings: record.get('Servings'),
      prepTime: record.get('Prep Time'),
      cookTime: record.get('Cook Time'),
      instructions: record.get('Instructions'),
      totalCost: record.get('Total Cost'),
      costPerServing: record.get('Cost Per Serving'),
      qFactorPercentage: record.get('Q Factor Percentage'),
      totalCostWithQFactor: record.get('Total Cost with Q Factor'),
      costPerServingWithQFactor: record.get('Cost Per Serving with Q Factor'),
      ingredients: [] // Will be populated separately if needed
    }));

    res.json({
      success: true,
      data: recipes
    });
  } catch (error) {
    logger.error('Failed to fetch recipes', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recipes'
    });
  }
});

// Cache for ingredients to avoid repeated API calls
let ingredientsCache = null;
let ingredientsCacheTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Helper function to get ingredients with caching
async function getCachedIngredients() {
  const now = Date.now();

  if (ingredientsCache && ingredientsCacheTime && (now - ingredientsCacheTime < CACHE_DURATION)) {
    return ingredientsCache;
  }

  try {
    const records = await airtableBase('Ingredients').select().all();
    ingredientsCache = records.map(record => ({
      id: record.id,
      name: record.get('Ingredient Name'),
      unitCost: record.get('Unit Cost') || 0
    }));
    ingredientsCacheTime = now;
    return ingredientsCache;
  } catch (error) {
    logger.error('Error fetching ingredients', error);
    return ingredientsCache || []; // Return cached version if available
  }
}

// Helper function to get recipe ingredients from junction table
async function getRecipeIngredients(recipeId) {
  try {
    // Get all junction records and filter client-side
    const allJunctionRecords = await airtableBase('Recipe Ingredients').select().all();

    const recipeIngredients = allJunctionRecords.filter(record => {
      const recipes = record.get('Recipe') || [];
      return Array.isArray(recipes) && recipes.includes(recipeId);
    });

    const ingredients = [];

    for (const record of recipeIngredients) {
      const ingredientId = record.get('Ingredient')?.[0];

      if (ingredientId) {
        try {
          const masterIngredient = await airtableBase('Ingredients').find(ingredientId);
          const recipeQuantity = record.get('Quantity') || 0;
          const unitCost = masterIngredient.get('Unit Cost') || 0;
          const totalCost = recipeQuantity * unitCost;

          ingredients.push({
            id: ingredientId,
            name: masterIngredient.get('Ingredient Name'),
            quantity: recipeQuantity,
            unit: record.get('Unit') || masterIngredient.get('Unit'),
            cost: unitCost,
            totalCost: totalCost,
            fromOdoo: masterIngredient.get('From Odoo') || false,
            odooProductName: masterIngredient.get('Odoo Product Name') || undefined
          });
        } catch (error) {
          logger.error(`Error fetching ingredient ${ingredientId}`, error);
        }
      }
    }

    return ingredients;
  } catch (error) {
    logger.error('Error in getRecipeIngredients', error);
    return [];
  }
}

// Helper function to calculate recipe costs with Q Factor
function calculateRecipeCostsWithQFactor(ingredients, servings = 1, qFactor = 10) {
  const baseCost = ingredients.reduce((sum, ingredient) => sum + (ingredient.totalCost || 0), 0);
  const qFactorAmount = baseCost * (qFactor / 100);
  const totalCostWithQFactor = baseCost + qFactorAmount;
  const costPerServing = servings > 0 ? totalCostWithQFactor / servings : 0;

  return {
    baseCost,
    qFactor,
    qFactorAmount,
    totalCost: totalCostWithQFactor,
    costPerServing,
    breakdown: {
      baseCost,
      qFactorPercentage: qFactor,
      qFactorAmount,
      totalWithQFactor: totalCostWithQFactor
    }
  };
}

// Search ingredients (with caching) - MUST be before /:id route
app.get('/api/recipes/ingredients/search', async (req, res) => {
  try {
    const { q } = req.query;
    const ingredients = await getCachedIngredients();

    let filteredIngredients = ingredients;

    if (q && q.length > 0) {
      filteredIngredients = ingredients.filter(ing =>
        ing.name && ing.name.toLowerCase().includes(q.toLowerCase())
      );
    }

    logger.info(`Ingredient search for "${q}": ${filteredIngredients.length} results`);
    res.json({
      success: true,
      data: filteredIngredients.slice(0, 50), // Limit results
      query: q,
      totalCount: filteredIngredients.length
    });

  } catch (error) {
    logger.error('Failed to search ingredients', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search ingredients'
    });
  }
});

// Get recipe by ID
app.get('/api/recipes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const qFactor = parseFloat(req.query.qFactor) || 10;

    if (!airtableBase) {
      return res.status(503).json({
        success: false,
        error: 'Airtable not configured'
      });
    }

    const record = await airtableBase('Recipes').find(id);
    const ingredients = await getRecipeIngredients(id);
    const servings = record.get('Servings') || 1;

    // Calculate costs with Q Factor
    const costCalculation = calculateRecipeCostsWithQFactor(ingredients, servings, qFactor);

    const recipe = {
      id: record.id,
      name: record.get('Name'),
      description: record.get('Description'),
      category: record.get('Category'),
      servings: servings,
      prepTime: record.get('Prep Time'),
      cookTime: record.get('Cook Time'),
      instructions: record.get('Instructions'),
      ingredients: ingredients,
      totalCost: costCalculation.totalCost,
      costPerServing: costCalculation.costPerServing,
      qFactorPercentage: costCalculation.qFactor,
      qFactorCost: costCalculation.qFactorAmount,
      totalCostWithQFactor: costCalculation.totalCost,
      costPerServingWithQFactor: costCalculation.costPerServing,
      costBreakdown: costCalculation.breakdown
    };

    logger.info(`Fetched recipe: ${recipe.name} with ${ingredients.length} ingredients`);
    res.json({
      success: true,
      data: recipe,
      qFactor: qFactor
    });
  } catch (error) {
    logger.error('Failed to fetch recipe', error);
    res.status(500).json({
      success: false,
      error: 'Recipe not found'
    });
  }
});


// Create new recipe
app.post('/api/recipes', async (req, res) => {
  try {
    const recipe = req.body;

    if (!airtableBase) {
      return res.status(503).json({
        success: false,
        error: 'Airtable not configured'
      });
    }

    const record = await airtableBase('Recipes').create({
      'Name': recipe.name,
      'Description': recipe.description,
      'Category': recipe.category,
      'Servings': recipe.servings,
      'Prep Time': recipe.prepTime,
      'Cook Time': recipe.cookTime,
      'Instructions': recipe.instructions
    });

    const createdRecipe = {
      id: record.id,
      name: record.get('Name'),
      description: record.get('Description'),
      category: record.get('Category'),
      servings: record.get('Servings'),
      prepTime: record.get('Prep Time'),
      cookTime: record.get('Cook Time'),
      instructions: record.get('Instructions'),
      totalCost: record.get('Total Cost') || 0,
      costPerServing: record.get('Cost Per Serving') || 0,
      ingredients: []
    };

    res.json({
      success: true,
      data: createdRecipe
    });
  } catch (error) {
    logger.error('Failed to create recipe', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create recipe'
    });
  }
});

// Update recipe
app.put('/api/recipes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const recipe = req.body;

    if (!airtableBase) {
      return res.status(503).json({
        success: false,
        error: 'Airtable not configured'
      });
    }

    const record = await airtableBase('Recipes').update(id, {
      'Name': recipe.name,
      'Description': recipe.description,
      'Category': recipe.category,
      'Servings': recipe.servings,
      'Prep Time': recipe.prepTime,
      'Cook Time': recipe.cookTime,
      'Instructions': recipe.instructions
    });

    const updatedRecipe = {
      id: record.id,
      name: record.get('Name'),
      description: record.get('Description'),
      category: record.get('Category'),
      servings: record.get('Servings'),
      prepTime: record.get('Prep Time'),
      cookTime: record.get('Cook Time'),
      instructions: record.get('Instructions'),
      totalCost: record.get('Total Cost') || 0,
      costPerServing: record.get('Cost Per Serving') || 0,
      ingredients: []
    };

    res.json({
      success: true,
      data: updatedRecipe
    });
  } catch (error) {
    logger.error('Failed to update recipe', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update recipe'
    });
  }
});

// Delete recipe
app.delete('/api/recipes/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!airtableBase) {
      return res.status(503).json({
        success: false,
        error: 'Airtable not configured'
      });
    }

    await airtableBase('Recipes').destroy(id);

    res.json({
      success: true,
      data: null
    });
  } catch (error) {
    logger.error('Failed to delete recipe', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete recipe'
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Error handling
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info(`Noe Sushi Operations API started`, {
    port: PORT,
    environment: NODE_ENV,
    odooUrl: ODOO_CONFIG.url,
    odooDatabase: ODOO_CONFIG.database
  });
  logger.info(`Health check available at: http://localhost:${PORT}/health`);
  logger.info(`API documentation at: http://localhost:${PORT}/api`);
});
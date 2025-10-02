const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const Airtable = require('airtable');

// Load environment variables from parent directory
dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || process.env.API_PORT || 5000;

// Configure Airtable
if (process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID) {
  Airtable.configure({
    endpointUrl: 'https://api.airtable.com',
    apiKey: process.env.AIRTABLE_API_KEY
  });
  console.log('✅ Airtable configured successfully');
} else {
  console.warn('⚠️ Airtable credentials not found in environment variables');
}

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000', // React dev server (local)
    'http://localhost:3001', // Proxy server (local)
    'http://192.168.1.141:3000', // React dev server (network)
    'http://192.168.1.141:3001'  // Proxy server (network)
  ],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    airtableConfigured: !!(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID)
  });
});

// Auth endpoint for Odoo service
app.post('/api/auth', (req, res) => {
  // Since we're using server-side Airtable integration,
  // we don't need actual Odoo authentication on the frontend
  // Return a mock session for compatibility
  res.json({
    success: true,
    data: {
      sessionId: 'mock-session-' + Date.now()
    },
    message: 'Authentication successful'
  });
});

// Routes
const recipesRouter = require('./routes/recipes');
const toastRouter = require('./routes/toast');
app.use('/api/recipes', recipesRouter);
app.use('/api/toast', toastRouter);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('API Error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Start server - bind to 0.0.0.0 to accept connections from network
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API Server running on http://0.0.0.0:${PORT}`);
  console.log(`📋 Health check: http://192.168.1.141:${PORT}/health`);
  console.log(`🍳 Recipes API: http://192.168.1.141:${PORT}/api/recipes`);
  console.log(`🔍 Ingredient search: http://192.168.1.141:${PORT}/api/recipes/ingredients/search`);
  console.log(`🍞 Toast POS API: http://192.168.1.141:${PORT}/api/toast`);
  console.log(`📊 Toast POS sales: http://192.168.1.141:${PORT}/api/toast/sales`);
});
require('dotenv').config({ path: require('path').join(__dirname, '../server/.env') });
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Proxy middleware for Odoo API
const odooProxy = createProxyMiddleware({
  target: 'https://noe-usa-llc.odoo.com',
  changeOrigin: true,
  secure: true,
  timeout: 30000, // 30 second timeout
  proxyTimeout: 30000,
  pathRewrite: {
    '^/api/odoo': '' // Remove /api/odoo prefix
  },
  headers: {
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache'
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log('Proxying request to:', proxyReq.path);
    // Set proper headers
    proxyReq.setHeader('Host', 'noe-usa-llc.odoo.com');
    proxyReq.setHeader('Origin', 'https://noe-usa-llc.odoo.com');
    proxyReq.setHeader('Referer', 'https://noe-usa-llc.odoo.com/');
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log('Received response:', proxyRes.statusCode);
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err.code, err.message);
    res.status(500).json({ error: 'Proxy error', details: err.message, code: err.code });
  }
});

// Auth endpoint for Odoo authentication
app.post('/api/auth', (req, res) => {
  // Return a mock session for Odoo authentication
  // In a real implementation, this would authenticate with Odoo
  res.json({
    success: true,
    data: {
      sessionId: 'odoo-session-' + Date.now()
    },
    message: 'Odoo authentication successful'
  });
});

// Mock products endpoint for demo purposes
app.get('/api/products', (req, res) => {
  // Return mock product data
  const mockProducts = [
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

  res.json({
    success: true,
    data: mockProducts,
    message: 'Products fetched successfully'
  });
});

// Mock product search endpoint
app.get('/api/products/search/:name', (req, res) => {
  const searchName = req.params.name.toLowerCase();

  const mockProducts = [
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

  // Filter products by name
  const filteredProducts = mockProducts.filter(product =>
    product.name.toLowerCase().includes(searchName)
  );

  res.json({
    success: true,
    data: filteredProducts,
    message: `Found ${filteredProducts.length} products matching "${req.params.name}"`
  });
});

// Note: Recipe routes are now served by the main server (port 5000)
// This proxy server only handles Odoo proxying

// Use the proxy for all /api/odoo routes
app.use('/api/odoo', odooProxy);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Odoo proxy server is running' });
});

app.listen(PORT, () => {
  console.log(`Odoo proxy server running on http://localhost:${PORT}`);
  console.log('Proxying requests to: https://noe-usa-llc.odoo.com');
});
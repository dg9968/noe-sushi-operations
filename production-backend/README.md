# Noe Sushi Operations API

A production-ready REST API for Noe Sushi Bar operations management, providing secure access to Odoo ERP data.

## 🚀 Features

- **Secure Authentication**: Session-based authentication with automatic cleanup
- **Comprehensive Logging**: Structured logging with timestamps and request tracking
- **Production Ready**: Error handling, rate limiting, and security middleware
- **Odoo Integration**: Full integration with Odoo ERP system
- **RESTful API**: Clean, consistent API design with proper HTTP status codes
- **Health Monitoring**: Built-in health check and monitoring endpoints

## 📋 Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0
- Access to Odoo instance (noe-usa-llc.odoo.com)
- Valid Odoo credentials

## 🔧 Installation

1. **Clone and navigate to the backend directory:**
   ```bash
   cd production-backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your Odoo credentials
   ```

4. **Start the server:**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm run prod
   ```

## 🌐 API Endpoints

### Authentication
- `POST /api/auth` - Authenticate and get session token
- `GET /api/session` - Get session information (requires auth)
- `POST /api/logout` - Logout and invalidate session (requires auth)

### Products
- `GET /api/products` - Get all products (supports pagination)
- `GET /api/products/search/:name` - Search products by name
- `GET /api/products/:id` - Get specific product by ID

### Inventory & Stock
- `GET /api/categories` - Get product categories
- `GET /api/inventory` - Get inventory/stock levels
- `GET /api/locations` - Get stock locations

### Partners & Company
- `GET /api/partners` - Get customers/suppliers
- `GET /api/company` - Get company information

### System
- `GET /health` - Health check endpoint
- `GET /api` - API documentation and endpoints list

## 🔐 Authentication

The API uses session-based authentication. Follow these steps:

1. **Get a session token:**
   ```bash
   curl -X POST http://localhost:5000/api/auth
   ```

2. **Use the token in subsequent requests:**
   ```bash
   curl -H "Authorization: Bearer YOUR_SESSION_TOKEN" http://localhost:5000/api/products
   ```

3. **Session expires in 24 hours** - re-authenticate as needed.

## 📊 API Response Format

All API responses follow this consistent format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error description"
}
```

## 🔍 Query Parameters

### Products Endpoint
- `limit` - Number of items to return (default: 100)
- `offset` - Number of items to skip (default: 0)
- `category_id` - Filter by category ID

### Example:
```bash
GET /api/products?limit=50&offset=100&category_id=5
```

## 🏥 Health Check

Monitor the API health:

```bash
curl http://localhost:5000/health
```

Response includes:
- Server status
- Uptime
- Memory usage
- Environment info

## 🛡️ Security Features

- **CORS Protection**: Configured for specific origins
- **Rate Limiting**: Prevents API abuse
- **Helmet.js**: Security headers
- **Input Validation**: Request sanitization
- **Session Management**: Automatic session cleanup

## 📝 Logging

The API provides comprehensive logging:

```
[2025-09-21T12:02:57.810Z] INFO: Authentication request received
[2025-09-21T12:02:57.811Z] INFO: Fetched 25 products
[2025-09-21T12:02:57.812Z] ERROR: Failed to fetch inventory
```

## 🚀 Production Deployment

### Environment Variables

Create a `.env` file with:

```env
# Odoo Configuration
ODOO_URL=https://noe-usa-llc.odoo.com
ODOO_DB=noe-usa-llc
ODOO_USER=your_username
ODOO_PASSWORD=your_password

# Server Configuration
PORT=5000
NODE_ENV=production
```

### Docker Deployment (Optional)

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### Process Management (PM2)

```bash
npm install -g pm2
pm2 start server.js --name "noe-sushi-api"
pm2 save
pm2 startup
```

## 🔧 Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm run prod` - Start production server with NODE_ENV=production
- `npm run health` - Health check script

## 📈 Performance

- **Session Cleanup**: Automatic cleanup of expired sessions every hour
- **Request Timeout**: 30-second timeout for Odoo requests
- **Memory Monitoring**: Built-in memory usage tracking
- **Compression**: Gzip compression for responses

## 🐛 Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify Odoo credentials in `.env`
   - Check Odoo server connectivity
   - Ensure database name is correct

2. **Session Expired**
   - Re-authenticate to get a new session token
   - Check system clock synchronization

3. **Network Errors**
   - Verify Odoo URL is accessible
   - Check firewall settings

### Debug Mode

Set environment variable for verbose logging:
```bash
DEBUG=* npm run dev
```

## 📋 API Testing

### Using curl:

```bash
# Get session token
SESSION_TOKEN=$(curl -s -X POST http://localhost:5000/api/auth | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)

# Test products endpoint
curl -H "Authorization: Bearer $SESSION_TOKEN" http://localhost:5000/api/products?limit=5

# Search products
curl -H "Authorization: Bearer $SESSION_TOKEN" http://localhost:5000/api/products/search/avocado

# Get categories
curl -H "Authorization: Bearer $SESSION_TOKEN" http://localhost:5000/api/categories
```

### Using Postman:

1. Create a POST request to `/api/auth`
2. Copy the `sessionId` from the response
3. Add header: `Authorization: Bearer YOUR_SESSION_TOKEN`
4. Test other endpoints

## 🤝 Contributing

1. Follow existing code style
2. Add proper error handling
3. Include logging for new features
4. Update this README for new endpoints

## 📄 License

MIT License - see LICENSE file for details.

## 📞 Support

For issues and support:
- Check logs for error details
- Verify Odoo connectivity
- Review environment configuration
- Contact system administrator

---

**Production Backend Status**: ✅ **READY**

Server running at: http://localhost:5000
Health check: http://localhost:5000/health
API docs: http://localhost:5000/api
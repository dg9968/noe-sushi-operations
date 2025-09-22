import React, { useState, useEffect } from 'react';
import { OdooConnection, OdooProduct } from '../../types';
import { productionOdooService as odooService } from '../../services/productionOdooService';
import config, { isProduction, isDemoMode } from '../../config/environment';
import './OdooIntegration.css';

const OdooIntegration: React.FC = () => {
  const [connection, setConnection] = useState<OdooConnection>({
    url: '',
    database: '',
    username: '',
    password: '',
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [products, setProducts] = useState<OdooProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    const savedConnection = localStorage.getItem('noe-sushi-odoo-connection');
    if (savedConnection) {
      const parsedConnection = JSON.parse(savedConnection);
      setConnection(parsedConnection);
      odooService.setConnection(parsedConnection);
    }
  }, []);

  const enableDemoMode = async () => {
    setIsConnecting(true);
    setConnectionError(null);
    
    odooService.enableDemoMode();
    setIsDemoMode(true);
    
    try {
      const success = await odooService.authenticate();
      if (success) {
        setIsConnected(true);
        await loadProducts();
      }
    } catch (error) {
      setConnectionError('Demo mode failed to initialize.');
    } finally {
      setIsConnecting(false);
    }
  };

  const saveConnection = (conn: OdooConnection) => {
    localStorage.setItem('noe-sushi-odoo-connection', JSON.stringify(conn));
    setConnection(conn);
    odooService.setConnection(conn);
  };

  const connectToBackend = async () => {
    setIsConnecting(true);
    setConnectionError(null);
    
    // Ensure demo mode is disabled for real connections
    odooService.disableDemoMode();
    setIsDemoMode(false);
    
    try {
      // For production mode, we don't need Odoo credentials since backend handles that
      const success = await odooService.authenticate();
      if (success) {
        setIsConnected(true);
        await loadProducts();
      } else {
        setConnectionError('Backend authentication failed. Please check if the backend server is running and configured correctly.');
        setIsConnected(false);
      }
    } catch (error) {
      let errorMessage = 'Connection to backend failed. ';
      
      if (error instanceof TypeError) {
        errorMessage += 'Backend server may not be running. ';
      } else if (error instanceof Error) {
        errorMessage += `Error: ${error.message}`;
      }
      
      errorMessage += '\n\nTroubleshooting steps:\n';
      errorMessage += '• Ensure backend server is running on ' + config.api.baseURL + '\n';
      errorMessage += '• Check backend server configuration\n';
      errorMessage += '• Verify Odoo credentials in backend .env file\n';
      errorMessage += '• Check browser console for detailed errors';
      
      setConnectionError(errorMessage);
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const loadProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const productList = await odooService.getProducts();
      setProducts(productList);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const searchProducts = async () => {
    if (!searchTerm.trim()) {
      await loadProducts();
      return;
    }

    setIsLoadingProducts(true);
    try {
      const product = await odooService.getProductByName(searchTerm);
      setProducts(product ? [product] : []);
    } catch (error) {
      console.error('Failed to search products:', error);
      setProducts([]);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const disconnect = () => {
    setIsConnected(false);
    setProducts([]);
    setIsDemoMode(false);
    odooService.disableDemoMode();
    localStorage.removeItem('noe-sushi-odoo-connection');
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="odoo-integration">
      <h2>Odoo Integration</h2>
      <p className="description">
        Connect to your Odoo ERP system to automatically fetch ingredient costs and keep your recipe pricing up to date.
      </p>

      {!isConnected ? (
        <div className="connection-setup">
          <div className="connection-form">
            {isProduction() ? (
              <>
                <h3>Backend API Connection</h3>
                <div className="backend-info">
                  <p><strong>Backend API:</strong> {config.api.baseURL}</p>
                  <p><strong>Status:</strong> Ready to connect</p>
                  <p>Odoo credentials are configured in the backend server.</p>
                </div>

                {connectionError && (
                  <div className="error-message">
                    {connectionError}
                  </div>
                )}

                <div className="button-group">
                  <button
                    onClick={connectToBackend}
                    disabled={isConnecting}
                    className="connect-btn"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect to Odoo'}
                  </button>
                  
                  <button
                    onClick={enableDemoMode}
                    disabled={isConnecting}
                    className="demo-btn"
                  >
                    {isConnecting ? 'Loading...' : 'Try Demo Mode'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>Development Mode</h3>
                <div className="dev-info">
                  <p>You're in development mode. Choose an option:</p>
                </div>

                {connectionError && (
                  <div className="error-message">
                    {connectionError}
                  </div>
                )}

                <div className="button-group">
                  <button
                    onClick={enableDemoMode}
                    disabled={isConnecting}
                    className="demo-btn"
                  >
                    {isConnecting ? 'Loading...' : 'Use Demo Mode'}
                  </button>
                  
                  <button
                    onClick={connectToBackend}
                    disabled={isConnecting}
                    className="connect-btn"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect to Backend API'}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="connection-info">
            <h4>Setup Instructions</h4>
            <ol>
              <li>Ensure your Odoo server is accessible from this application</li>
              <li>Create a dedicated user account for this integration</li>
              <li>Grant the user access to product and inventory modules</li>
              <li>Enter your server details and test the connection</li>
            </ol>

            <div className="security-note">
              <h5>Security Note</h5>
              <p>Your Odoo credentials are stored locally in your browser and are only used to authenticate with your Odoo server. They are not sent to any third-party services.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="connected-view">
          <div className="connection-status">
            <div className="status-indicator">
              <span className="status-dot connected"></span>
              <span>{isDemoMode ? 'Demo Mode Active' : `Connected to ${connection.url}`}</span>
            </div>
            <button onClick={disconnect} className="disconnect-btn">
              Disconnect
            </button>
          </div>

          <div className="products-section">
            <div className="products-header">
              <h3>Product Catalog</h3>
              <button onClick={loadProducts} disabled={isLoadingProducts} className="refresh-btn">
                {isLoadingProducts ? 'Loading...' : 'Refresh Products'}
              </button>
            </div>

            <div className="search-section">
              <div className="search-controls">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <button onClick={searchProducts} className="search-btn">
                  Search
                </button>
              </div>
            </div>

            <div className="products-grid">
              {isLoadingProducts ? (
                <div className="loading-state">
                  <p>Loading products...</p>
                </div>
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <div key={product.id} className="product-card">
                    <h4>{product.name}</h4>
                    <div className="product-details">
                      <p className="product-price">
                        Price: <span>${product.standard_price.toFixed(2)}</span>
                      </p>
                      <p className="product-unit">
                        Unit: <span>{product.uom_name || 'Unit'}</span>
                      </p>
                      <p className="product-category">
                        Category: <span>{product.categ_id?.[1] || product.category_id?.[1] || 'Unknown'}</span>
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <p>No products found. Try adjusting your search or refresh the product list.</p>
                </div>
              )}
            </div>

            <div className="integration-tips">
              <h4>Integration Tips</h4>
              <ul>
                <li>Product names in recipes should match product names in Odoo for automatic cost calculation</li>
                <li>Use the "Calculate Cost" feature in Recipe Manager to fetch current prices</li>
                <li>Prices are fetched in real-time when calculating recipe costs</li>
                <li>Ensure your products have accurate standard prices set in Odoo</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OdooIntegration;
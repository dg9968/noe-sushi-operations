import React, { useState, useEffect } from 'react';
import './ToastIntegration.css';

interface RestaurantData {
  name?: string;
  guid?: string;
  timeZone?: string;
  address?: any;
}

interface MenuGroup {
  name: string;
  menuItems?: MenuItem[];
}

interface MenuItem {
  name: string;
  guid: string;
  price?: number;
  description?: string;
}

interface MenuData {
  menuGroups: MenuGroup[];
}

interface SalesData {
  recipeId: string;
  recipeName: string;
  quantitySold: number;
  revenue: number;
  period: string;
  date: string;
}

interface Mapping {
  [key: string]: string;
}

const ToastIntegration: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<any>(null);
  const [restaurantData, setRestaurantData] = useState<RestaurantData | null>(null);
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [mappings, setMappings] = useState<Mapping>({});
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('connection');
  const [businessDate, setBusinessDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const apiBaseUrl = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';

  useEffect(() => {
    testConnection();
  }, []);

  const setLoadingState = (key: string, value: boolean) => {
    setLoading(prev => ({ ...prev, [key]: value }));
  };

  const testConnection = async () => {
    setLoadingState('connection', true);
    setError(null);
    try {
      console.log('🔗 Testing Toast POS connection...');
      const response = await fetch(`${apiBaseUrl}/api/toast/test`);
      const data = await response.json();
      setConnectionStatus(data);
      console.log('✅ Connection test result:', data);
    } catch (err) {
      console.error('❌ Connection test failed:', err);
      setError('Failed to test Toast POS connection');
      setConnectionStatus({ success: false, connected: false, message: 'Connection failed' });
    } finally {
      setLoadingState('connection', false);
    }
  };

  const fetchRestaurantData = async () => {
    setLoadingState('restaurant', true);
    setError(null);
    try {
      console.log('🏪 Fetching restaurant data...');
      const response = await fetch(`${apiBaseUrl}/api/toast/restaurant`);
      const data = await response.json();
      if (data.success) {
        setRestaurantData(Array.isArray(data.data) ? data.data[0] : data.data);
        console.log('✅ Restaurant data fetched:', data.data);
      } else {
        if (data.message && data.message.includes('404')) {
          setError('Restaurant configuration endpoint requires additional API permissions. Contact Toast support to enable config:restaurants scope.');
        } else {
          throw new Error(data.error || 'Failed to fetch restaurant data');
        }
      }
    } catch (err) {
      console.error('❌ Restaurant fetch failed:', err);
      if (!error) { // Only set if we haven't already set a more specific error
        setError('Failed to fetch restaurant data - may require additional API permissions');
      }
    } finally {
      setLoadingState('restaurant', false);
    }
  };

  const fetchMenuData = async () => {
    setLoadingState('menu', true);
    setError(null);
    try {
      console.log('🍽️ Fetching menu data...');
      const response = await fetch(`${apiBaseUrl}/api/toast/menu`);
      const data = await response.json();
      if (data.success) {
        setMenuData(data.data);
        console.log('✅ Menu data fetched:', data.meta);
      } else {
        if (data.message && data.message.includes('404')) {
          setError('Menu configuration endpoint requires additional API permissions. Contact Toast support to enable config:menu scope.');
        } else {
          throw new Error(data.error || 'Failed to fetch menu data');
        }
      }
    } catch (err) {
      console.error('❌ Menu fetch failed:', err);
      if (!error) {
        setError('Failed to fetch menu data - may require additional API permissions');
      }
    } finally {
      setLoadingState('menu', false);
    }
  };

  const fetchMappings = async () => {
    setLoadingState('mappings', true);
    setError(null);
    try {
      console.log('🗺️ Fetching menu item mappings...');
      const response = await fetch(`${apiBaseUrl}/api/toast/mappings`);
      const data = await response.json();
      if (data.success) {
        setMappings(data.data);
        console.log('✅ Mappings fetched:', data.meta);
      } else {
        throw new Error(data.error || 'Failed to fetch mappings');
      }
    } catch (err) {
      console.error('❌ Mappings fetch failed:', err);
      setError('Failed to fetch mappings');
    } finally {
      setLoadingState('mappings', false);
    }
  };

  const fetchSalesData = async () => {
    setLoadingState('sales', true);
    setError(null);
    try {
      console.log('📊 Fetching sales data for date:', businessDate);

      // Convert business date to date range (full day in UTC)
      const startDate = new Date(businessDate + 'T00:00:00.000Z');
      const endDate = new Date(businessDate + 'T23:59:59.999Z');

      console.log('📅 Date range:', { startDate: startDate.toISOString(), endDate: endDate.toISOString() });

      // For now, use a 1-hour sample since Toast API limits to 1 hour per request
      // In production, you'd need to make 24 separate 1-hour requests
      const sampleStart = new Date(businessDate + 'T12:00:00.000Z');
      const sampleEnd = new Date(businessDate + 'T13:00:00.000Z');

      const response = await fetch(
        `${apiBaseUrl}/api/toast/sales?startDate=${sampleStart.toISOString()}&endDate=${sampleEnd.toISOString()}`
      );
      const data = await response.json();
      if (data.success) {
        setSalesData(data.data);
        console.log('✅ Sales data fetched:', data.meta);
        if (data.data.length === 0) {
          setError('No sales data found for the selected date. This is a 1-hour sample (12:00-13:00 UTC). Real implementation would query all 24 hours.');
        }
      } else {
        throw new Error(data.error || 'Failed to fetch sales data');
      }
    } catch (err) {
      console.error('❌ Sales fetch failed:', err);
      setError('Failed to fetch sales data');
    } finally {
      setLoadingState('sales', false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const renderConnectionTab = () => (
    <div className="toast-section">
      <div className="section-header">
        <h3>🔗 Connection Status</h3>
        <button
          onClick={testConnection}
          disabled={loading.connection}
          className="action-btn"
        >
          {loading.connection ? 'Testing...' : 'Test Connection'}
        </button>
      </div>

      {connectionStatus && (
        <div className={`connection-status ${connectionStatus.connected ? 'connected' : 'disconnected'}`}>
          <div className="status-indicator">
            <span className={`status-dot ${connectionStatus.connected ? 'connected' : 'disconnected'}`}></span>
            <span className="status-text">{connectionStatus.message}</span>
          </div>

          {connectionStatus.data && (
            <div className="connection-details">
              <div className="detail-item">
                <strong>Restaurant GUID:</strong> {connectionStatus.data.restaurantGuid}
              </div>
              <div className="detail-item">
                <strong>Token Available:</strong> {connectionStatus.data.tokenAvailable ? 'Yes' : 'No'}
              </div>
              <div className="detail-item">
                <strong>Token Expires:</strong> {new Date(connectionStatus.data.tokenExpiry).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderRestaurantTab = () => (
    <div className="toast-section">
      <div className="section-header">
        <h3>🏪 Restaurant Information</h3>
        <button
          onClick={fetchRestaurantData}
          disabled={loading.restaurant}
          className="action-btn"
        >
          {loading.restaurant ? 'Loading...' : 'Fetch Restaurant Data'}
        </button>
      </div>

      {restaurantData && (
        <div className="data-display">
          <div className="data-grid">
            <div className="data-item">
              <strong>Name:</strong> {restaurantData.name || 'N/A'}
            </div>
            <div className="data-item">
              <strong>GUID:</strong> {restaurantData.guid || 'N/A'}
            </div>
            <div className="data-item">
              <strong>Time Zone:</strong> {restaurantData.timeZone || 'N/A'}
            </div>
          </div>

          <div className="raw-data">
            <h4>Raw Data:</h4>
            <pre>{JSON.stringify(restaurantData, null, 2)}</pre>
          </div>
        </div>
      )}

      {!restaurantData && !loading.restaurant && (
        <div className="permission-info">
          <h4>📋 Available Restaurant Information</h4>
          <p>The restaurant configuration endpoint requires additional API permissions. However, we can access basic restaurant info from the connection test:</p>
          {connectionStatus?.data && (
            <div className="basic-info">
              <div className="data-item">
                <strong>Restaurant GUID:</strong> {connectionStatus.data.restaurantGuid}
              </div>
              <div className="data-item">
                <strong>API Access:</strong> Orders and Sales data available
              </div>
              <div className="data-item">
                <strong>Status:</strong> {connectionStatus.connected ? 'Connected' : 'Disconnected'}
              </div>
            </div>
          )}
          <div className="note">
            <strong>Note:</strong> To access full restaurant configuration, contact Toast support to enable the <code>config:restaurants</code> API scope.
          </div>
        </div>
      )}
    </div>
  );

  const renderMenuTab = () => (
    <div className="toast-section">
      <div className="section-header">
        <h3>🍽️ Menu Configuration</h3>
        <button
          onClick={fetchMenuData}
          disabled={loading.menu}
          className="action-btn"
        >
          {loading.menu ? 'Loading...' : 'Fetch Menu Data'}
        </button>
      </div>

      {menuData && (
        <div className="data-display">
          <div className="menu-summary">
            <p><strong>Menu Groups:</strong> {menuData.menuGroups?.length || 0}</p>
            <p><strong>Total Items:</strong> {
              menuData.menuGroups?.reduce((total, group) =>
                total + (group.menuItems?.length || 0), 0) || 0
            }</p>
          </div>

          <div className="menu-groups">
            {menuData.menuGroups?.map((group, index) => (
              <div key={index} className="menu-group">
                <h4>{group.name}</h4>
                {group.menuItems && group.menuItems.length > 0 ? (
                  <div className="menu-items">
                    {group.menuItems.slice(0, 5).map((item, itemIndex) => (
                      <div key={itemIndex} className="menu-item">
                        <span className="item-name">{item.name}</span>
                        {item.price && <span className="item-price">{formatCurrency(item.price)}</span>}
                      </div>
                    ))}
                    {group.menuItems.length > 5 && (
                      <p className="more-items">... and {group.menuItems.length - 5} more items</p>
                    )}
                  </div>
                ) : (
                  <p className="no-items">No items in this group</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!menuData && !loading.menu && (
        <div className="permission-info">
          <h4>🍽️ Menu Configuration Not Available</h4>
          <p>The menu configuration endpoint requires additional API permissions.</p>
          <div className="fallback-info">
            <h5>📊 Available Data Sources:</h5>
            <ul>
              <li><strong>Sales Data:</strong> Menu item names from actual sales orders</li>
              <li><strong>Menu Mappings:</strong> Pre-configured menu item to recipe mappings (see Mappings tab)</li>
              <li><strong>Order Data:</strong> Item selections and pricing from completed orders</li>
            </ul>
          </div>
          <div className="note">
            <strong>Note:</strong> To access full menu configuration, contact Toast support to enable the <code>config:menu</code> API scope.
          </div>
        </div>
      )}
    </div>
  );

  const renderMappingsTab = () => (
    <div className="toast-section">
      <div className="section-header">
        <h3>🗺️ Menu Item Mappings</h3>
        <button
          onClick={fetchMappings}
          disabled={loading.mappings}
          className="action-btn"
        >
          {loading.mappings ? 'Loading...' : 'Fetch Mappings'}
        </button>
      </div>

      {Object.keys(mappings).length > 0 && (
        <div className="data-display">
          <p><strong>Total Mappings:</strong> {Object.keys(mappings).length}</p>

          <div className="mappings-table">
            <table>
              <thead>
                <tr>
                  <th>Menu Item Name</th>
                  <th>Recipe ID</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(mappings).map(([menuItem, recipeId]) => (
                  <tr key={menuItem}>
                    <td>{menuItem}</td>
                    <td><code>{recipeId}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderSalesTab = () => (
    <div className="toast-section">
      <div className="section-header">
        <h3>📊 Sales Data</h3>
        <div className="sales-controls">
          <input
            type="date"
            value={businessDate}
            onChange={(e) => setBusinessDate(e.target.value)}
            className="date-input"
          />
          <button
            onClick={fetchSalesData}
            disabled={loading.sales}
            className="action-btn"
          >
            {loading.sales ? 'Loading...' : 'Fetch Sales Data'}
          </button>
        </div>
      </div>

      {salesData.length > 0 && (
        <div className="data-display">
          <div className="sales-summary">
            <p><strong>Total Items:</strong> {salesData.length}</p>
            <p><strong>Total Revenue:</strong> {formatCurrency(
              salesData.reduce((sum, item) => sum + item.revenue, 0)
            )}</p>
            <p><strong>Total Quantity:</strong> {
              salesData.reduce((sum, item) => sum + item.quantitySold, 0)
            }</p>
          </div>

          <div className="sales-table">
            <table>
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Recipe ID</th>
                  <th>Quantity</th>
                  <th>Revenue</th>
                  <th>Period</th>
                </tr>
              </thead>
              <tbody>
                {salesData.map((item, index) => (
                  <tr key={index}>
                    <td>{item.recipeName}</td>
                    <td><code>{item.recipeId}</code></td>
                    <td>{item.quantitySold}</td>
                    <td>{formatCurrency(item.revenue)}</td>
                    <td>{item.period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {salesData.length === 0 && !loading.sales && (
        <div className="permission-info">
          <h4>📊 Sales Data Information</h4>
          <p>Currently showing 1-hour sample data (12:00-13:00 UTC) for {businessDate}</p>
          <div className="fallback-info">
            <h5>🚀 API Limitations & Solutions:</h5>
            <ul>
              <li><strong>Toast API Limit:</strong> Maximum 1 hour per request</li>
              <li><strong>Daily Data:</strong> Requires 24 separate API calls</li>
              <li><strong>Current Sample:</strong> Shows lunch hour data only</li>
              <li><strong>Production Solution:</strong> Implement chunked requests for full day coverage</li>
            </ul>
          </div>
          <div className="note">
            <strong>Note:</strong> This demo queries a 1-hour window. No sales data may indicate restaurant was closed during that hour, or no orders were placed.
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="toast-integration">
      <div className="toast-integration-header">
        <h2>🍞 Toast POS Integration</h2>
        <p className="toast-integration-subtitle">
          Manage and monitor your Toast POS API integration
        </p>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)} className="close-btn">×</button>
        </div>
      )}

      <div className="toast-tabs">
        <div className="tab-buttons">
          {[
            { key: 'connection', label: '🔗 Connection', icon: '🔗' },
            { key: 'restaurant', label: '🏪 Restaurant', icon: '🏪' },
            { key: 'menu', label: '🍽️ Menu', icon: '🍽️' },
            { key: 'mappings', label: '🗺️ Mappings', icon: '🗺️' },
            { key: 'sales', label: '📊 Sales', icon: '📊' }
          ].map(tab => (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="tab-content">
          {activeTab === 'connection' && renderConnectionTab()}
          {activeTab === 'restaurant' && renderRestaurantTab()}
          {activeTab === 'menu' && renderMenuTab()}
          {activeTab === 'mappings' && renderMappingsTab()}
          {activeTab === 'sales' && renderSalesTab()}
        </div>
      </div>
    </div>
  );
};

export default ToastIntegration;
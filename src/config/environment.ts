// Environment configuration for the application

export const config = {
  // API Configuration
  api: {
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
    timeout: 30000, // 30 seconds
  },

  // Odoo Configuration
  odoo: {
    baseURL: import.meta.env.VITE_ODOO_URL || 'http://localhost:3001',
    timeout: 30000, // 30 seconds
  },

  // Application mode
  mode: import.meta.env.VITE_MODE || 'development', // 'development' | 'production' | 'demo'

  // Feature flags
  features: {
    enableOdooIntegration: import.meta.env.VITE_ENABLE_ODOO === 'true',
    enableDemoMode: import.meta.env.VITE_ENABLE_DEMO !== 'false', // default true
    enableLogging: import.meta.env.VITE_ENABLE_LOGGING !== 'false', // default true
  },
  
  // Default connection for development
  development: {
    odoo: {
      url: 'http://localhost:8069',
      database: 'demo_database',
      username: 'admin',
      password: 'admin',
    },
  },
};

// Helper functions
export const isDevelopment = () => config.mode === 'development';
export const isProduction = () => config.mode === 'production';
export const isDemoMode = () => config.mode === 'demo' || config.features.enableDemoMode;

export default config;
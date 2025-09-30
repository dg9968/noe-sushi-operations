import React, { useState } from 'react';
import './App.css';
import DocumentManager from './components/DocumentManager/DocumentManager';
import OptimizedRecipeManager from './components/RecipeManager/OptimizedRecipeManager';
import OdooIntegration from './components/OdooIntegration/OdooIntegration';
import CostManagement from './components/CostManagement/CostManagement';
import COGSCalculationToast from './components/COGSCalculationToast/COGSCalculationToast';
import ToastIntegration from './components/ToastIntegration/ToastIntegration';

type TabType = 'documents' | 'recipes' | 'cost-management' | 'cogs-toast' | 'odoo' | 'toast-integration';
// Force recompile - using OptimizedRecipeManager for better performance
// Fixed compilation cache issue

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('recipes');

  const renderContent = () => {
    switch (activeTab) {
      case 'documents':
        return <DocumentManager />;
      case 'recipes':
        return <OptimizedRecipeManager />;
      case 'cost-management':
        return <CostManagement />;
      case 'cogs-toast':
        return <COGSCalculationToast />;
      case 'odoo':
        return <OdooIntegration />;
      case 'toast-integration':
        return <ToastIntegration />;
      default:
        return <DocumentManager />;
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Noe Sushi Bar - Operations Management</h1>
        <nav className="navigation">

          <button
            className={activeTab === 'recipes' ? 'active' : ''}
            onClick={() => setActiveTab('recipes')}
          >
            Recipe Manager
          </button>
          <button
            className={activeTab === 'cost-management' ? 'active' : ''}
            onClick={() => setActiveTab('cost-management')}
          >
            Cost Management
          </button>
          <button
            className={activeTab === 'cogs-toast' ? 'active' : ''}
            onClick={() => setActiveTab('cogs-toast')}
          >
            COGS Calculation with Toast
          </button>
          <button
            className={activeTab === 'toast-integration' ? 'active' : ''}
            onClick={() => setActiveTab('toast-integration')}
          >
            Toast Integration
          </button>
          <button
            className={activeTab === 'odoo' ? 'active' : ''}
            onClick={() => setActiveTab('odoo')}
          >
            Odoo Integration
          </button>
          <button
            className={activeTab === 'documents' ? 'active' : ''}
            onClick={() => setActiveTab('documents')}
          >
            Document Manager
          </button>
        </nav>
      </header>
      <main className="App-content">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;

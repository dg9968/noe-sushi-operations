import React, { useState } from 'react';
import './App.css';
import DocumentManager from './components/DocumentManager/DocumentManager';
import AirtableRecipeManager from './components/RecipeManager/AirtableRecipeManager';
import OdooIntegration from './components/OdooIntegration/OdooIntegration';

type TabType = 'documents' | 'recipes' | 'odoo';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('documents');

  const renderContent = () => {
    switch (activeTab) {
      case 'documents':
        return <DocumentManager />;
      case 'recipes':
        return <AirtableRecipeManager />;
      case 'odoo':
        return <OdooIntegration />;
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
            className={activeTab === 'documents' ? 'active' : ''}
            onClick={() => setActiveTab('documents')}
          >
            Document Manager
          </button>
          <button
            className={activeTab === 'recipes' ? 'active' : ''}
            onClick={() => setActiveTab('recipes')}
          >
            Recipe Manager
          </button>
          <button
            className={activeTab === 'odoo' ? 'active' : ''}
            onClick={() => setActiveTab('odoo')}
          >
            Odoo Integration
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

import { useState } from 'react';
import { ChefHat, Sheet, Waypoints } from 'lucide-react';
import { Button } from './components/ui/button';
import DocumentManager from './components/DocumentManager/DocumentManager';
import OptimizedRecipeManager from './components/RecipeManager/OptimizedRecipeManager';
import OdooIntegration from './components/OdooIntegration/OdooIntegration';
import CostManagement from './components/CostManagement/CostManagement';
import COGSCalculationToast from './components/COGSCalculationToast/COGSCalculationToast';
import ToastIntegration from './components/ToastIntegration/ToastIntegration';

type TabType = 'documents' | 'recipes' | 'cost-management' | 'cogs-toast' | 'odoo' | 'toast-integration';

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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          {/* Logo and Title */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <img
              src="/logo.png"
              alt="Noe Sushi Bar Logo"
              className="h-16 rounded-lg shadow-lg ring-4 ring-slate-600 hover:ring-rose-500 transition-all duration-300"
            />
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
              Noe Sushi Bar - Operations Management
            </h1>
          </div>

          {/* Navigation */}
          <nav className="flex justify-center gap-2 flex-wrap">
            <Button
              variant={activeTab === 'recipes' ? "default" : "secondary"}
              size="lg"
              className={activeTab === 'recipes' ? "bg-rose-500 hover:bg-rose-600" : ""}
              onClick={() => setActiveTab('recipes')}
            >
              <ChefHat className="mr-2" size={25} />
              Recipe Manager
            </Button>
            <Button
              variant={activeTab === 'cost-management' ? "default" : "secondary"}
              size="lg"
              className={activeTab === 'cost-management' ? "bg-rose-500 hover:bg-rose-600" : ""}
              onClick={() => setActiveTab('cost-management')}
            >
              <Sheet className="mr-2" size={25} />
              Cost Management
            </Button>
            <Button
              variant={activeTab === 'cogs-toast' ? "default" : "secondary"}
              size="lg"
              className={activeTab === 'cogs-toast' ? "bg-rose-500 hover:bg-rose-600" : ""}
              onClick={() => setActiveTab('cogs-toast')}
            >
              <Waypoints className="mr-2" size={25} />
              COGS with Toast
            </Button>
            <Button
              variant={activeTab === 'toast-integration' ? "default" : "secondary"}
              size="lg"
              className={activeTab === 'toast-integration' ? "bg-rose-500 hover:bg-rose-600" : ""}
              onClick={() => setActiveTab('toast-integration')}
            >
              🍞 Toast Integration
            </Button>
            <Button
              variant={activeTab === 'odoo' ? "default" : "secondary"}
              size="lg"
              className={activeTab === 'odoo' ? "bg-rose-500 hover:bg-rose-600" : ""}
              onClick={() => setActiveTab('odoo')}
            >
              🔗 Odoo Integration
            </Button>
            <Button
              variant={activeTab === 'documents' ? "default" : "secondary"}
              size="lg"
              className={activeTab === 'documents' ? "bg-rose-500 hover:bg-rose-600" : ""}
              onClick={() => setActiveTab('documents')}
            >
              📄 Document Manager
            </Button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-xl p-6 min-h-[600px]">
          {renderContent()}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 text-slate-300 py-4 text-center text-sm">
        <p>© 2025 Noe Sushi Bar | Operations Management System</p>
      </footer>
    </div>
  );
}

export default App;

import React, { useState, useEffect } from 'react';
import { Recipe } from '../../types';
import { airtableService } from '../../services/airtableService';
import { toasthubService } from '../../services/toasthubService';
import { Button } from '../ui/button';
import './COGSCalculationToast.css';

interface SalesData {
  recipeId: string;
  recipeName: string;
  quantitySold: number;
  revenue: number;
  period: string;
  date: Date;
}

interface CostAnalysis {
  recipeId: string;
  recipeName: string;
  totalCost: number;
  quantitySold: number;
  revenue: number;
  profit: number;
  profitMargin: number;
  period: string;
}

type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'custom';

const COGSCalculationToast: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [costAnalyses, setCostAnalyses] = useState<CostAnalysis[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('weekly');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRecipes();
  }, []);

  useEffect(() => {
    if (recipes.length > 0) {
      loadSalesData();
    }
  }, [recipes, selectedPeriod, customStartDate, customEndDate]);

  const loadRecipes = async () => {
    try {
      if (airtableService.isEnabled()) {
        const recipeData = await airtableService.getRecipes();
        setRecipes(recipeData);
      }
    } catch (err) {
      console.error('Error loading recipes:', err);
      setError('Failed to load recipes');
    }
  };

  const loadSalesData = async () => {
    console.log('🔄 COGSCalculationToast: Starting to load sales data for period:', selectedPeriod);
    setIsLoading(true);
    setError(null);
    try {
      // Calculate date range based on selected period
      const { startDate, endDate } = getDateRange();
      console.log('📅 COGSCalculationToast: Date range calculated:', {
        period: selectedPeriod,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        daysDiff: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      });

      // Use Toast POS API to get sales data
      console.log('🍞 COGSCalculationToast: Calling toasthubService.getSalesData()...');
      const salesData = await toasthubService.getSalesData(startDate, endDate);

      console.log('📊 COGSCalculationToast: Received sales data:', {
        itemCount: salesData.length,
        totalRevenue: salesData.reduce((sum, item) => sum + item.revenue, 0),
        totalQuantity: salesData.reduce((sum, item) => sum + item.quantitySold, 0),
        items: salesData.map(item => ({ name: item.recipeName, qty: item.quantitySold, revenue: item.revenue }))
      });

      setSalesData(salesData);
      calculateCostAnalyses(salesData);
    } catch (err) {
      console.error('❌ COGSCalculationToast: Error loading sales data:', err);
      setError('Failed to load sales data from Toast POS');
    } finally {
      setIsLoading(false);
      console.log('✅ COGSCalculationToast: Finished loading sales data');
    }
  };

  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now);

    switch (selectedPeriod) {
      case 'daily':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'weekly':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'custom':
        startDate = customStartDate ? new Date(customStartDate) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = customEndDate ? new Date(customEndDate) : new Date(now);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  };

  const calculateCostAnalyses = (salesData: SalesData[]) => {
    console.log('🧮 COGSCalculationToast: Calculating cost analyses for', salesData.length, 'sales items');
    const analyses: CostAnalysis[] = salesData.map(sale => {
      const recipe = recipes.find(r => r.id === sale.recipeId);
      const totalCost = recipe?.totalCostWithQFactor || recipe?.totalCost || 0;
      const totalRecipeCost = totalCost * sale.quantitySold;
      const profit = sale.revenue - totalRecipeCost;
      const profitMargin = sale.revenue > 0 ? (profit / sale.revenue) * 100 : 0;

      console.log(`💰 Analysis for ${sale.recipeName}:`, {
        recipeFound: !!recipe,
        unitCost: totalCost,
        quantitySold: sale.quantitySold,
        totalCost: totalRecipeCost,
        revenue: sale.revenue,
        profit: profit,
        profitMargin: profitMargin.toFixed(1) + '%'
      });

      return {
        recipeId: sale.recipeId,
        recipeName: sale.recipeName,
        totalCost: totalRecipeCost,
        quantitySold: sale.quantitySold,
        revenue: sale.revenue,
        profit,
        profitMargin,
        period: sale.period
      };
    });

    // Sort by profit margin descending
    analyses.sort((a, b) => b.profitMargin - a.profitMargin);
    console.log('📈 COGSCalculationToast: Final analyses calculated:', {
      totalAnalyses: analyses.length,
      totalRevenue: analyses.reduce((sum, a) => sum + a.revenue, 0),
      totalProfit: analyses.reduce((sum, a) => sum + a.profit, 0),
      avgProfitMargin: (analyses.reduce((sum, a) => sum + a.profitMargin, 0) / analyses.length).toFixed(1) + '%'
    });
    setCostAnalyses(analyses);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      case 'custom': return 'Custom Period';
      default: return 'Weekly';
    }
  };

  return (
    <div className="cogs-calculation-toast">
      <div className="cogs-calculation-header">
        <h2>📊 COGS Calculation with Toast</h2>
        <p className="cogs-calculation-subtitle">
          Analyze recipe profitability and sales performance with Toast POS integration
        </p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Time Period Controls */}
      <div className="period-controls">
        <h3>Analysis Period</h3>
        <div className="period-selection">
          {(['daily', 'weekly', 'monthly', 'custom'] as TimePeriod[]).map(period => (
            <Button
              key={period}
              variant={selectedPeriod === period ? 'default' : 'secondary'}
              onClick={() => {
                console.log(`🔄 COGSCalculationToast: Period button clicked - changing from '${selectedPeriod}' to '${period}'`);
                setSelectedPeriod(period);
              }}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </Button>
          ))}
        </div>

        {selectedPeriod === 'custom' && (
          <div className="custom-date-range">
            <div className="date-input-group">
              <label>Start Date:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
            </div>
            <div className="date-input-group">
              <label>End Date:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Toast POS Connection Status */}
      <div className="toasthub-status">
        <h3>🔗 Toast POS Integration</h3>
        <div className="status-indicator">
          <span className={`status-dot ${toasthubService.getConnectionStatus().connected ? 'connected' : 'disconnected'}`}></span>
          <span>{toasthubService.getConnectionStatus().message}</span>
        </div>
        <p className="status-note">
          {toasthubService.getConnectionStatus().connected
            ? 'Live sales data is being pulled from Toast POS'
            : 'Configure Toast POS API credentials to enable live sales data integration'
          }
        </p>
      </div>

      {/* Cost Analysis Results */}
      <div className="analysis-results">
        <h3>📊 Recipe Profitability Analysis ({getPeriodLabel()})</h3>

        {isLoading ? (
          <div className="loading-state">Loading sales data...</div>
        ) : costAnalyses.length > 0 ? (
          <div className="analysis-table-container">
            <table className="analysis-table">
              <thead>
                <tr>
                  <th>Recipe</th>
                  <th>Qty Sold</th>
                  <th>Revenue</th>
                  <th>Total Cost</th>
                  <th>Profit</th>
                  <th>Margin %</th>
                </tr>
              </thead>
              <tbody>
                {costAnalyses.map((analysis, index) => (
                  <tr key={`${analysis.recipeId}-${index}`}>
                    <td className="recipe-name">{analysis.recipeName}</td>
                    <td className="quantity">{analysis.quantitySold}</td>
                    <td className="revenue">{formatCurrency(analysis.revenue)}</td>
                    <td className="cost">{formatCurrency(analysis.totalCost)}</td>
                    <td className={`profit ${analysis.profit >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(analysis.profit)}
                    </td>
                    <td className={`margin ${analysis.profitMargin >= 0 ? 'positive' : 'negative'}`}>
                      {analysis.profitMargin.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-data">
            <h4>No Sales Data Available</h4>
            <p>Connect to Toast POS to view recipe sales and profitability analysis</p>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {costAnalyses.length > 0 && (
        <div className="summary-stats">
          <h3>📈 Summary Statistics</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Revenue</div>
              <div className="stat-value">
                {formatCurrency(costAnalyses.reduce((sum, analysis) => sum + analysis.revenue, 0))}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Costs</div>
              <div className="stat-value">
                {formatCurrency(costAnalyses.reduce((sum, analysis) => sum + analysis.totalCost, 0))}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Profit</div>
              <div className="stat-value">
                {formatCurrency(costAnalyses.reduce((sum, analysis) => sum + analysis.profit, 0))}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Profit Margin</div>
              <div className="stat-value">
                {(costAnalyses.reduce((sum, analysis) => sum + analysis.profitMargin, 0) / costAnalyses.length).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default COGSCalculationToast;
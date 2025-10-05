import React, { useState, useEffect } from 'react';
import { Recipe } from '../../types';
import { apiService } from '../../services/apiService';
import { COGSCalculatorEntry } from '../../services/airtableService';
import { Button } from '../ui/button';
import './CostManagement.css';

interface RecipeRow {
  id: string;
  name: string;
  unitCost: number;
  quantitySold: number;
  totalCost: number;
}

const CostManagement: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [savedSessions, setSavedSessions] = useState<string[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);

  useEffect(() => {
    loadRecipes();
    loadSavedSessions();
  }, []);

  useEffect(() => {
    if (recipes.length > 0) {
      initializeRecipeRows();
    }
  }, [recipes]);

  const loadRecipes = async () => {
    setIsLoading(true);
    try {
      console.log('📋 Cost Management: Loading recipes via API service...');
      // Request all recipes (limit=1000 should be more than enough)
      const recipeData = await apiService.getRecipes(1000);
      setRecipes(recipeData);
      console.log('📋 Cost Management: Loaded recipes:', recipeData.length);
    } catch (err) {
      console.error('❌ Cost Management: Error loading recipes:', err);
      setError('Failed to load recipes from server');
    } finally {
      setIsLoading(false);
    }
  };

  const initializeRecipeRows = () => {
    // Sort recipes alphabetically by name
    const sortedRecipes = [...recipes].sort((a, b) => a.name.localeCompare(b.name));

    const rows: RecipeRow[] = sortedRecipes.map(recipe => {
      // Use totalCostWithQFactor if available, otherwise totalCost, otherwise 0
      const unitCost = recipe.totalCostWithQFactor || recipe.totalCost || 0;

      console.log(`💰 Recipe ${recipe.name}: unitCost=${unitCost}`);

      return {
        id: recipe.id,
        name: recipe.name,
        unitCost: unitCost,
        quantitySold: 0,
        totalCost: 0
      };
    });

    setRecipeRows(rows);
    console.log('📊 Initialized recipe rows:', rows.length);
  };

  const handleQuantityChange = (recipeId: string, quantity: number) => {
    setRecipeRows(prevRows =>
      prevRows.map(row => {
        if (row.id === recipeId) {
          const newQuantity = Math.max(0, quantity); // Ensure non-negative
          const newTotalCost = row.unitCost * newQuantity;
          console.log(`💰 Updated ${row.name}: qty=${newQuantity}, unit=${row.unitCost}, total=${newTotalCost}`);
          return {
            ...row,
            quantitySold: newQuantity,
            totalCost: newTotalCost
          };
        }
        return row;
      })
    );
  };

  const clearAllQuantities = () => {
    setRecipeRows(prevRows =>
      prevRows.map(row => ({
        ...row,
        quantitySold: 0,
        totalCost: 0
      }))
    );
    console.log('🧹 Cleared all quantities');
  };

  const loadSavedSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const sessions = await apiService.getCOGSSessionList();
      setSavedSessions(sessions);
      console.log('📂 Loaded saved sessions:', sessions.length);
    } catch (err) {
      console.error('❌ Error loading saved sessions:', err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleSaveSession = async () => {
    if (!newSessionName.trim()) {
      setError('Please enter a session name');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const entriesWithQuantity = recipeRows.filter(row => row.quantitySold > 0);
      if (entriesWithQuantity.length === 0) {
        setError('No quantities entered to save');
        return;
      }

      const entries: COGSCalculatorEntry[] = entriesWithQuantity.map(row => ({
        sessionName: newSessionName.trim(),
        recipeName: row.name,
        recipeId: row.id,
        unitCost: row.unitCost,
        quantitySold: row.quantitySold,
        totalCost: row.totalCost
      }));

      await apiService.saveCOGSSession(newSessionName.trim(), entries);
      console.log('💾 Session saved successfully:', newSessionName);
      setShowSaveDialog(false);
      setNewSessionName('');
      loadSavedSessions(); // Refresh the list
    } catch (err) {
      console.error('❌ Error saving session:', err);
      setError('Failed to save session');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadSession = async () => {
    if (!selectedSession) {
      setError('Please select a session to load');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const sessionData = await apiService.getCOGSSession(selectedSession);

      if (sessionData && sessionData.length > 0) {
        // Create a map of recipe ID to loaded quantity
        const loadedQuantities = new Map<string, number>();
        sessionData.forEach(entry => {
          loadedQuantities.set(entry.recipeId, entry.quantitySold);
        });

        // Update recipe rows with loaded quantities
        setRecipeRows(prevRows =>
          prevRows.map(row => {
            const loadedQuantity = loadedQuantities.get(row.id) || 0;
            return {
              ...row,
              quantitySold: loadedQuantity,
              totalCost: row.unitCost * loadedQuantity
            };
          })
        );

        console.log('📂 Session loaded successfully:', selectedSession);
        setShowLoadDialog(false);
        setSelectedSession('');
      } else {
        setError('No data found for selected session');
      }
    } catch (err) {
      console.error('❌ Error loading session:', err);
      setError('Failed to load session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingCSV(true);
      setError(null);

      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        setError('CSV file is empty or invalid');
        return;
      }

      // Parse CSV header
      const headers = lines[0].split(',').map(h => h.trim());
      const menuItemIndex = headers.findIndex(h => h.toLowerCase().includes('menu item'));
      const qtyIndex = headers.findIndex(h => h.toLowerCase() === 'qty');

      if (menuItemIndex === -1 || qtyIndex === -1) {
        setError('CSV must have "Menu Item" and "Qty" columns');
        return;
      }

      // Parse quantities by menu item
      const quantityMap = new Map<string, number>();

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length > Math.max(menuItemIndex, qtyIndex)) {
          const menuItem = values[menuItemIndex]?.trim().toUpperCase();
          const qty = parseFloat(values[qtyIndex]?.trim() || '0');

          if (menuItem && !isNaN(qty) && qty > 0) {
            quantityMap.set(menuItem, (quantityMap.get(menuItem) || 0) + qty);
          }
        }
      }

      console.log('📊 Parsed CSV quantities:', Object.fromEntries(quantityMap));
      console.log('📋 Available recipes:', recipeRows.map(r => r.name.toUpperCase()));

      // Match menu items to recipes and update quantities
      const matchLog: string[] = [];
      const matchedCsvItems = new Set<string>();

      // Convert Map to Array for iteration
      const quantityArray = Array.from(quantityMap.entries());

      setRecipeRows(prevRows => {
        const updatedRows = prevRows.map(row => {
          const recipeName = row.name.toUpperCase();
          let matchedQty = 0;

          // Try exact match first
          if (quantityMap.has(recipeName)) {
            matchedQty = quantityMap.get(recipeName)!;
            matchedCsvItems.add(recipeName);
            matchLog.push(`✅ EXACT: "${row.name}" ↔ CSV "${recipeName}" (qty: ${matchedQty})`);
          } else {
            // Try partial match
            for (let i = 0; i < quantityArray.length; i++) {
              const csvItem = quantityArray[i][0];
              const qty = quantityArray[i][1];
              if (csvItem.includes(recipeName) || recipeName.includes(csvItem)) {
                matchedQty = qty;
                matchedCsvItems.add(csvItem);
                matchLog.push(`✅ PARTIAL: "${row.name}" ↔ CSV "${csvItem}" (qty: ${matchedQty})`);
                break;
              }
            }
          }

          if (matchedQty > 0) {
            return {
              ...row,
              quantitySold: matchedQty,
              totalCost: row.unitCost * matchedQty
            };
          }
          return row;
        });

        return updatedRows;
      });

      console.log('🔍 Match details:', matchLog);

      // Find unmatched items
      const unmatchedItems = quantityArray
        .filter(([item]) => !matchedCsvItems.has(item))
        .map(([item]) => item);

      const matchedCount = matchLog.length;
      console.log(`✅ CSV uploaded: ${matchedCount} recipes matched, ${unmatchedItems.length} items unmatched`);

      if (unmatchedItems.length > 0) {
        console.warn('⚠️ Unmatched items:', unmatchedItems);
        setError(`Uploaded successfully. ${matchedCount} items matched. ${unmatchedItems.length} items not found in recipes.`);
      } else {
        setError(`Successfully uploaded! ${matchedCount} recipes populated from CSV.`);
      }

      // Clear the file input
      event.target.value = '';

    } catch (err) {
      console.error('❌ Error uploading CSV:', err);
      setError('Failed to parse CSV file');
    } finally {
      setIsUploadingCSV(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Filter recipes based on search term
  const filteredRecipeRows = recipeRows.filter(row =>
    row.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate totals
  const totalCost = recipeRows.reduce((sum, row) => sum + row.totalCost, 0);
  const totalQuantity = recipeRows.reduce((sum, row) => sum + row.quantitySold, 0);
  const recipesWithQuantity = recipeRows.filter(row => row.quantitySold > 0).length;

  return (
    <div className="cost-management">
      <div className="cost-management-header">
        <h2>💰 Cost Management Calculator</h2>
        <p className="cost-management-subtitle">
          Enter quantities sold to calculate total costs for each recipe
        </p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {isLoading ? (
        <div className="loading-state">Loading recipes...</div>
      ) : (
        <>
          {/* Controls */}
          <div className="spreadsheet-controls">
            <div className="search-section">
              <input
                type="text"
                placeholder="Search recipes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="action-buttons">
              <label className="upload-btn" title="Upload CSV file with Menu Item and Qty columns">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  style={{ display: 'none' }}
                  disabled={isUploadingCSV}
                />
                {isUploadingCSV ? 'Uploading...' : '📤 Upload CSV'}
              </label>
              <Button
                onClick={() => setShowSaveDialog(true)}
                variant="default"
                disabled={totalQuantity === 0 || isSaving}
              >
                {isSaving ? 'Saving...' : '💾 Save Session'}
              </Button>
              <Button
                onClick={() => setShowLoadDialog(true)}
                variant="secondary"
                disabled={savedSessions.length === 0 || isLoadingSessions}
              >
                📂 Load Session
              </Button>
              <Button
                onClick={clearAllQuantities}
                variant="outline"
                disabled={totalQuantity === 0}
              >
                Clear All
              </Button>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="summary-stats">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Total Recipes</div>
                <div className="stat-value">{recipeRows.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Items with Quantity</div>
                <div className="stat-value">{recipesWithQuantity}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Quantity</div>
                <div className="stat-value">{totalQuantity}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Cost</div>
                <div className="stat-value">{formatCurrency(totalCost)}</div>
              </div>
            </div>
          </div>

          {/* Spreadsheet Table */}
          <div className="spreadsheet-container">
            <table className="spreadsheet-table">
              <thead>
                <tr>
                  <th className="recipe-name-col">Recipe Name</th>
                  <th className="unit-cost-col">Unit Cost</th>
                  <th className="quantity-col">Quantity Sold</th>
                  <th className="total-cost-col">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecipeRows.map((row) => (
                  <tr key={row.id} className={row.quantitySold > 0 ? 'has-quantity' : ''}>
                    <td className="recipe-name">{row.name}</td>
                    <td className="unit-cost">{formatCurrency(row.unitCost)}</td>
                    <td className="quantity-input">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={row.quantitySold || ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                          if (!isNaN(value)) {
                            handleQuantityChange(row.id, value);
                          }
                        }}
                        className="quantity-field"
                        placeholder="0"
                      />
                    </td>
                    <td className="total-cost">
                      <span className={row.totalCost > 0 ? 'has-cost' : ''}>
                        {formatCurrency(row.totalCost)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredRecipeRows.length === 0 && searchTerm && (
              <div className="no-results">
                <p>No recipes found matching "{searchTerm}"</p>
              </div>
            )}
          </div>

          {/* Save Session Dialog */}
          {showSaveDialog && (
            <div className="dialog-overlay">
              <div className="dialog">
                <div className="dialog-header">
                  <h3>💾 Save Calculator Session</h3>
                  <Button
                    onClick={() => setShowSaveDialog(false)}
                    variant="ghost"
                    size="icon-sm"
                  >
                    ×
                  </Button>
                </div>
                <div className="dialog-content">
                  <p>Save your current calculator state with a custom name:</p>
                  <input
                    type="text"
                    placeholder="Enter session name..."
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    className="session-name-input"
                    disabled={isSaving}
                  />
                  <div className="dialog-actions">
                    <Button
                      onClick={() => setShowSaveDialog(false)}
                      variant="outline"
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveSession}
                      variant="default"
                      disabled={!newSessionName.trim() || isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Load Session Dialog */}
          {showLoadDialog && (
            <div className="dialog-overlay">
              <div className="dialog">
                <div className="dialog-header">
                  <h3>📂 Load Calculator Session</h3>
                  <Button
                    onClick={() => setShowLoadDialog(false)}
                    variant="ghost"
                    size="icon-sm"
                  >
                    ×
                  </Button>
                </div>
                <div className="dialog-content">
                  <p>Select a saved session to restore:</p>
                  {savedSessions.length > 0 ? (
                    <select
                      value={selectedSession}
                      onChange={(e) => setSelectedSession(e.target.value)}
                      className="session-select"
                      disabled={isLoading}
                    >
                      <option value="">Select a session...</option>
                      {savedSessions.map((sessionName) => (
                        <option key={sessionName} value={sessionName}>
                          {sessionName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="no-sessions">No saved sessions found</p>
                  )}
                  <div className="dialog-actions">
                    <Button
                      onClick={() => setShowLoadDialog(false)}
                      variant="outline"
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleLoadSession}
                      variant="default"
                      disabled={!selectedSession || isLoading}
                    >
                      {isLoading ? 'Loading...' : 'Load'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="instructions">
            <h3>📋 How to Use</h3>
            <ul>
              <li><strong>Upload CSV:</strong> Click "Upload CSV" to import quantities from a CSV file (requires "Menu Item" and "Qty" columns)</li>
              <li><strong>Manual Entry:</strong> Enter the quantity sold for each recipe in the "Quantity Sold" column</li>
              <li>The system will automatically calculate the total cost (Unit Cost × Quantity)</li>
              <li>Use the search box to quickly find specific recipes</li>
              <li>Save your current calculations using "Save Session" for future reference</li>
              <li>Load previously saved sessions using "Load Session"</li>
              <li>Click "Clear All" to reset all quantities to zero</li>
              <li>Total costs are shown in the summary section above</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default CostManagement;
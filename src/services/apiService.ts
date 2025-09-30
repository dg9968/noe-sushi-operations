import { Recipe, Ingredient } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

interface SearchResponse {
  success: boolean;
  data: Array<{id: string, name: string, unitCost?: number}>;
  query: string;
  totalCount: number;
}

interface RecipesByCategory {
  [category: string]: Array<{
    id: string;
    name: string;
    description: string;
    servings: number;
  }>;
}

interface RecipeListResponse {
  success: boolean;
  data: RecipesByCategory;
  totalRecipes: number;
  categories: string[];
}

class ApiService {
  private async fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || result.error || 'API request failed');
      }

      return result.data;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Check if API is available
  async isAvailable(): Promise<boolean> {
    try {
      // Remove /api from base URL for health check since it's at root level
      const baseUrl = API_BASE_URL.replace('/api', '');
      const response = await fetch(`${baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  // Recipe methods - lightweight list
  async getRecipeList(searchQuery?: string): Promise<RecipesByCategory> {
    // Use the lightweight list endpoint with search support
    const searchParams = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : '';
    const url = `${API_BASE_URL}/recipes/list${searchParams}`;
    console.log(`ApiService.getRecipeList - URL: ${url}, SearchQuery: "${searchQuery || 'none'}"`);

    const response = await fetch(url);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || result.error || 'Failed to fetch recipe list');
    }

    return result.data;
  }

  // Recipe methods - full data (HEAVY - use sparingly)
  async getRecipes(limit: number = 10): Promise<Recipe[]> {
    return this.fetchApi<Recipe[]>(`/recipes?limit=${limit}`);
  }

  async getRecipeById(id: string, qFactor: number = 10): Promise<Recipe> {
    return this.fetchApi<Recipe>(`/recipes/${id}?qFactor=${qFactor}`);
  }

  async createRecipe(recipe: Omit<Recipe, 'id'>): Promise<Recipe> {
    return this.fetchApi<Recipe>('/recipes', {
      method: 'POST',
      body: JSON.stringify(recipe),
    });
  }

  async updateRecipe(id: string, recipe: Partial<Recipe>): Promise<Recipe> {
    return this.fetchApi<Recipe>(`/recipes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(recipe),
    });
  }

  async deleteRecipe(id: string): Promise<void> {
    await this.fetchApi<void>(`/recipes/${id}`, {
      method: 'DELETE',
    });
  }

  // Ingredient search
  async searchIngredients(query: string = ''): Promise<Array<{id: string, name: string, unitCost?: number}>> {
    const searchParams = new URLSearchParams();
    if (query) {
      searchParams.append('q', query);
    }

    const result = await this.fetchApi<Array<{id: string, name: string, unitCost?: number}>>(`/recipes/ingredients/search?${searchParams}`);
    return result || [];
  }

  // Get all ingredients (with empty query)
  async getAllIngredients(): Promise<Array<{id: string, name: string, unitCost?: number}>> {
    return this.searchIngredients('');
  }
}

export const apiService = new ApiService();

// Make available globally for testing
if (typeof window !== 'undefined') {
  (window as any).apiService = apiService;
}
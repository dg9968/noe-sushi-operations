import { Recipe, Ingredient } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

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
      const response = await fetch(`${API_BASE_URL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  // Recipe methods
  async getRecipes(): Promise<Recipe[]> {
    return this.fetchApi<Recipe[]>('/api/recipes');
  }

  async getRecipeById(id: string): Promise<Recipe> {
    return this.fetchApi<Recipe>(`/api/recipes/${id}`);
  }

  async createRecipe(recipe: Omit<Recipe, 'id'>): Promise<Recipe> {
    return this.fetchApi<Recipe>('/api/recipes', {
      method: 'POST',
      body: JSON.stringify(recipe),
    });
  }

  async updateRecipe(id: string, recipe: Partial<Recipe>): Promise<Recipe> {
    return this.fetchApi<Recipe>(`/api/recipes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(recipe),
    });
  }

  async deleteRecipe(id: string): Promise<void> {
    await this.fetchApi<void>(`/api/recipes/${id}`, {
      method: 'DELETE',
    });
  }

  // Ingredient search
  async searchIngredients(query: string = ''): Promise<Array<{id: string, name: string, unitCost?: number}>> {
    const searchParams = new URLSearchParams();
    if (query) {
      searchParams.append('q', query);
    }

    const result = await this.fetchApi<Array<{id: string, name: string, unitCost?: number}>>(`/api/recipes/ingredients/search?${searchParams}`);
    return result || [];
  }

  // Get all ingredients (with empty query)
  async getAllIngredients(): Promise<Array<{id: string, name: string, unitCost?: number}>> {
    return this.searchIngredients('');
  }
}

export const apiService = new ApiService();
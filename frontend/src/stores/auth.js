import { defineStore } from 'pinia';
import axios from 'axios';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    isAuthenticated: !!localStorage.getItem('token')
  }),

  actions: {
    async login(password) {
      try {
        const response = await axios.post('/api/auth/login', { password });
        this.token = response.data.token;
        this.isAuthenticated = true;
        localStorage.setItem('token', this.token);

        // Set default Authorization header for all requests
        axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error.response?.data?.error || 'Login failed'
        };
      }
    },

    logout() {
      this.token = null;
      this.isAuthenticated = false;
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    },

    initAuth() {
      if (this.token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
      }
    }
  }
});

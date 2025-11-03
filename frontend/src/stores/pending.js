import { defineStore } from 'pinia';
import axios from 'axios';

export const usePendingStore = defineStore('pending', {
  state: () => ({
    hasPending: false,
    totalCount: 0,
    services: [], // Array of { service, hasPending, count }
    showPanel: false,
    loading: false
  }),

  actions: {
    async checkPending() {
      try {
        const response = await axios.get('/api/pending');
        if (response.data.success) {
          const data = response.data.data;
          console.log('Pending check result:', data);
          this.hasPending = data.hasPending;
          this.totalCount = data.totalCount;
          this.services = data.services;
        }
      } catch (error) {
        console.error('Failed to check pending changes:', error);
        // Reset to safe defaults on error
        this.hasPending = false;
        this.totalCount = 0;
        this.services = [];
      }
    },

    async applyService(serviceName) {
      this.loading = true;
      try {
        console.log(`Applying ${serviceName} changes...`);
        const response = await axios.post(`/api/pending/apply/${serviceName}`);
        console.log(`Apply ${serviceName} response:`, response.data);

        if (response.data.success) {
          // Small delay to allow pfSense to update its state
          await new Promise(resolve => setTimeout(resolve, 500));

          // Re-check pending changes after apply
          console.log('Re-checking pending changes after apply...');
          await this.checkPending();
        }
        return response.data;
      } catch (error) {
        console.error(`Failed to apply ${serviceName} changes:`, error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    togglePanel() {
      this.showPanel = !this.showPanel;
    },

    closePanel() {
      this.showPanel = false;
    }
  }
});

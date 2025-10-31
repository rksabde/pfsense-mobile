<template>
  <div class="layout">
    <NavigationBar />

    <main class="main-content">
      <div class="container">
        <div class="header">
          <h1 class="page-title">Connected Clients</h1>
          <button @click="fetchClients" class="refresh-btn" :disabled="loading">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" :class="{ spinning: loading }">
              <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Refresh
          </button>
        </div>

        <div v-if="loading && clients.length === 0" class="loading">Loading clients...</div>

        <div v-else-if="error" class="error-card">
          <p>{{ error }}</p>
          <button @click="fetchClients" class="btn-secondary">Retry</button>
        </div>

        <div v-else-if="clients.length === 0" class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.2"/>
          </svg>
          <p>No connected clients found</p>
        </div>

        <div v-else class="clients-list">
          <div v-for="client in clients" :key="client.mac" class="client-card">
            <div class="client-info">
              <div class="client-header">
                <h3 class="client-name">{{ client.hostname }}</h3>
                <span :class="['status-badge', client.blocked ? 'blocked' : 'active']">
                  {{ client.blocked ? 'Blocked' : 'Active' }}
                </span>
              </div>

              <div class="client-details">
                <div class="detail-row">
                  <span class="detail-label">MAC:</span>
                  <span class="detail-value">{{ client.mac }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">IP:</span>
                  <span class="detail-value">{{ client.ip || 'N/A' }}</span>
                </div>
                <div v-if="client.interface" class="detail-row">
                  <span class="detail-label">Interface:</span>
                  <span class="detail-value">{{ client.interface }}</span>
                </div>
              </div>
            </div>

            <div class="client-actions">
              <button
                @click="toggleBlock(client)"
                :class="['toggle-btn', client.blocked ? 'unblock' : 'block']"
                :disabled="processingMAC === client.mac"
              >
                <svg v-if="processingMAC === client.mac" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="spinning">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.2"/>
                  <path d="M12 2a10 10 0 0110 10" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
                </svg>
                <template v-else>
                  {{ client.blocked ? 'Unblock' : 'Block' }}
                </template>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import NavigationBar from '../components/NavigationBar.vue';

const clients = ref([]);
const loading = ref(true);
const error = ref('');
const processingMAC = ref('');

const fetchClients = async () => {
  loading.value = true;
  error.value = '';

  try {
    const response = await axios.get('/api/clients/connected');
    if (response.data.success) {
      clients.value = response.data.data;
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to load clients';
  } finally {
    loading.value = false;
  }
};

const toggleBlock = async (client) => {
  processingMAC.value = client.mac;

  try {
    const endpoint = client.blocked ? 'unblock' : 'block';
    const response = await axios.post(`/api/clients/${client.mac}/${endpoint}`);

    if (response.data.success) {
      // Update local state
      client.blocked = !client.blocked;
    } else {
      error.value = response.data.error || 'Operation failed';
    }
  } catch (err) {
    error.value = err.response?.data?.error || `Failed to ${client.blocked ? 'unblock' : 'block'} device`;
  } finally {
    processingMAC.value = '';
  }
};

onMounted(() => {
  fetchClients();

  // Auto-refresh every 30 seconds
  const interval = setInterval(fetchClients, 30000);

  // Cleanup on unmount
  onUnmounted(() => clearInterval(interval));
});
</script>

<script>
import { onUnmounted } from 'vue';
export default {
  name: 'ConnectedClientsView'
};
</script>

<style scoped>
.layout {
  padding-top: 4rem;
  padding-bottom: 5rem;
  min-height: 100vh;
}

.main-content {
  padding: 1.5rem 1rem;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  gap: 1rem;
}

.page-title {
  font-size: 1.875rem;
  font-weight: 700;
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: var(--bg-white);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading {
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary);
}

.error-card {
  background: #fee;
  border: 1px solid var(--danger-color);
  border-radius: 0.5rem;
  padding: 1.5rem;
  text-align: center;
  color: var(--danger-color);
}

.btn-secondary {
  margin-top: 1rem;
  padding: 0.5rem 1.5rem;
  background: var(--bg-white);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  font-weight: 500;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary);
}

.empty-state svg {
  margin-bottom: 1rem;
  color: var(--text-secondary);
}

.clients-list {
  display: grid;
  gap: 1rem;
}

.client-card {
  background: var(--bg-white);
  border-radius: 0.75rem;
  padding: 1.25rem;
  box-shadow: var(--shadow);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.client-info {
  flex: 1;
  min-width: 0;
}

.client-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  gap: 0.5rem;
}

.client-name {
  font-size: 1.125rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.status-badge.active {
  background: #d1fae5;
  color: var(--success-color);
}

.status-badge.blocked {
  background: #fee2e2;
  color: var(--danger-color);
}

.client-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-row {
  display: flex;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.detail-label {
  color: var(--text-secondary);
  font-weight: 500;
  min-width: 80px;
}

.detail-value {
  color: var(--text-primary);
  font-family: 'Courier New', monospace;
}

.client-actions {
  flex-shrink: 0;
}

.toggle-btn {
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
  transition: all 0.2s;
  min-width: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-btn.block {
  background: var(--danger-color);
  color: white;
}

.toggle-btn.block:hover:not(:disabled) {
  background: #dc2626;
}

.toggle-btn.unblock {
  background: var(--success-color);
  color: white;
}

.toggle-btn.unblock:hover:not(:disabled) {
  background: #059669;
}

.toggle-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (min-width: 768px) {
  .layout {
    padding-bottom: 1rem;
  }

  .clients-list {
    grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
  }

  .client-details {
    flex-direction: row;
    gap: 1.5rem;
  }
}
</style>

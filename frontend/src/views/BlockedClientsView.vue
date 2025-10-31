<template>
  <div class="layout">
    <NavigationBar />

    <main class="main-content">
      <div class="container">
        <div class="header">
          <h1 class="page-title">Blocked Clients</h1>
          <button @click="fetchBlocked" class="refresh-btn" :disabled="loading">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" :class="{ spinning: loading }">
              <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Refresh
          </button>
        </div>

        <div v-if="loading && blockedClients.length === 0" class="loading">Loading blocked clients...</div>

        <div v-else-if="error" class="error-card">
          <p>{{ error }}</p>
          <button @click="fetchBlocked" class="btn-secondary">Retry</button>
        </div>

        <div v-else-if="blockedClients.length === 0" class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <p>No blocked clients</p>
          <span class="empty-subtitle">Block devices from the Connected Clients page</span>
        </div>

        <div v-else class="clients-list">
          <div v-for="client in blockedClients" :key="client.mac" class="client-card">
            <div class="client-info">
              <div class="client-header">
                <h3 class="client-name">{{ client.hostname }}</h3>
                <span :class="['status-badge', client.status === 'offline' ? 'offline' : 'blocked']">
                  {{ client.status === 'offline' ? 'Offline' : 'Blocked' }}
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
                @click="unblockDevice(client)"
                class="unblock-btn"
                :disabled="processingMAC === client.mac"
              >
                <svg v-if="processingMAC === client.mac" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="spinning">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.2"/>
                  <path d="M12 2a10 10 0 0110 10" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
                </svg>
                <template v-else>
                  Unblock
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

const blockedClients = ref([]);
const loading = ref(true);
const error = ref('');
const processingMAC = ref('');

const fetchBlocked = async () => {
  loading.value = true;
  error.value = '';

  try {
    const response = await axios.get('/api/clients/blocked');
    if (response.data.success) {
      blockedClients.value = response.data.data;
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to load blocked clients';
  } finally {
    loading.value = false;
  }
};

const unblockDevice = async (client) => {
  processingMAC.value = client.mac;

  try {
    const response = await axios.post(`/api/clients/${client.mac}/unblock`);

    if (response.data.success) {
      // Remove from list
      blockedClients.value = blockedClients.value.filter(c => c.mac !== client.mac);
    } else {
      error.value = response.data.error || 'Failed to unblock device';
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to unblock device';
  } finally {
    processingMAC.value = '';
  }
};

onMounted(() => {
  fetchBlocked();

  // Auto-refresh every 30 seconds
  const interval = setInterval(fetchBlocked, 30000);

  // Cleanup on unmount
  onUnmounted(() => clearInterval(interval));
});
</script>

<script>
import { onUnmounted } from 'vue';
export default {
  name: 'BlockedClientsView'
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

.empty-subtitle {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.875rem;
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

.status-badge.blocked {
  background: #fee2e2;
  color: var(--danger-color);
}

.status-badge.offline {
  background: #f3f4f6;
  color: var(--text-secondary);
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

.unblock-btn {
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
  transition: all 0.2s;
  min-width: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--success-color);
  color: white;
}

.unblock-btn:hover:not(:disabled) {
  background: #059669;
}

.unblock-btn:disabled {
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

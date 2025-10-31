<template>
  <div class="layout">
    <NavigationBar />

    <main class="main-content">
      <div class="container">
        <h1 class="page-title">Dashboard</h1>

        <div v-if="loading" class="loading">Loading statistics...</div>

        <div v-else-if="error" class="error-card">
          <p>{{ error }}</p>
          <button @click="fetchStats" class="btn-secondary">Retry</button>
        </div>

        <div v-else class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon connected">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="stat-info">
              <p class="stat-label">Connected Devices</p>
              <p class="stat-value">{{ stats.totalConnected }}</p>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon blocked">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <path d="M4.93 4.93l14.14 14.14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="stat-info">
              <p class="stat-label">Total Blocked</p>
              <p class="stat-value">{{ stats.totalBlocked }}</p>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon active-blocked">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="stat-info">
              <p class="stat-label">Active Blocked</p>
              <p class="stat-value">{{ stats.activeBlocked }}</p>
            </div>
          </div>
        </div>

        <div v-if="stats.systemInfo" class="system-info">
          <h2>System Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Hostname:</span>
              <span class="info-value">{{ stats.systemInfo.hostname || 'N/A' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Version:</span>
              <span class="info-value">{{ stats.systemInfo.version || 'N/A' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Uptime:</span>
              <span class="info-value">{{ stats.systemInfo.uptime || 'N/A' }}</span>
            </div>
          </div>
        </div>

        <div class="quick-actions">
          <h2>Quick Actions</h2>
          <div class="action-buttons">
            <router-link to="/clients" class="action-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="2"/>
                <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/>
              </svg>
              View Connected Clients
            </router-link>

            <router-link to="/blocked" class="action-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <path d="M4.93 4.93l14.14 14.14" stroke="currentColor" stroke-width="2"/>
              </svg>
              Manage Blocked Devices
            </router-link>
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

const stats = ref({
  totalConnected: 0,
  totalBlocked: 0,
  activeBlocked: 0,
  systemInfo: null
});
const loading = ref(true);
const error = ref('');

const fetchStats = async () => {
  loading.value = true;
  error.value = '';

  try {
    const response = await axios.get('/api/stats/overview');
    if (response.data.success) {
      stats.value = response.data.data;
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to load statistics';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchStats();
});
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

.page-title {
  font-size: 1.875rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
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

.stats-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: var(--bg-white);
  border-radius: 0.75rem;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: var(--shadow);
}

.stat-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon.connected {
  background: #dbeafe;
  color: var(--primary-color);
}

.stat-icon.blocked {
  background: #fee2e2;
  color: var(--danger-color);
}

.stat-icon.active-blocked {
  background: #fef3c7;
  color: var(--warning-color);
}

.stat-info {
  flex: 1;
}

.stat-label {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
}

.system-info,
.quick-actions {
  background: var(--bg-white);
  border-radius: 0.75rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: var(--shadow);
}

.system-info h2,
.quick-actions h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-color);
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.info-value {
  color: var(--text-primary);
}

.action-buttons {
  display: grid;
  gap: 1rem;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--bg-gray);
  color: var(--text-primary);
  text-decoration: none;
  border-radius: 0.5rem;
  font-weight: 500;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--primary-color);
  color: white;
}

@media (min-width: 768px) {
  .layout {
    padding-bottom: 1rem;
  }

  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .action-buttons {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

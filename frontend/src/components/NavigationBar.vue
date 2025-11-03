<template>
  <nav class="navbar">
    <div class="nav-container">
      <div class="nav-brand">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" fill="currentColor" opacity="0.2"/>
          <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span class="brand-text">WiFi Manager</span>
      </div>

      <!-- Bell Icon Notification -->
      <div class="notification-wrapper">
        <button @click="togglePanel" class="bell-btn" :class="{ active: pendingStore.hasPending }" title="Pending Changes">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span v-if="pendingStore.totalCount > 0" class="badge">{{ pendingStore.totalCount }}</span>
        </button>

        <!-- Expandable Panel -->
        <div v-if="pendingStore.showPanel" class="pending-panel" @click.stop>
          <div class="panel-header">
            <h3>Pending Changes</h3>
            <button @click="pendingStore.closePanel" class="close-btn">✕</button>
          </div>

          <div v-if="pendingStore.services.length === 0" class="no-changes">
            No pending changes
          </div>

          <div v-else class="services-list">
            <div v-for="service in pendingStore.services" :key="service.service" class="service-item">
              <div class="service-info">
                <span class="service-name">{{ formatServiceName(service.service) }}</span>
                <span class="change-count">{{ service.count }} change(s)</span>
              </div>
              <button @click="applyService(service.service)" class="apply-btn" :disabled="pendingStore.loading">
                {{ pendingStore.loading ? 'Applying...' : 'Apply' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <button @click="handleLogout" class="logout-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="logout-text">Logout</span>
      </button>
    </div>
  </nav>

  <div class="bottom-nav">
    <router-link to="/" class="nav-item">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9 22V12h6v10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>Home</span>
    </router-link>

    <router-link to="/clients" class="nav-item">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>Clients</span>
    </router-link>

    <router-link to="/blocked" class="nav-item">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M4.93 4.93l14.14 14.14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>Blocked</span>
    </router-link>

    <router-link to="/groups" class="nav-item">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
        <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
        <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
        <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
      </svg>
      <span>Groups</span>
    </router-link>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { usePendingStore } from '../stores/pending';

const router = useRouter();
const authStore = useAuthStore();
const pendingStore = usePendingStore();

const handleLogout = () => {
  authStore.logout();
  router.push('/login');
};

const togglePanel = () => {
  pendingStore.togglePanel();
};

const formatServiceName = (service) => {
  const names = {
    dhcp: 'DHCP Server',
    firewall: 'Firewall'
  };
  return names[service] || service.toUpperCase();
};

const applyService = async (serviceName) => {
  try {
    await pendingStore.applyService(serviceName);
    // Success - the store will update automatically
  } catch (error) {
    alert(`Failed to apply ${serviceName} changes: ${error.message}`);
  }
};

// Close panel when clicking outside
const handleClickOutside = (event) => {
  if (pendingStore.showPanel && !event.target.closest('.notification-wrapper')) {
    pendingStore.closePanel();
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  // Initial check for pending changes
  pendingStore.checkPending();
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.navbar {
  background: var(--bg-white);
  border-bottom: 1px solid var(--border-color);
  padding: 1rem;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--primary-color);
}

.brand-text {
  font-weight: 600;
  font-size: 1.125rem;
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 0.5rem;
  transition: all 0.2s;
}

.logout-btn:hover {
  background: var(--bg-gray);
  color: var(--text-primary);
}

.logout-text {
  display: none;
}

/* Notification Bell */
.notification-wrapper {
  position: relative;
  margin-left: auto;
  margin-right: 1rem;
}

.bell-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  background: transparent;
  color: var(--text-secondary);
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.bell-btn:hover,
.bell-btn.active {
  background: var(--bg-gray);
  color: var(--primary-color);
}

.bell-btn.active svg {
  animation: ring 0.5s ease-in-out;
}

@keyframes ring {
  0%, 100% { transform: rotate(0); }
  25% { transform: rotate(-15deg); }
  75% { transform: rotate(15deg); }
}

.badge {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  background: var(--danger-color);
  color: white;
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  border-radius: 0.75rem;
  min-width: 1rem;
  text-align: center;
}

.pending-panel {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.5rem;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  width: 320px;
  max-height: 400px;
  overflow-y: auto;
  z-index: 200;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.panel-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 1.25rem;
  padding: 0.25rem;
  cursor: pointer;
  transition: color 0.2s;
}

.close-btn:hover {
  color: var(--text-primary);
}

.no-changes {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.services-list {
  padding: 0.5rem;
}

.service-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  border-radius: 0.375rem;
  background: var(--bg-gray);
  margin-bottom: 0.5rem;
}

.service-item:last-child {
  margin-bottom: 0;
}

.service-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.service-name {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.change-count {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.apply-btn {
  padding: 0.5rem 1rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.apply-btn:hover:not(:disabled) {
  background: #2563eb;
}

.apply-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-white);
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: space-around;
  padding: 0.5rem 0;
  z-index: 100;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 1rem;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.75rem;
  transition: color 0.2s;
  min-width: 70px;
}

.nav-item:hover {
  color: var(--primary-color);
}

.nav-item.router-link-active {
  color: var(--primary-color);
}

.nav-item svg {
  flex-shrink: 0;
}

@media (min-width: 768px) {
  .logout-text {
    display: inline;
  }

  .bottom-nav {
    position: static;
    background: transparent;
    border: none;
    justify-content: flex-start;
    gap: 1rem;
    padding: 1rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .nav-item {
    flex-direction: row;
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
  }

  .nav-item:hover {
    background: var(--bg-gray);
  }
}
</style>

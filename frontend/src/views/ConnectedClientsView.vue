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
                  <span class="detail-value">
                    {{ client.ip || 'N/A' }}
                    <button
                      v-if="client.ip && client.mac && isIPInDHCPRange(client.ip)"
                      @click="openStaticIPModal(client)"
                      class="ip-plus-btn"
                      title="Set static IP (move out of DHCP range)"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                    </button>
                  </span>
                </div>
                <div v-if="client.interface" class="detail-row">
                  <span class="detail-label">Interface:</span>
                  <span class="detail-value">{{ client.interface }}</span>
                </div>
              </div>
            </div>

            <div class="client-actions">
              <button
                @click="toggleAddToGroup(client)"
                class="icon-btn add-to-group-btn"
                :disabled="processingAdd === client.ip"
                title="Add to group"
              >
                <svg v-if="processingAdd === client.ip" class="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.25"/>
                  <path d="M12 2a10 10 0 0110 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>

              <button
                @click="toggleBlock(client)"
                :class="['icon-btn', 'block-btn', client.blocked ? 'blocked' : 'unblocked']"
                :disabled="processingMAC === client.mac"
                :title="client.blocked ? 'Unblock device' : 'Block device'"
              >
                <svg v-if="processingMAC === client.mac" class="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.25"/>
                  <path d="M12 2a10 10 0 0110 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <svg v-else-if="client.blocked" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
                  <path d="M4 4l16 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>

            <!-- Add to Group Dropdown -->
            <div v-if="showDropdown === client.ip" class="add-group-dropdown" @click.stop>
              <input
                ref="searchInput"
                v-model="groupSearch"
                type="text"
                placeholder="Search groups..."
                class="group-search"
                @click.stop
              />
              <div class="group-list">
                <div v-if="filteredGroups.length === 0" class="no-groups">
                  {{ groupSearch ? 'No groups found' : 'No groups available' }}
                </div>
                <div
                  v-for="group in filteredGroups"
                  :key="group.name"
                  :class="['group-item', { disabled: group.isProtected }]"
                  @click="addToGroup(client.ip, group)"
                >
                  <span class="group-name">{{ group.name }}</span>
                  <span class="group-count">{{ group.address?.length || 0 }} members</span>
                  <span v-if="group.isProtected" class="protected-label">Protected</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Static IP Modal -->
    <div v-if="showStaticIPModal" class="modal-overlay" @click.self="closeStaticIPModal">
      <div class="modal">
        <h2>Set Static IP Reservation</h2>
        <div class="modal-info">
          <p><strong>Device:</strong> {{ staticIPData.hostname }}</p>
          <p><strong>MAC:</strong> {{ staticIPData.mac }}</p>
          <p><strong>Current IP:</strong> {{ staticIPData.currentIP }}</p>
        </div>

        <div class="form-group">
          <label for="static-ip">Static IP Address</label>
          <input
            id="static-ip"
            v-model="staticIPInput"
            type="text"
            placeholder="e.g., 192.168.1.50"
            @input="validateIP"
            :class="{ error: validationError }"
          />
          <p v-if="validationError" class="error-text">{{ validationError }}</p>
          <p class="helper-text">
            Choose an IP outside DHCP range ({{ dhcpStart }}-{{ dhcpEnd }})
          </p>
        </div>

        <div class="modal-actions">
          <button @click="closeStaticIPModal" class="btn-secondary">Cancel</button>
          <button
            @click="saveStaticIP"
            class="btn-primary"
            :disabled="saving || !!validationError || !staticIPInput"
          >
            {{ saving ? 'Saving...' : 'Save Static IP' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import axios from 'axios';
import NavigationBar from '../components/NavigationBar.vue';
import { usePendingStore } from '../stores/pending';

const clients = ref([]);
const loading = ref(true);
const error = ref('');
const processingMAC = ref('');
const processingAdd = ref('');
const showDropdown = ref('');
const groupSearch = ref('');
const groups = ref([]);
const searchInput = ref(null);
const showStaticIPModal = ref(false);
const staticIPInput = ref('');
const staticIPData = ref({
  hostname: '',
  mac: '',
  currentIP: ''
});
const validationError = ref('');
const saving = ref(false);
const pendingStore = usePendingStore();

const PROTECTED_GROUPS = ['BLOCKED', 'WAN', 'LAN'];
const dhcpStart = 100; // From env
const dhcpEnd = 200; // From env

// Check if IP is in DHCP range (only show PLUS icon for IPs in DHCP range)
const isIPInDHCPRange = (ip) => {
  if (!ip) return false;
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  const lastOctet = parseInt(parts[3]);
  return lastOctet >= dhcpStart && lastOctet <= dhcpEnd;
};

const filteredGroups = computed(() => {
  const search = groupSearch.value.toLowerCase();
  return groups.value.filter(g =>
    g.name.toLowerCase().includes(search) ||
    g.descr?.toLowerCase().includes(search)
  );
});

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
    // Use IP address for blocking (pfSense only accepts IP/alias/FQDN, not MAC)
    if (!client.ip) {
      error.value = 'Cannot block device without IP address';
      processingMAC.value = '';
      return;
    }

    const endpoint = client.blocked ? 'unblock' : 'block';
    const response = await axios.post(`/api/blocked/${encodeURIComponent(client.ip)}/${endpoint}`);

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

const fetchGroups = async () => {
  try {
    const response = await axios.get('/api/groups');
    if (response.data.success) {
      groups.value = response.data.data
        .filter(g => g.name !== 'BLOCKED')
        .map(g => ({
          ...g,
          isProtected: PROTECTED_GROUPS.includes(g.name)
        }));
    }
  } catch (err) {
    console.error('Failed to load groups:', err);
  }
};

const toggleAddToGroup = async (client) => {
  if (showDropdown.value === client.ip) {
    showDropdown.value = '';
    groupSearch.value = '';
  } else {
    showDropdown.value = client.ip;
    groupSearch.value = '';
    if (groups.value.length === 0) {
      await fetchGroups();
    }
    await nextTick();
    searchInput.value?.[0]?.focus();
  }
};

const addToGroup = async (clientIp, group) => {
  if (group.isProtected) return;

  processingAdd.value = clientIp;
  showDropdown.value = '';

  try {
    const response = await axios.post(`/api/groups/${group.name}/members`, {
      member: clientIp
    });

    if (response.data.success) {
      error.value = '';
      // Show success message briefly
      const successMsg = `Added to ${group.name}`;
      error.value = successMsg;
      setTimeout(() => {
        if (error.value === successMsg) error.value = '';
      }, 3000);
    } else {
      error.value = response.data.error || 'Failed to add to group';
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to add to group';
  } finally {
    processingAdd.value = '';
    groupSearch.value = '';
  }
};

const handleClickOutside = (event) => {
  if (showDropdown.value && !event.target.closest('.add-group-dropdown') && !event.target.closest('.add-to-group-btn')) {
    showDropdown.value = '';
    groupSearch.value = '';
  }
};

const openStaticIPModal = (client) => {
  staticIPData.value = {
    hostname: client.hostname || 'Unknown Device',
    mac: client.mac,
    currentIP: client.ip
  };
  staticIPInput.value = client.ip;
  validationError.value = '';
  showStaticIPModal.value = true;
};

const closeStaticIPModal = () => {
  showStaticIPModal.value = false;
  staticIPInput.value = '';
  validationError.value = '';
  staticIPData.value = { hostname: '', mac: '', currentIP: '' };
};

const validateIP = async () => {
  const ip = staticIPInput.value.trim();

  // Clear previous error
  validationError.value = '';

  if (!ip) {
    validationError.value = 'IP address is required';
    return;
  }

  // Basic IP format validation
  const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipRegex);

  if (!match) {
    validationError.value = 'Invalid IP address format';
    return;
  }

  // Validate each octet is 0-255
  const octets = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), parseInt(match[4])];
  if (octets.some(octet => octet < 0 || octet > 255)) {
    validationError.value = 'IP address octets must be between 0-255';
    return;
  }

  // Check if in DHCP range
  const lastOctet = octets[3];
  if (lastOctet >= dhcpStart && lastOctet <= dhcpEnd) {
    validationError.value = `IP address cannot be in DHCP range (${dhcpStart}-${dhcpEnd})`;
    return;
  }

  // Validate subnet matches current IP
  const currentOctets = staticIPData.value.currentIP.split('.').map(Number);
  if (octets[0] !== currentOctets[0] || octets[1] !== currentOctets[1] || octets[2] !== currentOctets[2]) {
    validationError.value = 'IP must be in the same subnet as current IP';
    return;
  }
};

const saveStaticIP = async () => {
  // Validate first
  await validateIP();
  if (validationError.value) return;

  saving.value = true;

  try {
    const response = await axios.post('/api/dhcp/static', {
      mac: staticIPData.value.mac,
      ip: staticIPInput.value.trim(),
      hostname: staticIPData.value.hostname
    });

    if (response.data.success) {
      // Show success message
      error.value = `Static IP ${staticIPInput.value} set for ${staticIPData.value.hostname}. Apply changes to activate.`;
      setTimeout(() => {
        error.value = '';
      }, 5000);

      // Check for pending changes
      await pendingStore.checkPending();

      // Close modal
      closeStaticIPModal();

      // Refresh clients list
      await fetchClients();
    } else {
      validationError.value = response.data.error || 'Failed to set static IP';
    }
  } catch (err) {
    validationError.value = err.response?.data?.error || 'Failed to set static IP';
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  fetchClients();
  document.addEventListener('click', handleClickOutside);

  // Auto-refresh every 30 seconds
  const interval = setInterval(fetchClients, 30000);

  // Cleanup on unmount
  onUnmounted(() => {
    clearInterval(interval);
    document.removeEventListener('click', handleClickOutside);
  });
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
  align-items: flex-start;
  gap: 1rem;
}

.client-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
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
  display: flex;
  gap: 0.5rem;
  align-items: center;
  position: relative;
}

.icon-btn {
  width: 2.5rem;
  height: 2.5rem;
  padding: 0.5rem;
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
  cursor: pointer;
}

.icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.add-to-group-btn {
  background: var(--primary-color);
  color: white;
  border: none;
}

.add-to-group-btn:hover:not(:disabled) {
  background: #2563eb;
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Block button */
.block-btn.blocked {
  background: var(--success-color);
  color: white;
  border: none;
}

.block-btn.blocked:hover:not(:disabled) {
  background: #059669;
}

.block-btn.unblocked {
  background: var(--danger-color);
  color: white;
  border: none;
}

.block-btn.unblocked:hover:not(:disabled) {
  background: #dc2626;
}

/* Add to Group Dropdown */
.add-group-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.5rem;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  width: 300px;
  max-height: 400px;
  display: flex;
  flex-direction: column;
  z-index: 50;
}

.group-search {
  padding: 0.75rem;
  border: none;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.875rem;
  outline: none;
  position: sticky;
  top: 0;
  background: white;
  border-radius: 0.5rem 0.5rem 0 0;
}

.group-search:focus {
  border-bottom-color: var(--primary-color);
}

.group-list {
  overflow-y: auto;
  max-height: 350px;
}

.no-groups {
  padding: 1.5rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.group-item {
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid var(--border-color);
}

.group-item:last-child {
  border-bottom: none;
}

.group-item:hover:not(.disabled) {
  background: var(--bg-gray);
}

.group-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.group-name {
  flex: 1;
  font-weight: 500;
  font-size: 0.875rem;
}

.group-count {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.protected-label {
  font-size: 0.75rem;
  color: var(--danger-color);
  font-weight: 600;
}

/* Static IP Button */
.ip-plus-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  margin-left: 0.5rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s;
  vertical-align: middle;
}

.ip-plus-btn:hover {
  background: #2563eb;
  transform: scale(1.1);
}

.ip-plus-btn svg {
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
}

/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal h2 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  color: var(--text-primary);
}

.modal-info {
  background: var(--bg-gray);
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.modal-info p {
  margin: 0.5rem 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.modal-info p:first-child {
  margin-top: 0;
}

.modal-info p:last-child {
  margin-bottom: 0;
}

.modal-info strong {
  color: var(--text-primary);
  font-weight: 600;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  font-size: 1rem;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.form-group input.error {
  border-color: var(--danger-color);
}

.helper-text {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.error-text {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--danger-color);
  font-weight: 500;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.modal-actions button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-actions button:first-child {
  background: var(--bg-gray);
  color: var(--text-primary);
}

.modal-actions button:first-child:hover {
  background: #d1d5db;
}

.modal-actions button:last-child {
  background: var(--primary-color);
  color: white;
}

.modal-actions button:last-child:hover:not(:disabled) {
  background: #2563eb;
}

.modal-actions button:disabled {
  opacity: 0.5;
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

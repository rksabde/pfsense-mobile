<template>
  <div class="layout">
    <NavigationBar />

    <main class="main-content">
      <div class="container">
        <div class="header">
          <h1 class="page-title">Groups</h1>
          <button @click="showCreateModal = true" class="create-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            New Group
          </button>
        </div>

        <div v-if="loading && groups.length === 0" class="loading">Loading groups...</div>

        <div v-else-if="error" class="error-card">
          <p>{{ error }}</p>
          <button @click="fetchGroups" class="btn-secondary">Retry</button>
        </div>

        <div v-else-if="groups.length === 0" class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.2"/>
          </svg>
          <p>No groups found</p>
        </div>

        <div v-else class="groups-list">
          <div v-for="group in groups" :key="group.name" class="group-card">
            <div class="group-info">
              <h3 class="group-name">{{ group.name }}</h3>
              <p v-if="group.descr" class="group-desc">{{ group.descr }}</p>
              <div class="group-meta">
                <span class="meta-item">{{ group.address?.length || 0 }} members</span>
                <span v-if="group.isProtected" class="protected-badge">Protected</span>
              </div>
            </div>
            <div class="group-actions">
              <button @click="editGroup(group)" class="action-btn edit" :disabled="group.isProtected">Edit</button>
              <button @click="confirmDelete(group)" class="action-btn delete" :disabled="group.isProtected">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Create/Edit Modal -->
    <div v-if="showCreateModal || showEditModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <h2>{{ showEditModal ? 'Edit Group' : 'Create Group' }}</h2>
        <form @submit.prevent="saveGroup">
          <div class="form-group">
            <label>Group Name</label>
            <input v-model="formData.name" :disabled="showEditModal" type="text" required placeholder="e.g., FAMILY" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <input v-model="formData.description" type="text" placeholder="Optional description" />
          </div>
          <div class="form-group">
            <label>Members (one per line: IP, hostname, or alias)</label>
            <textarea v-model="formData.membersText" rows="5" placeholder="192.168.1.10&#10;DEVICE1&#10;OTHER_GROUP"></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" @click="closeModal" class="btn-secondary">Cancel</button>
            <button type="submit" :disabled="saving" class="btn-primary">{{ saving ? 'Saving...' : 'Save' }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="modal small">
        <h2>Delete Group?</h2>
        <p>Are you sure you want to delete <strong>{{ deleteTarget?.name }}</strong>?</p>
        <div class="modal-actions">
          <button @click="showDeleteConfirm = false" class="btn-secondary">Cancel</button>
          <button @click="deleteGroup" :disabled="saving" class="btn-danger">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import NavigationBar from '../components/NavigationBar.vue';

const groups = ref([]);
const loading = ref(true);
const error = ref('');
const showCreateModal = ref(false);
const showEditModal = ref(false);
const showDeleteConfirm = ref(false);
const saving = ref(false);
const deleteTarget = ref(null);

const formData = ref({
  name: '',
  description: '',
  membersText: ''
});

const PROTECTED_GROUPS = ['BLOCKED', 'WAN', 'LAN'];

const fetchGroups = async () => {
  loading.value = true;
  error.value = '';

  try {
    const response = await axios.get('/api/groups');
    if (response.data.success) {
      groups.value = response.data.data.map(g => ({
        ...g,
        isProtected: PROTECTED_GROUPS.includes(g.name)
      }));
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to load groups';
  } finally {
    loading.value = false;
  }
};

const editGroup = (group) => {
  formData.value = {
    name: group.name,
    description: group.descr || '',
    membersText: (group.address || []).join('\n')
  };
  showEditModal.value = true;
};

const saveGroup = async () => {
  saving.value = true;
  error.value = '';

  try {
    const members = formData.value.membersText
      .split('\n')
      .map(m => m.trim())
      .filter(m => m.length > 0);

    const payload = {
      name: formData.value.name,
      addresses: members,
      description: formData.value.description
    };

    if (showEditModal.value) {
      await axios.put(`/api/groups/${formData.value.name}`, payload);
    } else {
      await axios.post('/api/groups', payload);
    }

    closeModal();
    fetchGroups();
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to save group';
  } finally {
    saving.value = false;
  }
};

const confirmDelete = (group) => {
  deleteTarget.value = group;
  showDeleteConfirm.value = true;
};

const deleteGroup = async () => {
  saving.value = true;

  try {
    await axios.delete(`/api/groups/${deleteTarget.value.name}`);
    showDeleteConfirm.value = false;
    fetchGroups();
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to delete group';
  } finally {
    saving.value = false;
  }
};

const closeModal = () => {
  showCreateModal.value = false;
  showEditModal.value = false;
  formData.value = { name: '', description: '', membersText: '' };
};

onMounted(() => {
  fetchGroups();
});
</script>

<script>
export default {
  name: 'GroupsView'
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
}

.page-title {
  font-size: 1.875rem;
  font-weight: 700;
}

.create-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
}

.groups-list {
  display: grid;
  gap: 1rem;
}

.group-card {
  background: var(--bg-white);
  border-radius: 0.75rem;
  padding: 1.25rem;
  box-shadow: var(--shadow);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.group-info {
  flex: 1;
}

.group-name {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.group-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.group-meta {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.meta-item {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.protected-badge {
  padding: 0.25rem 0.5rem;
  background: #f3f4f6;
  color: var(--text-secondary);
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.group-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.action-btn.edit {
  background: var(--bg-white);
  color: var(--primary-color);
  border: 1px solid var(--primary-color);
}

.action-btn.delete {
  background: var(--bg-white);
  color: var(--danger-color);
  border: 1px solid var(--danger-color);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

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
}

.modal {
  background: white;
  border-radius: 0.75rem;
  padding: 2rem;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal.small {
  max-width: 400px;
}

.modal h2 {
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  font-size: 0.875rem;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.625rem;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-family: inherit;
}

.form-group textarea {
  resize: vertical;
  font-family: 'Courier New', monospace;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.btn-primary {
  padding: 0.625rem 1.25rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-weight: 600;
  font-size: 0.875rem;
}

.btn-secondary {
  padding: 0.625rem 1.25rem;
  background: var(--bg-white);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  font-weight: 500;
  font-size: 0.875rem;
}

.btn-danger {
  padding: 0.625rem 1.25rem;
  background: var(--danger-color);
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-weight: 600;
  font-size: 0.875rem;
}

.loading, .empty-state {
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
</style>

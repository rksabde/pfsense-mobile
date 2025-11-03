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
            <div class="group-main">
              <button @click="toggleExpand(group.name)" class="expand-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path :d="expandedGroups.includes(group.name) ? 'M19 15l-7-7-7 7' : 'M9 5l7 7-7 7'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>

              <div class="group-info">
                <div class="group-header">
                  <h3 class="group-name">{{ group.name }}</h3>
                  <span :class="['block-badge', getBlockBadgeClass(group.blockStatus)]">
                    {{ getBlockBadgeText(group.blockStatus) }}
                  </span>
                  <span v-if="group.isProtected" class="protected-badge">Protected</span>
                </div>
                <p v-if="group.descr" class="group-desc">{{ group.descr }}</p>
                <div class="group-meta">
                  <span class="meta-item">{{ group.address?.length || 0 }} members</span>
                  <span v-if="group.blockStatus?.blockedMembers.length > 0 && !expandedGroups.includes(group.name)" class="meta-preview">
                    {{ getBlockPreview(group.blockStatus.blockedMembers) }}
                  </span>
                </div>
              </div>

              <div class="group-actions">
                <button
                  @click="toggleGroupBlock(group)"
                  :class="['icon-btn', 'group-block-btn', getBlockButtonClass(group.blockStatus)]"
                  :disabled="group.isProtected || processingGroup === group.name"
                  :title="group.blockStatus?.groupBlocked ? 'Unblock Group' : 'Block Group'"
                >
                  <svg v-if="processingGroup === group.name" class="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.25"/>
                    <path d="M12 2a10 10 0 0110 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  <svg v-else-if="group.blockStatus?.groupBlocked" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
                    <path d="M4 4l16 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
                <button
                  @click="editGroup(group)"
                  class="icon-btn edit-btn"
                  :disabled="group.isProtected"
                  title="Edit Group"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <button
                  @click="confirmDelete(group)"
                  class="icon-btn delete-btn"
                  :disabled="group.isProtected"
                  title="Delete Group"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <line x1="10" y1="11" x2="10" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Expanded Members List -->
            <div v-if="expandedGroups.includes(group.name)" class="members-list">
              <div v-if="!group.address || group.address.length === 0" class="empty-members">No members</div>
              <div v-else v-for="(member, index) in group.address" :key="index" class="member-item">
                <div class="member-info">
                  <span class="member-icon">📱</span>
                  <span class="member-name">{{ member }}</span>
                  <span v-if="group.blockStatus?.blockedMembers.includes(member)" class="member-status blocked">
                    🔴 {{ group.blockStatus.groupBlocked ? 'Via Group' : 'Individually' }}
                  </span>
                  <span v-else-if="group.blockStatus?.groupBlocked" class="member-status inherited">
                    ✓ Via Group
                  </span>
                </div>
                <div class="member-actions">
                  <button
                    @click="toggleMemberBlock(group.name, member, group.blockStatus)"
                    :class="['icon-btn', 'member-block-btn', getMemberBlockButtonClass(member, group.blockStatus)]"
                    :disabled="group.isProtected || group.blockStatus?.groupBlocked || processingMemberBlock === `${group.name}:${member}`"
                    :title="getMemberBlockTooltip(member, group.blockStatus)"
                  >
                    <svg v-if="processingMemberBlock === `${group.name}:${member}`" class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.25"/>
                      <path d="M12 2a10 10 0 0110 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <svg v-else-if="isMemberBlockedIndividually(member, group.blockStatus)" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
                      <path d="M4 4l16 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                  </button>
                  <button
                    @click="confirmRemoveMember(group.name, member, group.blockStatus?.blockedMembers.includes(member))"
                    class="icon-btn remove-btn"
                    :disabled="group.isProtected || processingMember === member"
                    title="Remove from group"
                  >
                    <svg v-if="processingMember === member" class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.25"/>
                      <path d="M12 2a10 10 0 0110 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
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

    <!-- Remove Member Confirmation -->
    <div v-if="showRemoveMemberConfirm" class="modal-overlay" @click.self="showRemoveMemberConfirm = false">
      <div class="modal small">
        <h2>Remove Member?</h2>
        <p>Remove <strong>{{ removeMemberData.member }}</strong> from <strong>{{ removeMemberData.groupName }}</strong>?</p>
        <p v-if="removeMemberData.isBlocked" class="warning-text">This member is currently blocked.</p>
        <div class="modal-actions">
          <button @click="showRemoveMemberConfirm = false" class="btn-secondary">Cancel</button>
          <button v-if="removeMemberData.isBlocked" @click="removeMember(false)" :disabled="saving" class="btn-warning">
            Remove & Keep Blocked
          </button>
          <button v-if="removeMemberData.isBlocked" @click="removeMember(true)" :disabled="saving" class="btn-primary">
            Remove & Unblock
          </button>
          <button v-if="!removeMemberData.isBlocked" @click="removeMember(false)" :disabled="saving" class="btn-danger">
            Remove
          </button>
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
const showRemoveMemberConfirm = ref(false);
const saving = ref(false);
const deleteTarget = ref(null);
const expandedGroups = ref([]);
const processingGroup = ref('');
const processingMember = ref('');
const processingMemberBlock = ref('');

const formData = ref({
  name: '',
  description: '',
  membersText: ''
});

const removeMemberData = ref({
  groupName: '',
  member: '',
  isBlocked: false
});

const PROTECTED_GROUPS = ['BLOCKED', 'WAN', 'LAN'];

const fetchGroups = async () => {
  loading.value = true;
  error.value = '';

  try {
    const response = await axios.get('/api/groups');
    if (response.data.success) {
      groups.value = response.data.data
        .filter(g => g.name !== 'BLOCKED')  // Hide BLOCKED group from UI
        .map(g => ({
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

const toggleExpand = (groupName) => {
  const index = expandedGroups.value.indexOf(groupName);
  if (index > -1) {
    expandedGroups.value.splice(index, 1);
  } else {
    expandedGroups.value.push(groupName);
  }
};

const getBlockBadgeClass = (blockStatus) => {
  if (!blockStatus) return 'unblocked';
  return blockStatus.status;
};

const getBlockBadgeText = (blockStatus) => {
  if (!blockStatus) return 'Unblocked';
  if (blockStatus.groupBlocked) return 'Blocked';
  if (blockStatus.individualBlocks > 0) {
    return `${blockStatus.individualBlocks}/${blockStatus.totalMembers} Blocked`;
  }
  return 'Unblocked';
};

const getBlockButtonClass = (blockStatus) => {
  if (!blockStatus) return 'unblocked';
  return blockStatus.groupBlocked ? 'blocked' : 'unblocked';
};

const getBlockPreview = (blockedMembers) => {
  if (blockedMembers.length === 0) return '';
  const preview = blockedMembers.slice(0, 2).join(', ');
  return blockedMembers.length > 2 ? `${preview}, +${blockedMembers.length - 2} more` : preview;
};

const toggleGroupBlock = async (group) => {
  processingGroup.value = group.name;
  error.value = '';

  try {
    const endpoint = group.blockStatus?.groupBlocked ? 'unblock' : 'block';
    await axios.post(`/api/groups/${group.name}/${endpoint}`);
    await fetchGroups();
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to toggle block status';
  } finally {
    processingGroup.value = '';
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

const confirmRemoveMember = (groupName, member, isBlocked) => {
  removeMemberData.value = { groupName, member, isBlocked };
  showRemoveMemberConfirm.value = true;
};

const removeMember = async (shouldUnblock) => {
  saving.value = true;
  processingMember.value = removeMemberData.value.member;

  try {
    const url = `/api/groups/${removeMemberData.value.groupName}/members/${encodeURIComponent(removeMemberData.value.member)}${shouldUnblock ? '?unblock=true' : ''}`;
    await axios.delete(url);
    showRemoveMemberConfirm.value = false;
    await fetchGroups();
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to remove member';
  } finally {
    saving.value = false;
    processingMember.value = '';
  }
};

const isMemberBlockedIndividually = (member, blockStatus) => {
  if (!blockStatus) return false;
  // Member is blocked individually if it's in blockedMembers but group itself isn't blocked
  return blockStatus.blockedMembers?.includes(member) && !blockStatus.groupBlocked;
};

const getMemberBlockButtonClass = (member, blockStatus) => {
  if (blockStatus?.groupBlocked) return 'blocked-via-group';
  return isMemberBlockedIndividually(member, blockStatus) ? 'blocked' : 'unblocked';
};

const getMemberBlockTooltip = (member, blockStatus) => {
  if (blockStatus?.groupBlocked) return 'Blocked via group';
  return isMemberBlockedIndividually(member, blockStatus) ? 'Unblock member' : 'Block member';
};

const toggleMemberBlock = async (groupName, member, blockStatus) => {
  const key = `${groupName}:${member}`;
  processingMemberBlock.value = key;
  error.value = '';

  try {
    const isBlocked = isMemberBlockedIndividually(member, blockStatus);
    const endpoint = isBlocked ? 'unblock' : 'block';
    await axios.post(`/api/blocked/${encodeURIComponent(member)}/${endpoint}`);
    await fetchGroups();
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to toggle member block status';
  } finally {
    processingMemberBlock.value = '';
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
}

.group-main {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.expand-btn {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: 0.375rem;
  background: var(--bg-white);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.expand-btn:hover {
  background: #f3f4f6;
}

.group-info {
  flex: 1;
  min-width: 0;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.25rem;
}

.group-name {
  font-size: 1.125rem;
  font-weight: 600;
}

.block-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.block-badge.blocked {
  background: #fee2e2;
  color: var(--danger-color);
}

.block-badge.partial {
  background: #fed7aa;
  color: #ea580c;
}

.block-badge.unblocked {
  background: #d1fae5;
  color: var(--success-color);
}

.protected-badge {
  padding: 0.25rem 0.5rem;
  background: #f3f4f6;
  color: var(--text-secondary);
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.group-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.group-meta {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.meta-item {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.meta-preview {
  font-size: 0.75rem;
  color: #ea580c;
  font-style: italic;
}

.group-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
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

/* Group block button */
.group-block-btn.blocked {
  background: var(--success-color);
  color: white;
  border: none;
}

.group-block-btn.blocked:hover:not(:disabled) {
  background: #059669;
}

.group-block-btn.unblocked {
  background: var(--danger-color);
  color: white;
  border: none;
}

.group-block-btn.unblocked:hover:not(:disabled) {
  background: #dc2626;
}

/* Edit button */
.edit-btn {
  background: var(--bg-white);
  color: var(--primary-color);
  border: 1px solid var(--primary-color);
}

.edit-btn:hover:not(:disabled) {
  background: var(--primary-color);
  color: white;
}

/* Delete button */
.delete-btn {
  background: var(--bg-white);
  color: var(--danger-color);
  border: 1px solid var(--danger-color);
}

.delete-btn:hover:not(:disabled) {
  background: var(--danger-color);
  color: white;
}

.members-list {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
  display: grid;
  gap: 0.5rem;
}

.empty-members {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-style: italic;
}

.member-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 0.375rem;
  gap: 0.75rem;
}

.member-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.member-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.member-name {
  font-size: 0.875rem;
  font-family: 'Courier New', monospace;
  font-weight: 500;
}

.member-status {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 600;
}

.member-status.blocked {
  background: #fee2e2;
  color: var(--danger-color);
}

.member-status.inherited {
  background: #dbeafe;
  color: var(--primary-color);
}

.member-actions {
  display: flex;
  gap: 0.375rem;
  flex-shrink: 0;
}

.member-actions .icon-btn {
  width: 2rem;
  height: 2rem;
  padding: 0.375rem;
}

/* Member block button */
.member-block-btn.blocked {
  background: var(--success-color);
  color: white;
  border: none;
}

.member-block-btn.blocked:hover:not(:disabled) {
  background: #059669;
}

.member-block-btn.unblocked {
  background: var(--danger-color);
  color: white;
  border: none;
}

.member-block-btn.unblocked:hover:not(:disabled) {
  background: #dc2626;
}

.member-block-btn.blocked-via-group {
  background: #e5e7eb;
  color: #9ca3af;
  border: 1px solid #d1d5db;
  cursor: not-allowed;
}

/* Member remove button */
.member-actions .remove-btn {
  background: var(--bg-white);
  color: var(--danger-color);
  border: 1px solid var(--danger-color);
}

.member-actions .remove-btn:hover:not(:disabled) {
  background: var(--danger-color);
  color: white;
}

/* Spinner animation */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spinner {
  animation: spin 1s linear infinite;
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

.warning-text {
  color: #ea580c;
  font-weight: 500;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
  flex-wrap: wrap;
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

.btn-warning {
  padding: 0.625rem 1.25rem;
  background: #ea580c;
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

@media (max-width: 768px) {
  .group-main {
    flex-wrap: wrap;
  }

  .group-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .modal-actions {
    flex-direction: column;
  }

  .modal-actions button {
    width: 100%;
  }
}
</style>

const axios = require('axios');
const https = require('https');

class PfSenseService {
  constructor() {
    this.baseURL = process.env.PFSENSE_URL;
    this.username = process.env.PFSENSE_USERNAME;
    this.password = process.env.PFSENSE_PASSWORD;
    this.blockedAliasName = process.env.BLOCKED_ALIAS_NAME || 'BLOCKED';

    // Debug logging for environment variables
    console.log('=== pfSense Service Configuration ===');
    console.log('PFSENSE_URL:', this.baseURL || '(not set)');
    console.log('PFSENSE_USERNAME:', this.username || '(not set)');
    console.log('PFSENSE_PASSWORD:', this.password ? '***' + this.password.slice(-3) : '(not set)');
    console.log('BLOCKED_ALIAS_NAME:', this.blockedAliasName);
    console.log('=====================================');

    // Create base64 encoded credentials for Basic auth
    const credentials = Buffer.from(`${this.username}:${this.password}`).toString('base64');

    // Create axios instance with custom config
    this.client = axios.create({
      baseURL: `${this.baseURL}/api/v2`,
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false // For self-signed certificates
      })
    });
  }

  // Get all firewall aliases
  async getAliases() {
    try {
      console.log(`Attempting to fetch aliases from: ${this.baseURL}/api/v2/firewall/aliases`);
      const response = await this.client.get('/firewall/aliases');
      return response.data;
    } catch (error) {
      console.error('Error fetching aliases:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      } else if (error.request) {
        console.error('No response received. Request details:', {
          url: error.config?.url,
          method: error.config?.method
        });
      }
      throw new Error('Failed to fetch aliases from pfSense');
    }
  }

  // Get specific alias by name
  async getAlias(name) {
    try {
      const aliases = await this.getAliases();
      const alias = aliases.data?.find(a => a.name === name);

      if (!alias) {
        throw new Error(`Alias ${name} not found`);
      }

      return { data: alias };
    } catch (error) {
      console.error(`Error fetching alias ${name}:`, error.message);
      throw new Error(`Failed to fetch alias ${name}`);
    }
  }

  // Get BLOCKED alias contents (IPs and alias names)
  async getBlockedItems() {
    try {
      const aliases = await this.getAliases();
      const blockedAlias = aliases.data?.find(alias => alias.name === this.blockedAliasName);

      if (!blockedAlias) {
        return [];
      }

      // Address field is already an array in pfSense API v2
      const addresses = Array.isArray(blockedAlias.address)
        ? blockedAlias.address.filter(addr => addr && addr.trim())
        : [];

      return addresses;
    } catch (error) {
      console.error('Error getting blocked items:', error.message);
      throw error;
    }
  }

  // Legacy alias for backward compatibility
  async getBlockedDevices() {
    return this.getBlockedItems();
  }

  // Parse identifier to determine its type (IP, hostname, or alias)
  parseIdentifier(identifier) {
    if (!identifier || typeof identifier !== 'string') {
      throw new Error('Invalid identifier');
    }

    const trimmed = identifier.trim();

    // Check if it's an IP address
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipRegex.test(trimmed)) {
      // Validate IP octets are 0-255
      const octets = trimmed.split('.');
      if (octets.every(octet => parseInt(octet) >= 0 && parseInt(octet) <= 255)) {
        return { type: 'ip', value: trimmed };
      }
    }

    // Check if it's all uppercase (likely an alias name)
    if (trimmed === trimmed.toUpperCase() && /^[A-Z0-9_]+$/.test(trimmed)) {
      return { type: 'alias', value: trimmed };
    }

    // Otherwise treat as hostname/FQDN
    return { type: 'hostname', value: trimmed };
  }

  // Resolve identifier to something blockable (IP or alias name)
  async resolveToBlockable(identifier) {
    const parsed = this.parseIdentifier(identifier);

    switch (parsed.type) {
      case 'ip':
        // IP is already blockable, just return it
        return parsed.value;

      case 'alias':
        // Verify the alias exists
        const aliases = await this.getAliases();
        const aliasExists = aliases.data?.some(a => a.name === parsed.value);
        if (!aliasExists) {
          throw new Error(`Alias ${parsed.value} not found`);
        }
        return parsed.value;

      case 'hostname':
        // Look up hostname in DHCP leases to find IP
        const dhcpLeases = await this.getDHCPLeases();
        const lease = dhcpLeases.data?.find(l =>
          l.hostname && l.hostname.toLowerCase() === parsed.value.toLowerCase()
        );

        if (!lease || !lease.ip) {
          throw new Error(`Could not resolve hostname ${parsed.value} to IP address`);
        }

        return lease.ip;

      default:
        throw new Error(`Unknown identifier type: ${parsed.type}`);
    }
  }

  // Unified block method - accepts IP, hostname, or alias
  async blockIdentifier(identifier) {
    try {
      // Resolve identifier to blockable value (IP or alias name)
      const blockable = await this.resolveToBlockable(identifier);
      const parsed = this.parseIdentifier(identifier);

      // Get the BLOCKED alias
      const aliases = await this.getAliases();
      const blockedAlias = aliases.data?.find(alias => alias.name === this.blockedAliasName);

      if (!blockedAlias) {
        throw new Error('BLOCKED alias not found');
      }

      // Get current addresses
      const currentAddresses = Array.isArray(blockedAlias.address)
        ? blockedAlias.address.filter(addr => addr && addr.trim())
        : [];

      // Check if already blocked
      if (currentAddresses.includes(blockable)) {
        return {
          success: true,
          message: `${parsed.type === 'alias' ? 'Alias' : 'Device'} already blocked`,
          blockable
        };
      }

      // Add to the list
      const updatedAddresses = [...currentAddresses, blockable];

      // Build detail array
      const currentDetails = Array.isArray(blockedAlias.detail) ? blockedAlias.detail : [];
      const updatedDetails = [...currentDetails, `Blocked ${parsed.type} on ${new Date().toISOString()}`];

      // Update the alias - PATCH endpoint for single alias update
      await this.client.patch('/firewall/alias', {
        id: blockedAlias.id,
        address: updatedAddresses,
        detail: updatedDetails
      });

      // Apply changes
      await this.applyChanges();

      return {
        success: true,
        message: `${parsed.type === 'alias' ? 'Alias' : 'Device'} blocked successfully`,
        blockable,
        type: parsed.type
      };
    } catch (error) {
      console.error('Error blocking identifier:', error.message);
      throw new Error(`Failed to block: ${error.message}`);
    }
  }

  // Unified unblock method - accepts IP, hostname, or alias
  async unblockIdentifier(identifier) {
    try {
      // Resolve identifier to blockable value (IP or alias name)
      const blockable = await this.resolveToBlockable(identifier);
      const parsed = this.parseIdentifier(identifier);

      // Get the BLOCKED alias
      const aliases = await this.getAliases();
      const blockedAlias = aliases.data?.find(alias => alias.name === this.blockedAliasName);

      if (!blockedAlias) {
        throw new Error('BLOCKED alias not found');
      }

      // Get current addresses
      const currentAddresses = Array.isArray(blockedAlias.address)
        ? blockedAlias.address.filter(addr => addr && addr.trim())
        : [];

      // Check if in the list
      const index = currentAddresses.indexOf(blockable);
      if (index === -1) {
        return {
          success: true,
          message: `${parsed.type === 'alias' ? 'Alias' : 'Device'} not in blocked list`,
          blockable
        };
      }

      // Remove from the list
      const updatedAddresses = currentAddresses.filter(item => item !== blockable);

      // Also remove corresponding detail entry
      const currentDetails = Array.isArray(blockedAlias.detail) ? blockedAlias.detail : [];
      const updatedDetails = currentDetails.filter((_, idx) => idx !== index);

      // Update the alias - PATCH endpoint for single alias update
      await this.client.patch('/firewall/alias', {
        id: blockedAlias.id,
        address: updatedAddresses,
        detail: updatedDetails
      });

      // Apply changes
      await this.applyChanges();

      return {
        success: true,
        message: `${parsed.type === 'alias' ? 'Alias' : 'Device'} unblocked successfully`,
        blockable,
        type: parsed.type
      };
    } catch (error) {
      console.error('Error unblocking identifier:', error.message);
      throw new Error(`Failed to unblock: ${error.message}`);
    }
  }

  // Legacy methods for backward compatibility
  async blockDevice(macOrIp) {
    console.warn('blockDevice is deprecated, use blockIdentifier instead');
    return this.blockIdentifier(macOrIp);
  }

  async unblockDevice(macOrIp) {
    console.warn('unblockDevice is deprecated, use unblockIdentifier instead');
    return this.unblockIdentifier(macOrIp);
  }

  // Apply firewall changes
  async applyChanges() {
    try {
      await this.client.post('/firewall/apply');
      return { success: true };
    } catch (error) {
      console.error('Error applying changes:', error.message);
      throw new Error('Failed to apply firewall changes');
    }
  }

  // Get DHCP leases (connected devices)
  async getDHCPLeases() {
    try {
      const response = await this.client.get('/status/dhcp_server/leases?limit=0&offset=0');
      return response.data;
    } catch (error) {
      console.error('Error fetching DHCP leases:', error.message);
      throw new Error('Failed to fetch DHCP leases');
    }
  }

  // Get ARP table
  async getARPTable() {
    try {
      const response = await this.client.get('/diagnostics/arp_table');
      return response.data;
    } catch (error) {
      console.error('Error fetching ARP table:', error.message);
      throw new Error('Failed to fetch ARP table');
    }
  }

  // Get connected clients with block status (now checks by IP, not MAC)
  async getConnectedClients() {
    try {
      const [dhcpLeases, arpTable, blockedItems] = await Promise.all([
        this.getDHCPLeases(),
        this.getARPTable(),
        this.getBlockedItems()
      ]);

      // Combine DHCP and ARP data
      const clients = [];
      const seenMACs = new Set();

      // Process DHCP leases
      if (dhcpLeases.data) {
        dhcpLeases.data.forEach(lease => {
          if (lease.mac && !seenMACs.has(lease.mac)) {
            seenMACs.add(lease.mac);
            clients.push({
              mac: lease.mac,
              ip: lease.ip,
              hostname: lease.hostname || 'Unknown',
              status: lease.state || 'active',
              blocked: lease.ip && blockedItems.includes(lease.ip), // Check by IP
              leaseEnd: lease.ends
            });
          }
        });
      }

      // Process ARP table (for devices not in DHCP)
      if (arpTable.data) {
        arpTable.data.forEach(arp => {
          if (arp.mac && !seenMACs.has(arp.mac)) {
            seenMACs.add(arp.mac);
            clients.push({
              mac: arp.mac,
              ip: arp.ip,
              hostname: arp.hostname || 'Unknown',
              status: 'active',
              blocked: arp.ip && blockedItems.includes(arp.ip), // Check by IP
              interface: arp.interface
            });
          }
        });
      }

      return clients;
    } catch (error) {
      console.error('Error getting connected clients:', error.message);
      throw error;
    }
  }

  // Get system info/stats
  async getSystemInfo() {
    try {
      const response = await this.client.get('/status/system');
      return response.data;
    } catch (error) {
      console.error('Error fetching system info:', error.message);
      throw new Error('Failed to fetch system info');
    }
  }

  // Get interface statistics
  async getInterfaceStats() {
    try {
      const response = await this.client.get('/interface');
      return response.data;
    } catch (error) {
      console.error('Error fetching interface stats:', error.message);
      throw new Error('Failed to fetch interface stats');
    }
  }

  // Legacy alias methods - redirect to unified methods
  async blockAlias(aliasName) {
    console.warn('blockAlias is deprecated, use blockIdentifier instead');
    return this.blockIdentifier(aliasName);
  }

  async unblockAlias(aliasName) {
    console.warn('unblockAlias is deprecated, use blockIdentifier instead');
    return this.unblockIdentifier(aliasName);
  }

  // Validate alias name
  validateAliasName(name) {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'Alias name is required' };
    }

    const trimmed = name.trim().toUpperCase();

    // Check length
    if (trimmed.length < 1 || trimmed.length > 32) {
      return { valid: false, error: 'Alias name must be 1-32 characters' };
    }

    // Check characters (alphanumeric and underscore only)
    if (!/^[A-Z0-9_]+$/.test(trimmed)) {
      return { valid: false, error: 'Alias name can only contain letters, numbers, and underscores' };
    }

    return { valid: true, name: trimmed };
  }

  // Create new alias
  async createAlias(name, addresses = [], description = '') {
    try {
      // Validate name
      const validation = this.validateAliasName(name);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const aliasName = validation.name;

      // Check if alias already exists
      const aliases = await this.getAliases();
      const exists = aliases.data?.some(a => a.name === aliasName);
      if (exists) {
        throw new Error(`Alias ${aliasName} already exists`);
      }

      // Ensure addresses is an array
      const addressArray = Array.isArray(addresses) ? addresses : [addresses];

      // Create detail array (empty strings for each address)
      const detailArray = addressArray.map((_, i) => description || `Entry ${i + 1}`);

      // Create the alias using POST
      await this.client.post('/firewall/alias', {
        name: aliasName,
        type: 'host',
        address: addressArray,
        detail: detailArray,
        descr: description
      });

      // Apply changes
      await this.applyChanges();

      return {
        success: true,
        message: `Alias ${aliasName} created successfully`,
        alias: { name: aliasName, address: addressArray, descr: description }
      };
    } catch (error) {
      console.error('Error creating alias:', error.message);
      if (error.response) {
        console.error('Response data:', JSON.stringify(error.response.data));
      }
      throw new Error(`Failed to create alias: ${error.message}`);
    }
  }

  // Update existing alias
  async updateAlias(name, addresses, description) {
    try {
      // Get the alias
      const aliases = await this.getAliases();
      const alias = aliases.data?.find(a => a.name === name);

      if (!alias) {
        throw new Error(`Alias ${name} not found`);
      }

      // Ensure addresses is an array
      const addressArray = Array.isArray(addresses) ? addresses : [addresses];

      // Create detail array
      const detailArray = addressArray.map((_, i) => description || `Entry ${i + 1}`);

      // Update the alias using PATCH
      await this.client.patch('/firewall/alias', {
        id: alias.id,
        address: addressArray,
        detail: detailArray,
        descr: description || alias.descr
      });

      // Apply changes
      await this.applyChanges();

      return {
        success: true,
        message: `Alias ${name} updated successfully`,
        alias: { name, address: addressArray, descr: description || alias.descr }
      };
    } catch (error) {
      console.error('Error updating alias:', error.message);
      if (error.response) {
        console.error('Response data:', JSON.stringify(error.response.data));
      }
      throw new Error(`Failed to update alias: ${error.message}`);
    }
  }

  // Delete alias
  async deleteAlias(name) {
    try {
      // Safety check - prevent deletion of critical aliases
      const protectedAliases = [this.blockedAliasName, 'WAN', 'LAN'];
      if (protectedAliases.includes(name.toUpperCase())) {
        throw new Error(`Cannot delete protected alias: ${name}`);
      }

      // Get the alias
      const aliases = await this.getAliases();
      const alias = aliases.data?.find(a => a.name === name);

      if (!alias) {
        throw new Error(`Alias ${name} not found`);
      }

      // Delete the alias using DELETE
      await this.client.delete('/firewall/alias', {
        data: { id: alias.id }
      });

      // Apply changes
      await this.applyChanges();

      return {
        success: true,
        message: `Alias ${name} deleted successfully`
      };
    } catch (error) {
      console.error('Error deleting alias:', error.message);
      if (error.response) {
        console.error('Response data:', JSON.stringify(error.response.data));
      }
      throw new Error(`Failed to delete alias: ${error.message}`);
    }
  }

  // Get group block status - checks if group itself is blocked and individual member status
  async getGroupBlockStatus(groupName, members) {
    try {
      const blockedItems = await this.getBlockedItems();

      // Check if group alias itself is in BLOCKED
      const groupBlocked = blockedItems.includes(groupName);

      // Count individually blocked members
      let individualBlocks = 0;
      if (Array.isArray(members)) {
        members.forEach(member => {
          if (blockedItems.includes(member)) {
            individualBlocks++;
          }
        });
      }

      const totalMembers = Array.isArray(members) ? members.length : 0;

      // Determine overall status
      let status = 'unblocked';
      if (groupBlocked) {
        status = 'blocked';  // Group itself is blocked (takes precedence)
      } else if (individualBlocks > 0) {
        status = 'partial';  // Some members individually blocked
      }

      return {
        groupBlocked,
        individualBlocks,
        totalMembers,
        status,
        blockedMembers: members?.filter(m => blockedItems.includes(m)) || []
      };
    } catch (error) {
      console.error('Error getting group block status:', error.message);
      return {
        groupBlocked: false,
        individualBlocks: 0,
        totalMembers: 0,
        status: 'unknown',
        blockedMembers: []
      };
    }
  }

  // Remove member from group/alias
  async removeMemberFromAlias(aliasName, member) {
    try {
      // Get the alias
      const aliases = await this.getAliases();
      const alias = aliases.data?.find(a => a.name === aliasName);

      if (!alias) {
        throw new Error(`Alias ${aliasName} not found`);
      }

      // Get current members
      const currentMembers = Array.isArray(alias.address) ? alias.address : [];

      // Check if member exists
      if (!currentMembers.includes(member)) {
        throw new Error(`Member ${member} not found in ${aliasName}`);
      }

      // Remove the member
      const updatedMembers = currentMembers.filter(m => m !== member);

      // Update corresponding detail array
      const memberIndex = currentMembers.indexOf(member);
      const currentDetails = Array.isArray(alias.detail) ? alias.detail : [];
      const updatedDetails = currentDetails.filter((_, idx) => idx !== memberIndex);

      // Update the alias
      await this.client.patch('/firewall/alias', {
        id: alias.id,
        address: updatedMembers,
        detail: updatedDetails
      });

      // Apply changes
      await this.applyChanges();

      return {
        success: true,
        message: `Removed ${member} from ${aliasName}`,
        remainingMembers: updatedMembers.length
      };
    } catch (error) {
      console.error('Error removing member from alias:', error.message);
      if (error.response) {
        console.error('Response data:', JSON.stringify(error.response.data));
      }
      throw new Error(`Failed to remove member: ${error.message}`);
    }
  }

  // Add member to group/alias
  async addMemberToAlias(aliasName, member) {
    try {
      // Get the alias
      const aliases = await this.getAliases();
      const alias = aliases.data?.find(a => a.name === aliasName);

      if (!alias) {
        throw new Error(`Alias ${aliasName} not found`);
      }

      // Get current members
      const currentMembers = Array.isArray(alias.address) ? alias.address : [];

      // Check if member already exists
      if (currentMembers.includes(member)) {
        throw new Error(`Member ${member} already exists in ${aliasName}`);
      }

      // Add the member
      const updatedMembers = [...currentMembers, member];

      // Add empty detail for the new member
      const currentDetails = Array.isArray(alias.detail) ? alias.detail : [];
      const updatedDetails = [...currentDetails, ''];

      // Update the alias
      await this.client.patch('/firewall/alias', {
        id: alias.id,
        address: updatedMembers,
        detail: updatedDetails
      });

      // Apply changes
      await this.applyChanges();

      return {
        success: true,
        message: `Added ${member} to ${aliasName}`,
        totalMembers: updatedMembers.length
      };
    } catch (error) {
      console.error('Error adding member to alias:', error.message);
      if (error.response) {
        console.error('Response data:', JSON.stringify(error.response.data));
      }
      throw new Error(`Failed to add member: ${error.message}`);
    }
  }

  // Get DHCP static mappings
  async getDHCPStaticMappings() {
    try {
      // Get mappings for LAN interface
      const response = await this.client.get('/services/dhcp_server/static_mapping', {
        params: { parent_id: 'lan' }
      });
      console.log('DHCP static mappings retrieved');
      return response;
    } catch (error) {
      console.error('Error getting DHCP static mappings:', error.message);
      throw new Error(`Failed to get DHCP static mappings: ${error.message}`);
    }
  }

  // Create or update static DHCP mapping
  async setStaticDHCPMapping(mac, ip, hostname) {
    try {
      // Validate IP is not in DHCP range
      const dhcpStart = parseInt(process.env.DHCP_RANGE_START || '100');
      const dhcpEnd = parseInt(process.env.DHCP_RANGE_END || '200');

      const ipParts = ip.split('.');
      const lastOctet = parseInt(ipParts[3]);

      if (lastOctet >= dhcpStart && lastOctet <= dhcpEnd) {
        throw new Error(`IP ${ip} is in DHCP range (${dhcpStart}-${dhcpEnd}). Choose an IP outside this range.`);
      }

      // Create static mapping
      // parent_id is the interface name (e.g., "lan", "opt1", etc.)
      const response = await this.client.post('/services/dhcp_server/static_mapping', {
        parent_id: 'lan', // Default to LAN interface
        mac: mac.toLowerCase(),
        ipaddr: ip,
        hostname: hostname || '',
        descr: `Static mapping for ${hostname || mac}`,
        arp_table_static_entry: false
      });

      // Note: Changes are NOT auto-applied. User must apply via pending changes notification.

      console.log(`Static DHCP mapping created: ${mac} -> ${ip}`);
      return {
        success: true,
        message: `Static IP ${ip} assigned to ${mac}. Apply changes to activate.`,
        data: response.data
      };
    } catch (error) {
      console.error('Error setting static DHCP mapping:', error.message);
      if (error.response) {
        console.error('Response data:', JSON.stringify(error.response.data));
      }
      throw new Error(`Failed to set static DHCP mapping: ${error.message}`);
    }
  }

  // Delete static DHCP mapping
  async deleteStaticDHCPMapping(mac) {
    try {
      const response = await this.client.delete(`/services/dhcp_server/static_mapping`, {
        data: { mac: mac.toLowerCase() }
      });

      // Note: Changes are NOT auto-applied. User must apply via pending changes notification.

      console.log(`Static DHCP mapping deleted for ${mac}`);
      return {
        success: true,
        message: `Static IP reservation removed for ${mac}. Apply changes to activate.`,
        data: response.data
      };
    } catch (error) {
      console.error('Error deleting static DHCP mapping:', error.message);
      throw new Error(`Failed to delete static DHCP mapping: ${error.message}`);
    }
  }

  // Validate static IP
  validateStaticIP(ip, currentIP) {
    // Format check
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
      return 'Invalid IP format';
    }

    // Range check (0-255 for each octet)
    const parts = ip.split('.').map(Number);
    if (parts.some(p => p < 0 || p > 255)) {
      return 'IP octets must be between 0 and 255';
    }

    // DHCP range check
    const lastOctet = parts[3];
    const dhcpStart = parseInt(process.env.DHCP_RANGE_START || '100');
    const dhcpEnd = parseInt(process.env.DHCP_RANGE_END || '200');

    if (lastOctet >= dhcpStart && lastOctet <= dhcpEnd) {
      return `IP is in DHCP range (${dhcpStart}-${dhcpEnd}). Choose outside this range.`;
    }

    // Subnet check (must be in same subnet)
    if (currentIP) {
      const currentParts = currentIP.split('.');
      if (currentParts[0] !== parts[0].toString() ||
          currentParts[1] !== parts[1].toString() ||
          currentParts[2] !== parts[2].toString()) {
        return 'IP must be in same subnet as current IP';
      }
    }

    return null; // Valid
  }

  // Check DHCP pending changes
  async getDHCPPendingChanges() {
    try {
      const response = await this.client.get('/services/dhcp_server/apply');
      console.log('DHCP apply GET response:', JSON.stringify(response.data, null, 2));

      // Check if DHCP changes are NOT applied (applied: false means pending changes)
      const hasPending = response.data?.data?.applied === false;

      console.log('DHCP hasPending:', hasPending);

      return {
        service: 'dhcp',
        hasPending: hasPending,
        count: hasPending ? 1 : 0
      };
    } catch (error) {
      console.error('Error checking DHCP pending changes:', error.message);
      return { service: 'dhcp', hasPending: false, count: 0 };
    }
  }

  // Apply DHCP pending changes
  async applyDHCPChanges() {
    try {
      await this.client.post('/services/dhcp_server/apply');
      console.log('DHCP changes applied');
      return { success: true, service: 'dhcp' };
    } catch (error) {
      console.error('Error applying DHCP changes:', error.message);
      throw new Error(`Failed to apply DHCP changes: ${error.message}`);
    }
  }

  // Check firewall pending changes
  async getFirewallPendingChanges() {
    try {
      const response = await this.client.get('/firewall/apply');
      console.log('Firewall apply GET response:', JSON.stringify(response.data, null, 2));

      // Check if firewall changes are NOT applied or if there are pending subsystems
      const applied = response.data?.data?.applied;
      const pendingSubsystems = response.data?.data?.pending_subsystems || [];
      const hasPending = (applied === false) || (pendingSubsystems.length > 0);

      console.log('Firewall hasPending:', hasPending);

      return {
        service: 'firewall',
        hasPending: hasPending,
        count: hasPending ? 1 : 0
      };
    } catch (error) {
      console.error('Error checking firewall pending changes:', error.message);
      return { service: 'firewall', hasPending: false, count: 0 };
    }
  }

  // Apply firewall changes (renamed from applyChanges for clarity)
  async applyFirewallChanges() {
    try {
      await this.client.post('/firewall/apply');
      console.log('Firewall changes applied');
      return { success: true, service: 'firewall' };
    } catch (error) {
      console.error('Error applying firewall changes:', error.message);
      throw new Error(`Failed to apply firewall changes: ${error.message}`);
    }
  }

  // Get all pending changes across services
  async getAllPendingChanges() {
    try {
      const [dhcp, firewall] = await Promise.all([
        this.getDHCPPendingChanges(),
        this.getFirewallPendingChanges()
      ]);

      const services = [dhcp, firewall].filter(s => s.hasPending);
      const totalCount = services.reduce((sum, s) => sum + s.count, 0);

      return {
        hasPending: services.length > 0,
        totalCount: totalCount,
        services: services
      };
    } catch (error) {
      console.error('Error getting all pending changes:', error.message);
      throw new Error(`Failed to get pending changes: ${error.message}`);
    }
  }

  // Keep original applyChanges for backward compatibility
  async applyChanges() {
    return this.applyFirewallChanges();
  }
}

module.exports = new PfSenseService();

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
}

module.exports = new PfSenseService();

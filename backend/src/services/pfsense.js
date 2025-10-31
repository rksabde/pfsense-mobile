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
      const response = await this.client.get(`/firewall/alias`, {
        params: { name }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching alias ${name}:`, error.message);
      throw new Error(`Failed to fetch alias ${name}`);
    }
  }

  // Get BLOCKED alias contents
  async getBlockedDevices() {
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
      console.error('Error getting blocked devices:', error.message);
      throw error;
    }
  }

  // Add MAC address to BLOCKED alias
  async blockDevice(macAddress) {
    try {
      // First get current blocked devices
      const currentBlocked = await this.getBlockedDevices();

      // Check if already blocked
      if (currentBlocked.includes(macAddress)) {
        return { success: true, message: 'Device already blocked' };
      }

      // Add new MAC to the list
      const updatedAddresses = [...currentBlocked, macAddress];

      // Update the alias - send array directly as pfSense API expects
      await this.client.put('/firewall/aliases', {
        name: this.blockedAliasName,
        address: updatedAddresses,
        type: 'host',
        descr: 'Blocked devices managed by WiFi Manager'
      });

      // Apply changes
      await this.applyChanges();

      return { success: true, message: 'Device blocked successfully' };
    } catch (error) {
      console.error('Error blocking device:', error.message);
      throw new Error('Failed to block device');
    }
  }

  // Remove MAC address from BLOCKED alias
  async unblockDevice(macAddress) {
    try {
      // Get current blocked devices
      const currentBlocked = await this.getBlockedDevices();

      // Check if device is in the list
      if (!currentBlocked.includes(macAddress)) {
        return { success: true, message: 'Device not in blocked list' };
      }

      // Remove MAC from the list
      const updatedAddresses = currentBlocked.filter(mac => mac !== macAddress);

      // Update the alias - send array directly as pfSense API expects
      await this.client.put('/firewall/aliases', {
        name: this.blockedAliasName,
        address: updatedAddresses,
        type: 'host',
        descr: 'Blocked devices managed by WiFi Manager'
      });

      // Apply changes
      await this.applyChanges();

      return { success: true, message: 'Device unblocked successfully' };
    } catch (error) {
      console.error('Error unblocking device:', error.message);
      throw new Error('Failed to unblock device');
    }
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

  // Get connected clients with block status
  async getConnectedClients() {
    try {
      const [dhcpLeases, arpTable, blockedDevices] = await Promise.all([
        this.getDHCPLeases(),
        this.getARPTable(),
        this.getBlockedDevices()
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
              blocked: blockedDevices.includes(lease.mac),
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
              blocked: blockedDevices.includes(arp.mac),
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
}

module.exports = new PfSenseService();

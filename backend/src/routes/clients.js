const express = require('express');
const router = express.Router();
const pfsense = require('../services/pfsense');

// Get all connected clients with block status
router.get('/connected', async (req, res) => {
  try {
    const clients = await pfsense.getConnectedClients();
    res.json({ success: true, data: clients });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all blocked clients
router.get('/blocked', async (req, res) => {
  try {
    const blockedMACs = await pfsense.getBlockedDevices();
    const allClients = await pfsense.getConnectedClients();

    // Filter to only show blocked clients, include historical blocked devices
    const blockedClients = allClients.filter(client => client.blocked);

    // Add any blocked MACs that aren't currently connected
    const connectedMACs = new Set(allClients.map(c => c.mac));
    blockedMACs.forEach(mac => {
      if (!connectedMACs.has(mac)) {
        blockedClients.push({
          mac: mac,
          ip: null,
          hostname: 'Not connected',
          status: 'offline',
          blocked: true
        });
      }
    });

    res.json({ success: true, data: blockedClients });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Block a device by MAC address
router.post('/:mac/block', async (req, res) => {
  try {
    const { mac } = req.params;

    if (!mac || !/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(mac)) {
      return res.status(400).json({ success: false, error: 'Invalid MAC address format' });
    }

    const result = await pfsense.blockDevice(mac);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unblock a device by MAC address
router.post('/:mac/unblock', async (req, res) => {
  try {
    const { mac } = req.params;

    if (!mac || !/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(mac)) {
      return res.status(400).json({ success: false, error: 'Invalid MAC address format' });
    }

    const result = await pfsense.unblockDevice(mac);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

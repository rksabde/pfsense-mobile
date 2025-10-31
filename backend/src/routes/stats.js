const express = require('express');
const router = express.Router();
const pfsense = require('../services/pfsense');

// Get overview statistics
router.get('/overview', async (req, res) => {
  try {
    const [clients, blockedDevices, systemInfo] = await Promise.all([
      pfsense.getConnectedClients(),
      pfsense.getBlockedDevices(),
      pfsense.getSystemInfo().catch(() => null)
    ]);

    const stats = {
      totalConnected: clients.length,
      totalBlocked: blockedDevices.length,
      activeBlocked: clients.filter(c => c.blocked).length,
      systemInfo: systemInfo ? {
        hostname: systemInfo.data?.hostname,
        version: systemInfo.data?.version,
        uptime: systemInfo.data?.uptime
      } : null
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

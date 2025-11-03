const express = require('express');
const router = express.Router();
const pfsense = require('../services/pfsense');

// Get all pending changes
router.get('/', async (req, res) => {
  try {
    const pending = await pfsense.getAllPendingChanges();
    res.json({ success: true, data: pending });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Apply service-specific changes
router.post('/apply/:service', async (req, res) => {
  try {
    const { service } = req.params;

    let result;
    if (service === 'dhcp') {
      result = await pfsense.applyDHCPChanges();
    } else if (service === 'firewall') {
      result = await pfsense.applyFirewallChanges();
    } else {
      return res.status(400).json({ success: false, error: 'Invalid service type' });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

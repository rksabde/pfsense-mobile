const express = require('express');
const router = express.Router();
const pfsense = require('../services/pfsense');

// Get all DHCP static mappings
router.get('/static', async (req, res) => {
  try {
    const mappings = await pfsense.getDHCPStaticMappings();
    res.json({ success: true, data: mappings.data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create/update static DHCP mapping
router.post('/static', async (req, res) => {
  try {
    const { mac, ip, hostname } = req.body;

    if (!mac) {
      return res.status(400).json({ success: false, error: 'MAC address is required' });
    }

    if (!ip) {
      return res.status(400).json({ success: false, error: 'IP address is required' });
    }

    // Validate MAC format
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(mac)) {
      return res.status(400).json({ success: false, error: 'Invalid MAC address format' });
    }

    // Validate IP format and range
    const validationError = pfsense.validateStaticIP(ip);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const result = await pfsense.setStaticDHCPMapping(mac, ip, hostname);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete static DHCP mapping
router.delete('/static/:mac', async (req, res) => {
  try {
    const { mac } = req.params;

    if (!mac) {
      return res.status(400).json({ success: false, error: 'MAC address is required' });
    }

    const result = await pfsense.deleteStaticDHCPMapping(mac);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Validate static IP
router.post('/validate-ip', async (req, res) => {
  try {
    const { ip, currentIP } = req.body;

    if (!ip) {
      return res.status(400).json({ success: false, error: 'IP address is required' });
    }

    const validationError = pfsense.validateStaticIP(ip, currentIP);

    if (validationError) {
      return res.json({ success: false, valid: false, error: validationError });
    }

    res.json({ success: true, valid: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

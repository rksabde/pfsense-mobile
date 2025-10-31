const express = require('express');
const router = express.Router();
const pfsense = require('../services/pfsense');

// Get all aliases (groups)
router.get('/', async (req, res) => {
  try {
    const aliases = await pfsense.getAliases();
    res.json({ success: true, data: aliases.data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get specific alias by name
router.get('/:name', async (req, res) => {
  try {
    const { name } = req.params;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Alias name is required' });
    }

    const alias = await pfsense.getAlias(name);
    res.json({ success: true, data: alias.data || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Block an entire alias group
router.post('/:name/block', async (req, res) => {
  try {
    const { name } = req.params;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Alias name is required' });
    }

    const result = await pfsense.blockAlias(name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unblock an entire alias group
router.post('/:name/unblock', async (req, res) => {
  try {
    const { name } = req.params;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Alias name is required' });
    }

    const result = await pfsense.unblockAlias(name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

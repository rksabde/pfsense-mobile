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

// Create new alias/group
router.post('/', async (req, res) => {
  try {
    const { name, addresses, description } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Alias name is required' });
    }

    const result = await pfsense.createAlias(name, addresses || [], description || '');
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update existing alias/group
router.put('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { addresses, description } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Alias name is required' });
    }

    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ success: false, error: 'Addresses array is required' });
    }

    const result = await pfsense.updateAlias(name, addresses, description || '');
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete alias/group
router.delete('/:name', async (req, res) => {
  try {
    const { name } = req.params;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Alias name is required' });
    }

    const result = await pfsense.deleteAlias(name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

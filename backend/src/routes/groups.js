const express = require('express');
const router = express.Router();
const pfsense = require('../services/pfsense');

// Get all aliases (groups) with block status
router.get('/', async (req, res) => {
  try {
    const aliases = await pfsense.getAliases();
    const aliasesData = aliases.data || [];

    // Enhance each alias with block status
    const enhancedAliases = await Promise.all(
      aliasesData.map(async (alias) => {
        const blockStatus = await pfsense.getGroupBlockStatus(alias.name, alias.address);
        return {
          ...alias,
          blockStatus
        };
      })
    );

    res.json({ success: true, data: enhancedAliases });
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

    const result = await pfsense.blockIdentifier(name);
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

    const result = await pfsense.unblockIdentifier(name);
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

// Add member to alias/group
router.post('/:name/members', async (req, res) => {
  try {
    const { name } = req.params;
    const { member } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Alias name is required' });
    }

    if (!member) {
      return res.status(400).json({ success: false, error: 'Member is required' });
    }

    const result = await pfsense.addMemberToAlias(name, member);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove member from alias/group
router.delete('/:name/members/:member', async (req, res) => {
  try {
    const { name, member } = req.params;
    const { unblock } = req.query;  // Optional: unblock=true to also unblock the member

    if (!name || !member) {
      return res.status(400).json({ success: false, error: 'Alias name and member are required' });
    }

    // Remove member from group
    const result = await pfsense.removeMemberFromAlias(name, decodeURIComponent(member));

    // If unblock flag is set, also unblock the member
    if (unblock === 'true') {
      try {
        await pfsense.unblockIdentifier(decodeURIComponent(member));
        result.message += ' and unblocked';
      } catch (unblockError) {
        console.warn('Failed to unblock member:', unblockError.message);
        result.message += ' (unblock failed)';
      }
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

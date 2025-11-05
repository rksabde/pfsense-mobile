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

// Get all groups that contain a specific client
router.get('/client/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;

    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Client identifier is required' });
    }

    // Get all aliases
    const aliases = await pfsense.getAliases();
    const aliasesData = aliases.data || [];

    // Filter groups that contain this identifier
    const clientGroups = aliasesData
      .filter(alias => {
        const members = alias.address || [];
        return members.some(member =>
          member === identifier ||
          member.toLowerCase() === identifier.toLowerCase()
        );
      })
      .map(alias => alias.name);

    res.json({ success: true, data: clientGroups });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update client's group memberships (add/remove from multiple groups)
router.post('/client/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { groups } = req.body; // Array of group names to be member of

    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Client identifier is required' });
    }

    if (!Array.isArray(groups)) {
      return res.status(400).json({
        success: false,
        error: 'Groups must be an array'
      });
    }

    // Get all aliases
    const aliases = await pfsense.getAliases();
    const aliasesData = aliases.data || [];

    // Protected groups that cannot be modified via this endpoint
    const PROTECTED = ['BLOCKED', 'WAN', 'LAN'];

    // For each group, add or remove the client
    const updates = await Promise.all(
      aliasesData.map(async (alias) => {
        const shouldBeMember = groups.includes(alias.name);
        const isMember = (alias.address || []).some(member =>
          member === identifier || member.toLowerCase() === identifier.toLowerCase()
        );

        // Skip protected groups
        if (PROTECTED.includes(alias.name)) {
          return { group: alias.name, action: 'skipped', reason: 'protected' };
        }

        // Add member if needed
        if (shouldBeMember && !isMember) {
          await pfsense.addMemberToGroup(alias.name, identifier);
          return { group: alias.name, action: 'added' };
        }

        // Remove member if needed
        if (!shouldBeMember && isMember) {
          await pfsense.removeMemberFromGroup(alias.name, identifier);
          return { group: alias.name, action: 'removed' };
        }

        return { group: alias.name, action: 'unchanged' };
      })
    );

    const summary = updates.filter(u => u.action !== 'unchanged' && u.action !== 'skipped');

    res.json({
      success: true,
      message: `Updated ${summary.length} groups`,
      data: summary
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

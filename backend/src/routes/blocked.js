const express = require('express');
const router = express.Router();
const pfsense = require('../services/pfsense');

// Get all blocked items (IPs and aliases)
router.get('/', async (req, res) => {
  try {
    const blockedItems = await pfsense.getBlockedItems();

    // Enrich with additional info
    const [dhcpLeases, aliases] = await Promise.all([
      pfsense.getDHCPLeases(),
      pfsense.getAliases()
    ]);

    const enrichedItems = blockedItems.map(item => {
      // Check if it's an IP or alias
      const parsed = pfsense.parseIdentifier(item);

      if (parsed.type === 'ip') {
        // Look up hostname from DHCP
        const lease = dhcpLeases.data?.find(l => l.ip === item);
        return {
          value: item,
          type: 'ip',
          hostname: lease?.hostname || 'Unknown',
          mac: lease?.mac || null
        };
      } else {
        // It's an alias - get alias details
        const alias = aliases.data?.find(a => a.name === item);
        return {
          value: item,
          type: 'alias',
          description: alias?.descr || '',
          memberCount: alias?.address?.length || 0
        };
      }
    });

    res.json({ success: true, data: enrichedItems });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Block an identifier (IP, hostname, or alias)
router.post('/:identifier/block', async (req, res) => {
  try {
    const { identifier } = req.params;

    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Identifier is required' });
    }

    const result = await pfsense.blockIdentifier(decodeURIComponent(identifier));
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unblock an identifier (IP, hostname, or alias)
router.post('/:identifier/unblock', async (req, res) => {
  try {
    const { identifier } = req.params;

    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Identifier is required' });
    }

    const result = await pfsense.unblockIdentifier(decodeURIComponent(identifier));
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

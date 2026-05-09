const express = require('express');
const router = express.Router();
const { getIsConnected } = require('../config/neo4j');
const neo4jService = require('../services/neo4jService');
const csvService = require('../services/csvService');

/**
 * GET /api/graph/traverse?company=<name>&hsn=<code>&depth=<n>
 * Traverse supply chain graph from a company.
 */
router.get('/traverse', async (req, res) => {
  try {
    const { company, hsn, depth } = req.query;

    if (!company) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const maxDepth = Math.min(parseInt(depth) || 5, 10);

    let result;
    if (getIsConnected()) {
      result = await neo4jService.traverseGraph(company, hsn, maxDepth);
    }
    if (!result) {
      result = csvService.traverseGraph(company, hsn, maxDepth);
    }

    res.json(result);
  } catch (err) {
    console.error('Traversal error:', err.message);
    res.status(500).json({ error: 'Graph traversal failed' });
  }
});

router.get('/stats', (req, res) => {
  try {
    const stats = csvService.getStats() || { totalCompanies: 0, totalTradeLinks: 0 };
    res.json({ stats });
  } catch (err) {
    res.json({ stats: { totalCompanies: 0, totalTradeLinks: 0 } });
  }
});

router.get('/debug/files', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    function getFiles(dir, depth = 0) {
      if (depth > 3) return [];
      const files = fs.readdirSync(dir);
      let results = [];
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          results.push({ name: file, type: 'dir', children: getFiles(fullPath, depth + 1) });
        } else {
          results.push({ name: file, type: 'file', size: fs.statSync(fullPath).size });
        }
      }
      return results;
    }

    res.json({
      cwd: process.cwd(),
      dirname: __dirname,
      tree: getFiles(process.cwd())
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const routeOptimizer = require('../services/routeOptimizer');

/**
 * POST /api/route/optimize
 * 
 * Dynamically computes the optimal supply chain route using A* pathfinding.
 * 
 * Body: { company: string, component: string }
 * 
 * Returns: {
 *   bestRoute: { route: string[], totalDistance: number, source, destination },
 *   allRoutes: [...],
 *   routeNodes: [...],
 *   routeEdges: [...],
 *   meta: { company, component, hsCode, destCountry, sourceCountries },
 *   steps: [...]
 * }
 */
router.post('/optimize', async (req, res) => {
  try {
    const { company, component } = req.body;

    if (!company || !component) {
      return res.status(400).json({
        error: 'Missing required fields: company and component',
        example: { company: 'Tesla', component: 'Lithium Battery' },
      });
    }

    console.log(`[Route] Optimizing: ${company} + ${component}`);

    const result = await routeOptimizer.optimize(company, component);

    if (result.error) {
      return res.status(404).json(result);
    }

    console.log(`[Route] Best: ${result.bestRoute.route.join(' → ')} (${result.bestRoute.totalDistance} km)`);
    res.json(result);

  } catch (err) {
    console.error('[Route] Optimization error:', err.message);
    res.status(500).json({ error: 'Route optimization failed', detail: err.message });
  }
});

module.exports = router;

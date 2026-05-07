/**
 * Route Optimization Service — A* Pathfinding with Haversine Distance
 * 
 * Dynamically computes the optimal supply chain route from source countries
 * to a destination company's country. All data is resolved at runtime from
 * the existing pipeline (CSV dataset, BOM service, Comtrade API).
 * 
 * Pipeline: Company → Country → Coords (from dataset)
 *           Component → HS → Comtrade → Source Countries
 *           Build fully-connected graph → A* for each source → pick best
 */

const csvService = require('./csvService');
const bomService = require('./bomService');
const comtradeService = require('./comtradeService');

// Normalize country names to match the dataset
const COUNTRY_NORMALIZE = {
  "people's republic of china": 'China',
  "republic of china": 'Taiwan',
  "kingdom of the netherlands": 'Netherlands',
  "dutch republic": 'Netherlands',
  "united kingdom of great britain and ireland": 'United Kingdom',
  "austria–hungary": 'Austria',
  "german reich": 'Germany',
  "german democratic republic": 'Germany',
  "czechoslovakia": 'Czech Republic',
};

function normalizeCountryName(raw) {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (lower.startsWith('country-')) return null; // Filter synthetic names
  return COUNTRY_NORMALIZE[lower] || raw.trim();
}

// ─── Haversine Formula ───
// Returns distance in kilometers between two lat/lng points
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// ─── A* Algorithm ───
// Finds shortest path from startNode to goalNode in a graph
// graph: Map<string, { lat, lng, neighbors: Map<string, distance> }>
function aStar(graph, startId, goalId) {
  const goalNode = graph.get(goalId);
  if (!goalNode) return null;

  // Heuristic: straight-line Haversine distance to goal
  const h = (nodeId) => {
    const node = graph.get(nodeId);
    if (!node) return Infinity;
    return haversine(node.lat, node.lng, goalNode.lat, goalNode.lng);
  };

  // Priority queue (simple sorted array — good enough for < 100 nodes)
  const openSet = new Set([startId]);
  const cameFrom = new Map();

  const gScore = new Map();
  gScore.set(startId, 0);

  const fScore = new Map();
  fScore.set(startId, h(startId));

  while (openSet.size > 0) {
    // Get node with lowest fScore
    let current = null;
    let lowestF = Infinity;
    for (const nodeId of openSet) {
      const f = fScore.get(nodeId) ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        current = nodeId;
      }
    }

    if (current === goalId) {
      // Reconstruct path
      const path = [current];
      let node = current;
      let trueDistance = 0;
      while (cameFrom.has(node)) {
        const prev = cameFrom.get(node);
        trueDistance += haversine(
          graph.get(node).lat, graph.get(node).lng,
          graph.get(prev).lat, graph.get(prev).lng
        );
        node = prev;
        path.unshift(node);
      }
      return {
        path,
        totalDistance: Math.round(trueDistance),
      };
    }

    openSet.delete(current);
    const currentNode = graph.get(current);
    if (!currentNode) continue;

    for (const [neighborId, edgeDist] of currentNode.neighbors) {
      const tentativeG = (gScore.get(current) ?? Infinity) + edgeDist;
      if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
        cameFrom.set(neighborId, current);
        gScore.set(neighborId, tentativeG);
        fScore.set(neighborId, tentativeG + h(neighborId));
        openSet.add(neighborId);
      }
    }
  }

  return null; // No path found
}

// ─── Main Route Optimizer ───
class RouteOptimizer {
  /**
   * Optimize route for a given company + component.
   * 
   * @param {string} companyName - e.g. "Tesla"
   * @param {string} componentName - e.g. "Lithium Battery"
   * @returns {Object} { route, totalDistance, details }
   */
  async optimize(companyName, componentName) {
    const steps = [];

    // ─── STEP 1: Resolve destination company → country → coordinates ───
    steps.push({ step: 1, action: 'Resolving destination' });

    let destGeo = csvService.resolveCompanyGeo(companyName);
    let destCountry, destLat, destLng;

    if (destGeo) {
      destCountry = destGeo.country;
      destLat = destGeo.lat;
      destLng = destGeo.lng;
    } else {
      // Fallback: Try company country from descriptions
      destCountry = csvService.getCompanyCountry(companyName) || 'United States';
      const countryGeo = csvService.getCountryGeo(destCountry);
      if (countryGeo) {
        destLat = countryGeo.lat;
        destLng = countryGeo.lng;
      } else {
        destLat = 37.09;
        destLng = -95.71; // Default to US center
      }
    }

    steps.push({ step: 1, result: `${companyName} → ${destCountry} [${destLat.toFixed(2)}, ${destLng.toFixed(2)}]` });

    // ─── STEP 2: Resolve component → HS code ───
    steps.push({ step: 2, action: 'Resolving HS code for component' });

    // Use BOM service to find HS code for the component
    const componentLower = componentName.toLowerCase();
    let hsCode = null;

    // Try local component → HS mapping first (instant, no API needed)
    const COMPONENT_HS_MAP = {
      'lithium battery': '8507', 'battery': '8507', 'lithium-ion battery': '8507',
      'steel': '72', 'iron': '72', 'aluminum': '76', 'aluminium': '76', 'copper': '74',
      'semiconductor': '8541', 'chip': '8542', 'electronics': '85', 'circuit': '8534',
      'plastic': '39', 'rubber': '40', 'glass': '70',
      'engine': '8407', 'motor': '8501', 'tire': '4011', 'tyre': '4011',
      'petroleum': '27', 'oil': '27', 'chemical': '28', 'organic chemical': '29',
      'copper wire': '74', 'wire': '74', 'cable': '8544',
      'display': '8528', 'screen': '8528', 'sensor': '9031',
      'pharmaceutical': '30', 'medicine': '30', 'drug': '30',
      'textile': '52', 'cotton': '52', 'fabric': '54',
      'paper': '48', 'machinery': '84', 'vehicle': '87', 'car': '87',
    };

    for (const [key, code] of Object.entries(COMPONENT_HS_MAP)) {
      if (componentLower.includes(key)) {
        hsCode = code;
        break;
      }
    }

    // If local mapping failed, try BOM service (may use Gemini or fallback)
    if (!hsCode) {
      try {
        const bomResult = await bomService.getStructuredBOM('85', componentName);
        if (Array.isArray(bomResult)) {
          const match = bomResult.find(b => 
            b.component.toLowerCase().includes(componentLower) || 
            componentLower.includes(b.component.toLowerCase())
          );
          if (match) hsCode = match.hs;
        }
      } catch (err) {
        console.warn(`[RouteOptimizer] BOM service error: ${err.message}. Using fallback HS.`);
      }
    }

    hsCode = hsCode || '85'; // Default fallback
    steps.push({ step: 2, result: `${componentName} → HS ${hsCode}` });

    // ─── STEP 3: Get source countries from Comtrade ───
    steps.push({ step: 3, action: 'Fetching source countries from Comtrade' });

    const partners = await comtradeService.getTopPartners(destCountry, hsCode);
    const sourceCountries = partners
      .map(p => normalizeCountryName(p.country))
      .filter(c => c && c !== destCountry);

    if (sourceCountries.length === 0) {
      return {
        error: 'No source countries found for this component via Comtrade.',
        steps,
      };
    }

    steps.push({ step: 3, result: `${sourceCountries.length} sources: ${sourceCountries.join(', ')}` });

    // ─── STEP 4: Build fully-connected country graph ───
    steps.push({ step: 4, action: 'Building country graph' });

    // Collect all unique countries (sources + destination + any intermediaries)
    const allCountries = new Set([destCountry, ...sourceCountries]);

    // Add some intermediate hub countries for richer routing
    const TRADE_HUBS = ['Singapore', 'Netherlands', 'Germany', 'United States', 'China', 'Japan', 'United Kingdom', 'South Korea', 'India', 'Turkey'];
    for (const hub of TRADE_HUBS) {
      allCountries.add(hub);
    }

    // Build graph nodes with coordinates
    const graph = new Map();
    const nodeDetails = new Map();

    for (const country of allCountries) {
      const geo = csvService.getCountryGeo(country);
      if (geo) {
        const isDestination = country === destCountry;
        // Use exact company coordinates for the destination, otherwise use country average
        const lat = isDestination ? destLat : geo.lat;
        const lng = isDestination ? destLng : geo.lng;
        
        // Ensure the selected company is at the front of the list for the destination node
        let nodeCompanies = geo.companies || [];
        if (isDestination && !nodeCompanies.includes(companyName)) {
          nodeCompanies = [companyName, ...nodeCompanies];
        } else if (isDestination) {
          nodeCompanies = [companyName, ...nodeCompanies.filter(c => c !== companyName)];
        }

        graph.set(country, {
          lat,
          lng,
          neighbors: new Map(),
        });
        nodeDetails.set(country, {
          name: country,
          lat,
          lng,
          companies: nodeCompanies,
          isSource: sourceCountries.includes(country),
          isDestination,
        });
      }
    }

    // Create edges with real-world logistics weightings
    const countries = Array.from(graph.keys());
    let edgeCount = 0;
    for (let i = 0; i < countries.length; i++) {
      for (let j = i + 1; j < countries.length; j++) {
        const a = graph.get(countries[i]);
        const b = graph.get(countries[j]);
        const dist = haversine(a.lat, a.lng, b.lat, b.lng);
        
        const isAHub = TRADE_HUBS.includes(countries[i]);
        const isBHub = TRADE_HUBS.includes(countries[j]);
        
        let cost = dist;
        // Apply logistics routing logic to force realistic hub-and-spoke behavior:
        if (isAHub && isBHub) {
          cost = dist * 0.5; // Hub-to-hub superhighways are "cheaper"
        } else if (isAHub || isBHub) {
          cost = dist * 0.8; // Spoke-to-hub is efficient
        } else if (dist > 3000) {
          cost = dist * 3.0; // Direct long-haul between non-hubs is highly penalized
        }

        a.neighbors.set(countries[j], cost);
        b.neighbors.set(countries[i], cost);
        edgeCount++;
      }
    }

    steps.push({ step: 4, result: `Graph: ${graph.size} nodes, ${countries.length * (countries.length - 1) / 2} edges` });

    // ─── STEP 5: Run A* from each source → destination ───
    steps.push({ step: 5, action: 'Running A* pathfinding' });

    const allPaths = [];
    for (const src of sourceCountries) {
      if (!graph.has(src)) continue;

      const result = aStar(graph, src, destCountry);
      if (result) {
        allPaths.push({
          source: src,
          path: result.path,
          totalDistance: result.totalDistance,
          tradeValue: partners.find(p => p.country === src)?.tradeValue || 0,
        });
      }
    }

    if (allPaths.length === 0) {
      return {
        error: 'A* could not find any valid path to destination.',
        steps,
      };
    }

    // ─── STEP 6: Select the best (shortest distance) path ───
    allPaths.sort((a, b) => a.totalDistance - b.totalDistance);
    const best = allPaths[0];

    steps.push({ step: 6, result: `Best: ${best.path.join(' → ')} (${best.totalDistance} km)` });

    // ─── Build map geometry for ALL routes ───
    const ROUTE_COLORS = [
      '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6',
      '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
    ];

    // Collect ALL unique route nodes across every path
    const allRouteNodesMap = new Map();
    for (const p of allPaths) {
      for (const country of p.path) {
        if (!allRouteNodesMap.has(country)) {
          const detail = nodeDetails.get(country);
          allRouteNodesMap.set(country, detail || { name: country, lat: 0, lng: 0, companies: [] });
        }
      }
    }
    const routeNodes = Array.from(allRouteNodesMap.values());

    // Build route edges for EVERY path (tagged with routeIndex + color)
    const routeEdges = [];
    for (let ri = 0; ri < allPaths.length; ri++) {
      const p = allPaths[ri];
      const color = ROUTE_COLORS[ri % ROUTE_COLORS.length];
      for (let i = 0; i < p.path.length - 1; i++) {
        const from = nodeDetails.get(p.path[i]);
        const to = nodeDetails.get(p.path[i + 1]);
        if (from && to) {
          routeEdges.push({
            from: [from.lat, from.lng],
            to: [to.lat, to.lng],
            fromCountry: from.name,
            toCountry: to.name,
            distance: haversine(from.lat, from.lng, to.lat, to.lng),
            routeIndex: ri,
            color,
            isBest: ri === 0,
          });
        }
      }
    }

    return {
      bestRoute: {
        route: best.path,
        totalDistance: best.totalDistance,
        source: best.source,
        destination: destCountry,
        tradeValue: best.tradeValue,
      },
      allRoutes: allPaths.map((p, i) => ({
        route: p.path,
        totalDistance: p.totalDistance,
        source: p.source,
        tradeValue: p.tradeValue || 0,
        color: ROUTE_COLORS[i % ROUTE_COLORS.length],
        routeIndex: i,
      })),
      routeNodes,
      routeEdges,
      meta: {
        company: companyName,
        component: componentName,
        hsCode,
        destCountry,
        destCoords: [destLat, destLng],
        sourceCountries,
      },
      steps,
    };
  }
}

module.exports = new RouteOptimizer();

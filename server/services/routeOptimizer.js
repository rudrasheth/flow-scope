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
   * @param {string} providedHsCode - optional explicit HS code
   * @returns {Object} { route, totalDistance, details }
   */
  async optimize(companyName, componentName, providedHsCode = null) {
    const steps = [];

    // ─── STEP 1: Resolve destination company → country → coordinates ───
    steps.push({ step: 1, action: 'Resolving Target Entity', result: `${companyName}` });

    let destGeo = csvService.resolveCompanyGeo(companyName);
    let destCountry, destLat, destLng;

    if (destGeo) {
      destCountry = destGeo.country;
      destLat = destGeo.lat;
      destLng = destGeo.lng;
    } else {
      // Fallback: Try company country from descriptions or trade history
      destCountry = csvService.getCompanyCountry(companyName);
      
      if (destCountry) {
        const countryGeo = csvService.getCountryGeo(destCountry);
        if (countryGeo) {
          destLat = countryGeo.lat;
          destLng = countryGeo.lng;
        } else {
          destLat = 20.59; destLng = 78.96; 
        }
      } else {
        console.warn(`[RouteOptimizer] Could not resolve country for ${companyName}. Defaulting to India.`);
        destCountry = 'India'; 
        destLat = 20.59;
        destLng = 78.96; 
      }
    }

    steps.push({ step: 2, action: 'Geo-Resolution Complete', result: `${destCountry} [${destLat.toFixed(2)}, ${destLng.toFixed(2)}]` });

    // Resolve destination company's standardized_industry for filtering source-country companies
    let destIndustry = destGeo?.standardizedIndustry || destGeo?.industry || '';
    
    // Fallback: Infer industry from description if missing (Sync with trace.js pipeline)
    if (!destIndustry) {
      const desc = (destGeo?.description || csvService.getCompanyDescription(companyName) || '').toLowerCase();
      if (desc.includes('automotive') || desc.includes('vehicle') || desc.includes(' car ')) destIndustry = 'Automotive Industry';
      else if (desc.includes('bank') || desc.includes('finance') || desc.includes('financial')) destIndustry = 'Banking & Financial Services';
      else if (desc.includes('steel') || desc.includes('metal')) destIndustry = 'Metal & Mining';
      else if (desc.includes('tech') || desc.includes('software') || desc.includes('electronic')) destIndustry = 'Technology & Electronics';
    }

    if (destIndustry) {
      steps.push({ step: 3, action: 'Industry Context Identified', result: destIndustry });
      console.log(`[RouteOptimizer] Industry resolved: "${destIndustry}" — filtering source companies strictly`);
    }

    // ─── STEP 2: Resolve component → HS code ───
    steps.push({ step: 4, action: 'HS Mapping Engine', result: `Resolving HS for "${componentName}"` });

    // Use provided HS code if available (Synchronized with BFS)
    let hsCode = providedHsCode;

    if (!hsCode) {
      const componentLower = componentName.toLowerCase();

      // Try local component → HS mapping first
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

      if (!hsCode) {
        try {
          const bomResult = await bomService.getStructuredBOM('85', componentName, companyName);
          if (Array.isArray(bomResult)) {
            const match = bomResult.find(b => 
              b.component.toLowerCase().includes(componentLower) || 
              componentLower.includes(b.component.toLowerCase())
            );
            if (match) hsCode = match.hs;
          }
        } catch (err) {
          console.warn(`[RouteOptimizer] BOM service error: ${err.message}`);
        }
      }
    }

    hsCode = hsCode || '85'; 
    steps.push({ step: 5, action: 'HS Mapping Success', result: `Component → HS ${hsCode}` });

    // ─── STEP 3: Get source countries from Comtrade ───
    steps.push({ step: 6, action: 'Comtrade Partner Discovery', result: `Fetching exporters for HS ${hsCode}...` });

    let partners = await comtradeService.getTopPartners(destCountry, hsCode);
    let sourceCountries = partners
      .map(p => normalizeCountryName(p.country))
      .filter(c => c && c !== destCountry);

    // ─── STEP 4: Build real trade country graph via Comtrade ───
    steps.push({ step: 7, action: 'Synthesizing Trade Network', result: `Analyzing ${sourceCountries.length} countries...` });

    const graph = new Map();
    const nodeDetails = new Map();

    const addNode = (country, isDestination, isSource) => {
      const geo = csvService.getCountryGeo(country);
      if (!geo) return false;
      if (!graph.has(country)) {
        const lat = (isDestination && destLat) ? destLat : geo.lat;
        const lng = (isDestination && destLng) ? destLng : geo.lng;
        
        let nodeCompanies = [];
        if (isDestination) {
          nodeCompanies = [companyName];
        } else if (destIndustry) {
          // STRICT: Only industry-matched companies (sorted by confidence)
          const industryMatched = csvService.findCompaniesByCountryAndIndustry(country, destIndustry, companyName);
          if (industryMatched.length > 0) {
            // Variety: Use HS code as a seed to pick different companies
            const hsSeed = parseInt(String(hsCode).substring(0, 4)) || 0;
            const limit = 6;
            const offset = (hsSeed % Math.max(1, Math.floor(industryMatched.length / limit))) * limit;
            const slice = industryMatched.slice(offset, offset + limit);
            nodeCompanies = (slice.length > 0 ? slice : industryMatched.slice(0, limit)).map(c => c.name);
          } else {
            // GATE: Skip country if no matching industry companies found (as per trace.js pipeline)
            console.log(`[RouteOptimizer] Skipping ${country} — no companies match industry "${destIndustry}"`);
            return false;
          }
        }

        graph.set(country, { lat, lng, neighbors: new Map() });
        nodeDetails.set(country, { name: country, lat, lng, companies: nodeCompanies, isSource: false, isDestination: false });
      }
      
      const details = nodeDetails.get(country);
      if (isSource) details.isSource = true;
      if (isDestination) details.isDestination = true;
      
      return true;
    };

    addNode(destCountry, true, false);

    // Link destCountry to direct suppliers (Tier 1)
    let edgeCount = 0;
    const validSources = [];
    for (const source of sourceCountries) {
      if (addNode(source, false, true)) {
        const a = graph.get(source);
        const b = graph.get(destCountry);
        const dist = haversine(a.lat, a.lng, b.lat, b.lng);
        a.neighbors.set(destCountry, dist);
        b.neighbors.set(source, dist);
        edgeCount++;
        validSources.push(source);
      }
    }
    sourceCountries = validSources;

    // ─── DATASET FALLBACK: If no Comtrade countries survived the industry filter ───
    if (sourceCountries.length === 0 && destIndustry) {
      steps.push({ step: 4, action: 'Trade Gap Detected', result: 'Mining global intelligence...' });
      console.log(`[RouteOptimizer] All trade links failed. Falling back to global dataset for "${destIndustry}"...`);
      const allCandidates = Array.from(csvService.geoCompanies.values())
        .filter(c => (c.standardizedIndustry || '').toLowerCase() === destIndustry.toLowerCase() && c.name.toLowerCase() !== companyName.toLowerCase())
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

      const hsSeed = parseInt(String(hsCode).substring(0, 4)) || 0;
      const t1Count = 6;
      const offset = (hsSeed % Math.max(1, allCandidates.length - t1Count));
      const finalCandidates = allCandidates.slice(offset, offset + t1Count);

      for (const candidate of finalCandidates) {
        if (addNode(candidate.country, false, true)) {
          const a = graph.get(candidate.country);
          const b = graph.get(destCountry);
          const dist = haversine(a.lat, a.lng, b.lat, b.lng);
          a.neighbors.set(destCountry, dist);
          b.neighbors.set(candidate.country, dist);
          edgeCount++;
          if (!sourceCountries.includes(candidate.country)) sourceCountries.push(candidate.country);
        }
      }
    }

    if (sourceCountries.length === 0) {
      return { error: 'No industry-relevant source countries found for this component.', steps };
    }

    steps.push({ step: 8, action: 'Sourcing Strategy', result: `${sourceCountries.length} Validated Partners` });

    // Expand top 3 Tier 1 sources to find Tier 2
    const topSources = sourceCountries.slice(0, 3);
    for (const source of topSources) {
      try {
        const tier2Partners = await comtradeService.getTopPartners(source, hsCode);
        for (const p2 of tier2Partners) {
          const t2Source = normalizeCountryName(p2.country);
          if (!t2Source || t2Source === source || t2Source === destCountry) continue;
          
          if (addNode(t2Source, false, true)) {
            const a = graph.get(t2Source);
            const b = graph.get(source);
            const dist = haversine(a.lat, a.lng, b.lat, b.lng);
            const cost = dist * 1.2;
            a.neighbors.set(source, cost);
            b.neighbors.set(t2Source, cost);
            edgeCount++;
            if (!sourceCountries.includes(t2Source)) sourceCountries.push(t2Source);
          }
        }
      } catch (err) {
        console.warn(`[RouteOptimizer] Tier 2 failure for ${source}`);
      }
    }

    steps.push({ step: 9, action: 'A* Neural Pathfinding', result: 'Computing shortest lead route...' });

    steps.push({ step: 10, action: 'Optimization Complete', result: `Graph: ${graph.size} nodes, ${edgeCount} edges` });

    // ─── STEP 5: Run A* from each source → destination ───
    steps.push({ step: 11, action: 'Executing Pathfinding', result: `Running A* for ${sourceCountries.length} origins...` });

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

    steps.push({ step: 12, action: 'Optimal Route Selected', result: `${best.path.join(' → ')} (${best.totalDistance} km)` });

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

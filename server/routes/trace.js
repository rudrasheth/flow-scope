const express = require('express');
const router = express.Router();
const bomService = require('../services/bomService');
const comtradeService = require('../services/comtradeService');
const csvService = require('../services/csvService');
const { getDriver, getIsConnected } = require('../config/neo4j');

// ─── HS Chapter → Relevant description keywords for company matching ───
const HS_PROFILE_KEYWORDS = {
  '72': ['steel', 'iron', 'metal', 'smelting', 'foundry', 'metallurg'],
  '73': ['steel', 'iron', 'metal', 'fabricat'],
  '74': ['copper', 'metal', 'wire', 'cable'],
  '75': ['nickel', 'metal', 'mining', 'mineral'],
  '76': ['aluminum', 'aluminium', 'metal'],
  '78': ['lead', 'metal', 'mining'],
  '79': ['zinc', 'metal', 'mining'],
  '80': ['tin', 'metal', 'mining'],
  '85': ['electronic', 'electrical', 'semiconductor', 'chip', 'battery', 'motor', 'circuit', 'technology'],
  '84': ['machinery', 'machine', 'engine', 'industrial', 'pump', 'compressor', 'equipment'],
  '87': ['automotive', 'vehicle', 'car', 'motor', 'auto', 'truck'],
  '39': ['plastic', 'polymer', 'resin', 'chemical'],
  '40': ['rubber', 'tire', 'tyre', 'elastomer'],
  '29': ['chemical', 'organic', 'pharmaceutical', 'synthesis'],
  '28': ['chemical', 'inorganic', 'industrial'],
  '30': ['pharma', 'drug', 'medicine', 'health'],
  '27': ['oil', 'fuel', 'petroleum', 'energy', 'gas', 'mining'],
  '26': ['ore', 'mining', 'mineral', 'extraction'],
  '25': ['mineral', 'mining', 'earth', 'sand', 'stone'],
  '90': ['instrument', 'optical', 'precision', 'medical'],
  '61': ['clothing', 'textile', 'garment', 'fashion', 'apparel'],
  '62': ['clothing', 'textile', 'garment', 'fashion', 'apparel'],
  '52': ['cotton', 'textile', 'fiber', 'fabric'],
  '54': ['synthetic', 'fiber', 'textile', 'filament'],
  '48': ['paper', 'pulp', 'packaging'],
  '70': ['glass', 'optical'],
  '38': ['chemical', 'industrial', 'compound'],
};

const COUNTRY_COORDS = {
  'India':[20.59,78.96],'United States':[37.09,-95.71],'China':[35.86,104.19],'Japan':[36.20,138.25],
  'South Korea':[35.90,127.76],'Germany':[51.16,10.45],'Taiwan':[23.69,120.96],'France':[46.22,2.21],
  'United Kingdom':[55.37,-3.43],'Switzerland':[46.81,8.22],'Singapore':[1.35,103.81],'Australia':[-25.27,133.77],
  'Brazil':[-14.23,-51.92],'Canada':[56.13,-106.35],'Netherlands':[52.13,5.29],'Italy':[41.87,12.56],
  'Spain':[40.46,-3.75],'Sweden':[60.12,18.64],'Norway':[60.47,8.47],'Finland':[61.92,25.75],
  'Denmark':[56.26,9.50],'Belgium':[50.50,4.47],'Austria':[47.52,14.55],'Poland':[51.92,19.14],
  'Czech Republic':[49.82,15.47],'Russia':[61.52,105.32],'Mexico':[23.63,-102.55],'Indonesia':[-0.79,113.92],
  'Thailand':[15.87,100.99],'Vietnam':[14.06,108.28],'Malaysia':[4.21,101.97],'Philippines':[12.88,121.77],
  'Turkey':[38.96,35.24],'Saudi Arabia':[23.88,45.08],'South Africa':[-30.56,22.94],'Luxembourg':[49.82,6.13],
  'Ireland':[53.14,-7.69],'Israel':[31.05,34.85],'Peru':[-9.19,-75.02],'Chile':[-35.67,-71.54],
  'Argentina':[-38.42,-63.62],'Colombia':[4.57,-74.30],'Portugal':[39.40,-8.22],'Greece':[39.07,21.82],
  'Romania':[45.94,24.97],'Hungary':[47.16,19.50],'Croatia':[45.10,15.20],'Serbia':[44.02,21.01],
  'Ukraine':[48.38,31.17],'Egypt':[26.82,30.80],'Nigeria':[9.08,8.68],'Kenya':[-0.02,37.91],
  'Pakistan':[30.37,69.34],'Bangladesh':[23.68,90.36],'Sri Lanka':[7.87,80.77],'Ivory Coast':[7.54,-5.55],
  'Congo':[-4.04,21.76],'Kuwait':[29.31,47.48],'Qatar':[25.35,51.18],'Oman':[21.47,55.97],
};

/**
 * Build description-based profile keywords for a given HS chapter.
 * Falls back to generic manufacturing keywords.
 */
function getProfileKeywords(hsChapter) {
  const chapter = String(hsChapter).substring(0, 2);
  return HS_PROFILE_KEYWORDS[chapter] || ['industr', 'manufactur', 'company', 'producer'];
}

/**
 * Get HS description from csvService taxonomy or HS_PROFILE_KEYWORDS.
 */
const CITY_COORDS = {
  'Mladá Boleslav': [50.41, 14.90], 'Yokohama': [35.44, 139.63], 'London': [51.50, -0.12], 'Toledo': [41.65, -83.53],
  'Smržovka': [50.73, 15.24], 'Naberezhnye Chelny': [55.74, 52.42], 'Round Rock': [30.50, -97.67], 'Crawley': [51.11, -0.18],
  'New York City': [40.71, -74.00], 'Fort Worth': [32.75, -97.33], 'Offenbach am Main': [50.10, 8.76], 'Taipei': [25.03, 121.56],
  'Vysoké Mýto': [49.95, 16.16], 'Stamford': [41.05, -73.53], 'Seoul': [37.56, 126.97], 'Dallas': [32.77, -96.79],
  'Ängelholm': [56.24, 12.86], 'Sant\'Agata Bolognese': [44.66, 11.13], 'Liberec': [50.76, 15.05], 'Stuttgart': [48.77, 9.18],
  'Armonk': [41.12, -73.71], 'Tokyo': [35.67, 139.65], 'Beijing': [39.90, 116.40], 'Shanghai': [31.23, 121.47],
  'Mumbai': [19.07, 72.87], 'Bengaluru': [12.97, 77.59], 'Chennai': [13.08, 80.27], 'New Taipei': [25.01, 121.46],
  'Hsinchu City': [24.81, 120.96], 'Wolfsburg': [52.42, 10.78], 'Munich': [48.13, 11.58], 'Cologne': [50.93, 6.95],
  'Essen': [51.45, 7.01], 'Hamburg': [53.55, 9.99], 'Dortmund': [51.51, 7.46], 'Detroit': [42.33, -83.04],
  'Chicago': [41.87, -87.62], 'San Francisco': [37.77, -122.41], 'San Jose': [37.33, -121.88], 'Palo Alto': [37.44, -122.14],
  'Mountain View': [37.38, -122.08], 'Santa Clara': [37.35, -121.95], 'Austin': [30.26, -97.74], 'Houston': [29.76, -95.36],
  'Paris': [48.85, 2.35], 'Lyon': [45.76, 4.83], 'Berlin': [52.52, 13.40], 'Frankfurt': [50.11, 8.68],
  'Amsterdam': [52.36, 4.90], 'Rotterdam': [51.92, 4.47], 'Brussels': [50.85, 4.35], 'Milan': [45.46, 9.18],
  'Turin': [45.07, 7.68], 'Bangkok': [13.75, 100.50], 'Singapore': [1.35, 103.81], 'Hong Kong': [22.31, 114.16],
  'Osaka': [34.69, 135.50], 'Nagoya': [35.18, 136.90], 'Hiroshima': [34.38, 132.45], 'Toyota': [35.08, 137.15],
};

function getCoords(country, city) {
  // 1. Try Dataset-driven smart coordinates (confidence >= 7 or country average)
  const smartGeo = csvService.getCountryGeo(country);
  if (smartGeo) {
    if (smartGeo.isExactCompanyAnchor) {
      return [smartGeo.lat, smartGeo.lng]; // Precision anchor - NO jitter
    }
    // Fallback: Jitter the country average so nodes don't overlap perfectly
    return [
      smartGeo.lat + (Math.random() - 0.5) * 1.5,
      smartGeo.lng + (Math.random() - 0.5) * 1.5
    ];
  }
  
  // 2. Local fallback if country not in dataset
  const base = COUNTRY_COORDS[country] || [20, 77];
  return [base[0] + (Math.random() - 0.5) * 2, base[1] + (Math.random() - 0.5) * 2];
}

function getHsLabel(hsCode) {
  const desc = csvService.getHsDescription?.(hsCode);
  if (desc) return desc;
  // Fallback to generic labels
  const labels = {
    '72':'Iron/Steel','73':'Steel articles','74':'Copper','75':'Nickel','76':'Aluminum',
    '85':'Electronics','84':'Machinery','87':'Vehicles','39':'Plastics','40':'Rubber',
    '29':'Organic chemicals','28':'Inorganic chemicals','30':'Pharmaceuticals',
    '27':'Mineral fuels','26':'Ores','25':'Minerals','90':'Instruments',
  };
  return labels[String(hsCode).substring(0, 2)] || `HS ${hsCode}`;
}

router.post('/expand', async (req, res) => {
  try {
    const {
      companyName,
      companyCountry,
      targetHsCode,
      maxTiers = 2,
      traceMode = 'hybrid',
      strictGemini = false,
      socketId, // Get socketId from request
    } = req.body;
    
    if (!companyName || !targetHsCode) return res.status(400).json({ error: 'Missing parameters' });

    const io = req.io;
    const emitUpdate = (type, data) => {
      if (io && socketId) {
        io.to(socketId).emit('graph-update', { type, data });
      }
    };

    const emitStatus = (message) => {
      if (io && socketId) {
        io.to(socketId).emit('status', { message });
      }
    };

    const normalizedMode = String(traceMode || 'hybrid').toLowerCase();
    const allowGemini = normalizedMode !== 'comtrade-only';

    let geminiAttemptCount = 0;
    let geminiSuccessCount = 0;
    let geminiFailureCount = 0;

    // Queue for BFS traversal
    const queue = [{ name: companyName, country: companyCountry || 'Unknown', hs: targetHsCode, tier: 0 }];
    const allNodes = new Map();
    const allEdges = [];
    const visitedCompanies = new Set([companyName]);

    emitStatus(`Starting expansion for ${companyName}...`);

    // Initial Node from DB/CSV
    let initialDesc = csvService.getCompanyDescription(companyName) || 'Global industrial entity.';
    let initialCity = null;
    
    const dossier = csvService.descriptions.get(companyName.toLowerCase());
    if (dossier) {
      initialDesc = dossier.description || initialDesc;
      initialCity = dossier.city;
    }

    if (getIsConnected() && (!initialDesc || initialDesc.includes('Global industrial'))) {
      const session = getDriver().session();
      try {
        const result = await session.run('MATCH (c:Company {name: $name}) RETURN c.description AS d', { name: companyName });
        if (result.records.length > 0) initialDesc = result.records[0].get('d') || initialDesc;
      } finally { await session.close(); }
    }

    const rootId = `c_${companyName}`;
    let rootLat = 20, rootLng = 77;
    const companyGeo = csvService.resolveCompanyGeo(companyName);
    
    if (companyGeo) {
      rootLat = companyGeo.lat;
      rootLng = companyGeo.lng;
    } else {
      const coords = getCoords(companyCountry, initialCity);
      rootLat = coords[0];
      rootLng = coords[1];
    }

    const rootNode = { 
      id: rootId, type: 'Company', label: companyName, country: companyCountry || 'Unknown', city: initialCity, tier: 0, 
      description: initialDesc,
      coords: [rootLat, rootLng],
      source: 'user-input',
      confidence: 'anchor'
    };
    allNodes.set(rootId, rootNode);
    emitUpdate('node', rootNode);

    while (queue.length > 0 && allNodes.size < 100) {
      const current = queue.shift();
      if (!current || current.tier >= maxTiers) continue;

      emitStatus(`Processing ${current.name} (Tier ${current.tier})...`);

      // ─── STEP 1: Get Structured BOM (now dataset driven) ───
      emitStatus(`Extracting BOM for ${current.name}...`);
      let bomList = [];
      let usedGemini = false; // Kept for edge compatibility

      try {
        const result = await bomService.getStructuredBOM(current.hs, current.description || '', current.name);
        if (Array.isArray(result) && result.length > 0) {
          bomList = result;
        }
      } catch (err) {
        console.warn(`[TRACE] BOM extraction failed for HS ${current.hs}: ${err.message}`);
      }

      // Ensure bomList is an array before processing
      if (!Array.isArray(bomList)) bomList = [];

      // Limit branching for speed
      for (const item of bomList.slice(0, 3)) {
        if (!item || !item.component) continue;

        // ─── STEP 2: Granular HS Validation ───
        const validHs = typeof csvService.getMostGranularValidHs === 'function' 
          ? csvService.getMostGranularValidHs(item.hs)
          : String(item.hs || '85').substring(0, 2);
          
        const hsLabel = getHsLabel(validHs);
        
        // ─── STEP 3: Add Component Node & Edge ───
        const compNodeId = `comp_${validHs}_${item.component.replace(/[^a-zA-Z0-9]/g, '')}`;
        if (!allNodes.has(compNodeId)) {
          const compNode = {
            id: compNodeId, type: 'Component', label: item.component, hsCode: validHs, tier: current.tier + 1,
            coords: null 
          };
          allNodes.set(compNodeId, compNode);
          emitUpdate('node', compNode);
        }
        
        const reqEdge = {
          from: `c_${current.name}`, to: compNodeId, relation: 'REQUIRES',
          provenance: usedGemini ? 'gemini' : 'fallback'
        };
        allEdges.push({ ...reqEdge, source: reqEdge.from, target: reqEdge.to, type: reqEdge.relation });
        emitUpdate('edge', reqEdge);

        // ─── STEP 4: Fetch Trade Data from Comtrade ───
        emitStatus(`Fetching trade data for ${item.component}...`);
        let partnerCountries = [];
        try {
          partnerCountries = await comtradeService.getTopPartners(current.country, validHs);
        } catch (err) {
          console.error(`[TRACE] Comtrade service error for ${item.component}:`, err.message);
        }
        
        if (!Array.isArray(partnerCountries)) partnerCountries = [];

        // ─── STEP 5: Resolve supplier entities in partner countries ───
        const keywords = item.keywords || getProfileKeywords(validHs);

        for (const partner of partnerCountries.slice(0, 2)) {
          const partnerCountry = partner.country;
          const locNodeId = `loc_${partnerCountry.replace(/[^a-zA-Z0-9]/g, '')}`;
          
          const countryGeo = csvService.getCountryGeo(partnerCountry);
          let locLat = 20, locLng = 77;
          if (countryGeo) {
            locLat = countryGeo.lat;
            locLng = countryGeo.lng;
          } else {
            locLat = COUNTRY_COORDS[partnerCountry]?.[0] || 20;
            locLng = COUNTRY_COORDS[partnerCountry]?.[1] || 77;
          }

          if (!allNodes.has(locNodeId)) {
            const locNode = {
              id: locNodeId, type: 'Location', label: partnerCountry,
              coords: [locLat, locLng]
            };
            allNodes.set(locNodeId, locNode);
            emitUpdate('node', locNode);
          }
          
          const impEdge = {
            from: compNodeId, to: locNodeId, relation: 'IMPORTED_FROM', tradeValue: partner.tradeValue
          };
          allEdges.push({ ...impEdge, source: impEdge.from, target: impEdge.to, type: impEdge.relation });
          emitUpdate('edge', impEdge);

          let matchedCompanies = [];

          try {
            if (getIsConnected()) {
              const session = getDriver().session();
              try {
                let keywordClauses = '';
                if (Array.isArray(keywords) && keywords.length > 0) {
                  keywordClauses = 'AND (' + keywords.slice(0, 3).map((_, i) => `toLower(s.description) CONTAINS $kw${i}`).join(' OR ') + ')';
                }
                const params = { partnerCountry, currentName: current.name };
                if (Array.isArray(keywords)) keywords.slice(0, 3).forEach((kw, i) => { params[`kw${i}`] = kw.toLowerCase(); });

                const result = await session.run(`
                  MATCH (s:Company)
                  WHERE toLower(s.country) = toLower($partnerCountry) AND s.name <> $currentName AND s.description IS NOT NULL ${keywordClauses}
                  RETURN s.name AS name, s.country AS country, s.description AS desc ORDER BY size(s.description) DESC LIMIT 2
                `, params);
                matchedCompanies = result.records.map(r => ({ name: r.get('name'), country: r.get('country') || partnerCountry, description: r.get('desc') || '' }));
                
                if (matchedCompanies.length === 0) {
                  const fbResult = await session.run(`
                    MATCH (s:Company) WHERE toLower(s.country) = toLower($partnerCountry) AND s.name <> $currentName AND s.description IS NOT NULL AND size(s.description) > 5
                    RETURN s.name AS name, s.country AS country, s.description AS desc LIMIT 1
                  `, { partnerCountry, currentName: current.name });
                  matchedCompanies = fbResult.records.map(r => ({ name: r.get('name'), country: r.get('country') || partnerCountry, description: r.get('desc') || '' }));
                }
              } finally { await session.close(); }
            } else {
              // CSV Fallback
              const csvCandidates = csvService.findCompaniesByCountryAndProfile(partnerCountry, keywords);
              matchedCompanies = csvCandidates.filter(c => c.name !== current.name).slice(0, 2).map(c => ({ name: c.name, country: c.country, description: c.description }));
              if (matchedCompanies.length === 0) {
                const anyInCountry = Array.from(csvService.companies.values()).filter(c => c.country && c.country.toLowerCase() === String(partnerCountry).toLowerCase() && c.name !== current.name).slice(0, 1);
                matchedCompanies = anyInCountry.map(c => ({ name: c.name, country: c.country, description: csvService.getCompanyDescription(c.name) || '' }));
              }
            }
          } catch (err) {
            console.error(`[TRACE] Entity resolution error for ${partnerCountry}:`, err.message);
          }

          if (matchedCompanies.length === 0) {
            matchedCompanies.push({
              name: `National ${hsLabel} Export Co. (${partnerCountry})`,
              country: partnerCountry,
              description: `Synthetic supplier generated for ${partnerCountry} to visualize the trade route.`
            });
          }

          // ─── STEP 6: Add Supplier Node & Recursion Edge ───
          for (const matched of matchedCompanies) {
            const supplierId = `c_${matched.name}`;
            const dossier = csvService.resolveCompanyGeo(matched.name);
            const supDesc = dossier?.description || csvService.getCompanyDescription(matched.name) || matched.description || 'Supply chain partner.';
            const supCity = dossier?.city || null;
            
            let supLat = 20, supLng = 77;
            if (matched.lat && matched.lng) {
              supLat = matched.lat;
              supLng = matched.lng;
            } else if (dossier) {
              supLat = dossier.lat;
              supLng = dossier.lng;
            } else {
              const coords = getCoords(matched.country || partnerCountry, supCity);
              supLat = coords[0];
              supLng = coords[1];
            }

            if (!allNodes.has(supplierId)) {
              const supNode = {
                id: supplierId, type: 'Company', label: matched.name, country: matched.country || partnerCountry, city: supCity,
                tier: current.tier + 1, coords: [supLat, supLng], description: supDesc
              };
              allNodes.set(supplierId, supNode);
              emitUpdate('node', supNode);
            }
            
            const supEdge = { from: locNodeId, to: supplierId, relation: 'SUPPLIED_BY' };
            allEdges.push({ ...supEdge, source: supEdge.from, target: supEdge.to, type: supEdge.relation });
            emitUpdate('edge', supEdge);

            const directEdge = { source: supplierId, target: `c_${current.name}`, type: 'SUPPLIES_DIRECT', component: item.component, hsn: validHs, tradeValue: partner.tradeValue };
            allEdges.push(directEdge);

            if (!visitedCompanies.has(matched.name)) {
              visitedCompanies.add(matched.name);
              queue.push({ name: matched.name, country: matched.country || partnerCountry, hs: validHs, tier: current.tier + 1, description: supDesc });
            }
          }
        }
      }
    }

    emitStatus('Expansion complete.');

    const tradeRoutes = allEdges.filter(e => e.type === 'SUPPLIES_DIRECT' || e.type === 'UPSTREAM_IMPORT' || e.type === 'IMPORT').map(e => {
      const s = allNodes.get(e.source), t = allNodes.get(e.target);
      return (s && t && s.coords && t.coords) ? { from: s.coords, to: t.coords, fromName: s.label, toName: t.label, hsn: e.hsn, type: e.type } : null;
    }).filter(r => r);

    res.json({
      nodes: Array.from(allNodes.values()),
      edges: allEdges,
      tradeRoutes,
      meta: {
        totalNodes: allNodes.size,
        totalEdges: allEdges.length,
        mode: normalizedMode,
        gemini: {
          enabled: allowGemini,
          attempts: geminiAttemptCount,
          successes: geminiSuccessCount,
          failures: geminiFailureCount,
        },
      },
    });
  } catch (error) {
    console.error('[TRACE] Fatal Error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

module.exports = router;

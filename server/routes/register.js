const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const csvService = require('../services/csvService');
const { getDriver, getIsConnected } = require('../config/neo4j');

// ─── Write Lock (prevents concurrent CSV corruption) ───
let writeLock = false;

// ─── Resolve CSV path ───
function getCsvPath() {
  const possiblePaths = [
    path.join(process.cwd(), 'server', 'data', 'geo_intel.csv'),
    path.join(process.cwd(), 'data', 'geo_intel.csv'),
    path.join(__dirname, '..', 'data', 'geo_intel.csv'),
  ];
  return possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
}

// ─── Escape a value for CSV (handles commas, quotes, newlines) ───
function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ─── Validation Helpers ───
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateCoord(lat, lng) {
  const la = parseFloat(lat);
  const lo = parseFloat(lng);
  return !isNaN(la) && !isNaN(lo) && la >= -90 && la <= 90 && lo >= -180 && lo <= 180;
}

function validateConfidence(score) {
  const n = parseInt(score, 10);
  return !isNaN(n) && n >= 0 && n <= 10;
}

// ─── GET /api/register/industries ───
// Returns all unique standardized industries from the dataset (dynamic, not hardcoded)
router.get('/industries', (req, res) => {
  try {
    const industries = csvService.allIndustries ? Array.from(csvService.allIndustries) : [];
    
    // Also include any industries that might only exist in geoCompanies (just in case they were added dynamically)
    for (const company of csvService.geoCompanies.values()) {
      if (company.standardizedIndustry && !industries.includes(company.standardizedIndustry)) {
        industries.push(company.standardizedIndustry);
      }
    }
    
    res.json({ industries: industries.sort() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch industries', detail: err.message });
  }
});

// ─── GET /api/register/bom-suggestions ───
// Returns BOM filter suggestions for a given standardized industry
router.get('/bom-suggestions', (req, res) => {
  try {
    const { industry } = req.query;
    if (!industry) return res.json({ suggestions: [] });

    const bomSet = new Set();
    for (const company of csvService.geoCompanies.values()) {
      if (company.standardizedIndustry &&
          company.standardizedIndustry.toLowerCase() === industry.toLowerCase() &&
          company.bomFilter && Array.isArray(company.bomFilter)) {
        company.bomFilter.forEach(b => bomSet.add(b));
      }
    }
    res.json({ suggestions: Array.from(bomSet).sort() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch BOM suggestions', detail: err.message });
  }
});

// ─── GET /api/register/check-duplicate ───
// Real-time duplicate check
router.get('/check-duplicate', (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.json({ exists: false });

    const lowerName = name.trim().toLowerCase();

    // Check geoCompanies
    if (csvService.geoCompanies.has(lowerName)) {
      return res.json({ exists: true, source: 'geo_intel' });
    }

    // Check trade companies
    for (const [cName] of csvService.companies) {
      if (cName.toLowerCase() === lowerName) {
        return res.json({ exists: true, source: 'trade_data' });
      }
    }

    res.json({ exists: false });
  } catch (err) {
    res.status(500).json({ error: 'Duplicate check failed', detail: err.message });
  }
});

// ─── POST /api/register ───
// Register a new company and append to geo_intel.csv
router.post('/', async (req, res) => {
  if (writeLock) {
    return res.status(429).json({ error: 'Server is processing another registration. Please try again in a moment.' });
  }

  writeLock = true;

  try {
    const {
      companyName, description, industry, standardizedIndustry,
      country, city, latitude, longitude,
      bomFilters, email, contactPerson, supplyChainRole,
      confidence,
      // Optional fields
      website, phone, state, postalCode, linkedin,
      secondaryIndustries, additionalBom, certifications, notes
    } = req.body;

    // ─── REQUIRED FIELD VALIDATION ───
    const missing = [];
    if (!companyName?.trim()) missing.push('Company Name');
    if (!description?.trim()) missing.push('Description');
    if (!industry?.trim()) missing.push('Industry');
    if (!standardizedIndustry?.trim()) missing.push('Standardized Industry');
    if (!country?.trim()) missing.push('Country');
    if (!city?.trim()) missing.push('City');
    if (latitude === undefined || latitude === '') missing.push('Latitude');
    if (longitude === undefined || longitude === '') missing.push('Longitude');
    if (!bomFilters || (Array.isArray(bomFilters) && bomFilters.length === 0)) missing.push('BOM Filters');
    if (!email?.trim()) missing.push('Email');
    if (!contactPerson?.trim()) missing.push('Contact Person');
    if (!supplyChainRole?.trim()) missing.push('Supply Chain Role');
    if (confidence === undefined || confidence === '') missing.push('Confidence Score');

    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    // ─── FORMAT VALIDATION ───
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }
    if (!validateCoord(latitude, longitude)) {
      return res.status(400).json({ error: 'Invalid coordinates. Latitude: -90 to 90, Longitude: -180 to 180.' });
    }
    if (!validateConfidence(confidence)) {
      return res.status(400).json({ error: 'Confidence must be an integer from 0 to 10.' });
    }

    // ─── DUPLICATE CHECK ───
    const lowerName = companyName.trim().toLowerCase();
    if (csvService.geoCompanies.has(lowerName)) {
      return res.status(409).json({ error: `Company "${companyName}" already exists in the intelligence database.` });
    }

    // ─── BUILD CSV ROW ───
    // Columns: entity_id,company_name,wikidata_qid,country,wikidata_hq,wikidata_description,
    //          full_location_info,latitude,longitude,formatted_address,confidence,location_type,
    //          house_number,road,suburb,neighbourhood,city_clean,county,state,postcode,
    //          country_clean,country_code,bounds_ne_lat,bounds_ne_lng,bounds_sw_lat,bounds_sw_lng,
    //          timezone,currency,flag,industry,standardized_industry,BOM_filter

    const entityId = `user_${Date.now()}`;
    const fullLocationInfo = `${companyName.trim()} ${city.trim()} ${description.trim()}`;
    const formattedAddress = `${city.trim()}, ${state || ''}, ${country.trim()}`.replace(/, ,/g, ',');
    const countryCode = country.trim().substring(0, 2).toLowerCase();

    // Build BOM filter string in the same format as existing data: "['item1', 'item2']"
    const bomArray = Array.isArray(bomFilters) ? bomFilters : [bomFilters];
    const bomString = `"['${bomArray.join("', '")}']"`;

    // Combine all industry info
    let fullIndustry = industry.trim();
    if (secondaryIndustries) {
      fullIndustry += `, ${secondaryIndustries}`;
    }

    // Combine description with optional fields for richer metadata
    let fullDesc = description.trim();
    if (supplyChainRole) fullDesc += ` | Role: ${supplyChainRole}`;
    if (contactPerson) fullDesc += ` | Contact: ${contactPerson}`;
    if (email) fullDesc += ` | Email: ${email}`;
    if (certifications) fullDesc += ` | Certifications: ${certifications}`;
    if (notes) fullDesc += ` | Notes: ${notes}`;

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const conf = parseInt(confidence, 10);

    const csvRow = [
      csvEscape(entityId),                          // entity_id
      csvEscape(companyName.trim()),                 // company_name
      '',                                            // wikidata_qid
      csvEscape(country.trim()),                     // country
      csvEscape(city.trim()),                        // wikidata_hq
      csvEscape(fullDesc),                           // wikidata_description
      csvEscape(fullLocationInfo),                   // full_location_info
      lat,                                           // latitude
      lng,                                           // longitude
      csvEscape(formattedAddress),                   // formatted_address
      conf,                                          // confidence
      '',                                            // location_type
      '',                                            // house_number
      '',                                            // road
      '',                                            // suburb
      '',                                            // neighbourhood
      csvEscape(city.trim()),                        // city_clean
      '',                                            // county
      csvEscape(state || ''),                        // state
      csvEscape(postalCode || ''),                   // postcode
      csvEscape(country.trim()),                     // country_clean
      countryCode,                                   // country_code
      '',                                            // bounds_ne_lat
      '',                                            // bounds_ne_lng
      '',                                            // bounds_sw_lat
      '',                                            // bounds_sw_lng
      '',                                            // timezone
      '',                                            // currency
      '',                                            // flag
      csvEscape(fullIndustry),                       // industry
      csvEscape(standardizedIndustry.trim()),        // standardized_industry
      bomString                                      // BOM_filter
    ].join(',');

    // ─── CSV BACKUP ───
    const csvPath = getCsvPath();
    const backupDir = path.join(path.dirname(csvPath), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupPath = path.join(backupDir, `geo_intel_backup_${Date.now()}.csv`);

    // Only keep last 5 backups
    try {
      const backups = fs.readdirSync(backupDir).sort();
      while (backups.length > 5) {
        fs.unlinkSync(path.join(backupDir, backups.shift()));
      }
    } catch (e) { /* ignore cleanup errors */ }

    fs.copyFileSync(csvPath, backupPath);

    // ─── APPEND TO CSV ───
    fs.appendFileSync(csvPath, '\n' + csvRow, 'utf8');

    // ─── UPDATE IN-MEMORY CACHE ───
    // Add to geoCompanies so routing/search works immediately
    csvService.geoCompanies.set(lowerName, {
      name: companyName.trim(),
      country: country.trim(),
      lat, lng,
      city: city.trim(),
      description: fullDesc,
      confidence: conf,
      industry: fullIndustry,
      standardizedIndustry: standardizedIndustry.trim(),
      bomFilter: bomArray
    });

    // Update country coords
    const countryKey = country.trim().toLowerCase();
    if (!csvService.countryCoords.has(countryKey)) {
      csvService.countryCoords.set(countryKey, {
        lat: 0, lng: 0, count: 0,
        companies: [], companyCoords: [],
        country: country.trim(),
        bestCoord: { lat, lng, confidence: conf }
      });
    }
    const entry = csvService.countryCoords.get(countryKey);
    entry.lat = ((entry.lat * entry.count) + lat) / (entry.count + 1);
    entry.lng = ((entry.lng * entry.count) + lng) / (entry.count + 1);
    entry.count += 1;
    if (conf > (entry.bestCoord?.confidence || 0)) {
      entry.bestCoord = { lat, lng, confidence: conf };
    }
    if (entry.companies.length < 10) {
      entry.companies.push(companyName.trim());
      entry.companyCoords.push({ lat, lng });
    }

    // Update industry coords
    if (standardizedIndustry) {
      const industryKey = `${countryKey}|${standardizedIndustry.trim().toLowerCase()}`;
      if (!csvService.industryCoords.has(industryKey)) {
        csvService.industryCoords.set(industryKey, { lat: 0, lng: 0, count: 0, coords: [] });
      }
      const indEntry = csvService.industryCoords.get(industryKey);
      indEntry.lat = ((indEntry.lat * indEntry.count) + lat) / (indEntry.count + 1);
      indEntry.lng = ((indEntry.lng * indEntry.count) + lng) / (indEntry.count + 1);
      indEntry.count += 1;
      if (indEntry.coords.length < 5) {
        indEntry.coords.push({ lat, lng });
      }
    }

    // Add to descriptions cache
    csvService.descriptions.set(lowerName, {
      description: fullDesc,
      country: country.trim(),
      city: city.trim()
    });

    console.log(`[Register] ✓ New company registered: ${companyName} (${country}, confidence: ${conf})`);

    // ─── NEO4J SYNC ───
    if (getIsConnected()) {
      const session = getDriver().session();
      try {
        await session.run(
          `MERGE (c:Company {name: $name})
           SET c.country = $country,
               c.city = $city,
               c.industry = $industry,
               c.description = $description,
               c.latitude = $lat,
               c.longitude = $lng,
               c.confidence = $conf,
               c.bomFilter = $bomFilter`,
          {
            name: companyName.trim(),
            country: country.trim(),
            city: city.trim(),
            industry: fullIndustry,
            description: fullDesc,
            lat,
            lng,
            conf,
            bomFilter: JSON.stringify(bomArray)
          }
        );
        console.log(`[Register] ✓ Successfully synced to Neo4j database`);
      } catch (neoErr) {
        console.error(`[Register] ⚠ Neo4j sync failed:`, neoErr.message);
      } finally {
        await session.close();
      }
    }


    res.status(201).json({
      success: true,
      message: `${companyName} has been successfully registered in the FlowScope intelligence database.`,
      company: {
        name: companyName.trim(),
        country: country.trim(),
        city: city.trim(),
        lat, lng,
        confidence: conf,
        industry: fullIndustry,
        standardizedIndustry: standardizedIndustry.trim()
      }
    });

  } catch (err) {
    console.error('[Register] Error:', err.message);
    res.status(500).json({ error: 'Registration failed.', detail: err.message });
  } finally {
    writeLock = false;
  }
});

// ─── GET /api/register/directory ───
// Advanced company directory search
router.get('/directory', (req, res) => {
  try {
    const { q, industry, country, bom, role, page = 1, limit = 20 } = req.query;
    const results = [];

    for (const company of csvService.geoCompanies.values()) {
      let match = true;

      // Text search (name or description)
      if (q) {
        const query = q.toLowerCase();
        const searchText = `${company.name} ${company.description || ''} ${company.industry || ''}`.toLowerCase();
        if (!searchText.includes(query)) match = false;
      }

      // Industry filter
      if (match && industry) {
        const ind = (company.standardizedIndustry || '').toLowerCase();
        if (!ind.includes(industry.toLowerCase())) match = false;
      }

      // Country filter
      if (match && country) {
        if ((company.country || '').toLowerCase() !== country.toLowerCase()) match = false;
      }

      // BOM filter
      if (match && bom) {
        const bomLower = bom.toLowerCase();
        const companyBom = (company.bomFilter || []).map(b => b.toLowerCase());
        if (!companyBom.some(b => b.includes(bomLower))) match = false;
      }

      // Role filter (stored in description)
      if (match && role) {
        const desc = (company.description || '').toLowerCase();
        if (!desc.includes(`role: ${role.toLowerCase()}`)) match = false;
      }

      if (match) {
        results.push({
          name: company.name,
          country: company.country,
          city: company.city || '',
          lat: company.lat,
          lng: company.lng,
          confidence: company.confidence,
          industry: company.industry || '',
          standardizedIndustry: company.standardizedIndustry || '',
          bomFilter: company.bomFilter || [],
          description: company.description || ''
        });
      }
    }

    // Sort by confidence (high first), then name
    results.sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));

    // Pagination
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const start = (pageNum - 1) * limitNum;
    const paged = results.slice(start, start + limitNum);

    res.json({
      total: results.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(results.length / limitNum),
      companies: paged
    });

  } catch (err) {
    console.error('[Directory] Error:', err.message);
    res.status(500).json({ error: 'Directory search failed', detail: err.message });
  }
});

// ─── GET /api/register/countries ───
// Returns all unique countries from the dataset
router.get('/countries', (req, res) => {
  try {
    const countries = new Set();
    for (const company of csvService.geoCompanies.values()) {
      if (company.country) countries.add(company.country);
    }
    res.json({ countries: Array.from(countries).sort() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch countries', detail: err.message });
  }
});

module.exports = router;

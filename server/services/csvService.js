const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// ─── Normalize exotic country names to Comtrade-compatible names ───
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

function normalizeCountry(raw) {
  if (!raw) return 'Unknown';
  const lower = raw.trim().toLowerCase();
  return COUNTRY_NORMALIZE[lower] || raw.trim();
}

class CSVGraphService {
  constructor() {
    this.companies = new Map();
    this.descriptions = new Map(); // company_name (lowercase) -> wikidata_description
    this.hsTaxonomy = new Map();   // hscode -> { section, section_name, description, level }
    this.geoCompanies = new Map(); // company_name (lowercase) -> { name, country, lat, lng, city, description }
    this.countryCoords = new Map(); // country (lowercase) -> { lat, lng, companies: [] }
    this.edges = [];
    this.loaded = false;

    // Smart path resolution for Local vs Vercel
    this.basePath = process.cwd();
    if (!fs.existsSync(path.join(this.basePath, 'server')) && fs.existsSync(path.join(this.basePath, 'data'))) {
      // We are already inside the 'server' directory (Local)
      this.dataPath = path.join(this.basePath, 'data');
    } else {
      // We are in the root directory (Vercel)
      this.dataPath = path.join(this.basePath, 'server', 'data');
    }
  }

  loadData() {
    return Promise.all([
      this._loadTradeData(),
      this._loadDescriptions(),
      this._loadHSTaxonomy(),
      this._loadGeoCompanies(),
    ]).then(() => {
      this.loaded = true;
      console.log(`  ✓ Trade Data Loaded`);
      console.log(`  ✓ HS Taxonomy Loaded`);
      console.log(`  ✓ Enriched Data Loaded`);
      console.log(`  ✓ CSV LOAD COMPLETE: ${this.companies.size} companies, ${this.edges.length} trade links, ${this.hsTaxonomy.size} HS codes, ${this.geoCompanies.size} enriched entities`);
    });
  }

  _loadTradeData() {
    return new Promise((resolve, reject) => {
      const csvPath = path.join(this.dataPath, 'supply_chain_data.csv');
      if (!fs.existsSync(csvPath)) {
        console.warn(`  ⚠ supply_chain_data.csv not found at ${csvPath}`);
        return resolve();
      }
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          const buyer = row.buyer_name?.trim();
          const supplier = row.supplier_name?.trim();
          const hsn = row.hsn_code?.trim();
          const product = row.product_description?.trim();
          const importCountry = normalizeCountry(row.import_country);
          const exportCountry = normalizeCountry(row.export_country);
          const quantity = parseInt(row.quantity) || 0;
          const date = row.trade_date?.trim() || '';

          if (buyer && supplier) {
            if (!this.companies.has(buyer)) this.companies.set(buyer, { name: buyer, country: importCountry, totalVolume: 0 });
            if (!this.companies.has(supplier)) this.companies.set(supplier, { name: supplier, country: exportCountry, totalVolume: 0 });
            
            this.companies.get(buyer).totalVolume += quantity;
            this.companies.get(supplier).totalVolume += quantity;

            this.edges.push({ buyer, supplier, hsn, product, importCountry, exportCountry, quantity, date });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
  }

  _loadDescriptions() {
    return new Promise((resolve, reject) => {
      const csvPath = path.join(this.dataPath, 'companies_with_bom_filters.csv');
      if (!fs.existsSync(csvPath)) {
        console.warn(`  ⚠ companies_with_bom_filters.csv not found at ${csvPath}`);
        return resolve();
      }

      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          const name = row.company_name?.trim();
          const desc = row.wikidata_description?.trim();
          const city = row.wikidata_hq?.trim();
          const country = normalizeCountry(row.country);
          if (name && desc) {
            this.descriptions.set(name.toLowerCase(), { 
              description: desc, 
              country,
              city: city || null
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
  }

  /**
   * Load the enriched companies dataset with geocoded coordinates.
   * Source: cleaned_companies_data.csv
   */
  _loadGeoCompanies() {
    return new Promise((resolve, reject) => {
      const csvPath = path.join(this.dataPath, 'companies_with_bom_filters.csv');
      if (!fs.existsSync(csvPath)) {
        console.warn(`  ⚠ companies_with_bom_filters.csv not found at ${csvPath}`);
        return resolve();
      }

      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          const name = row.company_name?.trim();
          const lat = parseFloat(row.latitude);
          const lng = parseFloat(row.longitude);
          const country = normalizeCountry(row.country);
          const city = row.wikidata_hq?.trim() || row.city_clean?.trim() || null;
          const desc = row.wikidata_description?.trim() || '';
          const confidence = parseInt(row.confidence, 10) || 0;
          
          // Parse new fields
          const industry = row.industry?.trim() || '';
          const standardizedIndustry = row.standardized_industry?.trim() || '';
          
          // BOM_filter is a string representation of an array, e.g. "['raw materials', 'machinery']"
          let bomFilter = [];
          if (row.BOM_filter) {
            try {
              // Quick and dirty parse of single-quoted arrays like "['a', 'b']"
              let cleanStr = row.BOM_filter.replace(/^"|"$/g, '').replace(/'/g, '"');
              bomFilter = JSON.parse(cleanStr);
            } catch (e) {
              // fallback if parsing fails
              bomFilter = row.BOM_filter.replace(/[\[\]'"]/g, '').split(',').map(s => s.trim()).filter(Boolean);
            }
          }

          if (name && !isNaN(lat) && !isNaN(lng)) {
            const key = name.toLowerCase();
            this.geoCompanies.set(key, {
              name, country, lat, lng, city, description: desc, confidence, industry, standardizedIndustry, bomFilter
            });

            // Aggregate country-level coordinates (average of all companies in that country)
            const countryKey = country.toLowerCase();
            if (!this.countryCoords.has(countryKey)) {
              this.countryCoords.set(countryKey, { lat: 0, lng: 0, count: 0, companies: [], companyCoords: [], country });
            }
            const entry = this.countryCoords.get(countryKey);
            entry.lat = ((entry.lat * entry.count) + lat) / (entry.count + 1);
            entry.lng = ((entry.lng * entry.count) + lng) / (entry.count + 1);
            entry.count += 1;
            
            if (entry.companies.length < 10) {
              entry.companies.push(name);
              entry.companyCoords.push({ lat, lng });
            }
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
  }

  /**
   * Resolve a company's coordinates dynamically from cleaned_companies_data.csv.
   * If confidence > 8, plots exact coordinates.
   * If <= 8, takes the average coordinates of the top 5 companies in that country.
   * Returns { name, country, lat, lng, city } or null.
   */
  resolveCompanyGeo(companyName) {
    if (!companyName) return null;
    const key = companyName.toLowerCase();
    const company = this.geoCompanies.get(key);
    
    if (!company) return null;

    if (company.confidence > 8) {
      return company; // High confidence -> exact coordinates
    } else {
      // Low confidence -> average of top 5 companies in that country
      const countryGeo = this.countryCoords.get(company.country.toLowerCase());
      if (countryGeo && countryGeo.companyCoords && countryGeo.companyCoords.length > 0) {
        const top5 = countryGeo.companyCoords.slice(0, 5);
        const avgLat = top5.reduce((sum, c) => sum + c.lat, 0) / top5.length;
        const avgLng = top5.reduce((sum, c) => sum + c.lng, 0) / top5.length;
        
        return {
          ...company,
          lat: avgLat,
          lng: avgLng,
          wasAveraged: true // Flag to indicate logic was triggered
        };
      }
      return company; // Fallback if no country data
    }
  }

  /**
   * Get coordinates for a country (averaged from all companies in that country).
   * Returns { lat, lng, companies, country } or null.
   */
  getCountryGeo(countryName) {
    if (!countryName) return null;
    return this.countryCoords.get(countryName.toLowerCase()) || null;
  }

  /**
   * Get all companies in a specific country.
   */
  getCompaniesByCountry(countryName) {
    if (!countryName) return [];
    const normalized = normalizeCountry(countryName).toLowerCase();
    const results = [];
    for (const [, entry] of this.geoCompanies) {
      if (entry.country.toLowerCase() === normalized) {
        results.push(entry);
      }
    }
    return results;
  }

  _loadHSTaxonomy() {
    return new Promise((resolve, reject) => {
      const csvPath = path.join(this.dataPath, 'merged_harmonized_sections.csv');
      if (!fs.existsSync(csvPath)) {
        console.warn(`  ⚠ merged_harmonized_sections.csv not found at ${csvPath}`);
        return resolve();
      }

      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          const hscode = row.hscode?.trim();
          if (hscode) {
            this.hsTaxonomy.set(hscode, {
              section: row.section?.trim() || '',
              section_name: row.section_name?.trim() || '',
              description: row.description?.trim() || '',
              level: parseInt(row.level) || 0,
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
  }

  /**
   * Get the HS code description from the taxonomy.
   */
  getHsDescription(hsCode) {
    if (!hsCode) return null;
    const code = String(hsCode).trim();
    // Try exact match first, then try 2-digit chapter
    const entry = this.hsTaxonomy.get(code) || this.hsTaxonomy.get(code.substring(0, 2));
    return entry ? entry.description : null;
  }

  /**
   * Get HS section info for a given HS code.
   */
  getHsSection(hsCode) {
    if (!hsCode) return null;
    const code = String(hsCode).trim();
    const entry = this.hsTaxonomy.get(code) || this.hsTaxonomy.get(code.substring(0, 2));
    return entry || null;
  }

  /**
   * Validates and falls back to the most specific HS code present in taxonomy.
   * Checks 6-digit -> 4-digit -> 2-digit.
   */
  getMostGranularValidHs(hsCode) {
    if (!hsCode) return "85"; // Default fallback
    const code = String(hsCode).trim();
    
    // Check 6-digit
    if (code.length >= 6 && this.hsTaxonomy.has(code.substring(0, 6))) {
      return code.substring(0, 6);
    }
    // Check 4-digit
    if (code.length >= 4 && this.hsTaxonomy.has(code.substring(0, 4))) {
      return code.substring(0, 4);
    }
    // Check 2-digit
    if (code.length >= 2 && this.hsTaxonomy.has(code.substring(0, 2))) {
      return code.substring(0, 2);
    }
    
    return "85"; // Default fallback if completely invalid
  }

  getCompanyDescription(name) {
    if (!name) return null;
    const entry = this.descriptions.get(name.toLowerCase());
    return entry ? entry.description : null;
  }

  /**
   * Get company's normalized country from the descriptions dataset.
   */
  getCompanyCountry(name) {
    if (!name) return null;
    const entry = this.descriptions.get(name.toLowerCase());
    return entry ? entry.country : null;
  }

  /**
   * Find companies by country whose description matches certain keywords.
   * Used by the trace engine for probabilistic matching.
   */
  findCompaniesByCountryAndProfile(country, keywords = []) {
    const normalized = normalizeCountry(country).toLowerCase();
    const results = [];
    for (const entry of this.geoCompanies.values()) {
      if (entry.country.toLowerCase() === normalized) {
        if (keywords.length === 0) {
          results.push({ name: entry.name, country: entry.country, description: entry.description, lat: entry.lat, lng: entry.lng });
        } else {
          const desc = (entry.description || '').toLowerCase();
          const ind = (entry.industry || '').toLowerCase();
          const stdInd = (entry.standardizedIndustry || '').toLowerCase();
          const text = `${desc} ${ind} ${stdInd}`;
          
          if (keywords.some(kw => text.includes(kw.toLowerCase()))) {
            results.push({ name: entry.name, country: entry.country, description: entry.description, lat: entry.lat, lng: entry.lng });
          }
        }
      }
    }
    return results;
  }

  searchCompanies(query) {
    if (!query || query.trim().length < 1) return [];
    const q = query.trim().toLowerCase();
    
    const resultsMap = new Map();

    // 1. Search in active trade companies
    for (const c of this.companies.values()) {
      if (c.name.toLowerCase().includes(q)) {
        resultsMap.set(c.name.toLowerCase(), {
          name: c.name,
          country: c.country,
          description: this.getCompanyDescription(c.name),
          totalVolume: c.totalVolume || 0,
        });
      }
    }

    // 2. Search in enriched geo dataset (cleaned_companies_data)
    for (const c of this.geoCompanies.values()) {
      if (c.name.toLowerCase().includes(q)) {
        const key = c.name.toLowerCase();
        if (!resultsMap.has(key)) {
          resultsMap.set(key, {
            name: c.name,
            country: c.country,
            description: c.description || this.getCompanyDescription(c.name),
            totalVolume: 0,
          });
        }
      }
    }

    return Array.from(resultsMap.values())
      .sort((a, b) => {
        const aStart = a.name.toLowerCase().startsWith(q) ? 1 : 0;
        const bStart = b.name.toLowerCase().startsWith(q) ? 1 : 0;
        if (aStart !== bStart) return bStart - aStart; // Prefix match wins
        return b.totalVolume - a.totalVolume; // Fallback to volume ranking
      })
      .slice(0, 12)
      .map(c => ({
        name: c.name,
        country: c.country,
        description: c.description
      }));
  }

  getHSNCodes(companyName) {
    const companyEdges = this.edges.filter(e => e.buyer === companyName || e.supplier === companyName);
    const hsnMap = new Map();
    for (const edge of companyEdges) {
      if (!hsnMap.has(edge.hsn)) hsnMap.set(edge.hsn, { code: edge.hsn, description: edge.product, count: 0, totalQuantity: 0 });
      const entry = hsnMap.get(edge.hsn);
      entry.count++;
      entry.totalQuantity += edge.quantity;
    }
    return Array.from(hsnMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
  }

  /**
   * Resolve geocoded company data including BOM filters.
   */
  resolveCompanyGeo(name) {
    if (!name) return null;
    return this.geoCompanies.get(name.toLowerCase()) || null;
  }

  getCompanyDetails(companyName) {
    const company = this.companies.get(companyName);
    if (!company) return null;
    const asCustomer = this.edges.filter(e => e.buyer === companyName);
    const asSupplier = this.edges.filter(e => e.supplier === companyName);
    const dossier = this.descriptions.get(companyName.toLowerCase());
    return {
      name: company.name,
      country: company.country,
      city: dossier?.city || null,
      description: dossier?.description || this.getCompanyDescription(companyName),
      totalTradeVolume: company.totalVolume,
      supplierCount: new Set(asCustomer.map(e => e.supplier)).size,
      customerCount: new Set(asSupplier.map(e => e.buyer)).size,
      hsnCodes: this.getHSNCodes(companyName),
    };
  }

  /**
   * Traverse the supply chain graph from a company, optionally filtered by HSN.
   * Used as a CSV fallback when Neo4j is unavailable.
   */
  traverseGraph(companyName, hsnCode, maxDepth = 5) {
    const nodeMap = new Map();
    const edgeList = [];
    const visited = new Set();
    const queue = [{ name: companyName, depth: 0 }];

    while (queue.length > 0) {
      const { name, depth } = queue.shift();
      if (visited.has(name) || depth > maxDepth) continue;
      visited.add(name);

      const company = this.companies.get(name);
      if (company && !nodeMap.has(name)) {
        nodeMap.set(name, {
          id: name,
          label: name,
          country: company.country,
          tradeVolume: company.totalVolume,
        });
      }

      // Find connected edges
      const connectedEdges = this.edges.filter(e => {
        const matches = e.buyer === name || e.supplier === name;
        if (!matches) return false;
        if (hsnCode && hsnCode !== 'all') return e.hsn === hsnCode;
        return true;
      });

      for (const edge of connectedEdges) {
        const otherName = edge.buyer === name ? edge.supplier : edge.buyer;
        const otherCompany = this.companies.get(otherName);

        if (otherCompany && !nodeMap.has(otherName)) {
          nodeMap.set(otherName, {
            id: otherName,
            label: otherName,
            country: otherCompany.country,
            tradeVolume: otherCompany.totalVolume,
          });
        }

        const edgeKey = `${edge.supplier}→${edge.buyer}→${edge.hsn}`;
        if (!edgeList.some(e => `${e.source}→${e.target}→${e.hsn}` === edgeKey)) {
          edgeList.push({
            source: edge.supplier,
            target: edge.buyer,
            hsn: edge.hsn,
            quantity: edge.quantity,
            product: edge.product,
            date: edge.date,
          });
        }

        if (!visited.has(otherName)) {
          queue.push({ name: otherName, depth: depth + 1 });
        }
      }
    }

    // Build trade routes
    const routeMap = new Map();
    for (const e of edgeList) {
      const sourceNode = nodeMap.get(e.source);
      const targetNode = nodeMap.get(e.target);
      if (sourceNode && targetNode && sourceNode.country !== targetNode.country) {
        const key = `${sourceNode.country}→${targetNode.country}`;
        if (!routeMap.has(key)) {
          routeMap.set(key, { from: sourceNode.country, to: targetNode.country, volume: 0, products: [] });
        }
        routeMap.get(key).volume += e.quantity || 0;
      }
    }

    return {
      nodes: Array.from(nodeMap.values()),
      edges: edgeList,
      tradeRoutes: Array.from(routeMap.values()),
    };
  }

  /**
   * Get overall dataset statistics.
   */
  getStats() {
    const countries = new Set();
    for (const e of this.edges) {
      if (e.importCountry) countries.add(e.importCountry);
      if (e.exportCountry) countries.add(e.exportCountry);
    }
    return {
      totalCompanies: this.companies.size,
      totalTradeLinks: this.edges.length,
      totalCountries: countries.size,
      totalDescriptions: this.descriptions.size,
      totalHSCodes: this.hsTaxonomy.size,
    };
  }
}

module.exports = new CSVGraphService();

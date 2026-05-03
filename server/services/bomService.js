const { GoogleGenAI } = require('@google/genai');

class BomService {
  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });
    // Cache BOM results to avoid duplicate Gemini calls
    this.cache = new Map();
    // Track if daily quota is exhausted — skip Gemini entirely
    this.quotaExhausted = false;
    this.quotaResetTime = 0;
    this.strictMode = String(process.env.BOM_STRICT_MODE || 'true').toLowerCase() === 'true';
  }

  /**
   * Given a target HS code and its description, returns an array of upstream 
   * HS chapters/headings (2 or 4 digit codes) required to manufacture it.
   * Includes caching, rate-limit detection, and static fallback.
   */
  async getStructuredBOM(targetHsCode, targetDescription) {
    // Normalize to 2-digit chapter for caching (reduces unique calls)
    const cacheKey = String(targetHsCode).substring(0, 2);

    if (this.cache.has(cacheKey)) {
      console.log(`[BOM] Cache hit for HS ${cacheKey}`);
      return this.cache.get(cacheKey);
    }

    // If daily quota exhausted, fail fast in strict mode
    if (this.quotaExhausted && Date.now() < this.quotaResetTime) {
      const message = `[BOM] Daily Gemini quota exhausted for HS ${cacheKey}.`;
      if (this.strictMode) {
        throw new Error(`${message} Provide a valid API key/quota to continue authentic BOM traversal.`);
      }
      console.log(`${message} Using fallback.`);
      return this._fallbackStructuredBom(cacheKey);
    }

    if (!process.env.GEMINI_API_KEY) {
       if (this.strictMode) {
         throw new Error('[BOM] GEMINI_API_KEY not set. Strict mode blocks fallback BOM generation.');
       }
       console.warn('[BOM] GEMINI_API_KEY not set. Using fallback.');
       return this._fallbackStructuredBom(cacheKey);
    }

    const prompt = `
    You are an expert in global trade, supply chains, and the Harmonized System (HS) code taxonomy.
    I am building a Bill of Materials (BOM) aware supply chain traversal graph.

    The target product being manufactured is:
    HS Code: ${targetHsCode}
    Description: ${targetDescription}

    Identify the key upstream raw materials and primary components required to manufacture this product.
    Provide your output ONLY as a JSON array of objects.
    Each object MUST have:
    - "component": A human-readable name of the component (e.g., "Lithium-ion Battery", "Steel", "Semiconductor"). Avoid generic terms.
    - "hs": The best possible HS code for this component (prefer 4 or 6 digit codes).
    - "keywords": An array of 2-3 keyword strings related to this component.

    Include only the most important 3-5 upstream categories.
    Do not include any other text, markdown, or explanation.
    
    Example response format:
    [
      { "component": "Lithium-ion Battery", "hs": "850760", "keywords": ["battery", "cell"] },
      { "component": "Steel", "hs": "7208", "keywords": ["steel", "iron"] },
      { "component": "Semiconductor", "hs": "8541", "keywords": ["chip", "silicon"] }
    ]
    `;

    // Single attempt with quick fallback
    try {
      const model = this.ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      });

      const response = await result.response;
      const text = response.text();
      const json = JSON.parse(text);

      // Reset quota flag on success
      this.quotaExhausted = false;

      this.cache.set(cacheKey, json);
      return json;

    } catch (error) {
      if (error.status === 429) {
        // Check if it's a DAILY quota (limit: 0) vs per-minute
        const isDaily = error.message && error.message.includes('limit: 0');
        if (isDaily) {
          console.warn(`[BOM] DAILY quota exhausted.`);
          this.quotaExhausted = true;
          this.quotaResetTime = Date.now() + 10 * 60 * 1000; // 10 minutes
        } else {
          console.warn(`[BOM] Per-minute rate limit for HS ${cacheKey}.`);
        }
      } else {
        console.error(`[BOM] Gemini failed:`, error.message || error);
      }

      if (this.strictMode) {
        throw new Error(`[BOM] Gemini request failed for HS ${cacheKey}: ${error.message || 'unknown error'}`);
      }
    }

    // Use fallback
    return this._fallbackStructuredBom(cacheKey);
  }

  /**
   * Comprehensive static fallback BOM rules when Gemini is unavailable.
   * Covers all major HS chapters used in supply chain tracing.
   */
  _fallbackStructuredBom(hsChapter) {
    const fallback = {
      // ─── Finished Goods ───
      '87': [
        { component: "Steel", hs: "72", keywords: ["steel", "metal"] },
        { component: "Aluminum", hs: "76", keywords: ["aluminum", "metal"] },
        { component: "Electronics", hs: "85", keywords: ["electronic", "circuit"] }
      ],
      '88': [
        { component: "Aluminum", hs: "76", keywords: ["aluminum", "metal"] },
        { component: "Titanium", hs: "81", keywords: ["titanium", "metal"] },
        { component: "Electronics", hs: "85", keywords: ["electronic", "avionics"] }
      ],
      // ─── Electronics & Machinery ───
      '85': [
        { component: "Copper Wire", hs: "74", keywords: ["copper", "wire"] },
        { component: "Plastics", hs: "39", keywords: ["plastic", "polymer"] },
        { component: "Semiconductors", hs: "8541", keywords: ["chip", "silicon"] }
      ],
      '84': [
        { component: "Steel", hs: "72", keywords: ["steel", "iron"] },
        { component: "Aluminum", hs: "76", keywords: ["aluminum", "metal"] },
        { component: "Electronics", hs: "85", keywords: ["electronic", "circuit"] }
      ],
      // ─── Pharmaceuticals & Chemicals ───
      '30': [
        { component: "Organic Chemicals", hs: "29", keywords: ["organic", "chemical"] },
        { component: "Inorganic Chemicals", hs: "28", keywords: ["inorganic", "chemical"] }
      ],
      // ─── Base Materials ───
      '72': [
        { component: "Iron Ore", hs: "2601", keywords: ["iron", "ore"] },
        { component: "Coal", hs: "2701", keywords: ["coal", "carbon"] }
      ],
      '73': [
        { component: "Steel", hs: "72", keywords: ["steel", "iron"] }
      ],
      '76': [
        { component: "Bauxite", hs: "2606", keywords: ["bauxite", "ore"] }
      ]
    };
    
    const defaultFallback = [
      { component: "Steel", hs: "72", keywords: ["steel", "iron"] },
      { component: "Electronics", hs: "85", keywords: ["electronic", "circuit"] },
      { component: "Chemicals", hs: "28", keywords: ["chemical"] }
    ];
    
    const terminalChapters = ['27', '26', '25', '01', '02', '03', '10'];
    if (terminalChapters.includes(hsChapter)) {
      this.cache.set(hsChapter, []);
      return [];
    }

    const result = fallback[hsChapter] || defaultFallback;
    this.cache.set(hsChapter, result);
    console.log(`[BOM] Using fallback for HS ${hsChapter}`);
    return result;
  }
}

module.exports = new BomService();

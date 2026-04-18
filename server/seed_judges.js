const neo4j = require('neo4j-driver');
require('dotenv').config();

const uri = process.env.NEO4J_URI;
const user = process.env.NEO4J_USER;
const password = process.env.NEO4J_PASSWORD;

async function seedJudgesData() {
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  const session = driver.session();

  console.log('🚀 Starting Judge-Ready Supply Chain Injection (6 Tiers)...');

  const supplyChains = [
    // 1. TESLA - LITHIUM CHAIN
    {
      nodes: [
        { name: 'Tesla', country: 'United States', industry: 'EV' },
        { name: 'Panasonic Energy', country: 'Japan', industry: 'Batteries' },
        { name: 'CATL', country: 'China', industry: 'Battery Cells' },
        { name: 'Ganfeng Lithium', country: 'China', industry: 'Refined Lithium' },
        { name: 'Albemarle Corp', country: 'United States', industry: 'Extraction' },
        { name: 'Salar de Atacama Mines', country: 'Chile', industry: 'Brine Source' },
        { name: 'EnergyX', country: 'United States', industry: 'DLE Tech' }
      ],
      links: [
        { from: 'Panasonic Energy', to: 'Tesla', hsn: '8507', product: 'Lithium-ion Batteries' },
        { from: 'CATL', to: 'Panasonic Energy', hsn: '8548', product: 'Battery Cell Components' },
        { from: 'Ganfeng Lithium', to: 'CATL', hsn: '2836', product: 'Lithium Carbonate' },
        { from: 'Albemarle Corp', to: 'Ganfeng Lithium', hsn: '2617', product: 'Lithium Ores' },
        { from: 'Salar de Atacama Mines', to: 'Albemarle Corp', hsn: '2501', product: 'Raw Brine' },
        { from: 'EnergyX', to: 'Salar de Atacama Mines', hsn: '8479', product: 'Extraction Systems' }
      ]
    },
    // 2. APPLE - CHIP CHAIN
    {
      nodes: [
        { name: 'Apple Inc', country: 'United States', industry: 'Electronics' },
        { name: 'Foxconn', country: 'Taiwan', industry: 'Assembly' },
        { name: 'TSMC', country: 'Taiwan', industry: 'Semiconductors' },
        { name: 'ASML', country: 'Netherlands', industry: 'Lithography' },
        { name: 'ZEISS Group', country: 'Germany', industry: 'Optics' },
        { name: 'Schott AG', country: 'Germany', industry: 'Special Glass' },
        { name: 'Inner Mongolia Rare Earths', country: 'China', industry: 'Mining' }
      ],
      links: [
        { from: 'Foxconn', to: 'Apple Inc', hsn: '8517', product: 'iPhone Assembly' },
        { from: 'TSMC', to: 'Foxconn', hsn: '8542', product: 'A17 Bionic Chips' },
        { from: 'ASML', to: 'TSMC', hsn: '8486', product: 'EUV Lithography Machines' },
        { from: 'ZEISS Group', to: 'ASML', hsn: '9002', product: 'Optical Lens Systems' },
        { from: 'Schott AG', to: 'ZEISS Group', hsn: '7002', product: 'Optical Raw Glass' },
        { from: 'Inner Mongolia Rare Earths', to: 'Schott AG', hsn: '2805', product: 'Cerium & Lanthanum' }
      ]
    },
    // 3. BOEING - AEROSPACE
    {
      nodes: [
        { name: 'Boeing', country: 'United States', industry: 'Aerospace' },
        { name: 'Spirit AeroSystems', country: 'United States', industry: 'Fuselage' },
        { name: 'Alcoa Corp', country: 'United States', industry: 'Aluminum' },
        { name: 'Rio Tinto', country: 'Australia', industry: 'Mining' },
        { name: 'Queensland Refinery', country: 'Australia', industry: 'Refining' },
        { name: 'Port of Dampier', country: 'Australia', industry: 'Logistics' },
        { name: 'Australian Rail Group', country: 'Australia', industry: 'Transport' }
      ],
      links: [
        { from: 'Spirit AeroSystems', to: 'Boeing', hsn: '8803', product: 'Fuselage Sections' },
        { from: 'Alcoa Corp', to: 'Spirit AeroSystems', hsn: '7601', product: 'Aerospace Aluminum Alloy' },
        { from: 'Queensland Refinery', to: 'Alcoa Corp', hsn: '2818', product: 'Aluminum Oxide' },
        { from: 'Rio Tinto', to: 'Queensland Refinery', hsn: '2606', product: 'Bauxite Ore' },
        { from: 'Port of Dampier', to: 'Rio Tinto', hsn: '9999', product: 'Critical Logistics Node' },
        { from: 'Australian Rail Group', to: 'Port of Dampier', hsn: '8601', product: 'Cargo Transport' }
      ]
    },
    // 4. NVIDIA - AI CHAIN
    {
      nodes: [
        { name: 'NVIDIA', country: 'United States', industry: 'AI' },
        { name: 'SK Hynix', country: 'South Korea', industry: 'Memory' },
        { name: 'Sumco Corp', country: 'Japan', industry: 'Wafers' },
        { name: 'Linde PLC', country: 'United Kingdom', industry: 'Industrial Gas' },
        { name: 'Cryoin', country: 'Ukraine', industry: 'Neon Gas' },
        { name: 'Azovstal Iron & Steel', country: 'Ukraine', industry: 'Source' }
      ],
      links: [
        { from: 'SK Hynix', to: 'NVIDIA', hsn: '8542', product: 'HBM3 Memory' },
        { from: 'Sumco Corp', to: 'SK Hynix', hsn: '3818', product: 'Silicon Wafers' },
        { from: 'Linde PLC', to: 'Sumco Corp', hsn: '2804', product: 'Ultra-pure Neon Gas' },
        { from: 'Cryoin', to: 'Linde PLC', hsn: '2804', product: 'Raw Neon Extraction' },
        { from: 'Azovstal Iron & Steel', to: 'Cryoin', hsn: '2705', product: 'Coal Gas Byproducts' }
      ]
    }
  ];

  try {
    for (const chain of supplyChains) {
      console.log(`\n📦 Injecting Chain for: ${chain.nodes[0].name}`);
      
      // Merge Nodes
      for (const node of chain.nodes) {
        await session.run(
          `MERGE (c:Company {name: $name})
           SET c.country = $country, c.industry = $industry, c.label = $name`,
          node
        );
      }

      // Merge Links
      for (const link of chain.links) {
        await session.run(
          `MATCH (a:Company {name: $from})
           MATCH (b:Company {name: $to})
           MERGE (a)-[r:SUPPLIES_TO {hsn: $hsn}]->(b)
           SET r.product = $product, r.tradeValue = $tradeValue, r.source = "curated"`,
          { ...link, tradeValue: Math.floor(Math.random() * 10000000) + 5000000 }
        );
      }
    }

    console.log('\n✅ SEEDING COMPLETE! Your graph now contains 6-tier deep high-impact supply chains.');
  } catch (err) {
    console.error('❌ SEEDING FAILED:', err);
  } finally {
    await session.close();
    await driver.close();
  }
}

seedJudgesData();

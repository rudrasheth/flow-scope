require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const neo4j = require('neo4j-driver');

const COMPANIES_CSV = path.join(__dirname, '..', 'data', 'cleaned_companies_data.csv');
const HS_CSV = path.join(__dirname, '..', 'data', 'merged_harmonized_sections.csv');

async function seedProduction() {
  console.log('\n  ═══ FlowScope Neo4j Production Seed ═══\n');

  const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const user = process.env.NEO4J_USER || 'neo4j';
  const password = process.env.NEO4J_PASSWORD || 'password';

  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  
  try {
    const serverInfo = await driver.getServerInfo();
    console.log(`  ✓ Connected to Neo4j: ${serverInfo.address}\n`);
  } catch (err) {
    console.error(`  ✗ Cannot connect to Neo4j at ${uri}`);
    console.error(`    ${err.message}`);
    process.exit(1);
  }

  const session = driver.session();

  try {
    console.log('  → Clearing existing data...');
    await session.run('MATCH (n) DETACH DELETE n');

    console.log('  → Creating constraints...');
    await session.run('CREATE CONSTRAINT company_name IF NOT EXISTS FOR (c:Company) REQUIRE c.name IS UNIQUE');
    await session.run('CREATE CONSTRAINT hscode_id IF NOT EXISTS FOR (p:Product) REQUIRE p.hscode IS UNIQUE');

    // 1. Seed Products (HS Codes)
    console.log('  → Seeding HS Taxonomy...');
    const hsRecords = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(HS_CSV)
        .pipe(csv())
        .on('data', (row) => {
            if (row.level && parseInt(row.level) <= 4) {
               hsRecords.push(row);
            }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    const hsBatches = chunkArray(hsRecords, 1000);
    let hsCount = 0;
    for (const batch of hsBatches) {
      await session.run(
        `UNWIND $batch AS p
         MERGE (prod:Product {hscode: p.hscode})
         SET prod.description = p.description, 
             prod.section = p.section, 
             prod.section_name = p.section_name, 
             prod.level = toInteger(p.level)`,
        { batch }
      );
      hsCount += batch.length;
    }
    console.log(`  ✓ Seeded ${hsCount} HS Code categories `);

    // 2. Seed Companies
    console.log('  → Seeding Companies database...');
    const companyRecords = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(COMPANIES_CSV)
        .pipe(csv())
        .on('data', (row) => {
            if (row.company_name) {
               companyRecords.push({
                  name: row.company_name.trim(),
                  country: row.country?.trim() || 'Unknown',
                  desc: row.wikidata_description?.trim() || '',
                  hq: row.wikidata_hq?.trim() || '',
                  entity_id: row.entity_id?.trim() || ''
               });
            }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    const companyBatches = chunkArray(companyRecords, 5000);
    let companyCount = 0;
    for (const batch of companyBatches) {
       await session.run(
         `UNWIND $batch AS c
          MERGE (comp:Company {name: c.name})
          SET comp.country = c.country,
              comp.description = c.desc,
              comp.wikidataHQ = c.hq,
              comp.entity_id = c.entity_id`,
         { batch }
       );
       companyCount += batch.length;
       console.log(`    Seeded ${companyCount} companies...`);
    }

    console.log(`  ✓ Seeded ${companyCount} real companies`);

  } finally {
    await session.close();
    await driver.close();
  }
}

function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

seedProduction().catch(console.error);

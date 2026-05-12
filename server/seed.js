/**
 * Neo4j Seed Script
 * Reads the CSV dataset and populates a Neo4j database with Company nodes
 * and SUPPLIES_TO relationships.
 *
 * Usage: node seed.js
 * Requires Neo4j to be running and configured in .env
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const neo4j = require('neo4j-driver');

const CSV_PATH = path.join(__dirname, 'data', 'supply_chain_data.csv');

async function seed() {
  console.log('\n  ═══ FlowScope Neo4j Seed ═══\n');

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
    console.error('\n  Make sure Neo4j is running and .env is configured.\n');
    process.exit(1);
  }

  // Read CSV
  const rows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`  ✓ Parsed ${rows.length} trade records from CSV\n`);

  const session = driver.session();

  try {
    // Clear existing data
    console.log('  → Clearing existing data...');
    await session.run('MATCH (n) DETACH DELETE n');

    // Create constraints
    console.log('  → Creating constraints...');
    await session.run(
      'CREATE CONSTRAINT company_name IF NOT EXISTS FOR (c:Company) REQUIRE c.name IS UNIQUE'
    );

    // Collect unique companies
    const companies = new Map();
    for (const row of rows) {
      const buyer = row.buyer_name.trim();
      const supplier = row.supplier_name.trim();
      if (!companies.has(buyer)) {
        companies.set(buyer, row.import_country.trim());
      }
      if (!companies.has(supplier)) {
        companies.set(supplier, row.export_country.trim());
      }
    }

    // Create company nodes
    console.log(`  → Creating ${companies.size} company nodes...`);
    for (const [name, country] of companies) {
      await session.run(
        'MERGE (c:Company {name: $name}) SET c.country = $country',
        { name, country }
      );
    }

    // Create relationships
    console.log(`  → Creating ${rows.length} SUPPLIES_TO relationships...`);
    for (const row of rows) {
      await session.run(
        `MATCH (s:Company {name: $supplier}), (b:Company {name: $buyer})
         CREATE (s)-[:SUPPLIES_TO {
           hsn: $hsn,
           product: $product,
           quantity: toInteger($quantity),
           date: $date
         }]->(b)`,
        {
          supplier: row.supplier_name.trim(),
          buyer: row.buyer_name.trim(),
          hsn: row.hsn_code.trim(),
          product: row.product_description.trim(),
          quantity: row.quantity.trim(),
          date: row.trade_date.trim(),
        }
      );
    }

    // Calculate total volumes
    console.log('  → Computing trade volumes...');
    await session.run(`
      MATCH (c:Company)
      OPTIONAL MATCH (c)-[r:SUPPLIES_TO]-()
      WITH c, sum(r.quantity) AS vol
      SET c.totalVolume = vol
    `);

    console.log('\n  ═══════════════════════════════════');
    console.log(`  ✓ Seeded ${companies.size} companies`);
    console.log(`  ✓ Seeded ${rows.length} trade relationships`);
    console.log('  ═══════════════════════════════════\n');
  } finally {
    await session.close();
    await driver.close();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

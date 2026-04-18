const { initDriver, getDriver, getIsConnected } = require('./config/neo4j');
require('dotenv').config();

async function testSearch() {
  await initDriver();
  const query = 'tesla';
  console.log(`Searching for: ${query}`);
  
  if (getIsConnected()) {
    const session = getDriver().session();
    try {
      const result = await session.run(
        `MATCH (c:Company)
         WHERE toLower(c.name) CONTAINS toLower($query)
         RETURN c.name AS name, c.country AS country, labels(c) as labels
         LIMIT 12`,
        { query }
      );
      console.log('Results:');
      result.records.forEach(r => {
        console.log(`- ${r.get('name')} (${r.get('country')}) [${r.get('labels')}]`);
      });
      if (result.records.length === 0) console.log('No results found.');
      
      const count = await session.run(`MATCH (c:Company) RETURN count(c) as total`);
      console.log(`Total nodes with :Company label: ${count.records[0].get('total')}`);

    } finally {
      await session.close();
      process.exit();
    }
  } else {
    console.log('Neo4j not connected.');
    process.exit(1);
  }
}

testSearch();

# FlowScope — Supply Chain Intelligence

Interactive platform for visualizing multi-tier global supply chains using HSN codes and trade data.

## Quick Start

### 1. Install Dependencies

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install
```

### 2. Start the Application

```bash
# Terminal 1 — Backend (port 3001)
cd server
npm run dev

# Terminal 2 — Frontend (port 5173)
cd client
npm run dev
```

Open **http://localhost:5173** in your browser.

### 3. (Optional) Neo4j Setup

The app works out of the box with an in-memory CSV-based graph engine. To use Neo4j:

1. Install and start [Neo4j Desktop](https://neo4j.com/download/)
2. Create a database
3. Update `server/.env` with your credentials
4. Seed the database:

```bash
cd server
npm run seed
```

## Features

- **Company Search** — Search any company in the supply chain network
- **HSN Code Filtering** — Filter by Harmonized System Nomenclature codes
- **Graph Visualization** — Interactive Cytoscape.js network with country-colored nodes
- **Geo Map** — Leaflet map with curved trade route arcs between countries
- **Details Panel** — Company stats, suppliers, customers, and product breakdown
- **Multi-tier Traversal** — BFS up to 5 hops deep through the supply chain

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Tailwind CSS, Cytoscape.js, Leaflet |
| Backend | Node.js, Express |
| Database | Neo4j (optional, CSV fallback) |
| Data | 55 trade records, 30+ companies, 14 countries |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/companies/search?q=` | Search companies |
| GET | `/api/companies/:name/hsn` | Get HSN codes |
| GET | `/api/companies/:name/details` | Company details |
| GET | `/api/graph/traverse?company=&hsn=&depth=` | Graph traversal |
| GET | `/api/graph/stats` | Dataset statistics |

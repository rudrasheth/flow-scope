# 🌐 FlowScope: ERP-Integrated Supply Chain & Vendor CRM

> **Next-generation Enterprise Resource Planning (ERP) and Vendor CRM tool for visualizing, mapping, and analyzing global trade dependencies.**

FlowScope is a high-performance **Supply Chain Intelligence Platform** designed to act as an advanced modular extension for modern ERP and CRM systems. By blending real-time trade volume data, intelligent Bill of Materials (BOM) inference, and a proprietary database of global entities, FlowScope enables enterprises to gain total visibility over their procurement pipelines, vendor networks, and B2B customer relationships.

---

## ✨ Enterprise Modules & Key Features

### 🏢 Vendor CRM & Master Data Management
- **🗄️ Proprietary 9.5k+ Entity Dataset:** A rich, custom-built master database of over 9,500 global supply chain vendors and customers, meticulously constructed using **Wikipedia** for corporate context and the **OpenCage Geocoding API** for precise geospatial coordinates.
- **💼 Interactive Company Registry:** A seamless CRM interface allowing procurement teams to dynamically onboard, register, and categorize new suppliers or B2B clients, instantly normalizing them into the enterprise network.
- **📊 Vendor Intelligence Dossiers:** 360-degree views of any registered entity, providing instant access to verified corporate profiles, enriched dynamically with live data.

### 🏭 Advanced ERP & Procurement Intelligence
- **🛡️ Structured BOM (Bill of Materials) Filtering:** Maps multi-tier product dependencies (e.g., Bauxite → Alumina → Aluminum) by systematically categorizing vendors using robust `industry` and `standardized_industry` data filters, allowing for precise drill-down into indirect procurement layers.
- **📈 Live Trade & Volume Analytics:** Real-time integration with the **UN Comtrade API** to dynamically map active export/import trade routes and shipment volumes, empowering data-driven procurement decisions.
- **🕸️ Dynamic Network Graph:** Interactive multi-tier graph visualization powered by **Cytoscape.js**, rendering complex vendor-to-customer relationships with hardware-accelerated nodes.

### 🚚 Logistics & Routing Optimization
- **🗺️ Global Map Intelligence:** Interactive trade route mapping using **Leaflet**, visualizing the physical flow of enterprise inventory across continents.
- **🔍 Advanced Routing Algorithms:** 
  - **Breadth-First Search (BFS):** Categorizes vendor depth automatically (Tier 1 direct suppliers to Tier 4 raw material sources).
  - **A* (A-Star) Pathfinding:** Optimizes logistics routes and distance tracking between suppliers and buyers to minimize transit times and procurement delays.

---

## 🏗️ Architecture Overview

The system operates on a hybrid **Pre-Computed & Dynamic** architecture built for enterprise scale:
1.  **Rich Custom Dataset:** Our proprietary CRM database of 9,500+ entities is pre-constructed using **Wikipedia** and **OpenCage** to ensure high-speed, sub-millisecond retrieval without API rate-limit bottlenecks.
2.  **Dynamic Comtrade Engine:** When a procurement node is expanded, the system queries the **UN Comtrade API** on the fly to render actual, live export/import trade paths.
3.  **Real-time Aggregation:** The frontend merges the massive ERP database state with live trade routes into a unified graph store, utilizing **A*** algorithms to compute precise logistical distances.

---

## 🛠️ Technology Stack

| Layer | Technologies / Sources |
| :--- | :--- |
| **Frontend (UI/UX)** | React, Vite, TailwindCSS, Framer Motion, Lucide Icons |
| **Backend (API)** | Node.js, Express, Axios |
| **Database** | Neo4j (GraphDB for Relationship Mapping), CSV Fast-Streaming |
| **Visualization** | Leaflet.js (Geospatial Mapping), Cytoscape.js (Network Graph) |
| **Algorithms** | BFS (Tiering), A* Search (Routing Optimization) |
| **Data Integrations**| **UN Comtrade** (Trade Data), **Wikipedia** (Context), **OpenCage** (Geocoding) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Neo4j Instance (Local or [AuraDB Free](https://neo4j.com/cloud/aura-free/)) — *optional, app falls back to CSV mode*

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Shubh179/FlowScope.git
   cd FlowScope
   ```

2. **Setup Server:**
   ```bash
   cd server
   npm install
   cp .env.example .env    # Then edit .env with your credentials
   npm run dev
   ```

3. **Setup Client (in a separate terminal):**
   ```bash
   cd client
   npm install
   npm run dev
   ```

4. **Open in browser:**
   Navigate to `http://localhost:5173`

---

## 🔑 Environment Variables

Copy `server/.env.example` to `server/.env` and fill in your values:

```env
# Server
PORT=3001

# Neo4j Graph Database (optional — app falls back to CSV if unavailable)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password_here

# Data Source: "neo4j" or "csv" (csv requires no external DB)
DATA_SOURCE=csv

# News API — optional, for live trade news (https://newsdata.io/)
NEWS_API_KEY=your_newsdata_api_key_here

# Gemini AI — optional, for AI-powered BOM inference (https://aistudio.google.com/)
GEMINI_API_KEY=your_gemini_api_key_here
```

> **Note:** The app works out-of-the-box with `DATA_SOURCE=csv` — no Neo4j or API keys required for the core experience. The 9,500+ company dataset is bundled in the repo.

---

## 🗃️ Seeding Neo4j (Optional)

If you want to use Neo4j for graph-powered queries, seed your database after configuring `.env`:

```bash
cd server

# Basic trade relationships
npm run seed

# Full production dataset (9.5k+ companies + HS taxonomy)
npm run seed:production

# Curated demo supply chains (Tesla, Apple, Boeing, NVIDIA)
npm run seed:judges

# Or seed everything at once
npm run seed:all
```

---

## 📐 Algorithmic Foundations

FlowScope leverages foundational graph and geospatial algorithms to interpret complex enterprise data:

- **Breadth-First Search (BFS):** Categorizes the supply chain network layer-by-layer to determine clear "Tiers":
  - **Tier 0:** Your search origin.
  - **Tier 1:** Direct strategic partners (Tier 1 Suppliers).
  - **Tier 2:** Secondary upstream suppliers.
  - **Tier 3+:** Raw material foundations (Ores, Minerals, Fuels).
- **A* (A-Star) Search Algorithm:** Computes optimal logistical paths between international nodes.
  - **Heuristic-Driven:** Unlike simple distance models, A* utilizes geographical heuristics to navigate the graph efficiently.
  - **Beyond the Straight Line:** In global trade, the shortest path is rarely a simple straight line. FlowScope accounts for **Haversine (Great Circle) distances** on a spherical Earth, acknowledging that the shortest route between two coordinates is an arc that follows the planet's curvature.
  - **Trade Hub Optimization:** The algorithm evaluates strategic **Global Trade Centers** (e.g., Singapore, Dubai, Rotterdam) as intermediate nodes. By intelligently routing through these hubs, FlowScope identifies paths that leverage established infrastructure and consolidated shipping lanes—optimizing for reduced logistical costs even when the physical distance may be greater. By combining this with graph edge weights, A* identifies the most efficient multi-stop vendor routes rather than just point-to-point Euclidean distances.

---

*FlowScope is built for enterprise precision. Trace the invisible, optimize your supply chain, and secure your vendor network.*

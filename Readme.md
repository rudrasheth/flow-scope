# 🌐 FlowScope: Supply Chain Graph Intelligence

> **Visualizing the complexity of global trade through AI-driven graph intelligence.**

FlowScope is a high-performance supply chain intelligence platform designed to map, trace, and analyze global trade networks. By merging real-time trade data with AI-powered Bill of Materials (BOM) inference, FlowScope reveals deep-tier dependencies and identifies risks across multi-country logistics networks.

---

## ✨ Key Features

- **🗄️ Proprietary 9.5k+ Dataset:** A rich, custom-built dataset of over 9,500 global supply chain entities, meticulously constructed using **Wikipedia** for company context and the **OpenCage Geocoding API** for precise geospatial coordinates.
- **🏢 Company Directory & Registration:** A seamless interface allowing users to dynamically register new companies into the network and discover existing entities through advanced, filterable search.
- **📈 Dynamic Trade Routes:** Real-time integration with the **UN Comtrade API** to dynamically map active export and import trade routes and cross-border shipment data on the fly.
- **🕸️ Dynamic Graph Engine:** Interactive multi-tier graph visualization powered by **Cytoscape.js**, featuring hardware-accelerated nodes and real-time path discovery.
- **🗺️ Global Map Intelligence:** Interactive trade route mapping using **Leaflet**, visualizing the physical flow of goods across continents.
- **🔍 Advanced Algorithms:** 
  - **Breadth-First Search (BFS):** Categorizes supply chain depth (Tier 1-4) automatically to discover direct and indirect dependencies.
  - **A* (A-Star) Pathfinding:** Optimizes logistics routes and distance tracking between suppliers and buyers across the globe.

---

## 🛠️ Technology Stack & Data Sources

| Layer | Technologies / Sources |
| :--- | :--- |
| **Frontend** | React, Vite, TailwindCSS, Framer Motion, Lucide Icons |
| **Backend** | Node.js, Express, Axios |
| **Database** | Neo4j (GraphDB), CSV Fast-Streaming |
| **Visualization** | Leaflet.js (Map), Cytoscape.js (Graph) |
| **Algorithms** | BFS, A* Search |
| **External APIs** | **UN Comtrade** (Trade Data), **Wikipedia** (Company Bios), **OpenCage** (Geocoding) |

---

## 🏗️ Architecture Overview

The system operates on a hybrid **Pre-Computed & Dynamic** model:
1.  **Rich Custom Dataset:** Our proprietary database of 9,500+ entities is pre-constructed using **Wikipedia** and **OpenCage** to ensure high-speed, sub-millisecond retrieval without API rate-limit bottlenecks.
2.  **Dynamic Comtrade Engine:** When a node expansion is requested, the system queries the **UN Comtrade API** on the fly to render actual, live export/import trade paths and volume metrics.
3.  **Interactive Registry:** Users can actively expand the dataset via the registration module, which instantly normalizes and injects new companies into the visualization pipeline.
4.  **Real-time Aggregation:** The frontend merges our massive database state with live Comtrade routes into a unified graph store, utilizing **A*** algorithms to compute precise logistical distances.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Neo4j Instance (Local or AuraDB)
- API Key for OpenCage

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/syn3rgy2026/Vibe_Creators_Syn3rgy_RudraSanjaySheth.git
   cd Vibe_Creators_Syn3rgy_RudraSanjaySheth
   ```

2. **Setup Server:**
   ```bash
   cd server
   npm install
   # Create a .env file based on the environment section below
   npm run dev
   ```

3. **Setup Client:**
   ```bash
   cd ../client
   npm install
   npm run dev
   ```

---

## 🔑 Environment Variables

Create a `.env` file in the `server/` directory:

```env
PORT=3001
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
OPENCAGE_API_KEY=your_opencage_key
```

---

## 📐 Algorithmic Foundations

FlowScope leverages foundational graph algorithms to make sense of complex trade flows:

- **Breadth-First Search (BFS):** Traverses the supply chain network layer-by-layer to determine clear "Tiers":
  - **Tier 0:** Your search origin.
  - **Tier 1:** Direct strategic partners.
  - **Tier 2:** Secondary upstream suppliers.
  - **Tier 3+:** Raw material foundations (Ores, Minerals, Fuels).
- **A* (A-Star) Search Algorithm:** Computes the most efficient logistical paths and shortest transit distances between international trade nodes, accounting for geographical heuristics.

---

## 🤝 Contributors

**Vibe Creators - Syn3rgy**
- *Rudra Sanjay Sheth*
- *Tanvi Kamath*
- *Vidhi Shah*
- *Shubh Shah*

---

*FlowScope is built for precision. Trace the invisible, secure the future.*

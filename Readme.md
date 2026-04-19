# 🌐 FlowScope: Supply Chain Graph Intelligence

> **Visualizing the complexity of global trade through AI-driven graph intelligence.**

FlowScope is a high-performance supply chain intelligence platform designed to map, trace, and analyze global trade networks. By merging real-time trade data with AI-powered Bill of Materials (BOM) inference, FlowScope reveals deep-tier dependencies and identifies risks across multi-country logistics networks.

---

## ✨ Key Features

- **🛡️ AI-Powered BOM Inference:** Uses Gemini AI and UN Comtrade data to automatically predict and verify product sub-components (Bauxite → Alumina → Aluminum).
- **🕸️ Dynamic Graph Engine:** Interactive multi-tier graph visualization powered by **Cytoscape.js**, featuring hardware-accelerated nodes and real-time path discovery.
- **🗺️ Global Map Intelligence:** Real-time trade route mapping using **Leaflet**, visualizing the physical flow of goods across continents.
- **📊 Intelligence Dossiers:** instant access to verified company profiles, trade volumes, and partner networks.
- **🔍 Prefix-Score Search:** Optimized search engine that prioritizes exact brand matches and caches results for sub-millisecond retrieval.
- **⛓️ Tier-Based Taxonomy:** Automatic classification of suppliers (Tier 1-4) using a custom Breadth-First Search (BFS) discovery algorithm.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React, Vite, TailwindCSS, Framer Motion, Lucide Icons |
| **Backend** | Node.js, Express, Axios |
| **Database** | Neo4j (GraphDB), CSV Fast-Streaming |
| **Visualization** | Leaflet.js (Map), Cytoscape.js (Graph) |
| **AI/Data** | Google Gemini AI, UN Comtrade API |

---

## 🏗️ Architecture Overview

The system operates on a **Discovery-Cache** model:
1.  **Static Database:** Core company data and HSN taxonomies are stored in Neo4j and high-speed CSV caches.
2.  **Live Discovery:** When a node expansion is requested, the **Trace Engine** queries Gemini AI to predict dependencies and fetches volume metrics from the UN Comtrade API.
3.  **Real-time Aggregation:** The frontend merges database state with live AI-discovered partners into a unified graph store.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Neo4j Instance (Local or AuraDB)
- Google Gemini API Key

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
GEMINI_API_KEY=your_google_ai_key
```

---

## 📐 The Tier Taxonomy (BFS Algorithm)

FlowScope uses a BFS (Breadth-First Search) model to categorize supply chain depth:

- **Tier 0:** Your search origin.
- **Tier 1:** Direct strategic partners.
- **Tier 2:** Secondary upstream suppliers.
- **Tier 3+:** Raw material foundations (Ores, Minerals, Fuels).

---

## 🤝 Contributors

**Vibe Creators - Syn3rgy**
- *Rudra Sanjay Sheth*
- *Tanvi Kamath*
- *Vidhi Shah*
- *Shubh Shah*

---

*FlowScope is built for precision. Trace the invisible, secure the future.*

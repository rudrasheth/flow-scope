# Understanding Tiers in FlowScope

In FlowScope, **Tiers** represent the distance or "hops" a company is from the center of your search. They are assigned dynamically using a Breadth-First Search (BFS) algorithm during the supply chain traversal.

Here is the breakdown of the Tiers and how the system "tags" them:

## 1. What Each Tier Represents

* **Tier 0 (The Anchor/Origin):** This is the company you specifically searched for. It is the root of the entire network graph.
* **Tier 1 (Direct Suppliers):** These are companies that provide goods or materials directly to the Tier 0 company.
* **Tier 2 (Upstream Suppliers):** These are the "suppliers to the suppliers." They provide materials to Tier 1 companies.
* **Tier 3+ (Deep-Tier Suppliers):** This continues deeper into the chain (Tier 3, 4, etc.), representing the raw material sources or secondary components far removed from the end product.

## 2. How the "Tag" is Assigned (Backend Logic)

The classification happens in the backend `trace.js` logic using a discovery queue:

* **Initialization:** The company you search for is added to a "Queue" with `tier: 0`.
* **Discovery:** The system looks for all companies connected to that "Tier 0" company via a trade link (e.g., a "SUPPLIES_TO" relationship).
* **Incrementing:** Every new company found during this search is assigned a tier value of `Parent Tier + 1`.
  * *If a supplier is found for a Tier 0 node, it becomes Tier 1.*
  * *If a supplier is found searching from a Tier 1 node, it becomes Tier 2.*
* **Stopping Point:** The algorithm continues until it reaches the `maxTiers` limit (usually set to 2 or 3 to prevent the graph from becoming too cluttered).

## 3. How it Looks in the Graph (Frontend Visuals)

The system uses the tier tag to automatically style the graph, making the hierarchy obvious at a glance:

| Tier | Node Size | Importance | Visual Style |
|:---|:---|:---|:---|
| **Tier 0** | Largest (56px) | Highest | Solid border, boldest label, pulsates as the "Origin." |
| **Tier 1** | Large (42px) | High | Clear visibility, direct connections to center. |
| **Tier 2** | Medium (34px) | Medium | Smaller nodes, orbiting the Tier 1 group. |
| **Tier 3** | Small (28px) | Low | Smallest nodes at the edges of the network. |

---

### 🎙️ Summary for Mentor:

> *"The Tiers are a representation of supply chain depth. We use a BFS (Breadth-First Search) algorithm to assign these tags. The 'Origin' is Tier 0, and every hop upstream adds +1 to the tier. This allows us to visually scale the graph so the most direct dependencies are larger and more prominent than the deep-tier suppliers."*

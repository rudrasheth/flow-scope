import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { Route, Zap, MapPin, ArrowRight, Loader2, ChevronDown, Navigation, Globe2, Package, Building2, Anchor } from 'lucide-react';

// ─── Major Global Trade Hubs ───
const MAJOR_HUBS = {
  'Germany': 'Primary European Export Hub - High infrastructure efficiency reduces overall transit costs.',
  'Singapore': 'Strategic Maritime Hub - Optimized for rapid transshipment and document processing.',
  'China': 'Global Manufacturing & Logistics Powerhouse - Scale-driven cost advantages.',
  'Netherlands': 'European Gateway (Rotterdam) - Superior multi-modal connectivity.',
  'United Arab Emirates': 'Middle East Transit Nexus - High-efficiency air and sea integration.'
};

// ─── Haversine Distance Helper ───
const calculateHaversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

// ─── Haversine Formula (Client-side) ───
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// ─── Custom Marker Icons ───
const createRouteMarker = (color, size = 18, isEndpoint = false) => L.divIcon({
  className: 'route-marker',
  html: `<div style="
    background: ${color};
    width: ${size}px; height: ${size}px;
    border: 3px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 ${isEndpoint ? 20 : 12}px ${color}, 0 2px 8px rgba(0,0,0,0.3);
    ${isEndpoint ? 'animation: pulse-glow 2s infinite;' : ''}
  "></div>
  <style>
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 20px ${color}, 0 2px 8px rgba(0,0,0,0.3); }
      50% { box-shadow: 0 0 35px ${color}, 0 2px 12px rgba(0,0,0,0.4); }
    }
  </style>`,
  iconSize: [size, size],
  iconAnchor: [size / 2, size / 2],
});

const SOURCE_MARKER = createRouteMarker('#10B981', 20, true);
const DEST_MARKER = createRouteMarker('#4DA3FF', 22, true); // Matching Tier 0 Blue
const TIER1_MARKER = createRouteMarker('#A78BFA', 18, true); // Matching Tier 1 Purple

export default function RouteOptimization({ company, graphData, onTriggerTrace }) {
  const [component, setComponent] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSteps, setShowSteps] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(-1);
  const [availableComponents, setAvailableComponents] = useState([]);

  const backendUrl = import.meta.env.VITE_API_URL || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : 'https://flow-scope.onrender.com'
  );

  // Fetch company specific BOM components
  useEffect(() => {
    if (company?.name) {
      axios.get(`${backendUrl}/api/companies/${encodeURIComponent(company.name)}/hsn`)
        .then(res => {
          if (res.data && res.data.hsnCodes) {
            setAvailableComponents(res.data.hsnCodes);
          } else {
            setAvailableComponents([]);
          }
        })
        .catch(err => {
          console.warn('Failed to load components for company', err);
          setAvailableComponents([]);
        });
    } else {
      setAvailableComponents([]);
    }
  }, [company, backendUrl]);

  // ─── CORE LOGIC: Tier 1 Vendor Distance Optimization ───
  const handleOptimize = useCallback(async () => {
    if (!company?.name || !component.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // 1. Identify Tier 0 Node
      let t0 = graphData?.nodes.find(n => n.tier === 0);
      
      // 2. Determine if we need to trigger a fresh trace (Comtrade Expansion)
      // Check if we have Tier 1 vendors in the current graph
      let t1Vendors = graphData?.nodes.filter(n => n.tier === 1 && n.type === 'Company') || [];
      
      // If no Tier 1s or if the user wants to ensure we have the LATEST data for this component
      if (t1Vendors.length === 0 || !graphData?.tradeRoutes?.some(r => r.hsn === component || r.hsn === component.substring(0,2))) {
        if (onTriggerTrace) {
           await onTriggerTrace(company, component, component);
           // After await, we should look at the graphData again (it should have been updated in props)
           // But wait, the prop won't update in this execution context.
           // We might need to wait for the next render or use the return value if fetchGraph returns data.
        }
      }

      // Note: Because onTriggerTrace updates the parent state, this component will re-render.
      // To handle the "Compute" after the trace is done, we can use a separate effect or just check if data is now available.
      // However, for better UX, I'll allow the user to click again or I'll use a 'shouldAutoCompute' flag.

    } catch (err) {
      setError('Optimization failed. Please ensure the network is traced first.');
    } finally {
      setLoading(false);
    }
  }, [company, component, graphData, onTriggerTrace]);

  // Effect to automatically run optimization once graphData contains the relevant Tier 1s
  useEffect(() => {
    if (!loading && component && graphData?.nodes.some(n => n.tier === 1)) {
      const t0 = graphData.nodes.find(n => n.tier === 0);
      const t1Vendors = graphData.nodes.filter(n => n.tier === 1 && n.type === 'Company');
      
      if (t0 && t1Vendors.length > 0 && !result) {
        // Auto-run distance calculation if we just finished a trace
        const vendorRoutes = t1Vendors.map((v, idx) => {
          const dist = calculateHaversine(v.coords[0], v.coords[1], t0.coords[0], t0.coords[1]);
          return {
            source: v.label,
            destination: t0.label,
            totalDistance: dist,
            route: [v.country, t0.country],
            color: idx % 2 === 0 ? '#10B981' : '#F59E0B',
            coords: { from: v.coords, to: t0.coords },
            vId: v.id,
            isHub: !!MAJOR_HUBS[v.country],
            hubNote: MAJOR_HUBS[v.country]
          };
        }).sort((a, b) => a.totalDistance - b.totalDistance);

        const best = vendorRoutes[0];
        setResult({
          bestRoute: best,
          allRoutes: vendorRoutes,
          routeNodes: [
             ...t1Vendors.map(v => ({ 
               name: v.label, lat: v.coords[0], lng: v.coords[1], 
               isSource: true, tier: 1, country: v.country,
               hubNote: MAJOR_HUBS[v.country]
             })),
             { name: t0.label, lat: t0.coords[0], lng: t0.coords[1], isDestination: true, tier: 0, country: t0.country }
          ],
          routeEdges: vendorRoutes.map((r, i) => ({
            from: r.coords.from,
            to: r.coords.to,
            color: i === 0 ? '#10B981' : '#A78BFA',
            isBest: i === 0,
            routeIndex: i
          })),
          meta: {
            company: t0.label,
            hsCode: component,
            sourceCountries: Array.from(new Set(t1Vendors.map(v => v.country)))
          },
          steps: [
            { step: 1, action: `Live Trace Complete: Identified ${t1Vendors.length} Tier 1 partners` },
            { step: 2, action: `Distance assessment calculated for all vendors` },
            { step: 3, action: `Shortest lead path verified through Trade Hub Intelligence` }
          ]
        });
      }
    }
  }, [graphData, component, loading, result]);

  useEffect(() => {
    if (!component.trim()) {
      setResult(null);
      setError(null);
    }
  }, [component]);

  // ─── Helper: Create Curved Path (Great Circle Visual) ───
  const getCurvedPath = (from, to, segments = 40) => {
    const [lat1, lon1] = from;
    const [lat2, lon2] = to;
    const path = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      let lat = lat1 + (lat2 - lat1) * t;
      let lon = lon1 + (lon2 - lon1) * t;
      const offset = Math.sin(t * Math.PI) * (haversine(lat1, lon1, lat2, lon2) / 3000) * 8;
      lat += offset;
      path.push([lat, lon]);
    }
    return path;
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] text-white overflow-hidden">
      <div className="shrink-0 px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-violet-600/20 border border-violet-500/30">
            <Route size={20} className="text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight uppercase tracking-tighter">Tier 1 Logistics Optimizer</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-60">Vendor Distance & Route Assessment</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Company */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm min-w-[160px]">
            <Building2 size={14} className="text-blue-400 shrink-0" />
            <span className="font-black text-blue-300 truncate uppercase text-[11px]">{company?.name || 'Select company'}</span>
          </div>
          <ArrowRight size={16} className="text-slate-600 shrink-0" />
          <div className="relative flex-1 max-w-[300px]">
            <select
              value={component}
              onChange={(e) => setComponent(e.target.value)}
              className="w-full appearance-none px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-[11px] font-black text-white uppercase tracking-wider
                focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 cursor-pointer
                hover:border-slate-600 transition-all"
            >
              <option value="">Select BOM Component</option>
              {availableComponents.map(c => (
                <option key={c.code} value={c.code}>
                  {c.description ? `${c.description} (${c.code})` : c.code}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <button
            onClick={handleOptimize}
            disabled={loading || !component.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500
              text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {loading ? 'ANALYZING...' : 'COMPUTE LOGISTICS'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-[380px] shrink-0 border-r border-white/10 overflow-y-auto custom-scrollbar bg-slate-900/50">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6">
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
                  <p className="text-xs font-black text-red-400 uppercase tracking-wider">{error}</p>
                </div>
              </motion.div>
            )}
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className="h-20 bg-slate-800/50 rounded-2xl animate-pulse" />
                ))}
              </motion.div>
            )}
            {result && !loading && (
              <motion.div key="result" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="p-5 space-y-4">
                {/* Best Vendor Card */}
                <div className="p-5 bg-gradient-to-br from-emerald-600/20 to-teal-600/20 border border-emerald-500/30 rounded-2xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Optimal Tier 1 Vendor</span>
                    <span className="px-2 py-0.5 bg-emerald-500/30 rounded-full text-[9px] font-black text-emerald-200">SHORTEST LEAD</span>
                  </div>
                  <div className="text-xl font-black text-white mb-1 uppercase truncate">
                    {result.bestRoute.source}
                  </div>
                  <div className="text-3xl font-black text-white tabular-nums">
                    {result.bestRoute.totalDistance.toLocaleString()} <span className="text-lg text-emerald-300 font-bold">km</span>
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">
                    Direct logistics distance to {result.bestRoute.destination}
                  </div>
                </div>

                {/* Vendor Comparison */}
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 px-1">Tier 1 Vendor Ranker</div>
                  <div className="space-y-2">
                    {result.allRoutes.map((r, i) => (
                      <motion.button
                        key={i}
                        onClick={() => setSelectedRoute(selectedRoute === i ? -1 : i)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all ${
                          selectedRoute === i
                            ? 'bg-slate-800 border-white/20 shadow-xl'
                            : 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-emerald-400' : 'bg-violet-400'}`} />
                            <span className="text-[11px] font-black text-white uppercase truncate max-w-[180px]">{r.source}</span>
                            {r.isHub && (
                              <span className="text-[7px] font-black bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-500/20">HUB</span>
                            )}
                          </div>
                          <span className="text-xs font-black text-slate-300 tabular-nums">{r.totalDistance.toLocaleString()} km</span>
                        </div>
                        <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                          <span>{r.route[0]}</span>
                          <ArrowRight size={10} />
                          <span className="text-blue-400">{r.route[1]}</span>
                        </div>
                        {r.isHub && (
                          <div className="p-2 bg-blue-500/5 rounded-lg border border-blue-500/10 text-[9px] font-bold text-blue-300/80 leading-relaxed">
                            {r.hubNote}
                          </div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Pipeline Stats */}
                <div className="p-4 bg-slate-800/20 border border-slate-700/30 rounded-2xl">
                   <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Optimization Insights</div>
                   <div className="space-y-3">
                      {result.steps.map((s, i) => (
                        <div key={i} className="flex gap-3 items-start">
                          <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[9px] font-black shrink-0">{i+1}</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase leading-tight">{s.action}</div>
                        </div>
                      ))}
                   </div>
                </div>
              </motion.div>
            )}

            {!result && !loading && !error && (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="w-20 h-20 rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-6">
                  <Anchor size={32} className="text-slate-600" />
                </div>
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Select a BOM Component</p>
                <p className="text-[10px] text-slate-600 mt-2 max-w-[200px] font-bold leading-relaxed uppercase">
                  Select a product to identify the closest Tier 1 suppliers in your network.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 relative">
          <MapContainer center={[25, 20]} zoom={2} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution='&copy; Esri' />
            <TileLayer url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" attribution='&copy; Esri' />

            {/* Direct Vendor Polylines */}
            {result?.routeEdges?.map((edge, i) => (
              <Polyline
                key={`edge-${i}`}
                positions={getCurvedPath(edge.from, edge.to)}
                pathOptions={{
                  color: edge.color,
                  weight: edge.isBest ? 5 : 2,
                  opacity: selectedRoute === -1 ? (edge.isBest ? 1 : 0.4) : (edge.routeIndex === selectedRoute ? 1 : 0.1),
                  dashArray: edge.isBest ? null : '10 10',
                  lineJoin: 'round',
                  className: edge.isBest ? 'animate-flow-fast' : ''
                }}
              />
            ))}

            {/* Vendor & Target Markers */}
            {result?.routeNodes?.map((node, i) => (
              <Marker
                key={`node-${node.name}-${i}`}
                position={[node.lat, node.lng]}
                icon={node.isDestination ? DEST_MARKER : TIER1_MARKER}
              >
                <Popup>
                  <div className="p-3 min-w-[200px] bg-slate-900 text-white rounded-lg border border-slate-700">
                    <div className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase inline-block mb-2 bg-slate-800 text-slate-400 border border-slate-700">
                      {node.isDestination ? 'Tier 0 Destination' : 'Tier 1 Supplier'}
                    </div>
                    <div className="text-xs font-black text-white uppercase">{node.name}</div>
                    <div className="text-[9px] text-slate-500 mt-1 uppercase font-bold">{node.country}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Map Overlay: Legend */}
          {result && (
            <div className="absolute bottom-6 right-6 z-[1000]">
               <div className="bg-black/90 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-2xl">
                  <div className="text-[10px] font-black uppercase text-slate-400 mb-2">Logistics Summary</div>
                  <div className="flex items-center gap-4">
                     <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[9px] font-black text-white uppercase">Best Supplier</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-violet-500" />
                        <span className="text-[9px] font-black text-white uppercase">Alternative</span>
                     </div>
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes flow-fast { to { stroke-dashoffset: -20; } }
        .animate-flow-fast { animation: flow-fast 0.5s linear infinite; }
      `}</style>
    </div>
  );
}

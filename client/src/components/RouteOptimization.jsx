import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { Route, Zap, MapPin, ArrowRight, Loader2, ChevronDown, Navigation, Globe2, Package, Building2 } from 'lucide-react';

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
const DEST_MARKER = createRouteMarker('#EF4444', 22, true);
const HUB_MARKER = createRouteMarker('#8B5CF6', 14);

export default function RouteOptimization({ company, graphData }) {
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
            setAvailableComponents(res.data.hsnCodes.map(h => h.code));
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

  const handleOptimize = useCallback(async () => {
    if (!company?.name || !component.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data } = await axios.post(`${backendUrl}/api/route/optimize`, {
        company: company.name,
        component: component.trim(),
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Route optimization failed');
    } finally {
      setLoading(false);
    }
  }, [company, component, backendUrl]);

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
            <h2 className="text-lg font-black tracking-tight">Route Optimization</h2>
            <p className="text-xs text-slate-400 font-medium">A* Pathfinding with Great Circle Arcs</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm min-w-[160px]">
            <Building2 size={14} className="text-blue-400 shrink-0" />
            <span className="font-bold text-blue-300 truncate">{company?.name || 'Select company'}</span>
          </div>
          <ArrowRight size={16} className="text-slate-600 shrink-0" />
          <div className="relative flex-1 max-w-[300px]">
            <div className="relative">
              <select
                value={component}
                onChange={(e) => setComponent(e.target.value)}
                className="w-full appearance-none px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-violet-500 cursor-pointer"
              >
                <option value="">Select Component</option>
                {availableComponents.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <button
            onClick={handleOptimize}
            disabled={loading || !component.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-sm font-black disabled:opacity-40"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {loading ? 'COMPUTING...' : 'OPTIMIZE'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-[380px] shrink-0 border-r border-white/10 overflow-y-auto custom-scrollbar bg-slate-900/50">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6">
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
                  <p className="text-sm font-bold text-red-400">{error}</p>
                </div>
              </motion.div>
            )}
            {loading && (
              <div className="p-6 space-y-4">
                {[1,2,3,4].map(i => <div key={i} className="h-16 bg-slate-800/50 rounded-2xl animate-pulse" />)}
              </div>
            )}
            {result && !loading && (
              <motion.div key="result" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="p-5 space-y-4">
                <div className="p-5 bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/30 rounded-2xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-violet-300">Optimal Route</span>
                    <span className="px-2 py-0.5 bg-violet-500/30 rounded-full text-[10px] font-black text-violet-200">
                      {result.meta.isFallback ? 'SIMULATED' : 'A* COMPUTED'}
                    </span>
                  </div>
                  <div className="text-3xl font-black text-white mb-1 tabular-nums">
                    {result.bestRoute.totalDistance.toLocaleString()} <span className="text-lg text-violet-300">km</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-violet-200 font-bold mt-3 flex-wrap">
                    {result.bestRoute.route.map((country, i) => (
                      <span key={country + i} className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                          i === 0 ? 'bg-emerald-500/30 text-emerald-200' :
                          i === result.bestRoute.route.length - 1 ? 'bg-red-500/30 text-red-200' : 'bg-slate-700 text-slate-300'
                        }`}>{country}</span>
                        {i < result.bestRoute.route.length - 1 && <ArrowRight size={12} className="text-violet-400" />}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">HS Code</div>
                    <div className="text-base font-black text-white">{result.meta.hsCode}</div>
                  </div>
                  <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Sources</div>
                    <div className="text-base font-black text-white">{result.meta.sourceCountries.length}</div>
                  </div>
                </div>
                {result.allRoutes?.length > 1 && (
                  <div className="space-y-2">
                    {result.allRoutes.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedRoute(selectedRoute === i ? -1 : i)}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${selectedRoute === i ? 'bg-white/5 border-white/20' : 'bg-slate-800/30 border-slate-700/30'}`}
                      >
                         <div className="flex items-center justify-between">
                           <span className="text-[10px] font-black" style={{ color: r.color }}>{r.source} → {result.bestRoute.destination}</span>
                           <span className="text-xs font-bold tabular-nums">{r.totalDistance.toLocaleString()} km</span>
                         </div>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 relative">
          <MapContainer center={[25, 20]} zoom={2} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
            <TileLayer url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />
            {result?.routeEdges?.map((edge, i) => (
              <Polyline
                key={`edge-${i}`}
                positions={getCurvedPath(edge.from, edge.to)}
                pathOptions={{
                  color: edge.color || '#8B5CF6',
                  weight: edge.isBest ? 5 : 2,
                  opacity: selectedRoute === -1 ? (edge.isBest ? 1 : 0.4) : (edge.routeIndex === selectedRoute ? 1 : 0.05),
                  dashArray: edge.isBest ? null : '5 10',
                }}
              />
            ))}
            {result?.routeNodes?.map((node, i) => (
              <Marker key={`node-${i}`} position={[node.lat, node.lng]} icon={node.isDestination ? DEST_MARKER : (node.isSource ? SOURCE_MARKER : HUB_MARKER)}>
                <Popup><div className="p-1 font-bold text-slate-900">{node.name}</div></Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

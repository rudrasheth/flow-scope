import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { Route, Zap, MapPin, ArrowRight, Loader2, ChevronDown, Navigation, Globe2, Package, Building2 } from 'lucide-react';

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

  // Extract available components from existing graph data (BOM)
  const availableComponents = (() => {
    if (!graphData?.nodes) return [];
    return graphData.nodes
      .filter(n => n.type === 'Component')
      .map(n => n.label)
      .filter((v, i, a) => a.indexOf(v) === i);
  })();

  const handleOptimize = useCallback(async () => {
    if (!company?.name || !component.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data } = await axios.post('/api/route/optimize', {
        company: company.name,
        component: component.trim(),
      });

      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Route optimization failed');
    } finally {
      setLoading(false);
    }
  }, [company, component]);

  // Clear result if component is empty
  useEffect(() => {
    if (!component.trim()) {
      setResult(null);
      setError(null);
    }
  }, [component]);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] text-white overflow-hidden">
      {/* ─── TOP CONTROL BAR ─── */}
      <div className="shrink-0 px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-violet-600/20 border border-violet-500/30">
            <Route size={20} className="text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight">Route Optimization</h2>
            <p className="text-xs text-slate-400 font-medium">A* Pathfinding with Haversine Distance</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Company (read-only from context) */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm min-w-[160px]">
            <Building2 size={14} className="text-blue-400 shrink-0" />
            <span className="font-bold text-blue-300 truncate">{company?.name || 'Select company'}</span>
          </div>

          <ArrowRight size={16} className="text-slate-600 shrink-0" />

          {/* Component selector */}
          <div className="relative flex-1 max-w-[300px]">
            {availableComponents.length > 0 ? (
              <div className="relative">
                <select
                  value={component}
                  onChange={(e) => setComponent(e.target.value)}
                  className="w-full appearance-none px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white
                    focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 cursor-pointer
                    hover:border-slate-600 transition-all"
                >
                  <option value="">Select Component</option>
                  {availableComponents.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            ) : (
              <input
                type="text"
                value={component}
                onChange={(e) => setComponent(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleOptimize()}
                placeholder="e.g. Lithium Battery"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white
                  placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30
                  hover:border-slate-600 transition-all"
              />
            )}
          </div>

          <button
            onClick={handleOptimize}
            disabled={loading || !component.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500
              text-white rounded-xl text-sm font-black uppercase tracking-wider transition-all shadow-lg shadow-violet-500/20
              disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-violet-600 disabled:hover:to-indigo-600"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {loading ? 'COMPUTING...' : 'OPTIMIZE'}
          </button>
        </div>
      </div>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 flex min-h-0">

        {/* ─── LEFT: RESULTS PANEL ─── */}
        <div className="w-[380px] shrink-0 border-r border-white/10 overflow-y-auto custom-scrollbar bg-slate-900/50">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6"
              >
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
                  <p className="text-sm font-bold text-red-400">{error}</p>
                </div>
              </motion.div>
            )}

            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-6 space-y-4"
              >
                {[1,2,3,4].map(i => (
                  <div key={i} className="h-16 bg-slate-800/50 rounded-2xl animate-pulse" />
                ))}
              </motion.div>
            )}

            {result && !loading && (
              <motion.div
                key="result"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-5 space-y-4"
              >
                {/* Best Route Card */}
                <div className="p-5 bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/30 rounded-2xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-violet-300">Optimal Route</span>
                    <span className="px-2 py-0.5 bg-violet-500/30 rounded-full text-[10px] font-black text-violet-200">
                      A* COMPUTED
                    </span>
                  </div>
                  <div className="text-3xl font-black text-white mb-1 tabular-nums">
                    {result.bestRoute.totalDistance.toLocaleString()} <span className="text-lg text-violet-300">km</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-violet-200 font-bold mt-3 flex-wrap">
                    {result.bestRoute.route.map((country, i) => (
                      <span key={country} className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                          i === 0 ? 'bg-emerald-500/30 text-emerald-200' :
                          i === result.bestRoute.route.length - 1 ? 'bg-red-500/30 text-red-200' :
                          'bg-slate-700 text-slate-300'
                        }`}>
                          {country}
                        </span>
                        {i < result.bestRoute.route.length - 1 && (
                          <ArrowRight size={12} className="text-violet-400" />
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Meta Info */}
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

                {/* All Routes Comparison */}
                {result.allRoutes?.length > 1 && (
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">All Computed Routes</div>
                    <div className="space-y-2">
                      {result.allRoutes.map((r, i) => (
                        <motion.button
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          onClick={() => setSelectedRoute(selectedRoute === i ? -1 : i)}
                          className={`w-full text-left p-3 rounded-xl border transition-all ${
                            selectedRoute === i
                              ? 'border-white/20 shadow-lg'
                              : 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600'
                          }`}
                          style={selectedRoute === i ? { background: `${r.color}15`, borderColor: `${r.color}50` } : {}}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                              style={{ background: r.color }}
                            />
                            <span className="text-[10px] font-black uppercase" style={{ color: r.color }}>{r.source}</span>
                            <ArrowRight size={10} className="text-slate-600" />
                            <span className="text-[10px] font-black text-red-400 uppercase">{result.bestRoute.destination}</span>
                            <span className="ml-auto text-xs font-black text-slate-300 tabular-nums">{r.totalDistance.toLocaleString()} km</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-bold truncate pl-4.5">
                            {r.route.join(' → ')}
                          </div>
                          {i === 0 && (
                            <div className="mt-1.5 pl-4.5">
                              <span className="text-[7px] font-black uppercase bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                                ⚡ Shortest Path
                              </span>
                            </div>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Route Nodes (Companies in each country) */}
                {result.routeNodes && (
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Route Nodes</div>
                    <div className="space-y-2">
                      {result.routeNodes.map((node, i) => (
                        <div key={node.name} className="flex items-center gap-3 p-3 bg-slate-800/30 border border-slate-700/30 rounded-xl">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0 ${
                            node.isSource ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            node.isDestination ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            'bg-slate-700 text-slate-400'
                          }`}>
                            {i + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-black text-white truncate">{node.name}</div>
                            {node.companies?.length > 0 && (
                              <div className="text-[9px] text-slate-500 font-bold truncate mt-0.5">
                                {node.companies.slice(0, 3).join(', ')}
                              </div>
                            )}
                          </div>
                          {node.isSource && <span className="text-[8px] font-black text-emerald-400 uppercase bg-emerald-500/10 px-2 py-0.5 rounded-full">SRC</span>}
                          {node.isDestination && <span className="text-[8px] font-black text-red-400 uppercase bg-red-500/10 px-2 py-0.5 rounded-full">DST</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pipeline Steps */}
                <button
                  onClick={() => setShowSteps(!showSteps)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-800/30 border border-slate-700/30 rounded-xl text-xs font-black text-slate-400 uppercase tracking-wider hover:border-slate-600 transition-all"
                >
                  <span>Pipeline Steps ({result.steps?.length || 0})</span>
                  <ChevronDown size={14} className={`transition-transform ${showSteps ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {showSteps && result.steps && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-1"
                    >
                      {result.steps.map((s, i) => (
                        <div key={i} className="text-[10px] font-mono text-slate-500 px-3 py-1 bg-slate-800/20 rounded-lg">
                          <span className="text-violet-400">Step {s.step}:</span> {s.action || s.result}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

              </motion.div>
            )}

            {/* Empty State */}
            {!result && !loading && !error && (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <motion.div
                  animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.5, 0.3] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="w-20 h-20 rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-6"
                >
                  <Navigation size={32} className="text-slate-600" />
                </motion.div>
                <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Select a Component</p>
                <p className="text-xs text-slate-600 mt-2 max-w-[200px]">
                  Choose a component from the BOM or type one manually to compute the optimal supply route.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── RIGHT: MAP VIEW ─── */}
        <div className="flex-1 relative">
          <MapContainer
            center={[25, 20]}
            zoom={2}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            />
            <TileLayer
              url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; Esri'
            />

            {/* ALL Route Polylines — each route has its own color */}
            {result?.routeEdges?.map((edge, i) => (
              <Polyline
                key={`route-edge-${i}`}
                positions={[edge.from, edge.to]}
                pathOptions={{
                  color: edge.color || '#8B5CF6',
                  weight: edge.isBest ? 5 : 3,
                  opacity: selectedRoute === -1
                    ? (edge.isBest ? 1 : 0.7)
                    : (edge.routeIndex === selectedRoute ? 1 : 0.15),
                  dashArray: edge.isBest ? null : '8 6',
                  lineJoin: 'round',
                }}
              />
            ))}

            {/* Route Node Markers */}
            {result?.routeNodes?.map((node, i) => {
              if (!node.lat || !node.lng) return null;
              const icon = node.isDestination
                ? DEST_MARKER
                : node.isSource
                  ? SOURCE_MARKER
                  : HUB_MARKER;

              return (
                <Marker
                  key={`route-node-${node.name}`}
                  position={[node.lat, node.lng]}
                  icon={icon}
                >
                  <Popup>
                    <div className="p-3 min-w-[200px] bg-slate-900 text-white rounded-lg border border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                          node.isSource ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800' :
                          node.isDestination ? 'bg-red-900/50 text-red-400 border border-red-800' :
                          'bg-violet-900/50 text-violet-400 border border-violet-800'
                        }`}>
                          {node.isSource ? 'Source (Exporter)' : node.isDestination ? 'Destination (Importer)' : 'Trade Hub'}
                        </div>
                      </div>
                      <div className="text-xs font-black text-white">
                        {node.isDestination ? result.meta.company : node.name}
                      </div>
                      {!node.isDestination && node.companies?.length > 0 && (
                        <div className="text-[10px] text-slate-300 mt-1">
                          <span className="text-slate-500 font-bold">Companies: </span>
                          {node.companies.slice(0, 5).join(', ')}
                        </div>
                      )}
                      <div className="text-[9px] text-slate-500 mt-2 font-mono">
                        [{node.lat?.toFixed(2)}, {node.lng?.toFixed(2)}]
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Map Overlay: Route Legend */}
          {result && (
            <div className="absolute top-4 right-4 z-[1000]">
              <div className="bg-black/85 backdrop-blur-md px-5 py-4 rounded-2xl border border-white/10 shadow-2xl min-w-[220px]">
                <div className="flex items-center gap-2 mb-3">
                  <Globe2 size={14} className="text-violet-400" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    {result.allRoutes?.length || 1} Routes Computed
                  </span>
                </div>

                {/* Best route highlight */}
                <div className="text-lg font-black text-white tabular-nums mb-3">
                  {result.bestRoute.totalDistance.toLocaleString()} <span className="text-sm text-violet-300">km</span>
                  <div className="text-[9px] text-slate-500 font-bold mt-0.5">Shortest Path</div>
                </div>

                {/* Route color legend */}
                <div className="space-y-1.5 border-t border-white/10 pt-3">
                  <button
                    onClick={() => setSelectedRoute(-1)}
                    className={`w-full text-left px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      selectedRoute === -1 ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Show All Routes
                  </button>
                  {result.allRoutes?.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedRoute(i)}
                      className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all ${
                        selectedRoute === i ? 'bg-white/10' : 'hover:bg-white/5'
                      }`}
                    >
                      <div
                        className="w-3 h-3 rounded-full shrink-0 border border-white/20"
                        style={{ background: r.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[10px] font-black truncate ${selectedRoute === i ? 'text-white' : 'text-slate-400'}`}>
                          {r.source} → {result.bestRoute.destination}
                        </div>
                        <div className="text-[9px] text-slate-600 tabular-nums">{r.totalDistance.toLocaleString()} km</div>
                      </div>
                      {i === 0 && (
                        <span className="text-[7px] font-black uppercase bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full shrink-0">
                          Best
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Map Overlay: Empty state */}
          {!result && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
              <div className="bg-black/80 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/10 shadow-2xl flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse" />
                <span className="text-[10px] uppercase font-bold text-slate-300 tracking-widest">
                  Ready for Route Computation
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

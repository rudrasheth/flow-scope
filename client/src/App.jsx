import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Cloud, Search as SearchIcon, ChevronLeft, ChevronRight, Info, Package, ArrowRightLeft, X, BarChart3, History, Clock, Route } from 'lucide-react';
import Dashboard from './components/Dashboard';
import SearchBar from './components/SearchBar';
import HSNSelector from './components/HSNSelector';
import GraphView from './components/GraphView';
import MapView from './components/MapView';
import DetailsPanel from './components/DetailsPanel';
import AnalyticsModal from './components/AnalyticsModal';
import InteractiveGlobe from './components/InteractiveGlobe';
import RouteOptimization from './components/RouteOptimization';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [viewMode, setViewMode] = useState('map');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const [company,   setCompany]   = useState(null);
  const [hsn,       setHsn]       = useState(null);
  const [hsnDesc,   setHsnDesc]   = useState('');
  const [graphData, setGraphData] = useState(null);
  const [selNode,   setSelNode]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [stats,     setStats]     = useState(null);
  const [error,     setError]     = useState(null);
  const [traceLog,  setTraceLog]  = useState('');
  const [expandingNode, setExpandingNode] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);

  const socketRef = useRef(null);
  const [socketId, setSocketId] = useState(null);

  const graphRef = useRef(null);
  const historyRef = useRef([]);
  useEffect(() => { graphRef.current = graphData; }, [graphData]);
  useEffect(() => { historyRef.current = searchHistory; }, [searchHistory]);

  // ─── Socket.io Connection ───
  useEffect(() => {
    const backendUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : window.location.origin;

    axios.defaults.baseURL = backendUrl;
    const socket = io(backendUrl); 
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setSocketId(socket.id);
    });

    socket.on('graph-update', ({ type, data }) => {
      setGraphData(prev => {
        const current = prev || { nodes: [], edges: [], tradeRoutes: [] };
        if (type === 'node') {
          if (current.nodes.some(n => n.id === data.id)) return current;
          return { ...current, nodes: [...current.nodes, data] };
        }
        if (type === 'edge') {
          const edgeId = `${data.from}-${data.to}`;
          if (current.edges.some(e => `${e.source}-${e.target}` === edgeId)) return current;
          const newEdge = { ...data, source: data.from, target: data.to, type: data.relation };
          return { ...current, edges: [...current.edges, newEdge] };
        }
        return current;
      });
    });

    socket.on('status', ({ message }) => {
      setTraceLog(message.toUpperCase());
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    axios.get('/api/graph/stats').then(({ data }) => setStats(data.stats)).catch(() => {});
  }, []);

  // 🗂️ Cache key helper
  const makeCacheKey = (companyName, hsnCode) => `${companyName}::${hsnCode}`;

  // 📝 fetchGraph — checks cache first, then calls API if not cached
  const fetchGraph = useCallback(async (c, h, desc) => {
    if (!c || !h) return;
    const cacheKey = makeCacheKey(c.name, h);

    // Check cache first
    const cached = historyRef.current.find(entry => entry.cacheKey === cacheKey);
    if (cached) {
      setGraphData(cached.graphData);
      setTraceLog(`CACHED · ${cached.graphData.nodes.length} PARTNERS`);
      return;
    }

    setLoading(true); setError(null); setTraceLog('SYNTHESIZING NETWORK FOR ' + h + '...');
    setGraphData({ nodes: [], edges: [], tradeRoutes: [] }); // Reset for live updates

    try {
      const payload = { 
        companyName: c.name, 
        companyCountry: c.country || 'Unknown', 
        targetHsCode: h, 
        hsnDescription: desc || '', 
        maxTiers: 2,
        socketId: socketRef.current?.id // Send socket ID for streaming
      };
      const { data } = await axios.post('/api/trace/expand', payload, { timeout: 120000 });
      const result = { nodes: data.nodes || [], edges: data.edges || [], tradeRoutes: data.tradeRoutes || [] };
      
      // Ensure we have the final state (socket might miss some messages or arrive out of order)
      setGraphData(result);
      setTraceLog(`VIEWING ${data.meta?.totalNodes || 0} PARTNERS`);

      // Save to history cache only if we actually found partners (avoid caching rate-limited empty results)
      if (result.nodes.length > 1) {
        setSearchHistory(prev => {
          const exists = prev.some(e => e.cacheKey === cacheKey);
          if (exists) return prev;
          const entry = {
            cacheKey,
            companyName: c.name,
            companyCountry: c.country,
            hsn: h,
            hsnDesc: desc || h,
            graphData: result,
            nodeCount: result.nodes.length,
            edgeCount: result.edges.length,
            timestamp: Date.now(),
          };
          return [entry, ...prev].slice(0, 10);
        });
      }
    } catch (err) {
      setError('Trace engine error. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 🔁 Restore a previous search from history (no API call) + open analytics
  const restoreFromHistory = useCallback((entry) => {
    setCompany({ name: entry.companyName, country: entry.companyCountry });
    setHsn(entry.hsn);
    setHsnDesc(entry.hsnDesc);
    setGraphData(entry.graphData);
    setTraceLog(`CACHED · ${entry.nodeCount} PARTNERS`);
    setPage('analytics');
  }, []);

  const expandNode = useCallback(async (node) => {
    if (!node || !node.id) return;
    const current = graphRef.current;
    if (!current) return;
    let traceHsCode = current.edges.find(e => e.source === node.id)?.hsn || hsn || '87';
    setExpandingNode(node.id);
    try {
      const payload = { 
        companyName: node.id, 
        companyCountry: node.country || 'Unknown', 
        targetHsCode: traceHsCode, 
        maxTiers: 2,
        socketId: socketRef.current?.id
      };
      const { data } = await axios.post('/api/trace/expand', payload);
      setGraphData(prev => ({
        nodes: [...prev.nodes, ...(data.nodes || []).filter(n => !prev.nodes.some(ex => ex.id === n.id))],
        edges: [...prev.edges, ...(data.edges || []).filter(e => !prev.edges.some(ex => `${ex.source}-${ex.target}` === `${e.source}-${e.target}`))],
        tradeRoutes: [...(prev.tradeRoutes || []), ...(data.tradeRoutes || []).filter(r => !prev.tradeRoutes.some(ex => `${ex.from}-${ex.to}` === `${r.from}-${r.to}`))]
      }));
    } catch (e) {} finally { setExpandingNode(null); }
  }, [hsn]);

  const handleNodeClickMain = useCallback((node) => {
    setSelNode(node);
  }, []);

  const handleNodeClickMiniGraph = useCallback((node) => {
    setSelNode(node);
  }, []);

  const handleExpandNodeMiniGraph = useCallback((node) => {
    expandNode(node);
  }, [expandNode]);

  return (
    <div className="relative h-screen w-screen bg-transparent text-black font-sans overflow-hidden flex">
      {page === 'dashboard' && (
        <>
          <video 
            autoPlay 
            loop 
            muted 
            playsInline 
            className="absolute inset-0 w-full h-full object-cover -z-10 pointer-events-none"
          >
            <source src="/Product_Video_Generator.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-white/10 -z-10 pointer-events-none" />
        </>
      )}
      
      {/* 🚀 MAIN SIDEBAR (Home Only) - Hidden on cinematic dashboard */}
      {page === 'dashboard' && false && (
        <aside className={`${sidebarCollapsed ? 'w-20' : 'w-64'} bg-white/30 backdrop-blur-md border-r border-white/40 flex flex-col shrink-0 z-50 transition-all duration-300 shadow-sm`}>
          <div className="p-6 flex flex-col h-full text-black">
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} mb-8`}>
               <div className="flex items-center gap-2">
                 <div className="w-8 h-8 bg-black rounded flex items-center justify-center">
                   <Cloud size={18} className="text-white" />
                 </div>
                 {!sidebarCollapsed && <span className="font-bold text-xl tracking-tight">FlowScope</span>}
               </div>
               {!sidebarCollapsed && (
                 <button onClick={() => setSidebarCollapsed(true)} className="p-1 hover:bg-gray-100 rounded text-gray-400"><ChevronLeft size={18} /></button>
               )}
            </div>
            <nav className="space-y-1 flex-1">
              {[{ id: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' }, { id: 'analytics', icon: <Cloud size={20} />, label: 'Analytics' }].map(item => (
                <button
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3 px-3'} py-3 rounded-lg text-sm font-bold transition-all ${
                    page === item.id ? 'bg-gray-100 text-black' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {item.icon}
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              ))}
            </nav>
            {sidebarCollapsed && (
              <button onClick={() => setSidebarCollapsed(false)} className="mt-auto w-10 h-10 mx-auto flex items-center justify-center bg-gray-50 hover:bg-gray-100 rounded-full text-gray-400 border border-gray-200 transition-all">
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </aside>
      )}

      {/* 🎯 MAIN VIEWPORT */}
      <main className="flex-1 relative flex flex-col min-w-0 bg-transparent">
        
        {page === 'analytics' && (
          <div className="absolute inset-0 z-0 bg-[#f8fafc]">
            {graphData ? (
              viewMode === 'map' ? (
                <MapView tradeRoutes={graphData?.tradeRoutes} nodes={graphData?.nodes} />
              ) : (
                <GraphView graphData={graphData} highlightCompany={company?.name} selectedNode={selNode?.id} onNodeClick={handleNodeClickMain} onExpandNode={expandNode} expandingNode={expandingNode} showControls={false} />
              )
            ) : (
              /* Idle state before BOM filter click */
              <div className="w-full h-full flex items-center justify-center pointer-events-none">
                 <MapView tradeRoutes={[]} nodes={[]} />
              </div>
            )}
          </div>
        )}

        {/* Global Control Bar - Hidden on cinematic dashboard */}
        <header className={`h-16 flex items-center justify-between px-6 z-[60] shrink-0 ${page === 'dashboard' ? 'hidden' : 'pointer-events-none'}`}>
          <div className="flex items-center gap-4 pointer-events-auto">
            {(page === 'analytics' || page === 'route') && (
              <button onClick={() => { setPage('dashboard'); setCompany(null); setHsn(null); setGraphData(null); }} className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-gray-100 text-black rounded-lg transition-all font-bold text-sm border border-gray-200 shadow-sm">
                ← Exit
              </button>
            )}
            {page === 'analytics' && company && graphData && (
              <button onClick={() => setPage('route')} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg transition-all font-bold text-xs uppercase tracking-wider shadow-lg shadow-violet-500/20 border border-violet-500/30">
                <Route size={14} />
                Route Optimizer
              </button>
            )}
            {page === 'route' && (
              <button onClick={() => setPage('analytics')} className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-100 text-black rounded-lg transition-all font-bold text-xs uppercase tracking-wider border border-gray-200 shadow-sm">
                <Cloud size={14} />
                Back to Analytics
              </button>
            )}
          </div>
          <div className="max-w-xl w-full flex items-center justify-center pointer-events-auto">
             <SearchBar onCompanySelect={(c) => { setCompany(c); setPage('analytics'); setHsn(null); setGraphData(null); }} selectedCompany={company} />
          </div>
          <div className="flex items-center gap-4 pointer-events-auto min-w-[150px] justify-end">
             {(loading || traceLog) && (
               <div className="flex items-center gap-3 bg-black px-4 py-2 rounded-lg shadow-lg">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">{traceLog}</span>
               </div>
             )}
          </div>
        </header>

        {/* content Layer */}
        <div className={`flex-1 relative overflow-hidden ${page === 'dashboard' ? '' : 'pointer-events-none'}`}>
          {page === 'dashboard' ? (
             <InteractiveGlobe onCompanySelect={(c) => { setCompany(c); setPage('analytics'); setHsn(null); setGraphData(null); }} />
          ) : (
            <div className="absolute inset-0 z-50 pointer-events-none">
              
              {/* 🏢 INTELLIGENCE OVERLAY (Dossier + BOM) */}
              {company && (
                <div className={`absolute top-6 left-6 bottom-6 w-80 bg-white border border-gray-200 rounded-3xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden animate-in slide-in-from-left duration-500`}>
                  {/* Top: LIVE DB DOSSIER */}
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-lg">
                        <Info size={20} className="text-white" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-xs text-gray-500 uppercase tracking-widest leading-none mb-1">Company Dossier</span>
                        <span className="font-extrabold text-lg truncate text-slate-800">{company.name}</span>
                      </div>
                    </div>
                    <div className="text-sm leading-relaxed text-gray-700 font-medium bg-gray-50 p-5 rounded-2xl border border-gray-100 italic">
                      "{company.description || 'Verified global trade entity found in intelligence database.'}"
                    </div>
                  </div>

                  {/* Middle: BOM Filters (Click to Implement) */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                         <Package size={18} className="text-black" />
                         <span className="font-black text-xs uppercase tracking-wider text-black">Bill of Materials Filter</span>
                      </div>
                      
                      {/* CRITICAL: Implement further only ON CLICK */}
                      <HSNSelector 
                        companyName={company.name} 
                        selectedHSN={hsn} 
                        onHSNSelect={(code, desc) => { 
                          setHsn(code); 
                          setHsnDesc(desc); 
                          fetchGraph(company, code, desc); // <-- IMPLEMENTATION STARTS HERE
                        }} 
                      />
                    </div>
                    {graphData && (
                      <div className="pt-6 border-t border-gray-100">
                         <div className="flex items-center gap-2 mb-4">
                            <Cloud size={18} className="text-black" />
                            <span className="font-black text-xs uppercase tracking-wider text-black">Importer Insights (Live)</span>
                         </div>
                         <div className="space-y-4">
                            {(() => {
                              // Aggregate unique concurrent importers for the current HSN being viewed
                              const allImporters = Array.from(new Set(
                                graphData.edges
                                  .filter(e => e.hsn && (e.hsn === hsn || e.hsn.startsWith(String(hsn).substring(0,2))))
                                  .flatMap(e => e.importers || [])
                              )).filter(name => name !== company.name).slice(0, 5);

                              return allImporters.length > 0 ? allImporters.map(importer => (
                                <div key={importer} className="flex justify-between items-center bg-gray-50 h-10 px-4 rounded-xl border border-gray-100 animate-in fade-in slide-in-from-right duration-300">
                                  <span className="text-[10px] font-black uppercase text-gray-500 truncate mr-2">{importer}</span>
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                </div>
                              )) : (
                                <span className="text-[9px] font-bold text-gray-400 italic px-2">Searching live trade records...</span>
                              );
                            })()}
                         </div>
                      </div>
                    )}

                    {/* 🕓 SEARCH HISTORY (cached results) */}
                    {searchHistory.length > 0 && (
                      <div className="pt-6 border-t border-gray-100">
                        <div className="flex items-center gap-2 mb-4">
                          <Clock size={16} className="text-black" />
                          <span className="font-black text-[10px] uppercase tracking-wider text-black">History</span>
                          <span className="text-[9px] font-bold text-gray-300 ml-auto">{searchHistory.length} cached</span>
                        </div>
                        <div className="space-y-2">
                          {searchHistory.map((entry, i) => {
                            const isActive = entry.companyName === company?.name && entry.hsn === hsn;
                            const ago = Math.round((Date.now() - entry.timestamp) / 60000);
                            const timeLabel = ago < 1 ? 'just now' : ago < 60 ? `${ago}m ago` : `${Math.round(ago / 60)}h ago`;
                            return (
                              <button
                                key={entry.cacheKey}
                                onClick={() => restoreFromHistory(entry)}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group ${
                                  isActive
                                    ? 'bg-black text-white border-black'
                                    : 'bg-gray-50 hover:bg-white border-gray-100 hover:border-gray-300 hover:shadow-sm'
                                }`}
                              >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                                  isActive ? 'bg-white/20 text-white' : 'bg-white text-gray-600 border border-gray-200'
                                }`}>
                                  {entry.nodeCount}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className={`text-[10px] font-black truncate ${isActive ? 'text-white' : 'text-gray-700'}`}>
                                    {entry.companyName}
                                  </div>
                                  <div className={`text-[9px] font-bold mt-0.5 flex items-center gap-1.5 ${isActive ? 'text-white/60' : 'text-gray-400'}`}>
                                    <span>HSN {entry.hsn}</span>
                                    <span>·</span>
                                    <span>{timeLabel}</span>
                                  </div>
                                </div>
                                {!isActive && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                   {/* Bottom: Network Legend + Analytics Button */}
                  <div className="p-6 bg-gray-50 border-t border-gray-100 space-y-3">
                     <span className="text-[9px] font-black uppercase text-gray-400">Network Map Status</span>
                     <div className="flex items-center gap-2 text-[10px]">
                        <div className={`w-2 h-2 rounded-full ${hsn ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                        <span className="font-bold text-gray-500 uppercase">{hsn ? 'Live Visualization' : 'Waiting for Filter Selection...'}</span>
                     </div>
                     {graphData && (
                       <button
                         onClick={() => setShowAnalytics(true)}
                         className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 bg-black hover:bg-gray-800 text-white rounded-xl transition-all font-black text-[10px] uppercase tracking-wider shadow-lg hover:shadow-xl"
                       >
                         <BarChart3 size={14} />
                         View Network Analytics
                       </button>
                     )}
                  </div>
                </div>
              )}

              {/* Mini-Map Swapper (Only shows after implementation) */}
              {graphData && (
                <div className="absolute bottom-6 right-6 pointer-events-auto group">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewMode(viewMode === 'map' ? 'graph' : 'map');
                      }}
                      className="absolute -top-4 -right-4 w-10 h-10 bg-slate-900 border-2 border-white hover:bg-slate-800 text-white rounded-full transition-all shadow-xl flex items-center justify-center z-30 hover:scale-110"
                      title={viewMode === 'map' ? 'Expand graph view' : 'Expand map view'}
                    >
                      <ArrowRightLeft size={16} strokeWidth={2.5} />
                    </button>
                    <div className="w-[380px] h-[280px] rounded-[32px] overflow-hidden border border-slate-200 shadow-2xl bg-white transition-transform group-hover:scale-[1.02]">
                      <div className="w-full h-full">
                        {viewMode === 'map' ? (
                          <GraphView
                            graphData={graphData}
                            highlightCompany={company?.name}
                            selectedNode={selNode?.id}
                            onNodeClick={handleNodeClickMiniGraph}
                            onExpandNode={handleExpandNodeMiniGraph}
                            expandingNode={expandingNode}
                            showControls={false}
                          />
                        ) : (
                          <MapView tradeRoutes={graphData?.tradeRoutes} nodes={graphData?.nodes} />
                        )}
                      </div>
                    </div>
                </div>
              )}

              {/* Map/Graph Switcher etc ends here */}
            </div>
          )}

          {/* ─── ROUTE OPTIMIZATION PAGE ─── */}
          {page === 'route' && (
            <div className="absolute inset-0 z-50 pointer-events-auto">
              <RouteOptimization company={company} graphData={graphData} />
            </div>
          )}
        </div>
      </main>

      {/* DETAILS PANEL FOR SELECTED NODE (MODAL) */}
      <AnimatePresence>
        {selNode && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm pointer-events-auto">
            <div className="absolute inset-0" onClick={() => setSelNode(null)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-[440px] max-h-[85vh] bg-white border border-gray-200 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col z-10"
            >
              <div className="absolute top-4 right-4 z-50">
               <button onClick={() => setSelNode(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors">
                  <X size={16} strokeWidth={3} />
               </button>
              </div>
              <DetailsPanel selectedNode={selNode} graphData={graphData} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 📊 ANALYTICS MODAL */}
      <AnimatePresence>
        {showAnalytics && graphData && (
          <AnalyticsModal
            graphData={graphData}
            company={company}
            hsn={hsn}
            onClose={() => setShowAnalytics(false)}
          />
        )}
      </AnimatePresence>

    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Cloud, Search as SearchIcon, ChevronLeft, ChevronRight, Info, Package, ArrowRightLeft, X, BarChart3 } from 'lucide-react';
import Dashboard from './components/Dashboard';
import SearchBar from './components/SearchBar';
import HSNSelector from './components/HSNSelector';
import GraphView from './components/GraphView';
import MapView from './components/MapView';
import DetailsPanel from './components/DetailsPanel';
import AnalyticsModal from './components/AnalyticsModal';

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

  const graphRef = useRef(null);
  useEffect(() => { graphRef.current = graphData; }, [graphData]);

  useEffect(() => {
    axios.get('/api/graph/stats').then(({ data }) => setStats(data.stats)).catch(() => {});
  }, []);

  // 📝 fetchGraph ONLY implements the network after a BOM filter is clicked
  const fetchGraph = useCallback(async (c, h, desc) => {
    if (!c || !h) return;
    setLoading(true); setError(null); setTraceLog('SYNTHESIZING NETWORK FOR ' + h + '...');
    try {
      const payload = { companyName: c.name, companyCountry: c.country || 'Unknown', targetHsCode: h, hsnDescription: desc || '', maxTiers: 3 };
      const { data } = await axios.post('/api/trace/expand', payload, { timeout: 120000 });
      setGraphData({ nodes: data.nodes || [], edges: data.edges || [], tradeRoutes: data.tradeRoutes || [] });
      setTraceLog(`VIEWING ${data.meta?.totalNodes || 0} PARTNERS`);
    } catch (err) {
      setError('Trace engine error. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const expandNode = useCallback(async (node) => {
    if (!node || !node.id) return;
    const current = graphRef.current;
    if (!current) return;
    let traceHsCode = current.edges.find(e => e.source === node.id)?.hsn || hsn || '87';
    setExpandingNode(node.id);
    try {
      const payload = { companyName: node.id, companyCountry: node.country || 'Unknown', targetHsCode: traceHsCode, maxTiers: 2 };
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
    <div className="relative h-screen w-screen bg-white text-black font-sans overflow-hidden flex">
      
      {/* 🚀 MAIN SIDEBAR (Home Only) */}
      {page === 'dashboard' && (
        <aside className={`${sidebarCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-gray-100 flex flex-col shrink-0 z-50 transition-all duration-300 shadow-sm`}>
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
      <main className="flex-1 relative flex flex-col min-w-0 bg-white">
        
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
              <div className="w-full h-full flex items-center justify-center opacity-30 grayscale pointer-events-none">
                 <MapView tradeRoutes={[]} nodes={[]} />
              </div>
            )}
          </div>
        )}

        {/* Global Control Bar */}
        <header className={`h-16 flex items-center justify-between px-6 z-[60] shrink-0 ${page === 'dashboard' ? 'bg-white border-b border-gray-100' : 'pointer-events-none'}`}>
          <div className="flex items-center gap-4 pointer-events-auto">
            {page === 'analytics' && (
              <button onClick={() => { setPage('dashboard'); setCompany(null); setHsn(null); setGraphData(null); }} className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-gray-100 text-black rounded-lg transition-all font-bold text-xs border border-gray-200 shadow-sm">
                ← Exit
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
             <div className="h-full overflow-y-auto bg-gray-50"><Dashboard stats={stats} onExplore={() => setPage('analytics')} onTrace={(c) => { setCompany(c); setPage('analytics'); setHsn(null); setGraphData(null); }} /></div>
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
                        <span className="font-black text-[10px] text-gray-400 uppercase tracking-widest leading-none mb-1">Company Dossier</span>
                        <span className="font-extrabold text-sm truncate">{company.name}</span>
                      </div>
                    </div>
                    <div className="text-[11px] leading-relaxed text-gray-600 font-bold bg-gray-50 p-5 rounded-2xl border border-gray-100 italic">
                      "{company.description || 'Verified global trade entity found in intelligence database.'}"
                    </div>
                  </div>

                  {/* Middle: BOM Filters (Click to Implement) */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                         <Package size={16} className="text-black" />
                         <span className="font-black text-[10px] uppercase tracking-wider text-black">Bill of Materials Filter</span>
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
                            <Cloud size={16} className="text-black" />
                            <span className="font-black text-[10px] uppercase tracking-wider text-black">Importer Insights (Live)</span>
                         </div>
                         <div className="space-y-3">
                            {(() => {
                              // Aggregate unique concurrent importers for the current HSN being viewed
                              const allImporters = Array.from(new Set(
                                graphData.edges
                                  .filter(e => e.hsn === hsn || e.hsn.startsWith(String(hsn).substring(0,2)))
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

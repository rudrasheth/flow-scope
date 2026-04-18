import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import SearchBar from './components/SearchBar';
import HSNSelector from './components/HSNSelector';
import GraphView from './components/GraphView';
import MapView from './components/MapView';
import DetailsPanel from './components/DetailsPanel';

const QUICK = ['isuzu','škoda auto','cage warriors','kaipan','ineos group'];

export default function App() {
  const [company,   setCompany]   = useState(null);
  const [hsn,       setHsn]       = useState(null);
  const [hsnDesc,   setHsnDesc]   = useState('');
  const [graphData, setGraphData] = useState(null);
  const [selNode,   setSelNode]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [stats,     setStats]     = useState(null);
  const [error,     setError]     = useState(null);
  const [traceLog,  setTraceLog]  = useState('');

  useEffect(() => {
    axios.get('/api/graph/stats').then(({ data }) => setStats(data.stats)).catch(() => {});
  }, []);

  const fetchGraph = useCallback(async (c, h, desc) => {
    if (!c || !h || h === 'all') return;
    setLoading(true); setError(null); setTraceLog('Connecting to AI trace engine...');
    try {
      const payload = {
        companyName: c.name,
        companyCountry: c.country || 'Unknown',
        targetHsCode: h,
        hsnDescription: desc || '',
        maxTiers: 1,
      };
      setTraceLog(`Tracing supply chain for ${c.name} (HS ${h})...`);
      const { data } = await axios.post('/api/trace/expand', payload, { timeout: 120000 });

      setGraphData({
        nodes: data.nodes || [],
        edges: data.edges || [],
        tradeRoutes: data.tradeRoutes || [],
      });
      setTraceLog(`Found ${data.meta?.totalNodes || 0} companies across ${data.meta?.tiersTraversed || 0} tiers`);
    } catch (err) {
      console.error(err);
      setError('Trace engine encountered an error. Check server logs.');
      setGraphData(null);
      setTraceLog('');
    } finally {
      setLoading(false);
    }
  }, []);

  const selectCompany = (c) => {
    setCompany(c); setHsn(null); setHsnDesc('');
    setGraphData(null); setSelNode(null); setError(null); setTraceLog('');
  };

  const selectHsn = (code, description) => {
    if (code === 'all') {
      setHsn('all');
      setHsnDesc('');
      return;
    }
    setHsn(code);
    setHsnDesc(description || '');
    if (company && code !== 'all') {
      fetchGraph(company, code, description);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#F8FAFC] overflow-hidden text-slate-800">
      
      {/* ─── HEADER ─── */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 gap-6 shadow-sm z-30">
        <div className="flex items-center gap-3 w-48">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <div className="text-lg font-black tracking-tighter text-slate-900 leading-none">FlowScope</div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mt-1">Intelligence</div>
          </div>
        </div>

        <div className="flex-1 max-w-xl">
          <SearchBar onCompanySelect={selectCompany} />
        </div>

        {stats && (
          <div className="flex items-center gap-6 border-l border-slate-100 pl-6 h-8">
            <div className="text-center">
              <div className="text-sm font-bold text-blue-600">{stats.totalCompanies}</div>
              <div className="text-[9px] uppercase font-bold text-slate-400">Companies</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-violet-600">{stats.totalTradeLinks}</div>
              <div className="text-[9px] uppercase font-bold text-slate-400">Trade Links</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-emerald-600">{stats.totalCountries}</div>
              <div className="text-[9px] uppercase font-bold text-slate-400">Countries</div>
            </div>
          </div>
        )}
      </header>

      {/* ─── MAIN CONTENT AREA ─── */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT FILTERS */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col overflow-hidden z-20">
          <div className="p-4 border-b border-slate-50 bg-slate-50/50">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">HSN Filter</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {company ? (
              <HSNSelector companyName={company.name} onHSNSelect={selectHsn} selectedHSN={hsn} />
            ) : (
              <div className="text-center py-10 px-4">
                <div className="text-[11px] text-slate-300 font-medium leading-relaxed">
                  Search a company to begin exploring networks
                </div>
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-slate-100">
             <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Quick List</h3>
             <div className="flex flex-wrap gap-1.5">
               {QUICK.map(q => (
                 <button key={q} onClick={() => selectCompany({name: q, country: ''})}
                   className="px-2.5 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 
                              text-[11px] font-bold rounded-lg transition-all border border-slate-100">
                   {q}
                 </button>
               ))}
             </div>
          </div>
        </aside>

        {/* CENTER GRAPH (MAIN) */}
        <main className="flex-1 bg-[#F8FAFC] relative overflow-hidden">
          {!company ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-sm px-6">
                <div className="mb-6 opacity-40">
                   <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto text-blue-500">
                     <circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/>
                     <circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/>
                     <path d="M7 6h10M6 8l5 8M18 8l-5 8"/>
                   </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Build Trade Networks</h2>
                <p className="text-sm text-slate-500">
                  Select a company to visualize multi-tier supplier relationships and global product flows.
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full relative">
              {loading && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-4">
                  <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"/>
                  <div className="text-sm font-bold text-slate-600">{traceLog}</div>
                  <div className="text-[10px] text-slate-400">Querying Gemini AI + UN Comtrade API...</div>
                </div>
              )}
              {error && (
                <div className="absolute top-4 left-4 right-4 z-10 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 font-medium">
                  {error}
                </div>
              )}
              {!hsn && !loading && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center max-w-sm px-6">
                    <div className="text-4xl mb-4">🏭</div>
                    <h3 className="text-lg font-bold text-slate-700 mb-2">Select an HSN Code</h3>
                    <p className="text-sm text-slate-400">
                      Pick a product category from the left panel to begin tracing the supply chain for <strong>{company.name}</strong>.
                    </p>
                  </div>
                </div>
              )}
              <GraphView 
                graphData={graphData} 
                onNodeClick={setSelNode} 
                selectedNode={selNode?.name || selNode?.id}
                highlightCompany={company?.name}
              />
            </div>
          )}
        </main>

        {/* RIGHT SIDEBAR (DETAILS + MAP) */}
        <aside className="w-[360px] bg-white border-l border-slate-200 flex flex-col overflow-hidden z-20">
          
          {/* Details (Top 60%) */}
          <div className="flex-1 flex flex-col overflow-hidden border-b border-slate-200">
            <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Selected Detail</h3>
              {selNode && <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">Live</span>}
            </div>
            <div className="flex-1 overflow-y-auto">
              <DetailsPanel selectedCompany={company} selectedNode={selNode} />
            </div>
          </div>

          {/* Map (Bottom 40%) */}
          <div className="h-[320px] bg-slate-50 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-slate-100 bg-white shadow-sm flex justify-between items-center">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Geographic Flow</h3>
              {graphData?.tradeRoutes?.length > 0 && 
                <span className="text-[10px] font-bold text-emerald-600">{graphData.tradeRoutes.length} Routes</span>
              }
            </div>
            <div className="flex-1 relative">
              <MapView tradeRoutes={graphData?.tradeRoutes} nodes={graphData?.nodes} />
            </div>
          </div>

        </aside>

      </div>
    </div>
  );
}

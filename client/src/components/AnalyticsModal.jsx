import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import {
  X, TrendingUp, TrendingDown, Building2, Globe2,
  Package, ArrowUpRight, ArrowDownRight, Activity, BarChart3
} from 'lucide-react';

const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#06B6D4', '#6366F1'];

function fmt(n) {
  if (!n) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

export default function AnalyticsModal({ graphData, company, hsn, onClose }) {

  const analytics = useMemo(() => {
    if (!graphData?.nodes?.length || !graphData?.edges?.length) return null;

    const { nodes, edges } = graphData;

    // ─── 1. Volume aggregations per node ───
    const nodeVols = {};
    for (const n of nodes) {
      nodeVols[n.id] = { name: n.id, country: n.country || 'Unknown', tier: n.tier || 0, importVol: 0, exportVol: 0, totalVol: 0, edgeCount: 0 };
    }
    for (const e of edges) {
      if (nodeVols[e.target]) {
        nodeVols[e.target].importVol += (e.quantity || 0);
        nodeVols[e.target].totalVol += (e.quantity || 0);
        nodeVols[e.target].edgeCount++;
      }
      if (nodeVols[e.source]) {
        nodeVols[e.source].exportVol += (e.quantity || 0);
        nodeVols[e.source].totalVol += (e.quantity || 0);
        nodeVols[e.source].edgeCount++;
      }
    }
    const allNodes = Object.values(nodeVols);

    // ─── 2. Key Metrics ───
    const highestExporter = [...allNodes].sort((a, b) => b.exportVol - a.exportVol)[0];
    const highestImporter = [...allNodes].sort((a, b) => b.importVol - a.importVol)[0];
    const totalVolume = edges.reduce((s, e) => s + (e.quantity || 0), 0);
    const avgTradePerEdge = edges.length ? Math.round(totalVolume / edges.length) : 0;
    const totalExports = allNodes.reduce((s, n) => s + n.exportVol, 0);
    const totalImports = allNodes.reduce((s, n) => s + n.importVol, 0);

    // ─── 3. Country Distribution ───
    const countryMap = {};
    for (const n of allNodes) {
      if (!countryMap[n.country]) countryMap[n.country] = { country: n.country, volume: 0, companies: 0 };
      countryMap[n.country].volume += n.totalVol;
      countryMap[n.country].companies++;
    }
    const countryDist = Object.values(countryMap).sort((a, b) => b.volume - a.volume).slice(0, 8);

    // ─── 4. HSN Code Distribution ───
    const hsnMap = {};
    for (const e of edges) {
      const code = e.hsn || 'N/A';
      if (!hsnMap[code]) hsnMap[code] = { hsn: code, product: e.product || code, volume: 0, count: 0 };
      hsnMap[code].volume += (e.quantity || 0);
      hsnMap[code].count++;
    }
    const hsnDist = Object.values(hsnMap).sort((a, b) => b.volume - a.volume).slice(0, 6);

    // ─── 5. Tier Distribution ───
    const tierMap = {};
    for (const n of allNodes) {
      const t = `Tier ${n.tier}`;
      if (!tierMap[t]) tierMap[t] = { tier: t, count: 0, volume: 0 };
      tierMap[t].count++;
      tierMap[t].volume += n.totalVol;
    }
    const tierDist = Object.values(tierMap).sort((a, b) => parseInt(a.tier.split(' ')[1]) - parseInt(b.tier.split(' ')[1]));

    // ─── 6. Top 5 Trade Links ───
    const topLinks = [...edges]
      .sort((a, b) => (b.quantity || 0) - (a.quantity || 0))
      .slice(0, 5)
      .map(e => ({
        from: e.source,
        to: e.target,
        product: e.product || e.hsn,
        quantity: e.quantity || 0,
      }));

    // ─── 7. Network Health Radar ───
    const uniqueCountries = new Set(allNodes.map(n => n.country)).size;
    const networkDensity = edges.length / Math.max(1, (nodes.length * (nodes.length - 1)) / 2);
    const radarData = [
      { metric: 'Nodes', value: Math.min(100, nodes.length * 10), fullMark: 100 },
      { metric: 'Edges', value: Math.min(100, edges.length * 8), fullMark: 100 },
      { metric: 'Countries', value: Math.min(100, uniqueCountries * 15), fullMark: 100 },
      { metric: 'Density', value: Math.min(100, networkDensity * 500), fullMark: 100 },
      { metric: 'Volume', value: Math.min(100, totalVolume / 10000), fullMark: 100 },
      { metric: 'Tiers', value: Math.min(100, Object.keys(tierMap).length * 25), fullMark: 100 },
    ];

    return {
      highestExporter, highestImporter, totalVolume, avgTradePerEdge,
      totalExports, totalImports, countryDist, hsnDist, tierDist,
      topLinks, radarData, networkDensity, uniqueCountries,
      totalNodes: nodes.length, totalEdges: edges.length,
    };
  }, [graphData]);

  if (!analytics) return null;

  const kpis = [
    {
      label: 'Highest Exporter',
      value: analytics.highestExporter?.name?.split(' ').slice(0, 2).join(' '),
      sub: fmt(analytics.highestExporter?.exportVol) + ' units',
      icon: TrendingUp,
      color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100',
    },
    {
      label: 'Highest Importer',
      value: analytics.highestImporter?.name?.split(' ').slice(0, 2).join(' '),
      sub: fmt(analytics.highestImporter?.importVol) + ' units',
      icon: TrendingDown,
      color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100',
    },
    {
      label: 'Avg Trade / Link',
      value: fmt(analytics.avgTradePerEdge),
      sub: `${analytics.totalEdges} total links`,
      icon: Activity,
      color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100',
    },
    {
      label: 'Network Spread',
      value: `${analytics.uniqueCountries} Countries`,
      sub: `${analytics.totalNodes} entities`,
      icon: Globe2,
      color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100',
    },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="relative z-10 w-[92vw] max-w-[1100px] max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
      >
        {/* ── HEADER ── */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 shrink-0 bg-gradient-to-r from-white to-slate-50">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-black rounded-2xl flex items-center justify-center shadow-lg">
              <BarChart3 size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-gray-900">Network Analytics</h2>
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                {company?.name || 'Network'} &middot; HSN {hsn || 'All'} &middot; {analytics.totalNodes} Nodes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X size={18} strokeWidth={3} />
          </button>
        </div>

        {/* ── BODY (scrollable) ── */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">

          {/* KPI Row */}
          <div className="grid grid-cols-4 gap-4">
            {kpis.map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`p-4 rounded-2xl ${kpi.bg} border ${kpi.border} group hover:shadow-md transition-all`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-xl bg-white/80 ${kpi.color} shadow-sm group-hover:scale-110 transition-transform`}>
                    <kpi.icon size={16} strokeWidth={2.5} />
                  </div>
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{kpi.label}</span>
                </div>
                <div className={`text-xl font-black ${kpi.color} tracking-tight truncate`}>{kpi.value}</div>
                <div className="text-[10px] font-bold text-gray-400 mt-1">{kpi.sub}</div>
              </motion.div>
            ))}
          </div>

          {/* Summary Bar */}
          <div className="flex items-center gap-6 bg-slate-50 rounded-2xl p-5 border border-slate-100">
            <div className="flex-1">
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Network Volume</div>
              <div className="text-3xl font-black text-gray-900 tabular-nums">{fmt(analytics.totalVolume)}</div>
            </div>
            <div className="flex gap-8">
              <div className="text-right">
                <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 flex items-center gap-1 justify-end"><ArrowUpRight size={10} /> Exports</div>
                <div className="text-lg font-black text-gray-700 tabular-nums">{fmt(analytics.totalExports)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1 flex items-center gap-1 justify-end"><ArrowDownRight size={10} /> Imports</div>
                <div className="text-lg font-black text-gray-700 tabular-nums">{fmt(analytics.totalImports)}</div>
              </div>
            </div>
          </div>

          {/* Charts Row 1: Country Distribution + Network Health */}
          <div className="grid grid-cols-5 gap-6">
            {/* Country Bar Chart */}
            <div className="col-span-3 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
                <Globe2 size={14} className="text-blue-500" />
                Trade Volume by Country
              </h3>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.countryDist} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={fmt} />
                    <YAxis dataKey="country" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#334155', fontWeight: 700 }} width={90} />
                    <Tooltip
                      contentStyle={{ fontSize: '11px', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: 700 }}
                      formatter={(v) => [fmt(v), 'Volume']}
                    />
                    <Bar dataKey="volume" radius={[0, 6, 6, 0]} barSize={18}>
                      {analytics.countryDist.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Radar Chart */}
            <div className="col-span-2 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
                <Activity size={14} className="text-violet-500" />
                Network Health Score
              </h3>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={analytics.radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
                    <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                    <Radar dataKey="value" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.15} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Charts Row 2: Product Mix Pie + Tier Distribution */}
          <div className="grid grid-cols-2 gap-6">
            {/* HSN Pie Chart */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
                <Package size={14} className="text-amber-500" />
                Product Category Mix
              </h3>
              <div className="flex items-center gap-4">
                <div className="w-[180px] h-[180px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.hsnDist}
                        innerRadius={45}
                        outerRadius={80}
                        dataKey="volume"
                        nameKey="hsn"
                        stroke="none"
                        paddingAngle={2}
                      >
                        {analytics.hsnDist.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ fontSize: '11px', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: 700 }}
                        formatter={(v) => [fmt(v), 'Volume']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {analytics.hsnDist.map((h, i) => (
                    <div key={h.hsn} className="flex items-center gap-2 text-[11px]">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-600 font-bold truncate flex-1">{h.product}</span>
                      <span className="text-gray-400 font-black tabular-nums">{fmt(h.volume)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tier Volume Area */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
                <Building2 size={14} className="text-emerald-500" />
                Supply Chain Tier Analysis
              </h3>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.tierDist} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="tier" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={fmt} />
                    <Tooltip
                      contentStyle={{ fontSize: '11px', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: 700 }}
                      formatter={(v) => [fmt(v), 'Volume']}
                    />
                    <Area type="monotone" dataKey="volume" stroke="#10B981" fill="#10B981" fillOpacity={0.1} strokeWidth={2.5} />
                    <Area type="monotone" dataKey="count" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.08} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-6 mt-3">
                {analytics.tierDist.map((t, i) => (
                  <div key={t.tier} className="flex items-center gap-2 text-[10px]">
                    <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                    <span className="font-bold text-gray-500">{t.tier}: {t.count} entities</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Trade Links Table */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp size={14} className="text-rose-500" />
              Top 5 Trade Links by Volume
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2.5 px-3 font-black text-gray-400 uppercase tracking-widest text-[9px]">Rank</th>
                    <th className="text-left py-2.5 px-3 font-black text-gray-400 uppercase tracking-widest text-[9px]">Exporter</th>
                    <th className="text-left py-2.5 px-3 font-black text-gray-400 uppercase tracking-widest text-[9px]">Importer</th>
                    <th className="text-left py-2.5 px-3 font-black text-gray-400 uppercase tracking-widest text-[9px]">Product</th>
                    <th className="text-right py-2.5 px-3 font-black text-gray-400 uppercase tracking-widest text-[9px]">Volume</th>
                    <th className="text-right py-2.5 px-3 font-black text-gray-400 uppercase tracking-widest text-[9px]">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topLinks.map((link, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-600">
                          {i + 1}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-bold text-gray-800 truncate max-w-[160px]">{link.from}</td>
                      <td className="py-3 px-3 font-bold text-gray-800 truncate max-w-[160px]">{link.to}</td>
                      <td className="py-3 px-3 text-gray-500 font-medium truncate max-w-[200px]">{link.product}</td>
                      <td className="py-3 px-3 text-right font-black text-gray-700 tabular-nums">{fmt(link.quantity)}</td>
                      <td className="py-3 px-3 text-right">
                        <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-black text-[10px]">
                          {analytics.totalVolume > 0 ? ((link.quantity / analytics.totalVolume) * 100).toFixed(1) : 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </motion.div>
    </div>
  );
}

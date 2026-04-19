import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
  ChevronDown, ChevronRight, ArrowUpRight, ArrowDownRight,
  RefreshCw, FileText
} from 'lucide-react';

const COLORS = ['#D1D5DB', '#9CA3AF', '#6B7280', '#374151'];

const FLAGS = {
  'India':'🇮🇳','United States':'🇺🇸','China':'🇨🇳','Japan':'🇯🇵',
  'South Korea':'🇰🇷','Germany':'🇩🇪','Taiwan':'🇹🇼','France':'🇫🇷',
  'United Kingdom':'🇬🇧','Switzerland':'🇨🇭','Singapore':'🇸🇬','Finland':'🇫🇮',
  'Sweden':'🇸🇪','Brazil':'🇧🇷','Australia':'🇦🇺','Norway':'🇳🇴',
  'Belgium':'🇧🇪','Luxembourg':'🇱🇺','Netherlands':'🇳🇱','Denmark':'🇩🇰',
  'Italy':'🇮🇹','Canada':'🇨🇦','Malaysia':'🇲🇾','Congo':'🇨🇩',
  'Peru':'🇵🇪','Ivory Coast':'🇨🇮','Saudi Arabia':'🇸🇦','Ireland':'🇮🇪',
};

const generateHistoryData = () => {
  const data = [];
  const years = [1960, 1970, 1980, 1990, 2000, 2010];
  years.forEach(year => {
    const base = (year - 1950) * 60000;
    data.push({
      year: year.toString(),
      importGoods: base + Math.random() * 500000,
      exportGoods: base * 0.8 + Math.random() * 400000,
      importServices: base * 0.3 + Math.random() * 200000,
      exportServices: base * 0.5 + Math.random() * 300000,
    });
  });
  return data;
};

const historyData = generateHistoryData();

function fmt(n) {
  if (!n) return '0';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('All');

  const fetchNews = async (query = 'trade OR supply chain') => {
    setNewsLoading(true);
    try {
      const res = await axios.get(`/api/news?q=${encodeURIComponent(query)}`);
      // Ensure we always have an array even if the API returns an error structure
      setNews(Array.isArray(res.data?.results) ? res.data.results : []);
    } catch (error) {
      console.error("Error fetching news:", error);
      setNews([]);
    } finally {
      setNewsLoading(false);
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      fetchNews(searchQuery);
    }
  };

  useEffect(() => {
    setLoading(true);
    axios.get(`/api/dashboard?year=${selectedYear}`)
      .then(({ data }) => {
        setData(data);
        // Automatically fetch news for the top 2 trade partners
        if (data.topCountries && data.topCountries.length >= 2) {
          const topTwo = `${data.topCountries[0].country} and ${data.topCountries[1].country} trade news`;
          fetchNews(topTwo);
        } else {
          fetchNews();
        }
      })
      .catch(err => {
        console.error("Dashboard fetch error:", err);
        setData({
          topCompanies: [],
          topCountries: [],
          topSectors: [],
          recentActivity: [],
          summary: {}
        });
        fetchNews();
      })
      .finally(() => setLoading(false));
  }, [selectedYear]);

  if (loading || !data) return (
    <div className="flex items-center justify-center h-full text-gray-400">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mr-3"></div>
      Connecting to Intelligence Engine...
    </div>
  );

  const { topCompanies = [], topCountries = [], topSectors = [] } = data;

  return (
    <div className="min-h-full p-6 flex gap-6 text-gray-900 bg-[#F9FAFB]">
      {/* ─── LEFT COLUMN (MAIN) ─── */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">

        {/* STATS ROW */}
        <div className="flex gap-6">
          <div className="flex-1 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="text-3xl font-bold">120.8M</div>
            <div className="text-sm text-gray-500 mt-1">Imported Goods</div>
            <div className="text-xs text-red-600 flex items-center gap-1 mt-3 font-medium">
              <ArrowDownRight size={14} /> 5.6% Decrease
            </div>
          </div>
          <div className="flex-1 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="text-3xl font-bold">151.9M</div>
            <div className="text-sm text-gray-500 mt-1">Exported Goods</div>
            <div className="text-xs text-green-600 flex items-center gap-1 mt-3 font-medium">
              <ArrowUpRight size={14} /> 7.3% Increase
            </div>
          </div>
          <div className="flex-1 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="text-3xl font-bold">+31.1M</div>
            <div className="text-sm text-gray-500 mt-1">Trade Balance</div>
            <div className="text-xs text-green-600 flex items-center gap-1 mt-3 font-medium">
              <ArrowUpRight size={14} /> 25.7% Increase
            </div>
          </div>
        </div>

        {/* MAIN CHART */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold">Imports and Exports Over Time</h3>

          </div>

          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historyData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E7EB" />
                <XAxis type="number" domain={[0, 6000000]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => v === 0 ? '0M' : `${v / 1000000}M`} />
                <YAxis dataKey="year" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                <Bar dataKey="importGoods" stackId="a" fill="#E5E7EB" />
                <Bar dataKey="exportGoods" stackId="a" fill="#9CA3AF" />
                <Bar dataKey="importServices" stackId="a" fill="#6B7280" />
                <Bar dataKey="exportServices" stackId="a" fill="#374151" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center gap-6 mt-4 border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2 text-xs text-gray-500"><div className="w-3 h-3 rounded-full bg-[#E5E7EB]"></div> Sum of Import Goods</div>
            <div className="flex items-center gap-2 text-xs text-gray-500"><div className="w-3 h-3 rounded-full bg-[#9CA3AF]"></div> Sum of Export Goods</div>
            <div className="flex items-center gap-2 text-xs text-gray-500"><div className="w-3 h-3 rounded-full bg-[#6B7280]"></div> Sum of Import Services</div>
            <div className="flex items-center gap-2 text-xs text-gray-500"><div className="w-3 h-3 rounded-full bg-[#374151]"></div> Export Services</div>
          </div>
        </div>

        {/* TREND & RATIO ROW */}
        <div className="flex gap-6 h-[260px] shrink-0">
          {/* Services Trade Trend */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex-1 flex flex-col min-h-0">
            <h3 className="text-sm font-semibold mb-4">Services Trade Trend</h3>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData} margin={{ top: 5, right: 0, left: -30, bottom: 0 }}>
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} padding={{ left: 10, right: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={false} />
                  <Area type="monotone" dataKey="exportServices" stackId="1" stroke="#374151" fill="#374151" />
                  <Area type="monotone" dataKey="importServices" stackId="1" stroke="#9CA3AF" fill="#9CA3AF" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Export to Import Ratio */}
          <div className="w-[320px] bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col shrink-0">
            <h3 className="text-base font-semibold mb-4">Export-to-Import Ratio</h3>
            <div className="flex items-center justify-between border border-gray-200 rounded-lg p-3 mb-6 text-sm">
              <span className="font-medium text-gray-700 truncate">Global Ratio <span className="text-gray-400 font-normal ml-1">avg</span></span>
              <span className="font-bold flex items-center gap-1.5"><span className="text-gray-400 text-xs">⊘</span> 1.26</span>
            </div>
            <div className="flex-1 flex items-center justify-between pl-2 min-h-0">
              <div className="flex flex-col gap-5 text-xs text-gray-500 font-medium">
                <div className="flex items-center gap-3"><div className="w-4 h-1.5 bg-gray-400 rounded-full"></div> Growth</div>
                <div className="flex items-center gap-3"><div className="w-4 h-1.5 bg-gray-300 rounded-full"></div> Volume</div>
                <div className="flex items-center gap-3"><div className="w-4 h-1.5 bg-gray-200 rounded-full"></div> Balance</div>
              </div>
              <div className="w-28 h-28 relative mr-4 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{ v: 1.26 }, { v: 0.4 }]} innerRadius={36} outerRadius={52} dataKey="v" stroke="none" startAngle={90} endAngle={-270}>
                      <Cell fill="#374151" />
                      <Cell fill="#E5E7EB" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
                  <div className="text-2xl font-bold leading-none text-gray-900">1.26</div>
                  <div className="text-[7px] text-gray-500 font-medium mt-1.5 uppercase text-center leading-tight">Ratio</div>
                </div>
              </div>
            </div>
          </div>
        </div>


      </div>

      {/* ─── RIGHT COLUMN ─── */}
      <div className="w-96 flex flex-col gap-6 shrink-0">

        {/* Top Companies */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-base font-semibold">Top Companies</h3>
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="text-[10px] font-bold text-gray-500 bg-transparent border border-gray-200 px-2 py-1 rounded-md outline-none cursor-pointer"
            >
              <option value="All">All Time</option>
              {Array.from({length: 27}, (_, i) => 2000 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-4 px-1">
            <span className="w-24">Company</span>
            <span className="flex-1 text-right">Imp</span>
            <span className="flex-1 text-right">Exp</span>
            <span className="w-12 text-right">Ratio</span>
          </div>
          <div className="space-y-4">
            {topCompanies.slice(0, 5).map((c, i) => (
              <div key={i} className="flex items-center text-sm border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                <span className="w-24 truncate font-medium text-gray-800">{c.name.split(' ')[0]}</span>
                <span className="flex-1 text-right font-semibold text-gray-500">{fmt(c.importVolume)}</span>
                <span className="flex-1 text-right font-semibold text-gray-900">{fmt(c.exportVolume)}</span>
                <span className={`w-12 text-right font-bold ${c.ratio === '-' ? 'text-gray-400' : (parseFloat(c.ratio) >= 1 ? 'text-green-600' : 'text-red-500')}`}>
                  {c.ratio}
                </span>
              </div>
            ))}
          </div>
        </div>


        {/* Trade News */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-base font-semibold">Trade News</h3>
            <button onClick={() => fetchNews(searchQuery || 'trade OR supply chain')} disabled={newsLoading} className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1 cursor-pointer hover:text-gray-900 transition-colors">
              {newsLoading ? 'LOADING...' : 'REFRESH'} <RefreshCw size={12} className={newsLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search..."
              className="flex-1 border border-gray-200 rounded-md px-3 py-1 text-sm focus:outline-none focus:border-gray-400"
            />
            <button onClick={handleSearch} className="bg-gray-900 text-white px-3 py-1 rounded-md text-sm font-medium">
              Search
            </button>
          </div>

          <div className="space-y-5">
            {newsLoading ? (
              <div className="text-sm text-gray-400 animate-pulse">Fetching latest news...</div>
            ) : (!Array.isArray(news) || news.length === 0) ? (
              <div className="text-sm text-gray-400 italic">No recent news found.</div>
            ) : news.slice(0, 3).map((item, i) => (
              <a 
                key={i} 
                href={item.link} 
                target="_blank" 
                rel="noreferrer" 
                className="flex gap-4 text-sm hover:bg-slate-50 p-3 rounded-xl -mx-3 transition-all cursor-pointer group border border-transparent hover:border-slate-100"
              >
                <div className="mt-1 text-gray-400 shrink-0 group-hover:text-blue-500 transition-colors"><FileText size={18} /></div>
                <div className="flex-1 leading-tight min-w-0">
                  <div className="font-bold text-gray-900 truncate block group-hover:text-blue-600 transition-colors">
                    {item.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                    {item.description || item.content || 'No description available for this article.'}
                  </div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-2.5 flex justify-between items-center">
                    <span>{item.source_id || 'News Feed'}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-all text-blue-500 translate-x-2 group-hover:translate-x-0">READ ARTICLE →</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Bot } from '../types.ts';

interface AnalyticsProps {
  bots: Bot[];
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
}

const data = [
  { name: 'Pzt', chats: 400, tokens: 2400 },
  { name: 'Sal', chats: 300, tokens: 1398 },
  { name: 'Çar', chats: 200, tokens: 9800 },
  { name: 'Per', chats: 278, tokens: 3908 },
  { name: 'Cum', chats: 189, tokens: 4800 },
  { name: 'Cmt', chats: 239, tokens: 3800 },
  { name: 'Paz', chats: 349, tokens: 4300 },
];

const Analytics: React.FC<AnalyticsProps> = ({ bots, onOpenSidebar }) => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden fade-in">
      <header className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onOpenSidebar}
            className="w-9 h-9 flex flex-col items-center justify-center gap-[3px] border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            <div className="w-3.5 menu-icon-line"></div>
            <div className="w-2.5 menu-icon-line self-start ml-[7.5px]"></div>
            <div className="w-3.5 menu-icon-line"></div>
          </button>
          <h1 className="text-sm font-bold tracking-tight text-zinc-900">Platform Analytics</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Realtime Sync</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar space-y-8">
        <div className="max-w-[1400px] mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Performance Overview</h2>
            <p className="text-zinc-500 text-sm max-w-xl mx-auto leading-relaxed">
              Track your assistants' interaction volumes and token consumption in real-time.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-8 text-center">Interaction Trend</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id="colorChats" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#000" stopOpacity={0.05}/>
                        <stop offset="95%" stopColor="#000" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#a1a1aa'}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#a1a1aa'}} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: '1px solid #f4f4f5', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '11px' }}
                    />
                    <Area type="monotone" dataKey="chats" stroke="#000" fillOpacity={1} fill="url(#colorChats)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-8 text-center">Token Consumption</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#a1a1aa'}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#a1a1aa'}} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: '1px solid #f4f4f5', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '11px' }}
                    />
                    <Bar dataKey="tokens" fill="#f4f4f5" radius={[6, 6, 6, 6]} barSize={32} hover={{ fill: '#000' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-zinc-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 tracking-tight">Model Performance Report</h3>
              <span className="text-[9px] font-bold text-black border border-zinc-100 px-2 py-1 rounded-lg bg-zinc-50 uppercase tracking-widest">Live Sync</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-zinc-50/50 text-zinc-400 uppercase text-[9px] font-bold tracking-widest border-b border-zinc-50">
                  <tr>
                    <th className="px-6 py-4">Assistant</th>
                    <th className="px-6 py-4 text-center">Accuracy</th>
                    <th className="px-6 py-4 text-center">Latency</th>
                    <th className="px-6 py-4 text-right">Total Sessions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {bots.map((bot) => (
                    <tr key={bot.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <img src={bot.avatar} className="w-8 h-8 rounded-lg border border-zinc-100 shadow-sm" alt="" />
                          <span className="font-bold text-zinc-900 text-sm tracking-tight">{bot.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="bg-zinc-900 text-white px-2 py-0.5 rounded-md text-[10px] font-bold">
                          98.2%
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center text-xs text-zinc-500 font-bold">120ms</td>
                      <td className="px-6 py-5 text-right font-mono text-xs text-zinc-600 font-bold">
                        {bot.usageCount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Analytics;
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot } from '../types';

interface DashboardProps {
  bots: Bot[];
  onDelete: (id: string) => void;
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
}

interface ActivityEvent {
  id: string;
  botId?: string;
  botName?: string;
  type: 'creation' | 'message' | 'media' | 'analytics';
  description: string;
  timestamp: string;
  status: 'success' | 'info' | 'warning';
}

const MOCK_ACTIVITIES: ActivityEvent[] = [
  { id: 'a1', botName: 'Gemini Technical Studio', type: 'message', description: 'Architecture review session started.', timestamp: '2 mins ago', status: 'success' },
  { id: 'a2', type: 'creation', description: 'New project "Data Insight Engine" initialized.', timestamp: '45 mins ago', status: 'info' },
  { id: 'a3', botName: 'Gemini Technical Studio', type: 'media', description: 'High-resolution visualization generated via Veo-3.1.', timestamp: '2 hours ago', status: 'success' },
  { id: 'a4', type: 'analytics', description: 'Monthly performance report generated for all projects.', timestamp: '5 hours ago', status: 'info' },
  { id: 'a5', botName: 'Marketing Assistant', type: 'message', description: 'System performance optimized for unlimited queries.', timestamp: '1 day ago', status: 'success' },
];

export default function Dashboard({ bots, onDelete, isSidebarOpen, onOpenSidebar }: DashboardProps) {
  const [viewMode, setViewMode] = useState<'projects' | 'activity'>('projects');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const handleDeleteClick = (id: string, name: string) => {
    setConfirmDelete({ id, name });
  };

  const confirmDeletion = () => {
    if (confirmDelete) {
      onDelete(confirmDelete.id);
      setConfirmDelete(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden view-fade">
      <main className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-10 py-4 md:py-6">
        <div className="max-w-[1600px] mx-auto space-y-6">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={onOpenSidebar}
                className="w-10 h-10 flex flex-col items-center justify-center gap-[3px] border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-all shadow-sm group shrink-0"
              >
                <div className="w-4 menu-icon-line group-hover:scale-x-110 transition-transform"></div>
                <div className="w-2.5 menu-icon-line self-start ml-[9.5px] group-hover:scale-x-125 transition-transform"></div>
                <div className="w-4 menu-icon-line group-hover:scale-x-110 transition-transform"></div>
              </button>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tighter text-black leading-none">
                  {viewMode === 'projects' ? 'Projects' : 'Activity'}
                </h1>
              </div>
            </div>
            
            <Link to="/a/editor/new" className="px-6 py-3 bg-black text-white border border-black rounded-[16px] font-bold text-sm hover:bg-zinc-800 transition-all flex items-center gap-2 shadow-lg shadow-zinc-100 active:scale-95">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Create project
            </Link>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="relative w-full md:w-64">
              <select className="w-full appearance-none bg-zinc-50/50 border border-zinc-100 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-zinc-100 transition-all cursor-pointer text-zinc-600">
                <option>All items</option>
                <option>Active</option>
                <option>Recent</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>

            <div className="flex bg-zinc-50 p-1 rounded-xl border border-zinc-100">
               <button 
                onClick={() => setViewMode('projects')}
                className={`px-6 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-2 ${viewMode === 'projects' ? 'bg-white shadow-sm text-black border border-zinc-100' : 'text-zinc-400 hover:text-zinc-600'}`}
               >
                 <div className={`w-1.5 h-1.5 rounded-full ${viewMode === 'projects' ? 'bg-black' : 'bg-transparent border border-zinc-200'}`}></div>
                 Projects
               </button>
               <button 
                onClick={() => setViewMode('activity')}
                className={`px-6 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-2 ${viewMode === 'activity' ? 'bg-white shadow-sm text-black border border-zinc-100' : 'text-zinc-400 hover:text-zinc-600'}`}
               >
                 <div className={`w-1.5 h-1.5 rounded-full ${viewMode === 'activity' ? 'bg-black' : 'bg-transparent border border-zinc-200'}`}></div>
                 Activity
               </button>
            </div>
          </div>

          {viewMode === 'projects' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-1 animate-in fade-in duration-300">
              {bots.map(bot => (
                <div 
                  key={bot.id} 
                  className="bg-white border border-zinc-100 rounded-[20px] p-4 flex flex-col transition-all duration-300 hover:border-zinc-300 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.05)] group h-[160px] relative overflow-hidden"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="text-[16.7px] font-extrabold text-black truncate tracking-tighter leading-tight mb-0.5">{bot.name}</h3>
                      <p className="text-[11.7px] text-zinc-400 line-clamp-3 font-medium leading-relaxed">
                        {bot.description || 'Professional AI assistance for engineering workflows.'}
                      </p>
                    </div>
                    <div className="w-16 h-16 shrink-0 relative">
                      <img 
                        src={bot.avatar} 
                        className="w-full h-full object-cover rounded-lg opacity-80" 
                        style={{ 
                          WebkitMaskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)' 
                        }}
                        alt={bot.name} 
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-auto">
                    <Link 
                      to={`/a/test/${bot.id}`} 
                      className="flex-1 px-[16.7px] py-[8.7px] bg-black text-white text-[11.7px] font-bold rounded-xl hover:bg-zinc-800 transition-all active:scale-95 text-center"
                    >
                      Open Studio
                    </Link>
                    
                    <div className="flex items-center bg-zinc-50 border border-zinc-100 rounded-xl p-0.5">
                      <Link 
                        to={`/a/editor/${bot.id}`} 
                        className="p-[6.7px] text-zinc-600 hover:text-black hover:bg-white rounded-lg transition-all" 
                        title="Edit"
                      >
                        <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                      </Link>
                      <button 
                        onClick={() => handleDeleteClick(bot.id, bot.name)}
                        className="p-[6.7px] text-zinc-600 hover:text-red-500 hover:bg-white rounded-lg transition-all"
                        title="Delete"
                      >
                        <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-bottom-2 duration-400">
              {MOCK_ACTIVITIES.map(activity => (
                <div key={activity.id} className="flex items-center justify-between px-5 py-4 bg-white border border-zinc-100 rounded-[18px] hover:border-zinc-300 transition-all group">
                  <div className="flex items-center gap-5">
                    <div className={`w-5 h-5 flex items-center justify-center shrink-0 ${
                      activity.status === 'success' ? 'text-green-500' :
                      activity.status === 'warning' ? 'text-amber-500' : 'text-blue-500'
                    }`}>
                      {activity.type === 'message' && <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
                      {activity.type === 'creation' && <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>}
                      {activity.type === 'media' && <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                      {activity.type === 'analytics' && <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                    </div>
                    <div>
                      <h4 className="text-[13.5px] font-bold text-black flex items-center gap-2 leading-none">
                        {activity.botName && <span className="px-1.5 py-0.5 bg-zinc-50 border border-zinc-100 rounded text-[9px] uppercase tracking-wider text-zinc-400 font-black">{activity.botName}</span>}
                        {activity.description}
                      </h4>
                      <p className="text-[10px] text-zinc-300 font-black uppercase tracking-widest mt-1.5">{activity.timestamp}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-6 flex items-center justify-between px-6 border-t border-zinc-50">
            <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">
              {viewMode === 'projects' ? `${bots.length} Projects` : `${MOCK_ACTIVITIES.length} Recent Events`}
            </p>
            <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">v4.2.1 Stable</p>
          </div>

        </div>
      </main>

      {confirmDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-zinc-950/20 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-100 rounded-[28px] p-8 max-w-[380px] w-full shadow-[0_20px_60px_-10px_rgba(0,0,0,0.15)] space-y-7 animate-in zoom-in-95 duration-200">
            <div className="space-y-2.5">
              <h3 className="text-2xl font-extrabold tracking-tighter text-black leading-none">Delete project?</h3>
              <p className="text-[13px] text-zinc-500 font-medium leading-relaxed">
                Permanently remove <span className="text-black font-bold">"{confirmDelete.name}"</span>?
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-6 py-3.5 border border-zinc-100 text-zinc-600 rounded-2xl text-[12px] font-bold hover:bg-zinc-50 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeletion}
                className="flex-1 px-6 py-3.5 bg-red-600 text-white rounded-2xl text-[12px] font-bold hover:bg-red-700 transition-all shadow-xl shadow-red-100"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
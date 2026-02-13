import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
  isOpen: boolean;
  onToggle: (val?: boolean) => void;
}

interface PinnedItem {
  id: string;
  botId: string;
  name: string;
  timestamp: string;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const location = useLocation();
  const currentPath = location.pathname;
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || document.documentElement.classList.contains('dark');
  });
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);

  const loadPinned = () => {
    const saved = localStorage.getItem('geminihub_global_pinned');
    if (saved) {
      try {
        setPinnedItems(JSON.parse(saved));
      } catch (e) {
        setPinnedItems([]);
      }
    }
  };

  useEffect(() => {
    loadPinned();
    window.addEventListener('storage', (e) => {
      if (e.key === 'geminihub_global_pinned') loadPinned();
    });
    window.addEventListener('pinned_updated', loadPinned);
    return () => {
      window.removeEventListener('storage', loadPinned);
      window.removeEventListener('pinned_updated', loadPinned);
    };
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const menuItems = [
    { label: 'Dashboard', path: '/a/dashboard', icon: 'M4 6h16M4 12h16M4 18h16' },
    { label: 'Create New Bot', path: '/a/editor/new', icon: 'M12 4v16m8-8H4' },
    { label: 'Code Manager', path: '/a/code-manager', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
    { label: 'Analytics', path: '/a/analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  ];

  const removePinned = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = pinnedItems.filter(item => item.id !== id);
    localStorage.setItem('geminihub_global_pinned', JSON.stringify(updated));
    setPinnedItems(updated);
  };

  const groupedPinned = useMemo(() => {
    const groups: { date: string, items: PinnedItem[] }[] = [];
    pinnedItems.forEach(item => {
      const date = new Date(item.timestamp).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
      let group = groups.find(g => g.date === date);
      if (!group) {
        group = { date, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    });
    return groups;
  }, [pinnedItems]);

  return (
    <>
      <div 
        className={`fixed inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-sm z-[90] transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => onToggle(false)}
      />

      <aside className={`fixed inset-y-0 left-0 bg-white border-r border-zinc-100 transition-all duration-300 ease-in-out flex flex-col h-full z-[100] overflow-hidden ${isOpen ? 'w-64 translate-x-0 shadow-2xl shadow-zinc-200' : 'w-0 -translate-x-full'}`}>
        <div className="w-64 flex flex-col h-full">
          <div className="p-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center text-white text-[9px] font-bold">G</div>
              <span className="font-bold text-sm tracking-tight text-black">GeminiHub</span>
            </div>
            <button 
              onClick={() => onToggle(false)}
              className="p-1.5 hover:bg-zinc-50 rounded-lg text-zinc-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <nav className="flex-1 px-3 space-y-1 mt-2 overflow-y-auto custom-scrollbar">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => onToggle(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all ${
                  currentPath.startsWith(item.path) 
                    ? 'bg-black text-white shadow-lg shadow-zinc-100' 
                    : 'text-zinc-500 hover:bg-zinc-50 hover:text-black'
                }`}
              >
                <svg className="w-4 h-4 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span>{item.label}</span>
              </Link>
            ))}

            {groupedPinned.length > 0 && (
              <div className="mt-8 pt-6 border-t border-zinc-100 space-y-6">
                {groupedPinned.map((group) => (
                  <div key={group.date} className="space-y-1">
                    <div className="px-4 mb-2">
                      <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-400">{group.date}</span>
                    </div>
                    <div className="space-y-1">
                      {group.items.map((pinned) => (
                        <Link
                          key={pinned.id}
                          to={`/a/test/${pinned.botId}`}
                          onClick={() => onToggle(false)}
                          className="flex items-center justify-between group px-4 py-2.5 rounded-xl text-[11px] font-bold text-zinc-500 hover:bg-zinc-50 hover:text-black transition-all"
                        >
                          <div className="flex items-center gap-3 truncate">
                            <svg className="w-3.5 h-3.5 shrink-0 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                            </svg>
                            <span className="truncate">{pinned.name}</span>
                          </div>
                          <button 
                            onClick={(e) => removePinned(e, pinned.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </nav>

          <div className="p-4 border-t border-zinc-50 space-y-4">
            <button 
              onClick={() => setIsDark(!isDark)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-[11px] font-bold text-zinc-500 hover:bg-zinc-50 hover:text-black transition-all group"
            >
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  {isDark ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  )}
                </svg>
                <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
              </div>
              <div className={`w-2 h-2 rounded-full ${isDark ? 'bg-indigo-500' : 'bg-zinc-300'}`}></div>
            </button>

            <div className="px-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
                <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">Operational</p>
              </div>
              <p className="text-[9px] text-zinc-300 font-medium">v4.2 Studio</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Bot } from '../types.ts';

interface CodeManagerProps {
  bots: Bot[];
  onOpenSidebar: () => void;
}

interface HistoryItem {
  stack: string[];
  index: number;
}

const CodeManager: React.FC<CodeManagerProps> = ({ bots, onOpenSidebar }) => {
  const [selectedBotId, setSelectedBotId] = useState<string>(() => {
    return localStorage.getItem('last_active_bot_id') || bots[0]?.id || '';
  });
  const [files, setFiles] = useState<Record<string, string>>({
    'index.html': '<div class="flex items-center justify-center min-h-screen bg-zinc-50">\n  <div class="p-12 bg-white rounded-3xl shadow-xl border border-zinc-100 text-center">\n    <h1 class="text-4xl font-black tracking-tighter mb-4 text-black italic underline decoration-zinc-200 decoration-8 underline-offset-8">Studio Ready</h1>\n    <p class="text-zinc-500 font-medium">Select a project to start building.</p>\n  </div>\n</div>',
    'style.css': '/* Custom Styles */\nbody {\n  background: #fafafa;\n}',
    'script.js': '// script.js\nconsole.log("Artifact Studio Loaded");'
  });
  
  const [activeFile, setActiveFile] = useState<string>('index.html');
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [isFullScreenPreview, setIsFullScreenPreview] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  
  const [historyState, setHistoryState] = useState<Record<string, HistoryItem>>({
    'index.html': { stack: [
      '<div class="flex items-center justify-center min-h-screen bg-zinc-50">\n  <div class="p-12 bg-white rounded-3xl shadow-xl border border-zinc-100 text-center">\n    <h1 class="text-4xl font-black tracking-tighter mb-4 text-black italic underline decoration-zinc-200 decoration-8 underline-offset-8">Studio Ready</h1>\n    <p class="text-zinc-500 font-medium">Select a project to start building.</p>\n  </div>\n</div>'
    ], index: 0 },
    'style.css': { stack: ['/* Custom Styles */\nbody {\n  background: #fafafa;\n}'], index: 0 },
    'script.js': { stack: ['// script.js\nconsole.log("Artifact Studio Loaded");'], index: 0 }
  });
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumberRef = useRef<HTMLDivElement>(null);
  const historyTimer = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedBotId) {
      const saved = localStorage.getItem('preview_files_' + selectedBotId);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setFiles(parsed);
          
          const fileKeys = Object.keys(parsed);
          if (fileKeys.length > 0) {
            if (parsed['index.html']) setActiveFile('index.html');
            else if (parsed['App.tsx']) setActiveFile('App.tsx');
            else setActiveFile(fileKeys[0]);
          }

          const newHistoryState: Record<string, HistoryItem> = {};
          fileKeys.forEach(key => {
            newHistoryState[key] = {
              stack: [parsed[key]],
              index: 0
            };
          });
          setHistoryState(newHistoryState);
        } catch (e) {
          console.error("Failed to parse saved files", e);
        }
      }
    }
  }, [selectedBotId]);

  useEffect(() => {
    const fileKeys = Object.keys(files);
    
    // Determine the main entry point
    const htmlFiles = fileKeys.filter(k => k.toLowerCase().endsWith('.html'));
    let mainHtmlKey = 'index.html';
    if (!files[mainHtmlKey] && htmlFiles.length > 0) {
      mainHtmlKey = htmlFiles[0];
    }
    
    const htmlContent = files[mainHtmlKey] || '';
    
    // Aggregate all CSS and JS files
    const allCss = fileKeys
      .filter(k => k.toLowerCase().endsWith('.css'))
      .map(k => files[k])
      .join('\n');
      
    const allJs = fileKeys
      .filter(k => 
        k.toLowerCase().endsWith('.js') || 
        k.toLowerCase().endsWith('.ts') || 
        k.toLowerCase().endsWith('.jsx') || 
        k.toLowerCase().endsWith('.tsx')
      )
      .map(k => files[k])
      .join('\n');

    // Check if the HTML is a full document or a fragment
    const isFullDoc = htmlContent.toLowerCase().includes('<html') || htmlContent.toLowerCase().includes('<body');

    let fullHtml = '';
    if (isFullDoc) {
      // Inject CSS and JS into the existing full document
      fullHtml = htmlContent;
      const cssTag = `<style>\n${allCss}\n</style>`;
      const jsTag = `<script>\n${allJs}\n</script>`;
      
      if (fullHtml.includes('</head>')) {
        fullHtml = fullHtml.replace('</head>', `${cssTag}\n</head>`);
      } else {
        fullHtml = cssTag + fullHtml;
      }
      
      if (fullHtml.includes('</body>')) {
        fullHtml = fullHtml.replace('</body>', `${jsTag}\n</body>`);
      } else {
        fullHtml = fullHtml + jsTag;
      }
    } else {
      // Wrap the fragment in a standard preview template
      fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; margin: 0; min-height: 100vh; }
    ${allCss}
  </style>
</head>
<body>
  ${htmlContent}
  <script>${allJs}</script>
</body>
</html>`;
    }
    
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    
    if (selectedBotId) {
      localStorage.setItem('preview_files_' + selectedBotId, JSON.stringify(files));
    }

    return () => URL.revokeObjectURL(url);
  }, [files, selectedBotId]);

  const updateCode = (newVal: string) => {
    setFiles(prev => ({ ...prev, [activeFile]: newVal }));
    
    if (historyTimer.current) window.clearTimeout(historyTimer.current);
    
    historyTimer.current = window.setTimeout(() => {
      setHistoryState(prev => {
        const current = prev[activeFile] || { stack: [], index: -1 };
        const newStack = current.stack.slice(0, current.index + 1);
        
        if (newStack[newStack.length - 1] !== newVal) {
          newStack.push(newVal);
          if (newStack.length > 50) newStack.shift();
          
          return {
            ...prev,
            [activeFile]: {
              stack: newStack,
              index: newStack.length - 1
            }
          };
        }
        return prev;
      });
    }, 400);
  };

  const handleUndo = () => {
    const current = historyState[activeFile];
    if (current && current.index > 0) {
      const newIndex = current.index - 1;
      const prevVal = current.stack[newIndex];
      
      if (historyTimer.current) window.clearTimeout(historyTimer.current);
      
      setFiles(prev => ({ ...prev, [activeFile]: prevVal }));
      setHistoryState(prev => ({
        ...prev,
        [activeFile]: { ...prev[activeFile], index: newIndex }
      }));
    }
  };

  const handleRedo = () => {
    const current = historyState[activeFile];
    if (current && current.index < current.stack.length - 1) {
      const newIndex = current.index + 1;
      const nextVal = current.stack[newIndex];
      
      if (historyTimer.current) window.clearTimeout(historyTimer.current);
      
      setFiles(prev => ({ ...prev, [activeFile]: nextVal }));
      setHistoryState(prev => ({
        ...prev,
        [activeFile]: { ...prev[activeFile], index: newIndex }
      }));
    }
  };

  const handleClearAll = () => {
    setShowClearModal(true);
    setIsMenuOpen(false);
  };

  const confirmClearAll = () => {
    updateCode('');
    setShowClearModal(false);
  };

  const handleDownloadProject = () => {
    const dataStr = JSON.stringify(files, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `project_${selectedBotId || 'export'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsMenuOpen(false);
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (typeof parsed === 'object' && parsed !== null) {
          setFiles(parsed);
          const keys = Object.keys(parsed);
          if (keys.length > 0) {
             setActiveFile(keys[0]);
             const newHistory: Record<string, HistoryItem> = {};
             keys.forEach(k => {
               newHistory[k] = { stack: [parsed[k]], index: 0 };
             });
             setHistoryState(newHistory);
          }
        }
      } catch (err) {
        alert("JSON dosyası ayrıştırılamadı.");
      }
    };
    reader.readAsText(file);
    if (jsonInputRef.current) jsonInputRef.current.value = '';
    setIsMenuOpen(false);
  };

  const handleFindNext = () => {
    if (!textareaRef.current || !searchQuery) return;
    const text = files[activeFile];
    const start = textareaRef.current.selectionEnd;
    const index = text.toLowerCase().indexOf(searchQuery.toLowerCase(), start);
    
    if (index !== -1) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(index, index + searchQuery.length);
    } else {
      const firstIndex = text.toLowerCase().indexOf(searchQuery.toLowerCase());
      if (firstIndex !== -1) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(firstIndex, firstIndex + searchQuery.length);
      }
    }
  };

  const handleFindPrev = () => {
    if (!textareaRef.current || !searchQuery) return;
    const text = files[activeFile];
    const start = textareaRef.current.selectionStart;
    const index = text.toLowerCase().lastIndexOf(searchQuery.toLowerCase(), start - 1);
    
    if (index !== -1) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(index, index + searchQuery.length);
    }
  };

  const handleReplaceAll = () => {
    if (!searchQuery) return;
    const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const newContent = files[activeFile].replace(regex, replaceQuery);
    updateCode(newContent);
  };

  const fileKeys = useMemo(() => Object.keys(files), [files]);

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden view-fade relative">
      <header className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-6">
          <button 
            onClick={onOpenSidebar}
            className="w-10 h-10 flex flex-col items-center justify-center gap-[3px] border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-all shadow-sm shrink-0"
          >
            <div className="w-4 menu-icon-line"></div>
            <div className="w-2.5 menu-icon-line self-start ml-[9.5px]"></div>
            <div className="w-4 menu-icon-line"></div>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-zinc-400 hover:text-black transition-colors rounded-lg"
              title="Menü"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            {isMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-zinc-100 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <button 
                  onClick={handleClearAll}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-bold text-red-500 hover:bg-zinc-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Tümünü Sil
                </button>
                <button 
                  onClick={() => jsonInputRef.current?.click()}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                  JSON Yükle
                </button>
                <button 
                  onClick={handleDownloadProject}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  İndir
                </button>
              </div>
            )}
            <input type="file" ref={jsonInputRef} onChange={handleJsonUpload} className="hidden" accept=".json" />
          </div>

          <button 
            onClick={handleUndo} 
            disabled={!historyState[activeFile] || historyState[activeFile].index <= 0}
            className="p-2 text-zinc-400 hover:text-black transition-colors disabled:opacity-20 disabled:cursor-not-allowed" 
            title="Geri Al"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l5 5m-5-5l5-5" />
            </svg>
          </button>
          <button 
            onClick={handleRedo} 
            disabled={!historyState[activeFile] || historyState[activeFile].index >= (historyState[activeFile].stack.length - 1)}
            className="p-2 text-zinc-400 hover:text-black transition-colors disabled:opacity-20 disabled:cursor-not-allowed" 
            title="İleri Al"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-5 5m5-5l-5-5" />
            </svg>
          </button>
          <button 
            onClick={() => setShowSearch(!showSearch)} 
            className={`p-2 transition-colors ${showSearch ? 'text-black' : 'text-zinc-400 hover:text-black'}`}
            title={showSearch ? "Close Search" : "Search"}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              {showSearch ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              )}
            </svg>
          </button>
          <button 
            onClick={() => setIsFullScreenPreview(true)} 
            className="p-2.5 bg-black text-white rounded-xl hover:bg-zinc-800 transition-all shadow-lg active:scale-95 ml-2" 
            title="Full Screen Preview"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 border-r border-zinc-100 bg-zinc-50/30 overflow-y-auto hidden md:block custom-scrollbar">
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-4">Projects</h3>
              <div className="space-y-1">
                {bots.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBotId(b.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${selectedBotId === b.id ? 'bg-white border border-zinc-200 shadow-sm text-black' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}`}
                  >
                    <img src={b.avatar} className="w-6 h-6 rounded-lg grayscale shrink-0 opacity-60" alt="" />
                    <span className="text-xs font-bold truncate">{b.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {showSearch && (
            <div className="px-6 py-3 bg-zinc-50 border-b border-zinc-100 space-y-2 animate-in slide-in-from-top duration-200">
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFindNext()}
                  placeholder="Find..."
                  className="flex-1 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-xs outline-none shadow-sm"
                />
                <div className="flex items-center gap-1">
                  <button onClick={handleFindPrev} className="p-1.5 hover:bg-white border border-transparent hover:border-zinc-200 rounded-lg text-zinc-400 hover:text-black transition-all">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                  </button>
                  <button onClick={handleFindNext} className="p-1.5 hover:bg-white border border-transparent hover:border-zinc-200 rounded-lg text-zinc-400 hover:text-black transition-all">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  placeholder="Replace with..."
                  className="flex-1 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-xs outline-none shadow-sm"
                />
                <button 
                  onClick={handleReplaceAll}
                  className="px-4 py-1.5 bg-black text-white text-[10px] font-bold uppercase tracking-tight rounded-md hover:bg-zinc-800 transition-all shadow-sm"
                >
                  Replace All
                </button>
              </div>
            </div>
          )}

          <div className="px-6 pt-3 flex items-center gap-6 border-b border-zinc-100 bg-white overflow-x-auto whitespace-nowrap custom-scrollbar flex-nowrap">
            {fileKeys.map(key => (
              <button
                key={key}
                onClick={() => setActiveFile(key)}
                className={`pb-3 text-[10px] font-bold uppercase tracking-widest transition-all shrink-0 ${
                  activeFile === key 
                    ? 'text-black border-b-2 border-black' 
                    : 'text-zinc-400 hover:text-black'
                }`}
              >
                {key}
              </button>
            ))}
          </div>

          <div className="flex-1 flex overflow-hidden bg-zinc-50/30">
            <div 
              ref={lineNumberRef}
              className="w-12 pt-10 pb-10 text-right pr-3 text-zinc-300 font-mono text-[13px] leading-relaxed select-none overflow-hidden bg-zinc-50/50 border-r border-zinc-100/50"
            >
              {(files[activeFile] || '').split('\n').map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              onScroll={(e) => {
                if (lineNumberRef.current) {
                  lineNumberRef.current.scrollTop = e.currentTarget.scrollTop;
                }
              }}
              value={files[activeFile] || ''}
              onChange={(e) => updateCode(e.target.value)}
              spellCheck={false}
              className="flex-1 pt-10 pb-10 pr-10 pl-2 font-mono text-[13px] whitespace-pre font-medium leading-relaxed resize-none outline-none bg-transparent text-zinc-800 custom-scrollbar selection:bg-black selection:text-white"
              placeholder={'Edit ' + activeFile + '...'}
            />
          </div>
        </div>
      </div>

      {showClearModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-zinc-950/20 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-100 rounded-[28px] p-8 max-w-[380px] w-full shadow-[0_20px_60px_-10px_rgba(0,0,0,0.15)] space-y-7 animate-in zoom-in-95 duration-200">
            <div className="space-y-2.5 text-center">
              <h3 className="text-2xl font-extrabold tracking-tighter text-black leading-none">Dosyayı Temizle?</h3>
              <p className="text-[13px] text-zinc-500 font-medium leading-relaxed">
                <span className="text-black font-bold">"{activeFile}"</span> dosyasındaki tüm kodlar silinecek. Bu işlem geri alınamaz.
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowClearModal(false)} 
                className="flex-1 px-6 py-3.5 border border-zinc-100 text-zinc-600 rounded-2xl text-[12px] font-bold hover:bg-zinc-50 transition-all active:scale-95"
              >
                Vazgeç
              </button>
              <button 
                onClick={confirmClearAll} 
                className="flex-1 px-6 py-3.5 bg-black text-white rounded-2xl text-[12px] font-bold hover:bg-red-600 transition-all shadow-xl shadow-zinc-100 active:scale-95"
              >
                Temizle
              </button>
            </div>
          </div>
        </div>
      )}

      {isFullScreenPreview && (
        <div className="fixed inset-0 z-[300] bg-white animate-in zoom-in-95 duration-300 flex flex-col">
          <header className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
            <h2 className="text-sm font-bold text-black uppercase tracking-tight">Live Artifact Preview</h2>
            <button 
              onClick={() => setIsFullScreenPreview(false)}
              className="px-6 py-2 bg-black text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all shadow-md active:scale-95"
            >
              Exit Preview
            </button>
          </header>
          <div className="flex-1 bg-white">
            {blobUrl && (
              <iframe
                src={blobUrl}
                className="w-full h-full border-none"
                title="artifact-preview"
                sandbox="allow-scripts allow-modals allow-forms allow-popups"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeManager;
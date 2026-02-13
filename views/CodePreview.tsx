
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bot } from '../types';

interface CodePreviewProps {
  bots: Bot[];
}

const CodePreview: React.FC<CodePreviewProps> = ({ bots }) => {
  const { id } = useParams();
  const bot = bots.find(b => b.id === id);
  const [code, setCode] = useState('');
  const [blobUrl, setBlobUrl] = useState<string>('');

  const loadCode = () => {
    const savedCode = localStorage.getItem(`preview_code_${id}`);
    if (savedCode) {
      setCode(savedCode);
    }
  };

  useEffect(() => {
    loadCode();
    window.addEventListener('storage', loadCode);
    return () => window.removeEventListener('storage', loadCode);
  }, [id]);

  useEffect(() => {
    if (code) {
      const fullHtml = getFullHtml();
      const blob = new Blob([fullHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);

      // Memory leak önlemek için eski URL'i temizle
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [code]);

  if (!bot) return <div className="p-12 text-center text-slate-500">Yapı (Bot) bulunamadı.</div>;

  const getFullHtml = () => {
    if (!code) return `
      <html>
        <body style="display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif; color:#94a3b8;">
          <p>Kod verisi bekleniyor...</p>
        </body>
      </html>
    `;

    return `
      <!DOCTYPE html>
      <html lang="tr">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Preview - ${bot.name}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Plus Jakarta Sans', sans-serif; margin: 0; min-height: 100vh; background-color: white; }
          </style>
        </head>
        <body>
          ${code}
        </body>
      </html>
    `;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      {/* Navbar */}
      <header className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shadow-2xl z-10">
        <div className="flex items-center space-x-4">
          <img src={bot.avatar} className="w-8 h-8 rounded-lg border border-slate-700 shadow-sm" alt="" />
          <div>
            <h1 className="text-white font-bold text-sm tracking-tight">{bot.name} - Önizleme</h1>
            <p className="text-slate-500 text-[9px] uppercase font-black tracking-widest">Sandbox Ortamı (Blob)</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="hidden md:block px-3 py-1 bg-slate-800 rounded-md">
             <span className="text-[10px] text-slate-400 font-mono truncate max-w-[200px] block">
               {blobUrl || 'Oluşturuluyor...'}
             </span>
          </div>
          <button 
            onClick={loadCode}
            className="p-2 text-slate-400 hover:text-white transition-colors bg-slate-800 rounded-lg"
            title="Yenile"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          <button 
            onClick={() => window.close()}
            className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-red-600 hover:text-white rounded-lg text-xs font-bold transition-all"
          >
            Kapat
          </button>
        </div>
      </header>

      {/* Main Preview Container */}
      <div className="flex-1 bg-white relative">
        {blobUrl ? (
          <iframe 
            title="preview"
            src={blobUrl}
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-modals allow-forms allow-popups"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-50">
            <div className="text-zinc-400 animate-pulse font-medium">Önizleme hazırlanıyor...</div>
          </div>
        )}
      </div>

      {/* Mini Console */}
      <footer className="h-32 bg-slate-900 border-t border-slate-800 p-4 overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-2">
           <h4 className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Kaynak Kod Çıktısı</h4>
           <span className="text-[8px] text-slate-500 font-mono">{code.length} karakter</span>
        </div>
        <pre className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap">{code || '// Veri yok'}</pre>
      </footer>
    </div>
  );
};

export default CodePreview;

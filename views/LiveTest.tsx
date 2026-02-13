import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bot, Message } from '../types.ts';
import { createBotChat, sendMessageWithGrounding, generateImage } from '../services/geminiService.ts';
import { Chat } from '@google/genai';

interface LiveTestProps {
  bots: Bot[];
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
}

interface Attachment {
  file: File;
  preview: string;
  base64: string;
  type: string;
}

interface ProjectGroup {
  id: string;
  title: string;
  files: Record<string, string>;
  timestamp: Date;
}

interface PanoNote {
  id: string;
  text: string;
  timestamp: Date;
  source: 'bot' | 'user';
}

const GEMINI_MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', desc: 'Maximum Technical Depth & Reasoning', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=pro&backgroundColor=f4f4f5' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', desc: 'Fast & Advanced Intelligence', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=flash&backgroundColor=f4f4f5' },
  { id: 'gemini-flash-latest', name: 'Gemini Flash 2.5', desc: 'High-Performance Multimodal', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=google&backgroundColor=f4f4f5' },
  { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite', desc: 'Lightweight & Instant', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=lite&backgroundColor=f4f4f5' },
];

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      throw new Error("Clipboard API unavailable");
    }
  } catch (err) {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (fallbackErr) {
      console.error('Fallback copy failed', fallbackErr);
      return false;
    }
  }
};

export default function LiveTest({ bots, onOpenSidebar }: LiveTestProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const bot = bots.find(b => b.id === id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const botSwitcherRef = useRef<HTMLDivElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  
  const CHAT_STORAGE_KEY = `geminihub_chat_history_${id}`;
  const MODEL_STORAGE_KEY = `geminihub_selected_model_${id}`;
  const PANO_STORAGE_KEY = `geminihub_pano_${id}`;
  
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
      } catch (e) { return []; }
    }
    return [];
  });
  
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingMedia, setIsGeneratingMedia] = useState<'image' | 'video' | null>(null);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [headerMenuAction, setHeaderMenuAction] = useState<'pin' | 'pdf' | null>(null);
  const [isBotSwitcherOpen, setIsBotSwitcherOpen] = useState(false);
  const [switcherTab, setSwitcherTab] = useState<'models' | 'assistants'>('models');
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem(MODEL_STORAGE_KEY) || 'gemini-3-pro-preview';
  });
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [showResetModal, setShowResetModal] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProjectPanelOpen, setIsProjectPanelOpen] = useState(false);
  const [activePanelTab, setActivePanelTab] = useState<'files' | 'images' | 'pano'>('files');
  const [manualNoteText, setManualNoteText] = useState('');
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [linkToConfirm, setLinkToConfirm] = useState<string | null>(null);
  
  const [panoNotes, setPanoNotes] = useState<PanoNote[]>(() => {
    const saved = localStorage.getItem(PANO_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved).map((s: any) => ({ 
          ...s, 
          timestamp: new Date(s.timestamp),
          source: s.source || 'bot' 
        }));
      } catch (e) { return []; }
    }
    return [];
  });

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (bot) {
      const savedChat = localStorage.getItem(CHAT_STORAGE_KEY);
      if (savedChat) {
        try {
          setMessages(JSON.parse(savedChat).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
        } catch (e) { setMessages([{ id: 'init', role: 'model', text: `Session initialized for ${bot.name}.`, timestamp: new Date() }]); }
      } else {
        setMessages([{ id: 'init', role: 'model', text: `Session initialized for ${bot.name}.`, timestamp: new Date() }]);
      }
      
      const savedPano = localStorage.getItem(PANO_STORAGE_KEY);
      if (savedPano) {
        try { setPanoNotes(JSON.parse(savedPano).map((s: any) => ({ ...s, timestamp: new Date(s.timestamp) }))); } catch (e) {}
      }

      const savedModel = localStorage.getItem(MODEL_STORAGE_KEY);
      if (savedModel) setSelectedModel(savedModel);
    }
  }, [id, bot]);

  const projectGroups = useMemo(() => {
    const groups: ProjectGroup[] = [];
    messages.forEach((msg) => {
      if (msg.role === 'model' && msg.text?.includes('```')) {
        const parts = msg.text.split(/(```[\s\S]*?```)/g);
        const currentFiles: Record<string, string> = {};
        parts.forEach(part => {
          const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
          if (match) {
            const lang = (match[1] || '').toLowerCase();
            const content = match[2].trim();
            const fileName = getFilenameFromCode(content, lang);
            currentFiles[fileName] = content;
          }
        });
        if (Object.keys(currentFiles).length > 0) {
          groups.push({ id: msg.id, title: `Artifact #${groups.length + 1}`, files: currentFiles, timestamp: msg.timestamp });
        }
      }
    });
    return groups.reverse();
  }, [messages]);

  const generatedImages = useMemo(() => {
    return messages.filter(m => m.type === 'image' && m.mediaUrl).map(m => ({ id: m.id, url: m.mediaUrl!, timestamp: m.timestamp })).reverse();
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setActiveMenuId(null);
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) setIsHeaderMenuOpen(false);
      if (botSwitcherRef.current && !botSwitcherRef.current.contains(event.target as Node)) setIsBotSwitcherOpen(false);
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target as Node)) setIsAttachmentMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (bot) {
      const history = messages
        .filter(m => m.id !== 'init' && m.text && !m.text.includes('kotası doldu'))
        .map(m => ({ role: m.role, parts: [{ text: m.text }] }));
      setChatSession(createBotChat(bot, history, selectedModel));
    }
  }, [bot, id, selectedModel]);

  useEffect(() => {
    if (messages.length > 0) {
      try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages)); } catch (e) {}
    }
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, id]);

  useEffect(() => {
    if (id) {
      localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
      localStorage.setItem(PANO_STORAGE_KEY, JSON.stringify(panoNotes));
    }
  }, [selectedModel, panoNotes, id]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSaveToPano = (text: string) => {
    const cleanText = text.replace(/\[GENERATE_(IMAGE|VIDEO):\s*.*?\]/g, '').trim();
    if (!cleanText) return;
    setPanoNotes(prev => [{ id: Date.now().toString(), text: cleanText, timestamp: new Date(), source: 'bot' }, ...prev]);
    setIsProjectPanelOpen(true);
    setActivePanelTab('pano');
  };

  const handleManualNoteSave = () => {
    if (!manualNoteText.trim()) return;
    setPanoNotes(prev => [{ id: Date.now().toString(), text: manualNoteText.trim(), timestamp: new Date(), source: 'user' }, ...prev]);
    setManualNoteText('');
  };

  const toggleListening = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    if (isListening) { recognitionRef.current?.stop(); return; }
    try { await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (err) { return; }
    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false; recognition.interimResults = false; recognition.lang = 'tr-TR';
      recognition.onresult = (e: any) => setInput(prev => prev + (prev ? ' ' : '') + e.results[0][0].transcript);
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
    recognitionRef.current.start();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setAttachments(prev => [...prev, { file, preview: URL.createObjectURL(file), base64, type: file.type }]);
      };
      reader.readAsDataURL(file);
    });
    if (e.target) e.target.value = '';
    setIsAttachmentMenuOpen(false);
  };

  const handleLinkClick = (e: React.MouseEvent, url: string) => {
    if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      const formattedUrl = url.startsWith('www.') ? `https://${url}` : url;
      setLinkToConfirm(formattedUrl);
    }
  };

  const send = async () => {
    if ((!input.trim() && attachments.length === 0) || !chatSession || isLoading) return;
    const userText = input; const currentAttachments = [...attachments];
    setInput(''); setAttachments([]); setIsLoading(true);
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: userText, timestamp: new Date(),
      mediaUrl: currentAttachments[0]?.preview, type: currentAttachments[0]?.type.startsWith('image') ? 'image' : 'text' };
    setMessages(prev => [...prev, userMsg]);
    const botMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: botMsgId, role: 'model', text: '', timestamp: new Date(), groundingChunks: [] }]);
    try {
      let payload: any = userText;
      if (currentAttachments.length > 0) {
        const parts: any[] = [{ text: userText || "Analiz et." }];
        currentAttachments.forEach(a => parts.push({ inlineData: { data: a.base64, mimeType: a.type } }));
        payload = { parts };
      }
      let fullText = '';
      await sendMessageWithGrounding(chatSession, payload, (chunk, grounding) => {
        fullText += chunk;
        setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: fullText, groundingChunks: grounding || m.groundingChunks } : m));
      });
      const imgMatch = fullText.match(/\[GENERATE_IMAGE:\s*(.*?)\]/);
      if (imgMatch && bot?.hasImageGen) {
        setIsGeneratingMedia('image');
        const url = await generateImage(imgMatch[1]);
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: `Görsel üretildi.`, timestamp: new Date(), type: 'image', mediaUrl: url }]);
        setIsGeneratingMedia(null);
      }
    } catch (e: any) {
      const errorMsg = e.message === 'SYSTEM_BUSY' ? 'API kotası doldu. Lütfen bekleyin.' : 'Bağlantı hatası oluştu.';
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: errorMsg } : m));
    } finally { setIsLoading(false); }
  };

  function getFilenameFromCode(code: string, lang: string) {
    const match = code.split('\n')[0].match(/\/\/\s*filename:\s*([a-zA-Z0-9._-]+)/i);
    if (match) return match[1];
    const extMap: any = { 'html': 'index.html', 'js': 'script.js', 'css': 'style.css' };
    return extMap[lang.toLowerCase()] || `file.${lang || 'txt'}`;
  }

  const handlePinChat = () => {
    const globalPinned = JSON.parse(localStorage.getItem('geminihub_global_pinned') || '[]');
    const newItem = { id: Date.now().toString(), botId: id, name: `${bot?.name} - ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`, timestamp: new Date().toISOString() };
    localStorage.setItem('geminihub_global_pinned', JSON.stringify([newItem, ...globalPinned].slice(0, 10)));
    window.dispatchEvent(new Event('pinned_updated'));
    setIsHeaderMenuOpen(false);
  };

  const renderFormattedLines = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      let content = line;
      let className = "mb-1.5 block";
      if (content.startsWith('### ')) { content = content.replace('### ', ''); className += " font-bold text-black"; }
      else if (content.startsWith('## ')) { content = content.replace('## ', ''); className += " font-extrabold text-black border-b border-zinc-50 pb-1 mb-2"; }
      else if (content.startsWith('# ')) { content = content.replace('# ', ''); className += " font-black text-black text-lg mb-3"; }
      
      const combinedRegex = /(\*\*.*?\*\*|\*.*?\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|(?:https?:\/\/|www\.)[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+[^\s,<>"]*?(?=[,.!?:;'"\s]|$))/g;
      const subparts = content.split(combinedRegex);
      return (
        <span key={idx} className={className}>
          {subparts.map((part, pIdx) => {
            if (!part) return null;
            if (part.startsWith('**') && part.endsWith('**')) return <strong key={pIdx} className="font-bold text-black">{part.slice(2, -2)}</strong>;
            if (part.startsWith('*') && part.endsWith('*')) return <em key={pIdx} className="font-medium italic">{part.slice(1, -1)}</em>;
            if (part.startsWith('[') && part.includes('](')) {
              const m = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
              return m ? <a key={pIdx} href={m[2]} onClick={e => handleLinkClick(e, m[2])} className="text-indigo-600 font-bold underline decoration-indigo-200 underline-offset-4 mx-0.5">{m[1]}</a> : part;
            }
            if (part.startsWith('http') || part.startsWith('www.')) {
              const href = part.startsWith('www.') ? `https://${part}` : part;
              return <a key={pIdx} href={href} onClick={e => handleLinkClick(e, href)} className="text-indigo-600 font-bold underline decoration-indigo-200 underline-offset-4 mx-0.5 inline-block truncate max-w-[280px] align-bottom">{part}</a>;
            }
            return part;
          })}
        </span>
      );
    });
  };

  const renderMessageContent = (msg: Message) => {
    if (!msg.text && isLoading && msg.role === 'model') return <span className="animate-pulse text-zinc-300">...</span>;
    const cleanText = (msg.text || '').replace(/\[GENERATE_(IMAGE|VIDEO):\s*.*?\]/g, '').trim();
    const parts = cleanText.split(/(```[\s\S]*?```)/g);
    return (
      <div className="space-y-4">
        {msg.role === 'user' && msg.mediaUrl && <div className="max-w-[160px] rounded-xl overflow-hidden border border-zinc-100 shadow-sm"><img src={msg.mediaUrl} /></div>}
        {parts.map((part, i) => {
          const codeMatch = part.match(/```(\w+)?\n?([\s\S]*?)```/);
          if (codeMatch) {
            const blockId = `${msg.id}-${i}`;
            const isExpanded = expandedBlocks.has(blockId);
            return (
              <div key={i} className="my-4 border border-zinc-100 rounded-xl overflow-hidden bg-white shadow-sm group">
                <div onClick={() => setExpandedBlocks(prev => {const n = new Set(prev); n.has(blockId) ? n.delete(blockId) : n.add(blockId); return n;})} className="px-5 py-4 cursor-pointer hover:bg-zinc-50 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-900">{getFilenameFromCode(codeMatch[2], codeMatch[1] || 'code')}</span>
                  <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}><svg className="w-4 h-4 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" /></svg></div>
                </div>
                {isExpanded && <div className="border-t border-zinc-50 bg-zinc-50/30 p-5 font-mono text-[11px] overflow-x-auto"><code>{codeMatch[2].trim()}</code></div>}
              </div>
            );
          }
          return <div key={i}>{renderFormattedLines(part)}</div>;
        })}
        {msg.mediaUrl && msg.role === 'model' && msg.type === 'image' && <div className="mt-4 rounded-2xl overflow-hidden border border-zinc-100 shadow-xl max-w-lg"><img src={msg.mediaUrl} className="w-full" /></div>}
      </div>
    );
  };

  if (!bot) return <div className="flex-1 flex items-center justify-center text-zinc-400">Asistan bulunamadı.</div>;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white overflow-hidden relative view-fade">
      <header className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-white/80 backdrop-blur-md z-[100]">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/a/dashboard')} className="w-9 h-9 flex items-center justify-center border border-zinc-200 rounded-lg hover:bg-zinc-50 text-zinc-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M15 19l-7-7 7-7" /></svg></button>
          <div className="relative" ref={botSwitcherRef}>
            <button onClick={() => setIsBotSwitcherOpen(!isBotSwitcherOpen)} className="flex items-center gap-3 px-3 py-1.5 rounded-xl hover:bg-zinc-50 transition-all">
              <img src={bot.avatar} className="w-7 h-7 rounded-lg border border-zinc-100 shadow-sm" alt="" />
              <h2 className="text-[13px] font-black text-zinc-900">{bot.name}</h2>
              <svg className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${isBotSwitcherOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" /></svg>
            </button>
            {isBotSwitcherOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-zinc-100 rounded-2xl shadow-2xl z-[110] p-2 animate-in fade-in slide-in-from-top-2">
                <div className="flex p-1 bg-zinc-100 rounded-xl mb-2">
                  <button onClick={() => setSwitcherTab('models')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg ${switcherTab === 'models' ? 'bg-white text-black' : 'text-zinc-500'}`}>Model</button>
                  <button onClick={() => setSwitcherTab('assistants')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg ${switcherTab === 'assistants' ? 'bg-white text-black' : 'text-zinc-500'}`}>Asistan</button>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                  {switcherTab === 'models' ? GEMINI_MODELS.map(m => (
                    <button key={m.id} onClick={() => { setSelectedModel(m.id); setIsBotSwitcherOpen(false); }} className={`w-full flex items-center gap-3 p-2.5 rounded-xl ${m.id === selectedModel ? 'bg-zinc-50' : ''}`}>
                      <img src={m.avatar} className="w-7 h-7 rounded-lg" />
                      <div className="text-left"><p className="text-[11px] font-bold">{m.name}</p></div>
                    </button>
                  )) : bots.map(b => (
                    <button key={b.id} onClick={() => navigate(`/a/test/${b.id}`)} className={`w-full flex items-center gap-3 p-2.5 rounded-xl ${b.id === id ? 'bg-zinc-50' : ''}`}>
                      <img src={b.avatar} className="w-7 h-7 rounded-lg" />
                      <p className="text-[11px] font-bold truncate">{b.name}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="relative" ref={headerMenuRef}>
          <button onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)} className="w-9 h-9 flex items-center justify-center text-zinc-600 hover:text-black"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" /></svg></button>
          {isHeaderMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-zinc-100 rounded-xl shadow-xl z-[110] overflow-hidden">
              <button onClick={() => { setIsProjectPanelOpen(true); setIsHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-[11px] font-bold text-zinc-600 hover:bg-zinc-50">Proje Paneli</button>
              <button onClick={handlePinChat} className="w-full flex items-center gap-3 px-4 py-3 text-left text-[11px] font-bold text-zinc-600 hover:bg-zinc-50">Sohbeti Sabitle</button>
              <button onClick={() => { setShowResetModal(true); setIsHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-[11px] font-bold text-red-500 hover:bg-zinc-50">Sohbeti Sil</button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex min-h-0 relative">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-12 lg:px-32 py-8 space-y-8 custom-scrollbar">
          {messages.map(msg => (
            <div key={msg.id} className="max-w-4xl mx-auto space-y-2 relative group/msg animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] font-bold uppercase tracking-widest ${msg.role === 'user' ? 'text-zinc-500' : 'text-black'}`}>{msg.role === 'user' ? 'User' : bot.name}</span>
                <span className="text-[9px] text-zinc-400 font-bold">{msg.timestamp.toLocaleTimeString()}</span>
                <div className="ml-auto opacity-0 group-hover/msg:opacity-100 transition-opacity">
                  <button onClick={() => handleSaveToPano(msg.text)} className="p-1 text-zinc-400 hover:text-indigo-600" title="Kaydet"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg></button>
                </div>
              </div>
              <div className="text-zinc-700 text-[13px] font-medium leading-relaxed">{renderMessageContent(msg)}</div>
            </div>
          ))}
          {isGeneratingMedia && <div className="max-w-4xl mx-auto"><div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3 max-w-sm"><div className="w-10 h-10 border-4 border-zinc-200 border-t-black rounded-full animate-spin"></div><p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Üretiliyor...</p></div></div>}
        </div>
        
        <aside className={`absolute top-0 right-0 h-full w-80 bg-zinc-50 border-l border-zinc-100 transition-transform duration-500 ease-in-out z-[90] shadow-2xl flex flex-col ${isProjectPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="px-6 py-4 bg-white border-b border-zinc-100 flex items-center justify-between shrink-0">
            <div className="flex gap-2">
              <button onClick={() => setActivePanelTab('files')} className={`p-2 rounded-lg ${activePanelTab === 'files' ? 'bg-black text-white' : 'text-zinc-500'}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg></button>
              <button onClick={() => setActivePanelTab('pano')} className={`p-2 rounded-lg ${activePanelTab === 'pano' ? 'bg-black text-white' : 'text-zinc-500'}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></button>
            </div>
            <button onClick={() => setIsProjectPanelOpen(false)} className="text-zinc-400 hover:text-black"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {activePanelTab === 'files' ? (
              <div className="space-y-3">{projectGroups.map(g => Object.keys(g.files).map(name => <div key={name} className="p-3 bg-white border border-zinc-100 rounded-xl text-[11px] font-bold hover:border-zinc-300 cursor-pointer">{name}</div>))}</div>
            ) : (
              <div className="space-y-3">
                <button onClick={() => setIsNoteModalOpen(true)} className="w-full p-4 border border-dashed border-zinc-200 rounded-xl text-[11px] font-bold text-zinc-400 hover:bg-zinc-100">+ Yeni Not</button>
                {panoNotes.map(n => <div key={n.id} className="p-4 bg-white border border-zinc-100 rounded-xl text-[11px] font-medium leading-relaxed italic">{n.text}</div>)}
              </div>
            )}
          </div>
        </aside>
      </div>

      <footer className="shrink-0 bg-white border-t border-zinc-100 p-4 md:p-6 z-[100]">
        <div className="max-w-4xl mx-auto">
          {attachments.length > 0 && (
            <div className="flex gap-2 mb-4 px-2">
              {attachments.map((a, i) => (
                <div key={i} className="relative w-12 h-12 border border-zinc-200 rounded-lg overflow-hidden">
                  <img src={a.preview} className="w-full h-full object-cover" />
                  <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-0 right-0 p-0.5 bg-black text-white rounded-bl-lg"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
              ))}
            </div>
          )}
          <div className="relative border border-zinc-200 rounded-2xl bg-white p-4 focus-within:border-black transition-all">
            <textarea ref={textareaRef} rows={1} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Mesajınızı yazın..." className="w-full bg-transparent outline-none text-sm font-medium text-zinc-800 resize-none min-h-[44px] max-h-[200px]" />
            <div className="flex items-center justify-between mt-2">
              <div className="flex gap-4 relative" ref={attachmentMenuRef}>
                <button onClick={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)} className="text-zinc-400 hover:text-black transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg></button>
                {isAttachmentMenuOpen && <div className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-zinc-100 rounded-xl shadow-xl z-[120] overflow-hidden"><button onClick={() => { fileInputRef.current?.click(); setIsAttachmentMenuOpen(false); }} className="w-full p-3 text-left text-[11px] font-bold hover:bg-zinc-50">Dosya/Görsel Ekle</button></div>}
                <button onClick={toggleListening} className={`transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-zinc-400 hover:text-black'}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg></button>
              </div>
              <button onClick={send} disabled={isLoading || (!input.trim() && attachments.length === 0)} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${input.trim() || attachments.length > 0 ? 'bg-black text-white shadow-lg' : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M12 19V5M5 12l7-7 7 7" /></svg></button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple />
          </div>
        </div>
      </footer>

      {isNoteModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-zinc-100 rounded-[32px] p-8 max-w-[500px] w-full shadow-2xl space-y-6 animate-in zoom-in-95">
            <h3 className="text-xl font-black text-black">Yeni Not</h3>
            <textarea autoFocus value={manualNoteText} onChange={e => setManualNoteText(e.target.value)} placeholder="Notunuzu buraya yazın..." className="w-full h-48 bg-zinc-50 border border-zinc-100 rounded-2xl p-5 text-sm outline-none resize-none" />
            <div className="flex gap-3"><button onClick={() => setIsNoteModalOpen(false)} className="flex-1 py-4 border border-zinc-100 text-zinc-500 rounded-2xl text-[12px] font-bold">İptal</button><button onClick={() => { handleManualNoteSave(); setIsNoteModalOpen(false); }} disabled={!manualNoteText.trim()} className="flex-1 py-4 bg-black text-white rounded-2xl text-[12px] font-bold">Kaydet</button></div>
          </div>
        </div>
      )}

      {showResetModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-zinc-950/20 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border rounded-[28px] p-8 max-w-[380px] w-full text-center space-y-7 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-extrabold text-black">Sohbeti sıfırla?</h3>
            <div className="flex gap-3"><button onClick={() => setShowResetModal(false)} className="flex-1 py-3 border border-zinc-100 text-zinc-600 rounded-xl text-[11px] font-bold">Vazgeç</button><button onClick={() => { setMessages([]); localStorage.removeItem(CHAT_STORAGE_KEY); setShowResetModal(false); }} className="flex-1 py-3 bg-black text-white rounded-xl text-[11px] font-bold">Sıfırla</button></div>
          </div>
        </div>
      )}

      {linkToConfirm && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-zinc-100 rounded-[32px] p-8 max-w-[440px] w-full shadow-2xl space-y-7 animate-in zoom-in-95">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-black leading-tight">Dış Bağlantı Onayı</h3>
                <p className="text-[13px] text-zinc-500 leading-relaxed">Güvenliğiniz için ayrılmadan önce onayınızı istiyoruz. Aşağıdaki adrese yönlendirileceksiniz:</p>
              </div>
              <div className="w-full p-4 bg-zinc-50 rounded-xl border border-zinc-100 font-mono text-[10px] text-indigo-600 break-all">{linkToConfirm}</div>
            </div>
            <div className="flex gap-3"><button onClick={() => setLinkToConfirm(null)} className="flex-1 py-4 border border-zinc-100 text-zinc-600 rounded-2xl text-[12px] font-bold">Vazgeç</button><button onClick={() => { window.open(linkToConfirm, '_blank', 'noopener,noreferrer'); setLinkToConfirm(null); }} className="flex-1 py-4 bg-black text-white rounded-2xl text-[12px] font-bold">Siteye Git</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

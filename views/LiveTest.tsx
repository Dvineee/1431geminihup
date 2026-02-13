import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bot, Message } from '../types.ts';
import { createBotChat, sendMessageWithGrounding, generateImage, generateVideo } from '../services/geminiService.ts';
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

/**
 * Robust utility to copy text to clipboard with fallback for restricted environments.
 */
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

  // Sync state when ID changes (Switching Assistants)
  useEffect(() => {
    const savedChat = localStorage.getItem(CHAT_STORAGE_KEY);
    if (savedChat) {
      try {
        setMessages(JSON.parse(savedChat).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
      } catch (e) { setMessages([{ id: 'init', role: 'model', text: `Engineering session initialized for ${bot?.name}.`, timestamp: new Date() }]); }
    } else {
      setMessages([{ id: 'init', role: 'model', text: `Engineering session initialized for ${bot?.name}.`, timestamp: new Date() }]);
    }

    const savedPano = localStorage.getItem(PANO_STORAGE_KEY);
    if (savedPano) {
      try {
        setPanoNotes(JSON.parse(savedPano).map((s: any) => ({ ...s, timestamp: new Date(s.timestamp), source: s.source || 'bot' })));
      } catch (e) { setPanoNotes([]); }
    } else {
      setPanoNotes([]);
    }

    const savedModel = localStorage.getItem(MODEL_STORAGE_KEY);
    if (savedModel) setSelectedModel(savedModel);
    
    // Close panels on switch
    setIsBotSwitcherOpen(false);
    setActiveMenuId(null);
  }, [id]);

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
          groups.push({ id: msg.id, title: `Software Artifact #${groups.length + 1}`, files: currentFiles, timestamp: msg.timestamp });
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
        .filter(m => m.id !== 'init' && m.text && !m.text.includes('biraz yoğun'))
        .map(m => ({ role: m.role, parts: [{ text: m.text }] }));
      setChatSession(createBotChat(bot, history, selectedModel));
    }
  }, [bot, id, selectedModel]);

  useEffect(() => {
    if (messages.length > 0) {
      try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages)); } catch (e) { console.warn("Storage quota exceeded."); }
    }
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, id]);

  useEffect(() => {
    if (id) localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
  }, [selectedModel, id]);

  useEffect(() => {
    if (id) localStorage.setItem(PANO_STORAGE_KEY, JSON.stringify(panoNotes));
  }, [panoNotes, id]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSaveToPano = (text: string) => {
    const cleanText = text.replace(/\[GENERATE_(IMAGE|VIDEO):\s*.*?\]/g, '').trim();
    if (!cleanText) return;
    const newNote: PanoNote = { id: Date.now().toString(), text: cleanText, timestamp: new Date(), source: 'bot' };
    setPanoNotes(prev => [newNote, ...prev]);
    setIsProjectPanelOpen(true);
    setActivePanelTab('pano');
  };

  const handleManualNoteSave = () => {
    if (!manualNoteText.trim()) return;
    const newNote: PanoNote = { id: Date.now().toString(), text: manualNoteText.trim(), timestamp: new Date(), source: 'user' };
    setPanoNotes(prev => [newNote, ...prev]);
    setManualNoteText('');
  };

  const handleCopyAllPano = async () => {
    const allText = panoNotes.map(n => n.text).join('\n\n---\n\n');
    const ok = await copyToClipboard(allText);
    if (ok) {
      setCopiedId('copy-all');
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const toggleListening = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Ses tanıma desteklenmiyor."); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    try { await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (err) { alert("Mikrofon reddedildi."); return; }
    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false; recognition.interimResults = false; recognition.lang = 'tr-TR';
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) setInput(prev => prev + (prev.length > 0 ? ' ' : '') + transcript);
      };
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
    try { recognitionRef.current.start(); } catch (e) { setIsListening(false); }
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

  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const newAttachments = prev.filter((_, i) => i !== index);
      URL.revokeObjectURL(prev[index].preview);
      return newAttachments;
    });
  };

  const handleCopyMessage = async (text: string, id: string) => {
    const cleanText = text.replace(/\[GENERATE_(IMAGE|VIDEO):\s*.*?\]/g, '').trim();
    const success = await copyToClipboard(cleanText);
    if (success) {
      setCopiedMsgId(id);
      setTimeout(() => setCopiedMsgId(null), 2000);
    }
  };

  const handleExportPDF = async (msg: Message) => {
    try {
      // @ts-ignore
      const { jsPDF } = await import('https://esm.sh/jspdf');
      const doc = new jsPDF();
      const margin = 20;
      doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("GeminiHub Artifact Export", margin, 20);
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
      doc.text(`${bot?.name} | ${msg.timestamp.toLocaleString()}`, margin, 27);
      doc.line(margin, 30, 190, 30);
      doc.setTextColor(0); doc.setFontSize(11);
      const cleanText = msg.text.replace(/\[GENERATE_(IMAGE|VIDEO):\s*.*?\]/g, '').trim();
      const splitText = doc.splitTextToSize(cleanText, 170);
      let y = 40; splitText.forEach((line: string) => { if (y > 280) { doc.addPage(); y = 20; } doc.text(line, margin, y); y += 7; });
      doc.save(`export-${msg.id}.pdf`);
    } catch (err) { console.error("PDF Error", err); }
    setActiveMenuId(null);
  };

  const handleExportFullChatPDF = async () => {
    setHeaderMenuAction('pdf');
    setTimeout(() => { setIsHeaderMenuOpen(false); setHeaderMenuAction(null); }, 1000);
    try {
      // @ts-ignore
      const { jsPDF } = await import('https://esm.sh/jspdf');
      const doc = new jsPDF();
      const margin = 20; const pageWidth = doc.internal.pageSize.getWidth(); const contentWidth = pageWidth - (margin * 2);
      let y = 20; doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("GeminiHub Full Session", margin, y);
      y += 10; doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
      doc.text(`${bot?.name} | Date: ${new Date().toLocaleString()}`, margin, y);
      y += 15;
      messages.forEach((msg) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(0);
        doc.text(`${msg.role === 'user' ? 'User' : bot?.name} (${msg.timestamp.toLocaleTimeString()}):`, margin, y);
        y += 5; doc.setFont("helvetica", "normal"); doc.setFontSize(10);
        const cleanText = msg.text.replace(/\[GENERATE_(IMAGE|VIDEO):\s*.*?\]/g, '').trim();
        const splitText = doc.splitTextToSize(cleanText, contentWidth);
        splitText.forEach((line: string) => { if (y > 280) { doc.addPage(); y = 20; } doc.text(line, margin, y); y += 7; });
        y += 5;
      });
      doc.save(`full-session-${Date.now()}.pdf`);
    } catch (err) { console.error("PDF hatası", err); }
  };

  const handlePinChat = () => {
    setHeaderMenuAction('pin');
    setTimeout(() => { setIsHeaderMenuOpen(false); setHeaderMenuAction(null); }, 1000);
    const sessionSummary = `${bot?.name} - ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    const globalPinnedRaw = localStorage.getItem('geminihub_global_pinned');
    let globalPinned = globalPinnedRaw ? JSON.parse(globalPinnedRaw) : [];
    const newItem = { id: Date.now().toString(), botId: id, name: sessionSummary, timestamp: new Date().toISOString() };
    globalPinned = [newItem, ...globalPinned].slice(0, 10);
    localStorage.setItem('geminihub_global_pinned', JSON.stringify(globalPinned));
    window.dispatchEvent(new Event('pinned_updated'));
  };

  const send = async () => {
    if ((!input.trim() && attachments.length === 0) || !chatSession || isLoading) return;
    const userText = input; const currentAttachments = [...attachments];
    setInput(''); setAttachments([]); setIsLoading(true);
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: userText, timestamp: new Date(),
      mediaUrl: currentAttachments.length > 0 ? currentAttachments[0].preview : undefined,
      fileName: currentAttachments.length > 0 ? currentAttachments[0].file.name : undefined,
      type: currentAttachments.length > 0 ? (currentAttachments[0].type.startsWith('image') ? 'image' : 'text') : 'text' };
    setMessages(prev => [...prev, userMsg]);
    const botMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: botMsgId, role: 'model', text: '', timestamp: new Date(), groundingChunks: [] }]);
    try {
      let messagePayload: any = userText;
      if (currentAttachments.length > 0) {
        const parts: any[] = [{ text: userText || "Analyze this." }];
        currentAttachments.forEach(attr => parts.push({ inlineData: { data: attr.base64, mimeType: attr.type } }));
        messagePayload = { parts };
      }
      let fullText = '';
      let allGrounding: any[] = [];
      await sendMessageWithGrounding(chatSession, messagePayload, (chunk, grounding) => {
        fullText += chunk;
        if (grounding) allGrounding = grounding;
        setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: fullText, groundingChunks: allGrounding } : m));
      });
      const imageMatches = Array.from(fullText.matchAll(/\[GENERATE_IMAGE:\s*(.*?)\]/g));
      if (imageMatches.length > 0 && bot?.hasImageGen) {
        setIsGeneratingMedia('image');
        for (const match of imageMatches) {
          try {
            const url = await generateImage(match[1]);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: `Visual asset generated.`, timestamp: new Date(), type: 'image', mediaUrl: url }]);
          } catch (e) {}
        }
        setIsGeneratingMedia(null);
      }
    } catch (e: any) {
      const errorMsg = e.message === 'SYSTEM_BUSY' 
        ? 'Üzgünüz, Gemini API kotası doldu (RESOURCE_EXHAUSTED). Lütfen birkaç dakika bekleyin veya API anahtarınızı kontrol edin.' 
        : 'Bağlantı hatası veya kota aşımı oluştu. Lütfen tekrar deneyin.';
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: errorMsg } : m));
    } finally { setIsLoading(false); }
  };

  function getFilenameFromCode(code: string, lang: string) {
    const firstLine = code.split('\n')[0];
    const match = firstLine.match(/(?:filename|file|name):\s*([a-zA-Z0-9._-]+)/i) || firstLine.match(/\/\/\s*([a-zA-Z0-9._-]+)/);
    if (match) return match[1];
    const extMap: Record<string, string> = { 'html': 'index.html', 'js': 'script.js', 'css': 'style.css' };
    return extMap[lang.toLowerCase()] || `file.${lang || 'txt'}`;
  }

  const handleTransferToManager = (e: React.MouseEvent, msgText: string) => {
    e.stopPropagation();
    const parts = msgText.split(/(```[\s\S]*?```)/g);
    let newFiles: Record<string, string> = {};
    parts.forEach(part => {
      const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
      if (match) {
        const lang = (match[1] || '').toLowerCase(); const content = match[2].trim();
        newFiles[getFilenameFromCode(content, lang)] = content;
      }
    });
    if (Object.keys(newFiles).length > 0) {
      localStorage.setItem('preview_files_' + id, JSON.stringify(newFiles));
      localStorage.setItem('last_active_bot_id', id!);
      navigate('/a/code-manager');
    }
  };

  const handleFullPreview = (e: React.MouseEvent, msgText: string) => {
    e.stopPropagation();
    const match = msgText.match(/```html\n?([\s\S]*?)```/);
    if (match) {
      const blob = new Blob([`<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script></head><body>${match[1].trim()}</body></html>`], { type: 'text/html' });
      window.open(URL.createObjectURL(blob), '_blank');
    }
  };

  const toggleBlock = (blockId: string) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId); else next.add(blockId);
      return next;
    });
  };

  const toggleSources = (msgId: string) => {
    setExpandedSources(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
      return next;
    });
  };

  const confirmReset = () => {
    setMessages([]); localStorage.removeItem(CHAT_STORAGE_KEY); setShowResetModal(false); setIsHeaderMenuOpen(false);
    if (bot) setMessages([{ id: 'init', role: 'model', text: `System reset successful. Ready.`, timestamp: new Date() }]);
  };

  const handleLinkClick = (e: React.MouseEvent, url: string) => {
    // Standard left-click only (no modifiers)
    if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      // Ensure the URL is valid for navigation (prefix with https if Ham starting with www.)
      const formattedUrl = url.startsWith('www.') ? `https://${url}` : url;
      setLinkToConfirm(formattedUrl);
    }
  };

  const renderFormattedLines = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      let content = line;
      let className = "mb-1.5 block";
      if (content.startsWith('### ')) {
        content = content.replace('### ', '');
        className += " font-bold text-black text-[14px]";
      } else if (content.startsWith('## ')) {
        content = content.replace('## ', '');
        className += " font-extrabold text-black text-[15px] border-b border-zinc-50 pb-1 mb-2";
      } else if (content.startsWith('# ')) {
        content = content.replace('# ', '');
        className += " font-black text-black text-[17px] tracking-tight mb-3";
      }
      
      // Better regex to detect Markdown links and standalone URLs
      // 1. Markdown Links: [Title](URL)
      // 2. Ham URLs: http/https or www. (ensuring trailing punctuation is excluded)
      const combinedRegex = /(\*\*.*?\*\*|\*.*?\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|(?:https?:\/\/|www\.)[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+[^\s,<>"]*?(?=[,.!?:;'"\s]|$))/g;
      
      const subparts = content.split(combinedRegex);
      const renderedParts = subparts.map((part, pIdx) => {
        if (!part) return null;
        
        // Bold **text**
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} className="font-bold text-black">{part.slice(2, -2)}</strong>;
        }
        // Italic *text*
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={pIdx} className="font-medium italic text-zinc-800">{part.slice(1, -1)}</em>;
        }
        // Markdown Link [Title](URL)
        if (part.startsWith('[') && part.includes('](')) {
          const match = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
          if (match) {
            const title = match[1];
            const url = match[2];
            return (
              <a 
                key={pIdx} 
                href={url} 
                onClick={(e) => handleLinkClick(e, url)}
                className="text-indigo-600 hover:text-indigo-500 font-bold underline decoration-indigo-200 underline-offset-4 transition-colors mx-0.5"
              >
                {title}
              </a>
            );
          }
        }
        // Ham URL
        if (part.startsWith('http://') || part.startsWith('https://') || part.startsWith('www.')) {
          const href = part.startsWith('www.') ? `https://${part}` : part;
          return (
            <a 
              key={pIdx} 
              href={href} 
              onClick={(e) => handleLinkClick(e, part)}
              className="text-indigo-600 hover:text-indigo-500 font-bold underline decoration-indigo-200 underline-offset-4 transition-colors mx-0.5 inline-block truncate max-w-[280px] align-bottom"
            >
              {part}
            </a>
          );
        }
        return part;
      });
      return <span key={idx} className={className}>{renderedParts}</span>;
    });
  };

  const renderSources = (msg: Message) => {
    if (!msg.groundingChunks || msg.groundingChunks.length === 0) return null;
    
    const seenUris = new Set();
    const uniqueSources = msg.groundingChunks.filter(chunk => {
      const uri = chunk.web?.uri || chunk.maps?.uri;
      if (uri && !seenUris.has(uri)) {
        seenUris.add(uri);
        return true;
      }
      return false;
    });

    if (uniqueSources.length === 0) return null;
    const isExpanded = expandedSources.has(msg.id);

    return (
      <div className="mt-6 pt-4 border-t border-zinc-50 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <button 
          onClick={() => toggleSources(msg.id)}
          className="flex items-center gap-2 mb-3 group/sources-btn"
        >
          <div className={`w-1.5 h-1.5 rounded-full transition-colors ${isExpanded ? 'bg-indigo-500' : 'bg-zinc-200'}`}></div>
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] group-hover/sources-btn:text-black transition-colors">Bilgi Kaynakları ({uniqueSources.length})</span>
          <svg className={`w-3 h-3 text-zinc-300 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isExpanded && (
          <div className="flex flex-wrap gap-2 animate-in slide-in-from-top-2 duration-300">
            {uniqueSources.map((chunk, idx) => {
              const source = chunk.web || chunk.maps;
              if (!source) return null;
              return (
                <a
                  key={idx}
                  href={source.uri}
                  onClick={(e) => handleLinkClick(e, source.uri)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-100 rounded-lg hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group/source"
                >
                  <svg className="w-3 h-3 text-zinc-400 group-hover/source:text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  <span className="text-[10px] font-bold text-zinc-600 truncate max-w-[150px]">{source.title || 'Kaynak'}</span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const cleanAndFormatText = (text: string) => {
    if (!text) return null;
    return <React.Fragment>{renderFormattedLines(text)}</React.Fragment>;
  };

  const handleShareMedia = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], `gemini-hub-artifact-${Date.now()}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'GeminiHub Media',
          text: 'Check out this AI-generated asset from GeminiHub.',
        });
      } else if (navigator.share) {
        await navigator.share({
          title: 'GeminiHub Media',
          text: 'Check out this AI-generated asset from GeminiHub.',
          url: url
        });
      } else {
        throw new Error('Web Share not supported');
      }
    } catch (err) {
      await copyToClipboard(url);
      alert("Bağlantı kopyalandı.");
    }
  };

  const renderMessageContent = (msg: Message) => {
    const safeText = msg.text || '';
    if (!safeText && isLoading && msg.role === 'model') return <span className="animate-pulse text-zinc-300">...</span>;
    const cleanText = safeText.replace(/\[GENERATE_(IMAGE|VIDEO):\s*.*?\]/g, '').trim();
    const parts = cleanText.split(/(```[\s\S]*?```)/g);
    return (
      <div className="space-y-4">
        {msg.role === 'user' && msg.mediaUrl && (
          <div className="mb-4 rounded-xl overflow-hidden border border-zinc-100 max-w-[160px] shadow-sm">
            {msg.type === 'image' ? <img src={msg.mediaUrl} className="w-full h-auto" /> : <div className="p-3 bg-zinc-50 text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">Attachment</div>}
          </div>
        )}
        {cleanText && parts.map((part, index) => {
          const codeMatch = part.match(/```(\w+)?\n?([\s\S]*?)```/);
          if (codeMatch) {
            const lang = codeMatch[1] || 'code'; const code = codeMatch[2].trim();
            const blockId = `${msg.id}-${index}`; const isExpanded = expandedBlocks.has(blockId);
            const filename = getFilenameFromCode(code, lang);
            return (
              <div key={index} className="my-5 border border-zinc-100 rounded-[11px] overflow-hidden bg-white group transition-all">
                <div onClick={() => toggleBlock(blockId)} className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-500 group-hover:bg-black group-hover:text-white transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
                    <h4 className="text-[12px] font-bold text-zinc-900">{filename}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={async (e) => { e.stopPropagation(); const ok = await copyToClipboard(code); if (ok) { setCopiedId(blockId); setTimeout(() => setCopiedId(null), 2000); } }} className="p-1.5 text-zinc-500 hover:text-black">
                      {copiedId === blockId ? <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const blob = new Blob([code], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="p-1.5 text-zinc-500 hover:text-black"
                      title="Download"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                    </button>
                    <div className={`transition-transform duration-300 ml-1 ${isExpanded ? 'rotate-180' : ''}`}><svg className="w-4 h-4 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M19 9l-7 7-7-7" /></svg></div>
                  </div>
                </div>
                {isExpanded && <div className="border-t border-zinc-100 bg-zinc-50/30 p-6 font-mono text-[12px] overflow-x-auto custom-scrollbar leading-relaxed"><code>{code}</code></div>}
              </div>
            );
          }
          return <div key={index} className="leading-relaxed">{cleanAndFormatText(part)}</div>;
        })}
        {msg.role === 'model' && renderSources(msg)}
        {msg.role === 'model' && msg.mediaUrl && (
          <div className="mt-4 rounded-2xl overflow-hidden border border-zinc-100 shadow-xl max-w-lg bg-zinc-50 group/media relative">
            {msg.type === 'image' ? (
              <div className="relative group/img-overlay">
                <img src={msg.mediaUrl} className="w-full h-auto" />
                <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover/img-overlay:opacity-100 transition-opacity">
                  <button 
                    onClick={() => {
                      const l = document.createElement('a');
                      l.href = msg.mediaUrl!;
                      l.download = `gemini-hup-img-${Date.now()}.png`;
                      l.click();
                    }}
                    className="w-9 h-9 bg-black/50 backdrop-blur-md text-white rounded-xl flex items-center justify-center hover:bg-black transition-all shadow-xl"
                    title="İndir"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => handleShareMedia(msg.mediaUrl!)}
                    className="w-9 h-9 bg-black/50 backdrop-blur-md text-white rounded-xl flex items-center justify-center hover:bg-black transition-all shadow-xl"
                    title="Paylaş"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <video src={msg.mediaUrl} controls className="w-full h-auto" />
            )}
          </div>
        )}
      </div>
    );
  };

  if (!bot) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white overflow-hidden relative view-fade">
      <header className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-md z-[100]">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/a/dashboard')} className="w-9 h-9 flex items-center justify-center border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-all shadow-sm text-zinc-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M15 19l-7-7 7-7" /></svg></button>
          <div className="relative" ref={botSwitcherRef}>
            <button onClick={() => setIsBotSwitcherOpen(!isBotSwitcherOpen)} className="flex items-center gap-3 px-3 py-1.5 rounded-xl hover:bg-zinc-50 transition-all group">
              <div className="relative w-7 h-7">
                <img src={bot.avatar} className={`w-full h-full rounded-lg border border-zinc-100 shadow-sm transition-opacity ${isLoading ? 'opacity-0' : 'opacity-100'}`} alt="" />
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-4 h-4 animate-spin text-black" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-start"><h2 className="text-[13px] font-black text-zinc-900 leading-none">{bot.name}</h2></div>
              <svg className={`w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-700 transition-transform ${isBotSwitcherOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M19 9l-7 7-7-7" /></svg>
            </button>
            {isBotSwitcherOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-zinc-100 rounded-[20px] shadow-2xl z-[110] overflow-hidden p-2 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex p-1 bg-zinc-100 rounded-xl mb-2">
                  <button onClick={() => setSwitcherTab('models')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg ${switcherTab === 'models' ? 'bg-white text-black' : 'text-zinc-500'}`}>Model</button>
                  <button onClick={() => setSwitcherTab('assistants')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg ${switcherTab === 'assistants' ? 'bg-white text-black' : 'text-zinc-500'}`}>Asistan</button>
                </div>
                <div className="space-y-1 max-h-[320px] overflow-y-auto custom-scrollbar">
                  {switcherTab === 'models' ? (
                    <>
                      {GEMINI_MODELS.map((m) => (
                        <button key={m.id} onClick={() => { setSelectedModel(m.id); setIsBotSwitcherOpen(false); }} className={`w-full flex items-center gap-3 p-2.5 rounded-xl ${m.id === selectedModel ? 'bg-zinc-50' : ''}`}>
                          <img src={m.avatar} className={`w-7 h-7 rounded-lg border border-zinc-100 ${m.id !== selectedModel ? 'grayscale opacity-60' : ''}`} alt="" />
                          <div className="flex-1 min-w-0 text-left"><p className={`text-[11px] font-bold truncate ${m.id === selectedModel ? 'text-black' : 'text-zinc-500'}`}>{m.name}</p><p className="text-[9px] text-zinc-400 font-medium truncate">{m.desc}</p></div>
                        </button>
                      ))}
                      <button 
                        onClick={() => { (window as any).aistudio?.openSelectKey(); setIsBotSwitcherOpen(false); }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-dashed border-zinc-200 mt-1 hover:bg-zinc-50 transition-all group"
                      >
                        <div className="w-7 h-7 rounded-lg border border-zinc-100 flex items-center justify-center text-zinc-400 group-hover:text-black">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>
                        </div>
                        <span className="text-[11px] font-bold text-zinc-500 group-hover:text-black">API key ekle</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {bots.map((b) => (
                        <button key={b.id} onClick={() => { navigate(`/a/test/${b.id}`); }} className={`w-full flex items-center gap-3 p-2.5 rounded-xl ${b.id === id ? 'bg-zinc-50' : ''}`}>
                          <img src={b.avatar} className={`w-7 h-7 rounded-lg border border-zinc-100 ${b.id !== id ? 'grayscale opacity-60' : ''}`} alt="" />
                          <div className="flex-1 min-w-0 text-left"><p className={`text-[11px] font-bold truncate ${b.id === id ? 'text-black' : 'text-zinc-500'}`}>{b.name}</p></div>
                        </button>
                      ))}
                      <button 
                        onClick={() => { navigate('/a/editor/new'); setIsBotSwitcherOpen(false); }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-dashed border-zinc-200 mt-1 hover:bg-zinc-50 transition-all group"
                      >
                        <div className="w-7 h-7 rounded-lg border border-zinc-100 flex items-center justify-center text-zinc-400 group-hover:text-black">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M12 4.5v15m7.5-7.5h-15" /></svg>
                        </div>
                        <span className="text-[11px] font-bold text-zinc-500 group-hover:text-black">asistan oluştur</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="relative" ref={headerMenuRef}>
          <button onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)} className="w-9 h-9 flex items-center justify-center text-zinc-600 hover:text-black"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" /></svg></button>
          {isHeaderMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-zinc-100 rounded-xl shadow-xl z-[110] overflow-hidden">
              <button onClick={() => { setIsProjectPanelOpen(true); setIsHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-[11px] font-bold text-zinc-600 hover:bg-zinc-50 transition-colors">
                <div className="w-4 flex flex-col gap-[2.5px] shrink-0">
                  <div className="h-[1.2px] bg-zinc-600 rounded-full"></div>
                  <div className="h-[1.2px] bg-zinc-600 rounded-full"></div>
                  <div className="h-[1.2px] bg-zinc-600 rounded-full"></div>
                </div>
                Proje Paneli
              </button>
              <button onClick={handlePinChat} className="w-full flex items-center gap-3 px-4 py-3 text-left text-[11px] font-bold text-zinc-600 hover:bg-zinc-50 transition-colors">
                {headerMenuAction === 'pin' ? <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>}Sohbeti Sabitle
              </button>
              <button onClick={handleExportFullChatPDF} className="w-full flex items-center gap-3 px-4 py-3 text-left text-[11px] font-bold text-zinc-600 hover:bg-zinc-50 transition-colors">
                {headerMenuAction === 'pdf' ? <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}PDF İndir
              </button>
              <div className="h-[1px] bg-zinc-50 mx-2"></div>
              <button onClick={() => { setShowResetModal(true); setIsHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-[11px] font-bold text-red-500 hover:bg-zinc-50 transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>Sohbeti Sil</button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex min-h-0 relative">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-12 lg:px-32 py-8 space-y-8 custom-scrollbar bg-white">
          {messages.map((msg) => {
            const isCopied = copiedMsgId === msg.id; const isMenuOpen = activeMenuId === msg.id;
            const isLatestModelMsg = isLoading && msg.role === 'model' && messages[messages.length - 1].id === msg.id;
            return (
              <div key={msg.id} className="max-w-4xl mx-auto space-y-2 relative group/msg animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[9px] font-bold uppercase tracking-[0.15em] ${msg.role === 'user' ? 'text-zinc-500' : 'text-black font-black'}`}>{msg.role === 'user' ? 'User Identity' : bot.name}</span>
                  <div className="w-1 h-1 rounded-full bg-zinc-200"></div>
                  <span className="text-[9px] text-zinc-400 font-bold">{msg.timestamp.toLocaleTimeString()}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={() => handleSaveToPano(msg.text)} className="p-1 rounded-md transition-all opacity-0 group-hover/msg:opacity-100 text-zinc-500 hover:text-indigo-600 hover:bg-zinc-50" title="Panoya Kaydet"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg></button>
                    <button onClick={() => handleCopyMessage(msg.text, msg.id)} className={`p-1 rounded-md transition-all opacity-0 group-hover/msg:opacity-100 ${isCopied ? 'text-green-600' : 'text-zinc-500 hover:text-black'}`}>
                      {isCopied ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                    </button>
                    <div className="relative" ref={isMenuOpen ? menuRef : null}>
                      <button onClick={() => setActiveMenuId(isMenuOpen ? null : msg.id)} className={`p-1 rounded-md transition-all opacity-0 group-hover/msg:opacity-100 ${isMenuOpen ? 'text-black bg-zinc-50' : 'text-zinc-500 hover:text-black'}`}><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg></button>
                      {isMenuOpen && <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-zinc-100 rounded-xl shadow-xl z-[110] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200"><button onClick={() => handleExportPDF(msg)} className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-[11px] font-bold text-zinc-600 hover:bg-zinc-50 transition-colors"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>PDF aktar</button></div>}
                    </div>
                  </div>
                </div>
                <div className="text-zinc-700 text-[13px] font-medium leading-relaxed">
                  {renderMessageContent(msg)}
                </div>
                {msg.text?.includes('```') && bot.canPreviewCode && (
                    <div className="mt-6 p-3 border border-zinc-200 rounded-[11px] flex items-center justify-between bg-zinc-50/40 hover:bg-zinc-50 transition-all group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 flex items-center justify-center text-black shrink-0 transition-transform group-hover:scale-110">
                          {isLatestModelMsg ? (
                            <svg className="w-4 h-4 animate-spin text-black" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-[11.5px] font-semibold text-black truncate tracking-tight">{bot.name} Artifact</h4>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={(e) => handleTransferToManager(e, msg.text)} className="px-3 py-1.5 text-zinc-500 hover:text-black rounded-lg text-[10px] font-semibold hover:bg-white border border-transparent hover:border-zinc-200 transition-all active:scale-95">Manager</button>
                        {msg.text.includes('```html') && (
                          <button onClick={(e) => handleFullPreview(e, msg.text)} className="px-4 py-2 bg-black text-white rounded-lg text-[10px] font-semibold shadow-md hover:bg-zinc-800 transition-all active:scale-95 flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>Preview</button>
                        )}
                      </div>
                    </div>
                )}
              </div>
            );
          })}
          {isGeneratingMedia && <div className="max-w-4xl mx-auto"><div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3 max-w-sm"><div className="w-10 h-10 border-4 border-zinc-200 border-t-black rounded-full animate-spin"></div><p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Üretiliyor...</p></div></div>}
        </div>
        <aside className={`absolute top-0 right-0 h-full w-80 bg-zinc-50 border-l border-zinc-100 transition-transform duration-500 ease-in-out z-[90] shadow-2xl flex flex-col ${isProjectPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex flex-col h-full overflow-hidden">
            <div className="px-6 py-4 bg-white border-b border-zinc-100 flex items-center justify-between shrink-0">
               <div className="flex items-center gap-3">
                 <button onClick={() => setActivePanelTab('files')} className={`p-2 rounded-xl transition-all ${activePanelTab === 'files' ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-100'}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg></button>
                 <button onClick={() => setActivePanelTab('images')} className={`p-2 rounded-xl relative transition-all ${activePanelTab === 'images' ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-100'}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>{generatedImages.length > 0 && activePanelTab !== 'images' && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-zinc-50">{generatedImages.length}</span>}</button>
                 <button onClick={() => setActivePanelTab('pano')} className={`p-2 rounded-xl relative transition-all ${activePanelTab === 'pano' ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-100'}`} title="Kopyalanabilir Pano"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>{panoNotes.length > 0 && activePanelTab !== 'pano' && <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-zinc-50">{panoNotes.length}</span>}</button>
               </div>
               <button onClick={() => setIsProjectPanelOpen(false)} className="p-1 text-zinc-500 hover:text-black"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {activePanelTab === 'files' ? (
                <div className="space-y-6">{projectGroups.length === 0 ? <div className="text-center py-10"><p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Kod bulunamadı.</p></div> : projectGroups.map((group) => <div key={group.id} className="space-y-3"><div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden shadow-sm">{Object.keys(group.files).map((fileName) => <div key={fileName} onClick={() => { localStorage.setItem('preview_files_' + id, JSON.stringify(group.files)); localStorage.setItem('last_active_bot_id', id!); navigate('/a/code-manager'); }} className="w-full flex items-center justify-between p-3.5 hover:bg-zinc-50 border-b border-zinc-50 last:border-b-0 text-left cursor-pointer group/file transition-all"><span className="text-[11px] font-bold text-zinc-800 truncate">{fileName}</span><svg className="w-3.5 h-3.5 text-zinc-200 group-hover/file:text-black transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M9 5l7 7-7 7" /></svg></div>)}</div></div>)}</div>
              ) : activePanelTab === 'images' ? (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-300">{generatedImages.length === 0 ? <div className="col-span-2 text-center py-10"><p className="text-[10px] font-bold text-zinc-400 uppercase">Görsel bulunamadı.</p></div> : generatedImages.map((img) => (
                  <div key={img.id} onClick={() => setFullScreenImage(img.url)} className="relative aspect-square rounded-xl overflow-hidden group/gallery bg-white border border-zinc-100 shadow-sm cursor-pointer hover:border-zinc-300 transition-all">
                    <img src={img.url} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover/gallery:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-8 h-8 bg-white/90 rounded-lg flex items-center justify-center text-black shadow-lg">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                      </div>
                    </div>
                  </div>
                ))}</div>
              ) : (
                <div className="space-y-3 animate-in fade-in duration-300">
                  <div className="flex flex-col items-center justify-center py-8 mb-4 border-b border-zinc-50">
                    <button 
                      onClick={() => setIsNoteModalOpen(true)}
                      className="group w-12 h-12 rounded-2xl border border-zinc-100 bg-white flex items-center justify-center text-zinc-300 hover:text-black hover:border-zinc-200 hover:bg-zinc-50 transition-all active:scale-95 shadow-sm"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </button>
                    <span className="text-[10px] font-medium text-zinc-400 mt-3 text-center px-4">Yeni not ekleyin veya yapıştırın</span>
                  </div>
                  
                  {panoNotes.length === 0 ? <div className="text-center py-10"><p className="text-[10px] font-bold text-zinc-400 uppercase">Not kaydı yok.</p></div> : panoNotes.map((s) => (
                    <div key={s.id} className="p-4 bg-white border border-zinc-100 rounded-2xl shadow-sm space-y-3 group/note">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${s.source === 'bot' ? 'bg-indigo-50 text-indigo-500' : 'bg-zinc-50 text-zinc-500'}`}>
                            {s.source === 'bot' ? (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            ) : (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            )}
                          </div>
                          <span className="text-[9px] text-zinc-400 font-black">{s.timestamp.toLocaleTimeString()}</span>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover/note:opacity-100">
                          <button onClick={async () => { const ok = await copyToClipboard(s.text); if (ok) { setCopiedId(s.id); setTimeout(() => setCopiedId(null), 2000); } }} className={`p-1 rounded ${copiedId === s.id ? 'text-green-500' : 'text-zinc-500 hover:text-black'}`}>{copiedId === s.id ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}</button>
                          <button onClick={() => setPanoNotes(prev => prev.filter(item => item.id !== s.id))} className="p-1 rounded text-zinc-500 hover:text-red-500"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                      </div>
                      <p className="text-[11px] font-medium text-zinc-800 line-clamp-6 leading-relaxed whitespace-pre-wrap italic selection:bg-indigo-100">{s.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
      <footer className="shrink-0 bg-white border-t border-zinc-100 p-4 md:p-6 z-[100] relative">
        <div className="max-w-4xl mx-auto">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4 px-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {attachments.map((attr, index) => (
                <div key={index} className="relative group w-14 h-14 border border-zinc-200 rounded-xl overflow-hidden bg-zinc-50 shadow-sm transition-all hover:border-zinc-400">
                  {attr.type.startsWith('image') ? <img src={attr.preview} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-400 font-bold text-[8px] uppercase">File</div>}
                  <button onClick={() => removeAttachment(index)} className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/90 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
              ))}
            </div>
          )}
          <div className="relative border border-zinc-200 rounded-2xl bg-white p-4 transition-all focus-within:border-black shadow-sm group">
            <textarea ref={textareaRef} rows={1} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Query intelligence..." className="w-full bg-transparent outline-none text-[14px] font-medium text-zinc-800 placeholder:text-zinc-300 resize-none min-h-[44px] max-h-[200px] mb-2 custom-scrollbar leading-relaxed" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 pl-1 relative" ref={attachmentMenuRef}>
                <button onClick={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)} className="text-zinc-500 hover:text-black transition-all p-1" title="Dosya Ekle"><svg className="w-[16px] h-[16px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg></button>
                {isAttachmentMenuOpen && <div className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-zinc-100 rounded-xl shadow-xl z-[120] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150"><button onClick={() => { cameraInputRef.current?.click(); setIsAttachmentMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-[11px] font-bold text-zinc-600 hover:bg-zinc-50 transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>Kamera</button><button onClick={() => { fileInputRef.current?.click(); setIsAttachmentMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-[11px] font-bold text-zinc-600 hover:bg-zinc-50 transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Medya Ekle</button></div>}
                <button onClick={toggleListening} className={`transition-all p-1 ${isListening ? 'text-red-600 animate-pulse' : 'text-zinc-500 hover:text-black'}`}><svg className="w-[16px] h-[16px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg></button>
              </div>
              <button onClick={send} disabled={isLoading || (!input.trim() && attachments.length === 0)} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-95 shrink-0 ${input.trim() || attachments.length > 0 ? 'bg-black text-white shadow-lg' : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M12 19V5M5 12l7-7 7 7" /></svg></button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple accept="*/*" />
            <input type="file" ref={cameraInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" capture="environment" />
          </div>
        </div>
      </footer>

      {isNoteModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-100 rounded-[32px] p-8 max-w-[500px] w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black tracking-tight text-black">Yeni Not</h3>
              <button onClick={() => setIsNoteModalOpen(false)} className="p-2 hover:bg-zinc-50 rounded-full transition-colors text-zinc-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <textarea 
              autoFocus
              value={manualNoteText}
              onChange={(e) => setManualNoteText(e.target.value)}
              placeholder="Notunuzu buraya yazın veya yapıştırın..."
              className="w-full h-48 bg-zinc-50 border border-zinc-100 rounded-2xl p-5 text-[14px] font-medium text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all resize-none custom-scrollbar"
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setIsNoteModalOpen(false)}
                className="flex-1 px-6 py-4 border border-zinc-100 text-zinc-500 rounded-2xl text-[12px] font-bold hover:bg-zinc-50 transition-all"
              >
                İptal
              </button>
              <button 
                onClick={() => { handleManualNoteSave(); setIsNoteModalOpen(false); }}
                disabled={!manualNoteText.trim()}
                className={`flex-1 px-6 py-4 rounded-2xl text-[12px] font-bold transition-all shadow-xl ${
                  manualNoteText.trim() ? 'bg-black text-white hover:bg-zinc-800 shadow-zinc-200' : 'bg-zinc-100 text-zinc-300 cursor-not-allowed'
                }`}
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-zinc-950/20 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border rounded-[28px] p-8 max-w-[380px] w-full text-center space-y-7 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-extrabold tracking-tight text-black">Sohbeti sıfırla?</h3>
            <p className="text-[12px] text-zinc-500 font-medium leading-relaxed">Etkileşim geçmişiniz kalıcı olarak silinecek.</p>
            <div className="flex gap-3"><button onClick={() => setShowResetModal(false)} className="flex-1 px-6 py-3 border border-zinc-100 text-zinc-600 rounded-xl text-[11px] font-bold hover:bg-zinc-50 transition-all">Vazgeç</button><button onClick={confirmReset} className="flex-1 px-6 py-3 bg-black text-white rounded-xl text-[11px] font-bold active:scale-95 shadow-xl">Sıfırla</button></div>
          </div>
        </div>
      )}

      {fullScreenImage && (
        <div className="fixed inset-0 z-[300] bg-black/95 flex flex-col animate-in fade-in duration-300">
          <header className="p-6 flex items-center justify-between z-10 shrink-0">
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  const l = document.createElement('a');
                  l.href = fullScreenImage;
                  l.download = `gemini-hub-artifact-${Date.now()}.png`;
                  l.click();
                }}
                className="w-11 h-11 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center transition-all backdrop-blur-md"
                title="İndir"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
              </button>
              <button 
                onClick={() => handleShareMedia(fullScreenImage)}
                className="w-11 h-11 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center transition-all backdrop-blur-md"
                title="Paylaş"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" /></svg>
              </button>
            </div>
            <button 
              onClick={() => setFullScreenImage(null)}
              className="w-11 h-11 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center transition-all backdrop-blur-md"
              title="Kapat"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </header>
          <div className="flex-1 flex items-center justify-center p-4 min-h-0">
            <img src={fullScreenImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300" alt="Preview" />
          </div>
        </div>
      )}

      {linkToConfirm && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-100 rounded-[32px] p-8 max-w-[440px] w-full shadow-2xl space-y-7 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black tracking-tight text-black leading-tight">Harici Bağlantı Onayı</h3>
                <p className="text-[13px] text-zinc-500 font-medium leading-relaxed">
                  Güvenliğiniz için ayrılmadan önce onayınızı istiyoruz. Aşağıdaki adrese yönlendirileceksiniz:
                </p>
              </div>
              <div className="w-full p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                <p className="text-[11px] font-mono font-bold text-indigo-600 break-all">{linkToConfirm}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setLinkToConfirm(null)}
                className="flex-1 px-6 py-4 border border-zinc-100 text-zinc-600 rounded-2xl text-[12px] font-bold hover:bg-zinc-50 transition-all"
              >
                Vazgeç
              </button>
              <button 
                onClick={() => {
                  window.open(linkToConfirm, '_blank', 'noopener,noreferrer');
                  setLinkToConfirm(null);
                }}
                className="flex-1 px-6 py-4 bg-black text-white rounded-2xl text-[12px] font-bold hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-100"
              >
                Siteye Git
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

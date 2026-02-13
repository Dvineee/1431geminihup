import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bot } from '../types.ts';

interface BotEditorProps {
  bots: Bot[];
  onUpdate: (bot: Bot) => void;
  onAdd: (bot: Bot) => void;
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
}

const BotEditor: React.FC<BotEditorProps> = ({ bots, onUpdate, onAdd, isSidebarOpen, onOpenSidebar }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const [activeTab, setActiveTab] = useState<'model' | 'capabilities' | 'advanced'>('model');

  const [formData, setFormData] = useState<Bot>({
    id: Math.random().toString(36).substr(2, 9),
    name: '',
    description: '',
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${Math.random()}&backgroundColor=f4f4f5`,
    status: 'active',
    systemInstruction: '',
    knowledgeBase: [],
    usageCount: 0,
    lastActive: new Date().toISOString(),
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    canPreviewCode: true,
    hasImageGen: false,
    hasAudioGen: false,
    hasVideoGen: false,
    hasSearchGrounding: false,
    hasLiveVoice: false,
    contactEmail: '',
    website: '',
    otherInfo: ''
  });

  useEffect(() => {
    if (!isNew) {
      const existing = bots.find(b => b.id === id);
      if (existing) setFormData(existing);
    }
  }, [id, bots, isNew]);

  const save = () => {
    if (!formData.name.trim()) return;
    if (isNew) onAdd(formData);
    else onUpdate(formData);
    navigate('/a/dashboard');
  };

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
          <div>
            <h1 className="text-xl font-bold tracking-tight">{isNew ? 'New Assistant' : formData.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/a/dashboard')} className="px-3 py-1.5 text-xs font-bold text-zinc-400 hover:text-zinc-900 transition-colors">Cancel</button>
          <button onClick={save} className="px-5 py-2 bg-black text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all shadow-md">Save Changes</button>
        </div>
      </header>

      <div className="px-6 py-3 bg-zinc-50/50 border-b border-zinc-100 shrink-0">
        <div className="flex bg-zinc-100 p-1 rounded-xl w-fit border border-zinc-100 shadow-sm">
          {[
            { id: 'model', label: 'Identity' },
            { id: 'capabilities', label: 'Skills' },
            { id: 'advanced', label: 'Parameters' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-2 ${
                activeTab === tab.id ? 'bg-white shadow-sm text-black' : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-8">
          {activeTab === 'model' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Name</label>
                  <input 
                    type="text" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    className="w-full px-4 py-2 border border-zinc-200 rounded-xl outline-none focus:border-black text-sm font-medium transition-all"
                    placeholder="Assistant Name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Logo URL</label>
                  <input 
                    type="text" 
                    value={formData.avatar} 
                    onChange={e => setFormData({...formData, avatar: e.target.value})} 
                    className="w-full px-4 py-2 border border-zinc-200 rounded-xl outline-none focus:border-black text-sm font-medium transition-all"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Description</label>
                <textarea 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                  className="w-full px-4 py-2 border border-zinc-200 rounded-xl outline-none focus:border-black text-sm font-medium h-16 resize-none transition-all"
                  placeholder="Short summary..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-zinc-100 pt-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Support Email</label>
                  <input 
                    type="email" 
                    value={formData.contactEmail || ''} 
                    onChange={e => setFormData({...formData, contactEmail: e.target.value})} 
                    className="w-full px-4 py-2 border border-zinc-200 rounded-xl outline-none focus:border-black text-sm font-medium transition-all"
                    placeholder="support@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Website</label>
                  <input 
                    type="text" 
                    value={formData.website || ''} 
                    onChange={e => setFormData({...formData, website: e.target.value})} 
                    className="w-full px-4 py-2 border border-zinc-200 rounded-xl outline-none focus:border-black text-sm font-medium transition-all"
                    placeholder="https://example.com"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Additional Support Info</label>
                  <textarea 
                    value={formData.otherInfo || ''} 
                    onChange={e => setFormData({...formData, otherInfo: e.target.value})} 
                    className="w-full px-4 py-2 border border-zinc-200 rounded-xl outline-none focus:border-black text-sm font-medium h-20 resize-none transition-all"
                    placeholder="Operating hours, specific contact persons, etc..."
                  />
                </div>
              </div>

              <div className="space-y-2 border-t border-zinc-100 pt-6">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">System Instruction</label>
                <textarea 
                  value={formData.systemInstruction} 
                  onChange={e => setFormData({...formData, systemInstruction: e.target.value})} 
                  className="w-full p-4 h-64 border border-zinc-200 rounded-xl outline-none focus:border-black text-sm font-mono bg-zinc-50/30 transition-all"
                  placeholder="Define behavior..."
                />
              </div>
            </div>
          )}

          {activeTab === 'capabilities' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
               {[
                { key: 'hasSearchGrounding', label: 'Web Access', desc: 'Real-time Search.' },
                { key: 'canPreviewCode', label: 'Bob Preview', desc: 'Live HTML Rendering.' },
                { key: 'hasImageGen', label: 'Imagen 4', desc: 'Visual Generation.' },
                { key: 'hasLiveVoice', label: 'Realtime Voice', desc: 'Native Multimodal.' },
              ].map(cap => (
                <div 
                  key={cap.key}
                  onClick={() => setFormData({...formData, [cap.key]: !formData[cap.key as keyof Bot]})}
                  className={`p-4 border rounded-xl cursor-pointer flex items-center justify-between transition-all ${formData[cap.key as keyof Bot] ? 'border-black bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'}`}
                >
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-bold">{cap.label}</h4>
                    <p className="text-[10px] text-zinc-400 font-medium">{cap.desc}</p>
                  </div>
                  <div className={`w-8 h-4 rounded-full relative transition-all ${formData[cap.key as keyof Bot] ? 'bg-black' : 'bg-zinc-200'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${formData[cap.key as keyof Bot] ? 'left-4.5' : 'left-0.5'}`}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {activeTab === 'advanced' && (
             <div className="max-w-md space-y-6">
                <div className="space-y-4 p-4 border border-zinc-100 rounded-xl">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Temperature</label>
                      <span className="text-xs font-black text-black">{formData.temperature}</span>
                    </div>
                    <input 
                      type="range" min="0" max="2" step="0.1" 
                      value={formData.temperature} 
                      onChange={e => setFormData({...formData, temperature: parseFloat(e.target.value)})}
                      className="w-full h-1 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-black"
                    />
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BotEditor;
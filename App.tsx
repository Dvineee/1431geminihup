import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar.tsx';
import LandingPage from './views/LandingPage.tsx';
import Dashboard from './views/Dashboard.tsx';
import BotEditor from './views/BotEditor.tsx';
import LiveTest from './views/LiveTest.tsx';
import Analytics from './views/Analytics.tsx';
import CodeManager from './views/CodeManager.tsx';
import CodePreview from './views/CodePreview.tsx';
import { Bot } from './types.ts';

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [bots, setBots] = useState<Bot[]>(() => {
    const saved = localStorage.getItem('geminihub_bots');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [
      {
        id: 'default-bot',
        name: 'Gemini Technical Studio',
        description: 'Elite architecture and engineering intelligence assistant.',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=studio&backgroundColor=f4f4f5',
        status: 'active',
        systemInstruction: 'You are a senior principal engineer. Focus on clean code and system design.',
        knowledgeBase: [],
        usageCount: 1240,
        lastActive: new Date().toISOString(),
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        canPreviewCode: true,
        hasImageGen: true,
        hasAudioGen: false,
        hasVideoGen: true,
        hasSearchGrounding: true,
        hasLiveVoice: true
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('geminihub_bots', JSON.stringify(bots));
  }, [bots]);

  const handleAddBot = (bot: Bot) => setBots(prev => [...prev, bot]);
  const handleUpdateBot = (bot: Bot) => setBots(prev => prev.map(b => b.id === bot.id ? bot : b));
  const handleDeleteBot = (id: string) => setBots(prev => prev.filter(b => b.id !== id));

  return (
    <Router>
      <div className="flex h-screen w-full bg-white text-zinc-900 overflow-hidden relative">
        <Sidebar isOpen={isSidebarOpen} onToggle={setIsSidebarOpen} />
        
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/a/dashboard" element={
              <Dashboard 
                bots={bots} 
                onDelete={handleDeleteBot} 
                isSidebarOpen={isSidebarOpen} 
                onOpenSidebar={() => setIsSidebarOpen(true)} 
              />
            } />
            <Route path="/a/editor/:id" element={
              <BotEditor 
                bots={bots} 
                onAdd={handleAddBot} 
                onUpdate={handleUpdateBot} 
                isSidebarOpen={isSidebarOpen} 
                onOpenSidebar={() => setIsSidebarOpen(true)} 
              />
            } />
            <Route path="/a/test/:id" element={
              <LiveTest 
                bots={bots} 
                isSidebarOpen={isSidebarOpen} 
                onOpenSidebar={() => setIsSidebarOpen(true)} 
              />
            } />
            <Route path="/a/analytics" element={
              <Analytics 
                bots={bots} 
                isSidebarOpen={isSidebarOpen} 
                onOpenSidebar={() => setIsSidebarOpen(true)} 
              />
            } />
            <Route path="/a/code-manager" element={
              <CodeManager 
                bots={bots} 
                onOpenSidebar={() => setIsSidebarOpen(true)} 
              />
            } />
            <Route path="/a/preview/:id" element={<CodePreview bots={bots} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;

import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage: React.FC = () => {
  return (
    <div className="w-full min-h-screen bg-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-zinc-100 z-50">
        <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white font-bold">G</div>
            <span className="font-bold text-xl tracking-tight text-black">GeminiHub</span>
          </div>
          <div className="flex items-center gap-8">
            <Link to="/a/dashboard" className="text-sm font-semibold text-zinc-500 hover:text-black transition-colors">Sign in</Link>
            <Link to="/a/dashboard" className="px-6 py-2.5 bg-black text-white text-sm font-bold rounded-xl hover:bg-zinc-800 transition-all shadow-sm">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-40 pb-32">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="max-w-4xl space-y-12">
            <div className="inline-flex items-center px-4 py-1.5 bg-zinc-50 border border-zinc-100 rounded-full text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              Powered by Google Gemini 2.5
            </div>
            <h1 className="text-7xl md:text-9xl font-extrabold tracking-tighter text-black leading-[0.9]">
              Engineering <br />
              <span className="text-zinc-200">the future of AI.</span>
            </h1>
            <p className="text-2xl text-zinc-500 font-medium max-w-2xl leading-relaxed">
              Build, test and deploy professional AI assistants with a minimalist studio designed for engineering excellence.
            </p>
            <div className="flex flex-wrap items-center gap-6 pt-6">
              <Link to="/a/dashboard" className="px-12 py-5 bg-black text-white rounded-2xl font-bold text-xl hover:bg-zinc-800 transition-all shadow-2xl shadow-zinc-200 active:scale-95">
                Launch Studio
              </Link>
              <button className="px-12 py-5 border border-zinc-200 text-black rounded-2xl font-bold text-xl hover:bg-zinc-50 transition-all">
                Documentation
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Showcase Section */}
      <section className="bg-zinc-50 py-32 border-y border-zinc-100">
        <div className="max-w-[1400px] mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-20">
          <div className="space-y-6">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-zinc-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
            </div>
            <h3 className="text-2xl font-bold tracking-tight">Interactive Preview</h3>
            <p className="text-zinc-500 leading-relaxed font-medium">Real-time code execution with dedicated sandbox environments for HTML and Tailwind artifacts.</p>
          </div>
          <div className="space-y-6">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-zinc-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <h3 className="text-2xl font-bold tracking-tight">Live Grounding</h3>
            <p className="text-zinc-500 leading-relaxed font-medium">Connect your agents to real-time information via Google Search and Maps integration.</p>
          </div>
          <div className="space-y-6">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-zinc-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <h3 className="text-2xl font-bold tracking-tight">Studio Analytics</h3>
            <p className="text-zinc-500 leading-relaxed font-medium">Deep insights into performance metrics, token consumption and interaction success rates.</p>
          </div>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="py-24 max-w-[1400px] mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-black rounded-lg flex items-center justify-center text-white text-[10px] font-bold">G</div>
              <span className="font-bold text-sm tracking-tight text-black">GeminiHub</span>
            </div>
            <p className="text-sm text-zinc-400 font-medium">© 2025 GeminiHub Engineering Studio.</p>
          </div>
          <div className="flex gap-12 text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            <a href="#" className="hover:text-black transition-colors">Privacy</a>
            <a href="#" className="hover:text-black transition-colors">Twitter</a>
            <a href="#" className="hover:text-black transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

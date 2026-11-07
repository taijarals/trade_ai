import React from 'react';
import { Bot, LineChart, Layers, Sliders, Settings, History, Terminal, AlertTriangle } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isRunning: boolean;
  mode: string;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, isRunning, mode }) => {
  const tabs = [
    { id: 'lab', label: mode === 'replay' ? 'Laboratório Replay' : 'Painel Ao Vivo', icon: LineChart },
    { id: 'lots', label: 'Lotes', icon: Layers },
    { id: 'calibration', label: 'Calibração da IA', icon: Sliders },
    { id: 'settings', label: 'Configurações', icon: Settings },
    { id: 'sessions', label: 'Sessões & Histórico', icon: History },
    { id: 'diagnostics', label: 'Diagnóstico', icon: Terminal },
  ];

  return (
    <header className="bg-slate-900 text-white shadow-md border-b border-slate-800">
      {/* Disclaimer Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-xs text-amber-300 flex items-center justify-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span><strong>Simulação com dinheiro fictício (Paper Trading)</strong> — Resultados passados não garantem resultados futuros. Nenhum pedido real é enviado.</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-indigo-600 to-violet-500 p-2.5 rounded-xl shadow-lg">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
              Robô de Tendência — Laboratório
            </h1>
            <p className="text-xs text-slate-400">Simulador de estratégias cripto guiadas por IA com dados da Foxbit</p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700 text-xs">
          <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
          <span className="text-slate-300 font-medium">{isRunning ? 'Executando...' : 'Pausado / Pronto'}</span>
          <span className="text-slate-500 uppercase">({mode})</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 flex overflow-x-auto no-scrollbar border-t border-slate-800">
        <div className="flex gap-1 py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

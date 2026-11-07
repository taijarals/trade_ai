import React from 'react';
import { SessionRecord } from '../types';
import { X, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface ComparisonModalProps {
  sessions: SessionRecord[];
  onClose: () => void;
}

export const ComparisonModal: React.FC<ComparisonModalProps> = ({ sessions, onClose }) => {
  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Comparação de Sessões Lado a Lado</h2>
            <p className="text-sm text-slate-500">Comparando {sessions.length} sessões de simulação.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {sessions.map(s => {
            const ret = Number(s.totalReturnPercent || 0);
            const isPos = ret >= 0;
            return (
              <div key={s.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 space-y-4">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">{s.title}</h3>
                  <p className="text-xs text-slate-500">{new Date(s.createdAt).toLocaleString()}</p>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500">Mercado</span>
                    <span className="font-semibold uppercase">{s.config.market}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500">Patrimônio Final</span>
                    <span className="font-bold">R$ {Number(s.finalNetWorthBRL).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500">Retorno Total</span>
                    <span className={`font-bold flex items-center gap-1 ${isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {isPos ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      {isPos ? '+' : ''}{ret.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500">Buy & Hold</span>
                    <span className="font-semibold">{Number(s.buyAndHoldReturnPercent || 0).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500">Total Operações</span>
                    <span className="font-semibold">{s.totalTrades}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500">Chamadas IA</span>
                    <span className="font-semibold">{s.aiCallsCount}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Taxas Totais</span>
                    <span className="font-semibold">R$ {Number(s.totalFeesBRL).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

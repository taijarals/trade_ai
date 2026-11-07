import React, { useState } from 'react';
import { Lot } from '../types';
import { Layers, Search, Filter } from 'lucide-react';

interface LotsPanelProps {
  lots: Lot[];
}

export const LotsPanel: React.FC<LotsPanelProps> = ({ lots }) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredLots = lots.filter(lot => {
    if (filterStatus !== 'all' && lot.status !== filterStatus) return false;
    if (searchTerm && !lot.id.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const getStatusBadge = (status: Lot['status']) => {
    switch (status) {
      case 'open':
        return <span className="bg-amber-500/10 text-amber-500 px-2.5 py-1 rounded-full text-xs font-semibold">Aberto</span>;
      case 'sold_target':
        return <span className="bg-emerald-500/10 text-emerald-500 px-2.5 py-1 rounded-full text-xs font-semibold">Meta Atingida</span>;
      case 'sold_stop':
        return <span className="bg-rose-500/10 text-rose-500 px-2.5 py-1 rounded-full text-xs font-semibold">Stop Loss</span>;
      case 'sold_signal':
        return <span className="bg-violet-500/10 text-violet-500 px-2.5 py-1 rounded-full text-xs font-semibold">Sinal de Queda</span>;
      case 'sold_guardrail':
        return <span className="bg-orange-500/10 text-orange-500 px-2.5 py-1 rounded-full text-xs font-semibold">Trava Geral</span>;
      default:
        return <span className="bg-slate-500/10 text-slate-500 px-2.5 py-1 rounded-full text-xs font-semibold">{status}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/10 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Gerenciamento de Lotes & Fluxo de Caixa</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Acompanhe todos os lotes abertos e encerrados com seus respectivos lucros líquidos.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-800 dark:text-slate-200"
              />
            </div>

            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-200"
            >
              <option value="all">Todos os Status</option>
              <option value="open">Abertos</option>
              <option value="sold_target">Meta Atingida</option>
              <option value="sold_stop">Stop Loss</option>
              <option value="sold_signal">Sinal de Queda</option>
              <option value="sold_guardrail">Trava Geral</option>
            </select>
          </div>
        </div>

        {filteredLots.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            Nenhum lote encontrado com os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-3 px-4">ID / Horário</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Qtd / Preço Compra</th>
                  <th className="py-3 px-4">Valor Gasto</th>
                  <th className="py-3 px-4">Meta / Stop</th>
                  <th className="py-3 px-4">Resultado Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredLots.map(lot => {
                  const hasProfit = lot.netProfitBRL && lot.netProfitBRL.gte(0);
                  return (
                    <tr key={lot.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono text-xs">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{lot.id.slice(-8)}</div>
                        <div className="text-slate-400">{new Date(lot.createdAt).toLocaleTimeString()}</div>
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(lot.status)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">{lot.quantity.toDecimalPlaces(4).toString()}</div>
                        <div className="text-xs text-slate-400">R$ {lot.buyPrice.toDecimalPlaces(2).toString()}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                        R$ {lot.spentBRL.toDecimalPlaces(2).toString()}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="text-emerald-500 font-medium">Alvo: R$ {lot.targetPrice.toDecimalPlaces(2).toString()}</div>
                        <div className="text-rose-500">Stop: {lot.stopLossPrice ? `R$ ${lot.stopLossPrice.toDecimalPlaces(2)}` : 'Desligado'}</div>
                      </td>
                      <td className="py-3 px-4">
                        {lot.netProfitBRL !== undefined ? (
                          <div>
                            <span className={`font-bold ${hasProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {hasProfit ? '+' : ''}R$ {lot.netProfitBRL.toDecimalPlaces(2).toString()}
                            </span>
                            <span className={`block text-xs ${hasProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                              ({hasProfit ? '+' : ''}{lot.netProfitPercent?.toDecimalPlaces(2).toString()}%)
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-500 font-medium">Em andamento</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

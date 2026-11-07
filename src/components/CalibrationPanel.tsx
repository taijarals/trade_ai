import React from 'react';
import { PredictionRecord } from '../types';
import { Sliders, AlertTriangle } from 'lucide-react';

interface CalibrationPanelProps {
  predictions: PredictionRecord[];
}

export const CalibrationPanel: React.FC<CalibrationPanelProps> = ({ predictions }) => {
  const evaluatedPredictions = predictions.filter(p => p.evaluated && !p.isTie);
  const tiePredictions = predictions.filter(p => p.evaluated && p.isTie);
  const totalEvaluated = evaluatedPredictions.length;
  
  const correctCount = evaluatedPredictions.filter(p => p.correct).length;
  const generalHitRate = totalEvaluated > 0 ? (correctCount / totalEvaluated) * 100 : 0;

  const buckets = Array.from({ length: 10 }, (_, i) => {
    const min = i * 10;
    const max = (i + 1) * 10;
    const bucketPreds = evaluatedPredictions.filter(p => p.probabilidadeAlta >= min && (i === 9 ? p.probabilidadeAlta <= max : p.probabilidadeAlta < max));
    const count = bucketPreds.length;
    const correctInBucket = bucketPreds.filter(p => p.correct).length;
    const actualHitRate = count > 0 ? (correctInBucket / count) * 100 : 0;
    return {
      label: `${min}-${max}%`,
      midpoint: min + 5,
      count,
      actualHitRate
    };
  });

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/10 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Calibração da Inteligência Artificial</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Avaliação da precisão das previsões (empates excluídos do cálculo principal).</p>
          </div>
        </div>

        {totalEvaluated < 100 && (
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center gap-3 text-amber-600 dark:text-amber-400 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span><strong>Amostra pequena ({totalEvaluated} previsões avaliadas)</strong> — Recomendado ≥ 100 previsões.</span>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="text-xs text-slate-500 font-medium">Previsões Avaliadas</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalEvaluated}</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="text-xs text-slate-500 font-medium">Taxa de Acerto Geral</div>
            <div className="text-2xl font-bold text-emerald-500 mt-1">{generalHitRate.toFixed(1)}%</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="text-xs text-slate-500 font-medium">Empates (Preço Igual)</div>
            <div className="text-2xl font-bold text-amber-500 mt-1">{tiePredictions.length}</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="text-xs text-slate-500 font-medium">Pendentes / Últimos H</div>
            <div className="text-2xl font-bold text-indigo-500 mt-1">{predictions.filter(p => !p.evaluated).length}</div>
          </div>
        </div>

        {/* Decile Buckets Table */}
        <div className="space-y-3">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">Análise por Faixas de Probabilidade (Decis)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-3 px-4">Faixa Prevista</th>
                  <th className="py-3 px-4">Quantidade</th>
                  <th className="py-3 px-4">Taxa Real de Alta</th>
                  <th className="py-3 px-4">Desvio / Calibração</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {buckets.map((b, idx) => {
                  const deviation = b.count > 0 ? b.actualHitRate - b.midpoint : 0;
                  return (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">{b.label}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{b.count}</td>
                      <td className="py-3 px-4 font-semibold text-emerald-500">
                        {b.count > 0 ? `${b.actualHitRate.toFixed(1)}%` : 'Sem dados'}
                      </td>
                      <td className="py-3 px-4">
                        {b.count > 0 ? (
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${Math.abs(deviation) <= 10 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                            {deviation > 0 ? `+${deviation.toFixed(1)}%` : `${deviation.toFixed(1)}%`}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

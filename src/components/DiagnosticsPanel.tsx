import React, { useState } from 'react';
import { SUPPORTED_MARKETS, fetchFoxbitRaw, fetchCandlesticks } from '../services/foxbit';
import { Terminal, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export const DiagnosticsPanel: React.FC = () => {
  const [selectedMarket, setSelectedMarket] = useState('xrpbrl');
  const [loading, setLoading] = useState(false);
  const [rawTicker, setRawTicker] = useState<any>(null);
  const [tickerUrl, setTickerUrl] = useState<string>('');
  const [candlesResult, setCandlesResult] = useState<{ url: string; raw: any; first: any; last: any } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      const tickerRes = await fetchFoxbitRaw(`markets/${selectedMarket}/ticker/24hr`);
      setRawTicker(tickerRes.data);
      setTickerUrl(tickerRes.url);

      const res = await fetchCandlesticks(selectedMarket, '1h', undefined, undefined, 10);
      if (res.candles.length > 0) {
        const first = res.candles[0];
        const last = res.candles[res.candles.length - 1];
        setCandlesResult({
          url: res.urlCalled,
          raw: res.rawResponse,
          first: {
            ...first,
            brasiliaTime: new Date(first.timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
          },
          last: {
            ...last,
            brasiliaTime: new Date(last.timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
          }
        });
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao consultar API da Foxbit.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/10 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Diagnóstico da API Foxbit</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">URL chamada, resposta bruta e candles convertidos com horário de Brasília.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
              className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-200"
            >
              {SUPPORTED_MARKETS.map(m => (
                <option key={m.symbol} value={m.symbol}>{m.displayName}</option>
              ))}
            </select>

            <button
              onClick={runDiagnostics}
              disabled={loading}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50 shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Testar Conexão
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-rose-600 dark:text-rose-400 flex items-center gap-3 text-sm mb-4">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Ticker Raw & URL */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Ticker 24hr (URL & Resposta)
            </h3>
            <div className="text-xs text-indigo-400 font-mono bg-slate-900 p-2 rounded-lg border border-slate-800">
              URL: {tickerUrl || 'N/A'}
            </div>
            <pre className="bg-slate-950 text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-auto max-h-80 border border-slate-800">
              {rawTicker ? JSON.stringify(rawTicker, null, 2) : 'Clique em "Testar Conexão" para carregar.'}
            </pre>
          </div>

          {/* Candlesticks Converted & Raw */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Candlesticks (URL, Primeiro & Último Convertidos)
            </h3>
            <div className="text-xs text-indigo-400 font-mono bg-slate-900 p-2 rounded-lg border border-slate-800">
              URL: {candlesResult?.url || 'N/A'}
            </div>
            <pre className="bg-slate-950 text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-auto max-h-80 border border-slate-800">
              {candlesResult ? JSON.stringify({ firstCandle: candlesResult.first, lastCandle: candlesResult.last }, null, 2) : 'Clique em "Testar Conexão" para carregar.'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

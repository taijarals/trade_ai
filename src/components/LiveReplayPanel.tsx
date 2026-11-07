import React from 'react';
import { Candle, WalletState, Lot, PredictionRecord, LogEntry, Config } from '../types';
import Decimal from 'decimal.js';
import { Play, Pause, SkipForward, Square, TrendingUp, TrendingDown, Activity, Zap } from 'lucide-react';

interface LiveReplayPanelProps {
  config: Config;
  isRunning: boolean;
  onStart: () => void;
  onPause: () => void;
  onStepForward: () => void;
  onStop: () => void;
  wallet: WalletState;
  currentCandleIndex: number;
  totalCandles: number;
  candles: Candle[];
  openLots: Lot[];
  logs: LogEntry[];
  predictions: PredictionRecord[];
}

export const LiveReplayPanel: React.FC<LiveReplayPanelProps> = ({
  config,
  isRunning,
  onStart,
  onPause,
  onStepForward,
  onStop,
  wallet,
  currentCandleIndex,
  totalCandles,
  candles,
  openLots,
  logs
}) => {
  const currentCandle = candles[currentCandleIndex] || candles[0];
  const currentPrice = currentCandle ? currentCandle.close : new Decimal(0);

  const initialNetWorth = wallet.initialCapitalBRL.plus(wallet.initialCoinQuantity.mul(candles[0]?.close || currentPrice));
  const currentCoinValue = wallet.coinQuantity.mul(currentPrice);
  const totalNetWorth = wallet.cashBRL.plus(currentCoinValue);
  const returnBRL = totalNetWorth.minus(initialNetWorth);
  const returnPercent = initialNetWorth.isZero() ? new Decimal(0) : returnBRL.div(initialNetWorth).mul(100);

  // Buy & Hold comparison
  const initialBuyAndHoldCoins = candles[0] && !candles[0].open.isZero() ? initialNetWorth.div(candles[0].open) : new Decimal(0);
  const buyAndHoldNetWorth = initialBuyAndHoldCoins.mul(currentPrice);
  const buyAndHoldReturn = initialNetWorth.isZero() ? new Decimal(0) : buyAndHoldNetWorth.minus(initialNetWorth).div(initialNetWorth).mul(100);

  const progressPercent = totalCandles > 0 ? ((currentCandleIndex + 1) / totalCandles) * 100 : 0;

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Controls & Progress Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              {config.mode === 'replay' ? 'Laboratório de Replay Histórico' : 'Painel de Execução Ao Vivo'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Mercado: <span className="uppercase font-bold text-slate-700 dark:text-slate-300">{config.market}</span> ({config.resolution}) • Passo {currentCandleIndex + 1} de {totalCandles}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!isRunning ? (
              <button
                onClick={onStart}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition"
              >
                <Play className="w-4 h-4 fill-current" />
                Iniciar
              </button>
            ) : (
              <button
                onClick={onPause}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition"
              >
                <Pause className="w-4 h-4 fill-current" />
                Pausar
              </button>
            )}

            <button
              onClick={onStepForward}
              disabled={isRunning || currentCandleIndex >= totalCandles - 1}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition"
            >
              <SkipForward className="w-4 h-4" />
              Avançar 1 Passo
            </button>

            <button
              onClick={onStop}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition"
            >
              <Square className="w-4 h-4 fill-current" />
              Parar
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500 font-medium">
            <span>Progresso da Simulação</span>
            <span>{progressPercent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      </div>

      {/* Wallet & Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-1">
          <div className="text-xs font-medium text-slate-500">Patrimônio Total</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            R$ {totalNetWorth.toDecimalPlaces(2).toString()}
          </div>
          <div className={`text-xs font-semibold flex items-center gap-1 ${returnPercent.gte(0) ? 'text-emerald-500' : 'text-rose-500'}`}>
            {returnPercent.gte(0) ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {returnPercent.gte(0) ? '+' : ''}{returnPercent.toDecimalPlaces(2).toString()}% (R$ {returnBRL.toDecimalPlaces(2).toString()})
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-1">
          <div className="text-xs font-medium text-slate-500">Saldo em Reais & Moedas</div>
          <div className="text-lg font-bold text-slate-900 dark:text-white">
            R$ {wallet.cashBRL.toDecimalPlaces(2).toString()}
          </div>
          <div className="text-xs text-slate-400 font-medium">
            {wallet.coinQuantity.toDecimalPlaces(4).toString()} {config.market.slice(0, 3).toUpperCase()} (R$ {currentCoinValue.toDecimalPlaces(2).toString()})
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-1">
          <div className="text-xs font-medium text-slate-500">Comparação Buy & Hold</div>
          <div className="text-lg font-bold text-slate-900 dark:text-white">
            R$ {buyAndHoldNetWorth.toDecimalPlaces(2).toString()}
          </div>
          <div className={`text-xs font-semibold ${buyAndHoldReturn.gte(0) ? 'text-emerald-500' : 'text-rose-500'}`}>
            {buyAndHoldReturn.gte(0) ? '+' : ''}{buyAndHoldReturn.toDecimalPlaces(2).toString()}%
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-1">
          <div className="text-xs font-medium text-slate-500">Estatísticas Operacionais</div>
          <div className="text-lg font-bold text-slate-900 dark:text-white">
            {wallet.totalTrades} operações
          </div>
          <div className="text-xs text-slate-400 font-medium">
            Taxas pagas: R$ {wallet.totalFeesPaidBRL.toDecimalPlaces(2).toString()} • {openLots.length} lotes abertos
          </div>
        </div>
      </div>

      {/* Price & Chart / Log Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Candle details & info */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Candle Atual (# {currentCandleIndex + 1})
          </h3>

          {currentCandle && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Horário</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{new Date(currentCandle.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Abertura</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">R$ {currentCandle.open.toDecimalPlaces(2).toString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Máxima / Mínima</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">R$ {currentCandle.high.toDecimalPlaces(2).toString()} / R$ {currentCandle.low.toDecimalPlaces(2).toString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Fechamento</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">R$ {currentCandle.close.toDecimalPlaces(2).toString()}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Volume</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{currentCandle.volume.toDecimalPlaces(2).toString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Live Logs Stream */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4 flex flex-col">
          <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Log de Atividades em Linguagem Simples
          </h3>

          <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-xs overflow-y-auto h-72 space-y-2 border border-slate-800">
            {logs.length === 0 ? (
              <div className="text-slate-500 italic">Nenhum evento registrado ainda. Clique em "Iniciar" para começar.</div>
            ) : (
              logs.map(log => {
                let colorClass = 'text-slate-300';
                if (log.type === 'buy') colorClass = 'text-emerald-400 font-bold';
                if (log.type === 'sell') colorClass = 'text-sky-400 font-bold';
                if (log.type === 'guardrail') colorClass = 'text-orange-400 font-bold';
                if (log.type === 'error') colorClass = 'text-rose-400 font-bold';
                if (log.type === 'warning') colorClass = 'text-amber-400';

                return (
                  <div key={log.id} className={`${colorClass} leading-relaxed`}>
                    {log.message}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

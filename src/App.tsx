import React, { useState, useEffect, useRef } from 'react';
import Decimal from 'decimal.js';
import { Header } from './components/Header';
import { LiveReplayPanel } from './components/LiveReplayPanel';
import { LotsPanel } from './components/LotsPanel';
import { CalibrationPanel } from './components/CalibrationPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { SessionsPanel } from './components/SessionsPanel';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { ComparisonModal } from './components/ComparisonModal';
import { Config, Candle, WalletState, Lot, PredictionRecord, LogEntry, SessionRecord } from './types';
import { DEFAULT_CONFIG, saveSession, savePredictions } from './services/storage';
import { fetchCandlesticks, parseIntervalToMs } from './services/foxbit';
import { processStep } from './utils/engine';

export default function App() {
  const [activeTab, setActiveTab] = useState('lab');
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [isRunning, setIsRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const [comparedSessions, setComparedSessions] = useState<SessionRecord[] | null>(null);

  // configRef to read latest config during replay
  const configRef = useRef(config);
  configRef.current = config;

  const simRef = useRef<{
    candles: Candle[];
    currentCandleIndex: number;
    wallet: WalletState;
    allLots: Lot[];
    predictions: PredictionRecord[];
    logs: LogEntry[];
    lastBuyStepIndex: number;
    dailyTrades: number;
    lastTradeCalendarDay: string;
    initialSessionPrice: Decimal;
    sessionId: string;
    startDateMs: number;
  }>({
    candles: [],
    currentCandleIndex: 0,
    wallet: {
      cashBRL: new Decimal(DEFAULT_CONFIG.initialCapitalBRL),
      coinQuantity: new Decimal(DEFAULT_CONFIG.initialCoins),
      initialCapitalBRL: new Decimal(DEFAULT_CONFIG.initialCapitalBRL),
      initialCoinQuantity: new Decimal(DEFAULT_CONFIG.initialCoins),
      totalFeesPaidBRL: new Decimal(0),
      totalTrades: 0
    },
    allLots: [],
    predictions: [],
    logs: [],
    lastBuyStepIndex: -999,
    dailyTrades: 0,
    lastTradeCalendarDay: '',
    initialSessionPrice: new Decimal(0),
    sessionId: `session_${Date.now()}`,
    startDateMs: Date.now()
  });

  const processingRef = useRef(false);
  const isRunningRef = useRef(false);
  isRunningRef.current = isRunning;

  useEffect(() => {
    if (config.mode === 'replay') {
      loadReplayCandles();
    }
  }, [config.market, config.resolution, config.replayDate, config.replayStartTime, config.replayEndTime]);

  const loadReplayCandles = async () => {
    try {
      setIsRunning(false);
      const dateParts = config.replayDate.split('-').map(Number);
      const startParts = config.replayStartTime.split(':').map(Number);
      const endParts = config.replayEndTime.split(':').map(Number);

      const startDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], startParts[0] || 8, startParts[1] || 0);
      const endDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], endParts[0] || 18, endParts[1] || 0);

      const intervalMs = parseIntervalToMs(config.resolution);
      const warmupTimeMs = startDate.getTime() - (config.candleWindowSize * intervalMs);

      const res = await fetchCandlesticks(
        config.market,
        config.resolution,
        warmupTimeMs,
        endDate.getTime(),
        1000
      );

      const fetched = res.candles;
      if (fetched.length === 0) {
        throw new Error('Nenhum candle retornado para o período selecionado.');
      }

      const startIndex = fetched.findIndex(c => c.timestamp >= startDate.getTime());
      const initialIdx = startIndex !== -1 ? startIndex : Math.min(config.candleWindowSize, fetched.length - 1);

      const warmupCandlesCount = fetched.slice(0, initialIdx).length;
      const dayWindowCandlesCount = fetched.slice(initialIdx).length;

      const initBRL = new Decimal(config.initialCapitalBRL);
      const initCoins = new Decimal(config.initialCoins);

      simRef.current = {
        candles: fetched,
        currentCandleIndex: initialIdx,
        wallet: {
          cashBRL: initBRL,
          coinQuantity: initCoins,
          initialCapitalBRL: initBRL,
          initialCoinQuantity: initCoins,
          totalFeesPaidBRL: new Decimal(0),
          totalTrades: 0
        },
        allLots: [],
        predictions: [],
        logs: [{
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          stepIndex: 0,
          type: 'info',
          message: `Replay carregado: ${warmupCandlesCount} candles no aquecimento, ${dayWindowCandlesCount} candles na janela do dia.`
        }],
        lastBuyStepIndex: -999,
        dailyTrades: 0,
        lastTradeCalendarDay: '',
        initialSessionPrice: fetched[initialIdx]?.close || fetched[0].close,
        sessionId: `session_${Date.now()}`,
        startDateMs: startDate.getTime()
      };

      setTick(t => t + 1);
    } catch (err: any) {
      alert(`Erro ao carregar dados da Foxbit: ${err.message}`);
    }
  };

  const validateGainTargetBeforeStart = (): boolean => {
    const totalCostPercent = (config.feePercent * 2) + (config.slippagePercent * 2);
    if (config.gainTargetPercent <= totalCostPercent) {
      alert(`Erro de Configuração: A meta de ganho (${config.gainTargetPercent}%) é menor ou igual à soma das taxas e slippage estimados (${totalCostPercent.toFixed(2)}%). Ajuste a meta de ganho nas configurações antes de iniciar.`);
      return false;
    }
    return true;
  };

  const handleStart = () => {
    if (!validateGainTargetBeforeStart()) return;
    if (simRef.current.candles.length === 0) {
      alert('Nenhum candle carregado para simulação.');
      return;
    }
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleStop = async () => {
    handlePause();
    await saveCurrentSession('stopped');
    alert('Simulação parada e salva no histórico.');
  };

  const saveCurrentSession = async (status: SessionRecord['status']) => {
    const s = simRef.current;
    const finalPredictions = s.predictions.map(p => {
      if (s.currentCandleIndex < p.stepIndex + p.horizon) {
        return { ...p, evaluated: false };
      }
      return p;
    });

    const finalPrice = s.candles[s.currentCandleIndex]?.close || new Decimal(0);
    const finalNetWorth = s.wallet.cashBRL.plus(s.wallet.coinQuantity.mul(finalPrice));
    const initialNetWorth = s.wallet.initialCapitalBRL.plus(s.wallet.initialCoinQuantity.mul(s.initialSessionPrice));
    const returnBRL = finalNetWorth.minus(initialNetWorth);
    const returnPercent = initialNetWorth.isZero() ? new Decimal(0) : returnBRL.div(initialNetWorth).mul(100);

    const initialBuyAndHoldCoins = s.candles[0] && !s.candles[0].open.isZero() ? initialNetWorth.div(s.candles[0].open) : new Decimal(0);
    const buyAndHoldNetWorth = initialBuyAndHoldCoins.mul(finalPrice);
    const buyAndHoldReturn = initialNetWorth.isZero() ? new Decimal(0) : buyAndHoldNetWorth.minus(initialNetWorth).div(initialNetWorth).mul(100);

    const winningLots = s.allLots.filter(l => l.netProfitBRL && l.netProfitBRL.gt(0)).length;
    const losingLots = s.allLots.filter(l => l.netProfitBRL && l.netProfitBRL.lt(0)).length;

    const sessionRecord: SessionRecord = {
      id: s.sessionId,
      title: `${config.market.toUpperCase()} — ${new Date().toLocaleDateString()}`,
      createdAt: Date.now(),
      config,
      status,
      initialNetWorthBRL: initialNetWorth.toString(),
      finalNetWorthBRL: finalNetWorth.toString(),
      buyAndHoldNetWorthBRL: buyAndHoldNetWorth.toString(),
      totalReturnPercent: returnPercent.toString(),
      buyAndHoldReturnPercent: buyAndHoldReturn.toString(),
      totalFeesBRL: s.wallet.totalFeesPaidBRL.toString(),
      aiCallsCount: finalPredictions.length,
      totalTrades: s.wallet.totalTrades,
      winningTrades: winningLots,
      losingTrades: losingLots,
      lots: s.allLots,
      predictions: finalPredictions,
      netWorthHistory: [],
      logs: s.logs,
      notes: ''
    };

    await saveSession(sessionRecord);
    await savePredictions(finalPredictions);
  };

  const executeStep = async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      const s = simRef.current;
      const currentConfig = configRef.current;

      if (s.currentCandleIndex >= s.candles.length - 1) {
        setIsRunning(false);
        await saveCurrentSession('completed');
        alert('Simulação concluída até o fim dos candles disponíveis!');
        processingRef.current = false;
        return;
      }

      const nextIndex = s.currentCandleIndex + 1;
      const currentCandle = s.candles[nextIndex];

      // Calendar day in Brasília timezone (America/Sao_Paulo)
      const brasiliaDateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(currentCandle.timestamp);

      if (s.lastTradeCalendarDay && s.lastTradeCalendarDay !== brasiliaDateStr) {
        s.dailyTrades = 0;
      }
      s.lastTradeCalendarDay = brasiliaDateStr;

      const canOpenTrades = s.dailyTrades < currentConfig.maxDailyTrades;

      if (!canOpenTrades) {
        s.logs.push({
          id: `log_${Date.now()}_${Math.random()}`,
          timestamp: Date.now(),
          stepIndex: nextIndex,
          type: 'warning',
          message: `${new Date(currentCandle.timestamp).toLocaleTimeString()} — Limite diário de operações atingido (${s.dailyTrades}/${currentConfig.maxDailyTrades}). Novas compras bloqueadas, mas verificando metas, stops e trava geral.`
        });
      }

      const openLotsList = s.allLots.filter(l => l.status === 'open');

      const result = await processStep({
        stepIndex: nextIndex,
        candles: s.candles,
        currentCandleIndex: nextIndex,
        wallet: s.wallet,
        openLots: openLotsList,
        allLots: s.allLots,
        config: currentConfig,
        predictions: s.predictions,
        sessionId: s.sessionId,
        lastBuyStepIndex: s.lastBuyStepIndex,
        initialSessionPrice: s.initialSessionPrice,
        canOpenTrades
      });

      s.wallet = result.updatedWallet;
      s.allLots = result.updatedLots;
      s.logs = [...s.logs, ...result.newLogs];
      s.predictions = result.updatedPredictions;
      s.currentCandleIndex = nextIndex;

      // Count each trade sold or bought in tradesCountDelta
      if (result.tradesCountDelta > 0) {
        s.dailyTrades += result.tradesCountDelta;
      }
      if (result.actionTaken === 'buy') {
        s.lastBuyStepIndex = nextIndex;
      }

      if (result.guardrailTriggered) {
        setIsRunning(false);
        await saveCurrentSession('guardrail_triggered');
        alert(result.guardrailReason || 'Trava geral acionada.');
      }

      setTick(t => t + 1);
    } finally {
      processingRef.current = false;
    }
  };

  useEffect(() => {
    let active = true;
    const runLoop = async () => {
      while (isRunningRef.current && active) {
        await executeStep();
        if (isRunningRef.current && active) {
          await new Promise(r => setTimeout(r, configRef.current.replayDelayMs));
        }
      }
    };

    if (isRunning) {
      runLoop();
    }

    return () => {
      active = false;
    };
  }, [isRunning]);

  const s = simRef.current;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isRunning={isRunning}
        mode={config.mode}
      />

      <main className="flex-1 py-6">
        {activeTab === 'lab' && (
          <LiveReplayPanel
            config={config}
            isRunning={isRunning}
            onStart={handleStart}
            onPause={handlePause}
            onStepForward={executeStep}
            onStop={handleStop}
            wallet={s.wallet}
            currentCandleIndex={s.currentCandleIndex}
            totalCandles={s.candles.length}
            candles={s.candles}
            openLots={s.allLots.filter(l => l.status === 'open')}
            logs={s.logs}
            predictions={s.predictions}
          />
        )}

        {activeTab === 'lots' && (
          <LotsPanel lots={s.allLots} />
        )}

        {activeTab === 'calibration' && (
          <CalibrationPanel predictions={s.predictions} />
        )}

        {activeTab === 'settings' && (
          <SettingsPanel config={config} setConfig={setConfig} />
        )}

        {activeTab === 'sessions' && (
          <SessionsPanel
            onLoadSession={(session) => {
              setConfig(session.config);
              simRef.current.allLots = session.lots;
              simRef.current.predictions = session.predictions;
              simRef.current.logs = session.logs;
              simRef.current.sessionId = session.id;
              setTick(t => t + 1);
              setActiveTab('lab');
            }}
            onCompareSessions={(sessionsToCompare) => {
              setComparedSessions(sessionsToCompare);
            }}
          />
        )}

        {activeTab === 'diagnostics' && (
          <DiagnosticsPanel />
        )}
      </main>

      {comparedSessions && (
        <ComparisonModal
          sessions={comparedSessions}
          onClose={() => setComparedSessions(null)}
        />
      )}
    </div>
  );
}

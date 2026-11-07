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
import { fetchCandlesticks } from './services/foxbit';
import { processStep } from './utils/engine';

export default function App() {
  const [activeTab, setActiveTab] = useState('lab');
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [isRunning, setIsRunning] = useState(false);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [currentCandleIndex, setCurrentCandleIndex] = useState(0);
  const [wallet, setWallet] = useState<WalletState>({
    cashBRL: new Decimal(DEFAULT_CONFIG.initialCapitalBRL),
    coinQuantity: new Decimal(DEFAULT_CONFIG.initialCoins),
    initialCapitalBRL: new Decimal(DEFAULT_CONFIG.initialCapitalBRL),
    initialCoinQuantity: new Decimal(DEFAULT_CONFIG.initialCoins),
    totalFeesPaidBRL: new Decimal(0),
    totalTrades: 0
  });
  const [allLots, setAllLots] = useState<Lot[]>([]);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastBuyStepIndex, setLastBuyStepIndex] = useState(-999);
  const [sessionId, setSessionId] = useState(`session_${Date.now()}`);
  const [comparedSessions, setComparedSessions] = useState<SessionRecord[] | null>(null);

  const timerRef = useRef<any>(null);

  // Load candles when market or date changes in replay mode
  useEffect(() => {
    if (config.mode === 'replay') {
      loadReplayCandles();
    }
  }, [config.market, config.resolution, config.replayDate, config.replayStartTime, config.replayEndTime]);

  const loadReplayCandles = async () => {
    try {
      setIsRunning(false);
      // Parse date and time window
      const dateParts = config.replayDate.split('-').map(Number);
      const startParts = config.replayStartTime.split(':').map(Number);
      const endParts = config.replayEndTime.split(':').map(Number);

      const startDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], startParts[0] || 8, startParts[1] || 0);
      const endDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], endParts[0] || 18, endParts[1] || 0);

      // Add warm-up period (e.g. 50 candles before start)
      const warmupTimeMs = startDate.getTime() - (config.candleWindowSize * 3600000);

      const fetched = await fetchCandlesticks(
        config.market,
        config.resolution,
        warmupTimeMs,
        endDate.getTime(),
        500
      );

      // Filter candles within range or starting from warmup
      setCandles(fetched);
      // Find index corresponding to startDate
      const startIndex = fetched.findIndex(c => c.timestamp >= startDate.getTime());
      const initialIdx = startIndex !== -1 ? startIndex : Math.min(config.candleWindowSize, fetched.length - 1);
      setCurrentCandleIndex(initialIdx);

      // Reset wallet
      const initBRL = new Decimal(config.initialCapitalBRL);
      const initCoins = new Decimal(config.initialCoins);
      setWallet({
        cashBRL: initBRL,
        coinQuantity: initCoins,
        initialCapitalBRL: initBRL,
        initialCoinQuantity: initCoins,
        totalFeesPaidBRL: new Decimal(0),
        totalTrades: 0
      });
      setAllLots([]);
      setPredictions([]);
      setLogs([{
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        stepIndex: 0,
        type: 'info',
        message: `Replay carregado com sucesso: ${fetched.length} candles obtidos da Foxbit.`
      }]);
      setSessionId(`session_${Date.now()}`);
    } catch (err: any) {
      alert(`Erro ao carregar dados da Foxbit: ${err.message}`);
    }
  };

  const handleStart = () => {
    if (candles.length === 0) {
      alert('Nenhum candle carregado para simulação.');
      return;
    }
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleStop = async () => {
    handlePause();
    // Save session record
    await saveCurrentSession('stopped');
    alert('Simulação parada e salva no histórico.');
  };

  const saveCurrentSession = async (status: SessionRecord['status']) => {
    const finalPrice = candles[currentCandleIndex]?.close || new Decimal(0);
    const finalNetWorth = wallet.cashBRL.plus(wallet.coinQuantity.mul(finalPrice));
    const initialNetWorth = wallet.initialCapitalBRL.plus(wallet.initialCoinQuantity.mul(candles[0]?.close || finalPrice));
    const returnBRL = finalNetWorth.minus(initialNetWorth);
    const returnPercent = initialNetWorth.isZero() ? new Decimal(0) : returnBRL.div(initialNetWorth).mul(100);

    const initialBuyAndHoldCoins = candles[0] && !candles[0].open.isZero() ? initialNetWorth.div(candles[0].open) : new Decimal(0);
    const buyAndHoldNetWorth = initialBuyAndHoldCoins.mul(finalPrice);
    const buyAndHoldReturn = initialNetWorth.isZero() ? new Decimal(0) : buyAndHoldNetWorth.minus(initialNetWorth).div(initialNetWorth).mul(100);

    const winningLots = allLots.filter(l => l.netProfitBRL && l.netProfitBRL.gt(0)).length;
    const losingLots = allLots.filter(l => l.netProfitBRL && l.netProfitBRL.lt(0)).length;

    const sessionRecord: SessionRecord = {
      id: sessionId,
      title: `${config.market.toUpperCase()} — ${new Date().toLocaleDateString()}`,
      createdAt: Date.now(),
      config,
      status,
      initialNetWorthBRL: initialNetWorth.toString(),
      finalNetWorthBRL: finalNetWorth.toString(),
      buyAndHoldNetWorthBRL: buyAndHoldNetWorth.toString(),
      totalReturnPercent: returnPercent.toString(),
      buyAndHoldReturnPercent: buyAndHoldReturn.toString(),
      totalFeesBRL: wallet.totalFeesPaidBRL.toString(),
      aiCallsCount: predictions.length,
      totalTrades: wallet.totalTrades,
      winningTrades: winningLots,
      losingTrades: losingLots,
      lots: allLots,
      predictions,
      netWorthHistory: [],
      logs,
      notes: ''
    };

    await saveSession(sessionRecord);
    await savePredictions(predictions);
  };

  const executeStep = async () => {
    if (currentCandleIndex >= candles.length - 1) {
      handlePause();
      await saveCurrentSession('completed');
      alert('Simulação concluída até o fim dos candles disponíveis!');
      return;
    }

    const nextIndex = currentCandleIndex + 1;
    setCurrentCandleIndex(nextIndex);

    const openLotsList = allLots.filter(l => l.status === 'open');

    const result = await processStep({
      stepIndex: nextIndex,
      candles,
      currentCandleIndex: nextIndex,
      wallet,
      openLots: openLotsList,
      allLots,
      config,
      predictions,
      sessionId,
      lastBuyStepIndex
    });

    setWallet(result.updatedWallet);
    setAllLots(result.updatedLots);
    setLogs(prev => [...prev, ...result.newLogs]);

    if (result.actionTaken === 'buy') {
      setLastBuyStepIndex(nextIndex);
    }

    if (result.newPrediction) {
      const updatedPreds = [...predictions, result.newPrediction];
      // Evaluate past predictions where horizon H has passed
      const evaluated = updatedPreds.map(p => {
        if (!p.evaluated && nextIndex >= p.stepIndex + p.horizon) {
          const futureCandle = candles[p.stepIndex + p.horizon];
          if (futureCandle) {
            const didRise = futureCandle.close.gt(p.priceAtPrediction);
            const predictedHigh = p.probabilidadeAlta >= 50;
            return {
              ...p,
              actualPrice: futureCandle.close,
              didPriceRise: didRise,
              evaluated: true,
              correct: predictedHigh === didRise
            };
          }
        }
        return p;
      });
      setPredictions(evaluated);
    }

    if (result.guardrailTriggered) {
      handlePause();
      await saveCurrentSession('guardrail_triggered');
      alert(result.guardrailReason || 'Trava geral acionada.');
    }
  };

  // Replay timer effect
  useEffect(() => {
    if (isRunning && config.mode === 'replay') {
      timerRef.current = setTimeout(() => {
        executeSpeedStep();
      }, config.replayDelayMs);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isRunning, currentCandleIndex, candles]);

  const executeSpeedStep = async () => {
    await executeStep();
  };

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
            wallet={wallet}
            currentCandleIndex={currentCandleIndex}
            totalCandles={candles.length}
            candles={candles}
            openLots={allLots.filter(l => l.status === 'open')}
            logs={logs}
            predictions={predictions}
          />
        )}

        {activeTab === 'lots' && (
          <LotsPanel lots={allLots} />
        )}

        {activeTab === 'calibration' && (
          <CalibrationPanel predictions={predictions} />
        )}

        {activeTab === 'settings' && (
          <SettingsPanel config={config} setConfig={setConfig} />
        )}

        {activeTab === 'sessions' && (
          <SessionsPanel
            onLoadSession={(session) => {
              setConfig(session.config);
              setAllLots(session.lots);
              setPredictions(session.predictions);
              setLogs(session.logs);
              setSessionId(session.id);
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

import Decimal from 'decimal.js';
import { Candle, Config, Lot, PredictionRecord, WalletState, LogEntry } from '../types';
import { calculateBuyOrder, calculateSellOrder, calculateNetWorth } from './wallet';
import { getAIPrediction } from '../services/ai';

export interface StepExecutionResult {
  updatedWallet: WalletState;
  updatedLots: Lot[];
  newLogs: LogEntry[];
  newPrediction?: PredictionRecord;
  updatedPredictions: PredictionRecord[];
  guardrailTriggered: boolean;
  guardrailReason?: string;
  actionTaken: 'buy' | 'sell_target' | 'sell_stop' | 'sell_signal' | 'sell_guardrail' | 'wait' | 'guardrail_halt';
}

export async function processStep({
  stepIndex,
  candles,
  currentCandleIndex,
  wallet,
  openLots,
  allLots,
  config,
  predictions,
  sessionId,
  lastBuyStepIndex,
  initialSessionPrice
}: {
  stepIndex: number;
  candles: Candle[];
  currentCandleIndex: number;
  wallet: WalletState;
  openLots: Lot[];
  allLots: Lot[];
  config: Config;
  predictions: PredictionRecord[];
  sessionId: string;
  lastBuyStepIndex: number;
  initialSessionPrice: Decimal;
}): Promise<StepExecutionResult> {
  const currentCandle = candles[currentCandleIndex];
  const currentPrice = currentCandle.close;
  const newLogs: LogEntry[] = [];
  let updatedWallet = { ...wallet };
  const updatedLots = [...allLots];
  let actionTaken: StepExecutionResult['actionTaken'] = 'wait';
  let guardrailTriggered = false;
  let guardrailReason: string | undefined;

  // 1. Check General Guardrail using initial session price (after warm-up)
  const { netWorthBRL } = calculateNetWorth({
    cashBRL: updatedWallet.cashBRL,
    coinQuantity: updatedWallet.coinQuantity,
    currentPrice
  });

  const initialNetWorth = updatedWallet.initialCapitalBRL.plus(updatedWallet.initialCoinQuantity.mul(initialSessionPrice));
  const dropPercent = initialNetWorth.isZero() ? new Decimal(0) : initialNetWorth.minus(netWorthBRL).div(initialNetWorth).mul(100);

  if (dropPercent.gte(config.generalGuardrailPercent)) {
    guardrailTriggered = true;
    guardrailReason = `Trava geral acionada: Patrimônio caiu ${dropPercent.toDecimalPlaces(2)}% (limite: ${config.generalGuardrailPercent}%).`;
    
    newLogs.push({
      id: `log_${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      stepIndex,
      type: 'guardrail',
      message: `${new Date(currentCandle.timestamp).toLocaleTimeString()} — ${guardrailReason}`
    });

    if (config.guardrailAction === 'sell_all') {
      for (const lot of openLots) {
        if (lot.status === 'open') {
          const sellRes = calculateSellOrder({
            lot,
            sellPrice: currentPrice,
            feePercent: config.feePercent,
            slippagePercent: config.slippagePercent,
            stepIndex,
            status: 'sold_guardrail'
          });
          updatedWallet.cashBRL = updatedWallet.cashBRL.plus(sellRes.proceedsBRL);
          updatedWallet.coinQuantity = updatedWallet.coinQuantity.minus(lot.quantity);
          updatedWallet.totalFeesPaidBRL = updatedWallet.totalFeesPaidBRL.plus(sellRes.feeBRL);
          updatedWallet.totalTrades += 1;

          const lotIndex = updatedLots.findIndex(l => l.id === lot.id);
          if (lotIndex !== -1) updatedLots[lotIndex] = sellRes.soldLot;
        }
      }
    }

    return {
      updatedWallet,
      updatedLots,
      newLogs,
      updatedPredictions: predictions,
      guardrailTriggered: true,
      guardrailReason,
      actionTaken: 'guardrail_halt'
    };
  }

  // 2. Check open lots against current candle (High / Low / Open)
  const newlyClosedOpenLots = openLots.filter(l => l.status === 'open');
  for (const lot of newlyClosedOpenLots) {
    let hitTarget = false;
    let hitStop = false;
    let sellPriceAt = currentPrice;
    let newStatus: Lot['status'] = 'sold_target';

    if (currentCandle.high.gte(lot.targetPrice)) {
      hitTarget = true;
      sellPriceAt = lot.targetPrice;
      newStatus = 'sold_target';
    }

    if (lot.stopLossPrice && currentCandle.low.lte(lot.stopLossPrice)) {
      hitStop = true;
      sellPriceAt = currentCandle.open.lt(lot.stopLossPrice) ? currentCandle.open : lot.stopLossPrice;
      newStatus = 'sold_stop';
    }

    if (hitTarget && hitStop) {
      hitTarget = false;
      newStatus = 'sold_stop';
      sellPriceAt = currentCandle.open.lt(lot.stopLossPrice!) ? currentCandle.open : lot.stopLossPrice!;
    }

    if (hitTarget || hitStop) {
      const sellRes = calculateSellOrder({
        lot,
        sellPrice: sellPriceAt,
        feePercent: config.feePercent,
        slippagePercent: config.slippagePercent,
        stepIndex,
        status: newStatus
      });

      updatedWallet.cashBRL = updatedWallet.cashBRL.plus(sellRes.proceedsBRL);
      updatedWallet.coinQuantity = updatedWallet.coinQuantity.minus(lot.quantity);
      updatedWallet.totalFeesPaidBRL = updatedWallet.totalFeesPaidBRL.plus(sellRes.feeBRL);
      updatedWallet.totalTrades += 1;

      const lotIndex = updatedLots.findIndex(l => l.id === lot.id);
      if (lotIndex !== -1) updatedLots[lotIndex] = sellRes.soldLot;

      actionTaken = newStatus === 'sold_target' ? 'sell_target' : 'sell_stop';
      const timeStr = new Date(currentCandle.timestamp).toLocaleTimeString();
      const profitSign = sellRes.netProfitBRL.gte(0) ? '+' : '';
      newLogs.push({
        id: `log_${Date.now()}_${Math.random()}`,
        timestamp: Date.now(),
        stepIndex,
        type: 'sell',
        message: `${timeStr} — Lote fechado por ${newStatus === 'sold_target' ? 'META' : 'STOP'}: R$ ${sellRes.netProfitBRL.toDecimalPlaces(2)} (${profitSign}${sellRes.netProfitPercent.toDecimalPlaces(2)}%)`
      });
    }
  }

  // 3. Evaluate predictions at every step (Checking if H candles passed)
  const evaluatedPredictions = predictions.map(p => {
    if (!p.evaluated && currentCandleIndex >= p.stepIndex + p.horizon) {
      const futureCandle = candles[p.stepIndex + p.horizon];
      if (futureCandle) {
        const diff = futureCandle.close.minus(p.priceAtPrediction);
        const predictedHigh = p.probabilidadeAlta >= 50;
        let isTie = diff.isZero();
        let correct = false;
        if (!isTie) {
          const didRise = diff.gt(0);
          correct = predictedHigh === didRise;
        }
        return {
          ...p,
          actualPrice: futureCandle.close,
          didPriceRise: diff.gt(0),
          evaluated: true,
          correct,
          isTie
        };
      }
    }
    return p;
  });

  if (currentCandle.isNoTrade) {
    newLogs.push({
      id: `log_${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      stepIndex,
      type: 'info',
      message: `${new Date(currentCandle.timestamp).toLocaleTimeString()} — Aguardar — sem negociação no candle.`
    });
    return {
      updatedWallet,
      updatedLots,
      newLogs,
      updatedPredictions: evaluatedPredictions,
      guardrailTriggered: false,
      actionTaken: 'wait'
    };
  }

  // 4. Gather window of candles for AI
  const windowStartIndex = Math.max(0, currentCandleIndex - config.candleWindowSize + 1);
  const candleWindow = candles.slice(windowStartIndex, currentCandleIndex + 1);

  if (candleWindow.length < 5) {
    return {
      updatedWallet,
      updatedLots,
      newLogs,
      updatedPredictions: evaluatedPredictions,
      guardrailTriggered: false,
      actionTaken: 'wait'
    };
  }

  // 5. Call AI Prediction
  let prediction: { probabilidadeAlta: number; justificativa: string };
  try {
    prediction = await getAIPrediction(candleWindow, {
      geminiModel: config.geminiModel,
      temperature: config.temperature,
      predictionHorizon: config.predictionHorizon,
      anonymized: config.anonymized
    });
  } catch (err: any) {
    newLogs.push({
      id: `log_${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      stepIndex,
      type: 'error',
      message: `${new Date(currentCandle.timestamp).toLocaleTimeString()} — Erro na IA: ${err.message}`
    });
    return {
      updatedWallet,
      updatedLots,
      newLogs,
      updatedPredictions: evaluatedPredictions,
      guardrailTriggered: false,
      actionTaken: 'wait'
    };
  }

  const probabilidadeAlta = prediction.probabilidadeAlta;
  const probabilidadeQueda = 100 - probabilidadeAlta;

  const predRecord: PredictionRecord = {
    id: `pred_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    sessionId,
    stepIndex,
    timestamp: currentCandle.timestamp,
    priceAtPrediction: currentPrice,
    horizon: config.predictionHorizon,
    probabilidadeAlta,
    justificativa: prediction.justificativa,
    evaluated: false
  };

  const allPredsWithNew = [...evaluatedPredictions, predRecord];

  const timeStr = new Date(currentCandle.timestamp).toLocaleTimeString();
  const activeOpenLotsCount = updatedLots.filter(l => l.status === 'open').length;
  const cooldownElapsed = stepIndex - lastBuyStepIndex >= config.cooldownSteps;
  const underMaxLots = activeOpenLotsCount < config.maxActiveLots;
  const underMaxTrades = updatedWallet.totalTrades < config.maxDailyTrades;

  let amountToSpend = new Decimal(0);
  if (config.buySizeMode === 'fixed') {
    amountToSpend = new Decimal(config.buySizeValue);
  } else {
    amountToSpend = updatedWallet.cashBRL.mul(config.buySizeValue).div(100);
  }

  if (amountToSpend.lt(config.minOrderValueBRL)) {
    amountToSpend = new Decimal(config.minOrderValueBRL);
  }

  if (
    probabilidadeAlta >= config.buyThreshold &&
    updatedWallet.cashBRL.gte(amountToSpend) &&
    underMaxLots &&
    underMaxTrades &&
    cooldownElapsed
  ) {
    const buyRes = calculateBuyOrder({
      cashBRL: updatedWallet.cashBRL,
      amountToSpendBRL: amountToSpend,
      currentPrice,
      feePercent: config.feePercent,
      slippagePercent: config.slippagePercent,
      buyProbability: probabilidadeAlta,
      stepIndex,
      gainTargetPercent: config.gainTargetPercent,
      stopLossPercent: config.stopLossPercent
    });

    if (buyRes.success && buyRes.lot) {
      updatedWallet.cashBRL = buyRes.newCashBRL!;
      updatedWallet.coinQuantity = updatedWallet.coinQuantity.plus(buyRes.lot.quantity);
      updatedWallet.totalFeesPaidBRL = updatedWallet.totalFeesPaidBRL.plus(buyRes.feePaidBRL!);
      updatedWallet.totalTrades += 1;
      updatedLots.push(buyRes.lot);
      actionTaken = 'buy';

      newLogs.push({
        id: `log_${Date.now()}_${Math.random()}`,
        timestamp: Date.now(),
        stepIndex,
        type: 'buy',
        message: `${timeStr} — IA (${probabilidadeAlta}% alta): COMPROU R$ ${amountToSpend.toDecimalPlaces(2)} (${buyRes.lot.quantity.toDecimalPlaces(4)} a R$ ${buyRes.lot.buyPrice.toDecimalPlaces(2)}). Meta: R$ ${buyRes.lot.targetPrice.toDecimalPlaces(2)}`
      });
    }
  } else if (probabilidadeQueda >= config.sellThreshold && config.fallPolicy !== 'ignore') {
    actionTaken = 'sell_signal';
    const lotsToSell = updatedLots.filter(l => {
      if (l.status !== 'open') return false;
      if (config.fallPolicy === 'all') return true;
      if (config.fallPolicy === 'profitable') {
        const unrealized = currentPrice.minus(l.buyPrice).div(l.buyPrice).mul(100);
        return unrealized.gt(config.feePercent * 2);
      }
      return false;
    });

    for (const lot of lotsToSell) {
      const sellRes = calculateSellOrder({
        lot,
        sellPrice: currentPrice,
        feePercent: config.feePercent,
        slippagePercent: config.slippagePercent,
        stepIndex,
        status: 'sold_signal'
      });

      updatedWallet.cashBRL = updatedWallet.cashBRL.plus(sellRes.proceedsBRL);
      updatedWallet.coinQuantity = updatedWallet.coinQuantity.minus(lot.quantity);
      updatedWallet.totalFeesPaidBRL = updatedWallet.totalFeesPaidBRL.plus(sellRes.feeBRL);
      updatedWallet.totalTrades += 1;

      const idx = updatedLots.findIndex(l => l.id === lot.id);
      if (idx !== -1) updatedLots[idx] = sellRes.soldLot;

      newLogs.push({
        id: `log_${Date.now()}_${Math.random()}`,
        timestamp: Date.now(),
        stepIndex,
        type: 'sell',
        message: `${timeStr} — Sinal de queda (${probabilidadeQueda}%): Vendeu lote por R$ ${sellRes.netProfitBRL.toDecimalPlaces(2)}`
      });
    }
  } else {
    actionTaken = 'wait';
    newLogs.push({
      id: `log_${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      stepIndex,
      type: 'info',
      message: `${timeStr} — IA: ${probabilidadeAlta}% alta, ${probabilidadeQueda}% queda. Aguardar. (${prediction.justificativa})`
    });
  }

  return {
    updatedWallet,
    updatedLots,
    newLogs,
    newPrediction: predRecord,
    updatedPredictions: allPredsWithNew,
    guardrailTriggered: false,
    actionTaken
  };
}

import Decimal from 'decimal.js';
import { Candle } from '../types';

export interface PredictionResult {
  probabilidadeAlta: number;
  justificativa: string;
}

export async function getAIPrediction(
  candles: Candle[],
  config: {
    geminiModel: string;
    temperature: number;
    predictionHorizon: number;
    anonymized: boolean;
  }
): Promise<PredictionResult> {
  let normalizedForAI = candles.map(c => ({
    open: c.open.toNumber(),
    high: c.high.toNumber(),
    low: c.low.toNumber(),
    close: c.close.toNumber(),
    volume: c.volume.toNumber()
  }));

  if (config.anonymized && candles.length > 0 && !candles[0].open.isZero()) {
    const baseOpen = candles[0].open;
    normalizedForAI = candles.map(c => ({
      open: c.open.mul(100).div(baseOpen).toDecimalPlaces(2).toNumber(),
      high: c.high.mul(100).div(baseOpen).toDecimalPlaces(2).toNumber(),
      low: c.low.mul(100).div(baseOpen).toDecimalPlaces(2).toNumber(),
      close: c.close.mul(100).div(baseOpen).toDecimalPlaces(2).toNumber(),
      volume: c.volume.toDecimalPlaces(2).toNumber()
    }));
  }

  const response = await fetch('/api/ai/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      candles: normalizedForAI,
      modelName: config.geminiModel || 'gemini-2.5-flash',
      temperature: config.temperature ?? 0.2,
      horizon: config.predictionHorizon ?? 4,
      anonymized: config.anonymized
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Erro ao obter previsão da IA');
  }

  const probabilidadeAlta = Number(data.probabilidadeAlta);
  const justificativa = String(data.justificativa || 'Sem justificativa fornecida.');

  if (isNaN(probabilidadeAlta) || probabilidadeAlta < 0 || probabilidadeAlta > 100) {
    throw new Error('A IA retornou uma probabilidade inválida (deve ser entre 0 e 100).');
  }

  return {
    probabilidadeAlta: Math.max(0, Math.min(100, Math.round(probabilidadeAlta))),
    justificativa
  };
}

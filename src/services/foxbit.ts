import Decimal from 'decimal.js';
import { Candle, Market } from '../types';

export const SUPPORTED_MARKETS: Market[] = [
  { symbol: 'xrpbrl', baseCurrency: 'XRP', quoteCurrency: 'BRL', displayName: 'XRP / BRL' },
  { symbol: 'btcbrl', baseCurrency: 'BTC', quoteCurrency: 'BRL', displayName: 'Bitcoin / BRL' },
  { symbol: 'ethbrl', baseCurrency: 'ETH', quoteCurrency: 'BRL', displayName: 'Ethereum / BRL' },
  { symbol: 'solbrl', baseCurrency: 'SOL', quoteCurrency: 'BRL', displayName: 'Solana / BRL' },
  { symbol: 'usdtbrl', baseCurrency: 'USDT', quoteCurrency: 'BRL', displayName: 'USDT / BRL' },
];

export function parseIntervalToMs(interval: string): number {
  const num = parseInt(interval) || 1;
  if (interval.endsWith('m')) return num * 60 * 1000;
  if (interval.endsWith('h')) return num * 60 * 60 * 1000;
  if (interval.endsWith('d')) return num * 24 * 60 * 60 * 1000;
  return 60 * 60 * 1000; // default 1h
}

export async function fetchFoxbitRaw(endpoint: string, params?: Record<string, string>): Promise<{ url: string; data: any }> {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  const url = `/api/foxbit/${endpoint}${query}`;
  console.log(`[Foxbit API] Fetching: ${url}`);
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || `Erro na API da Foxbit (${response.status})`);
  }
  return { url, data };
}

export async function fetchTicker24hr(market: string): Promise<any> {
  const res = await fetchFoxbitRaw(`markets/${market}/ticker/24hr`);
  return res.data;
}

/**
 * Fetches candlesticks for a market from Foxbit API v3 with pagination and array-of-arrays parsing.
 */
export async function fetchCandlesticks(
  market: string,
  interval: string = '1h',
  startTimeMs?: number,
  endTimeMs?: number,
  maxCandles: number = 1000
): Promise<{ candles: Candle[]; rawResponse: any; urlCalled: string }> {
  let allCandlesMap = new Map<number, Candle>();
  let currentStartTime = startTimeMs ? new Date(startTimeMs) : new Date(Date.now() - 86400000);
  let lastUrl = '';
  let lastRawResponse: any = null;

  let fetchedCount = 0;
  while (fetchedCount < maxCandles) {
    const params: Record<string, string> = {
      interval,
      start_time: currentStartTime.toISOString(),
      limit: '500'
    };

    const { url, data } = await fetchFoxbitRaw(`markets/${market}/candlesticks`, params);
    lastUrl = url;
    lastRawResponse = data;

    // Foxbit v3 candlestick response format: array of arrays or object with data array
    let list: any[] = [];
    if (Array.isArray(data)) {
      list = data;
    } else if (data && Array.isArray(data.data)) {
      list = data.data;
    } else if (data && Array.isArray(data.result)) {
      list = data.result;
    } else {
      throw new Error(`Formato de resposta de candlesticks inválido da Foxbit. Resposta: ${JSON.stringify(data).slice(0, 200)}`);
    }

    if (list.length === 0) {
      break;
    }

    let batchMaxTimestamp = 0;

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      let timestamp: number;
      let openVal: any, highVal: any, lowVal: any, closeVal: any, volumeVal: any;

      if (Array.isArray(item)) {
        // [timestampAbertura(ms), open, high, low, close, timestampFechamento(ms), volumeBase, volumeCotacao, numeroNegocios, ...]
        timestamp = Number(item[0]);
        openVal = item[1];
        highVal = item[2];
        lowVal = item[3];
        closeVal = item[4];
        volumeVal = item[6] !== undefined ? item[6] : item[7];
      } else {
        // Fallback object format
        const timeVal = item.time || item.timestamp || item.t;
        timestamp = typeof timeVal === 'number' ? (timeVal < 10000000000 ? timeVal * 1000 : timeVal) : new Date(timeVal).getTime();
        openVal = item.open !== undefined ? item.open : item.o;
        highVal = item.high !== undefined ? item.high : item.h;
        lowVal = item.low !== undefined ? item.low : item.l;
        closeVal = item.close !== undefined ? item.close : item.c;
        volumeVal = item.volume !== undefined ? item.volume : item.v;
      }

      if (openVal === undefined || highVal === undefined || lowVal === undefined || closeVal === undefined) {
        continue;
      }

      const open = new Decimal(openVal);
      const high = new Decimal(highVal);
      const low = new Decimal(lowVal);
      const close = new Decimal(closeVal);
      const volume = new Decimal(volumeVal || 0);

      if (isNaN(open.toNumber()) || isNaN(close.toNumber()) || isNaN(timestamp)) {
        continue;
      }

      const isNoTrade = volume.isZero() || (open.eq(high) && high.eq(low) && low.eq(close) && volume.isZero());

      const candle: Candle = {
        timestamp,
        open,
        high,
        low,
        close,
        volume,
        isNoTrade
      };

      allCandlesMap.set(timestamp, candle);
      if (timestamp > batchMaxTimestamp) {
        batchMaxTimestamp = timestamp;
      }
    }

    fetchedCount = allCandlesMap.size;

    // If endTimeMs is specified and we passed it, break
    if (endTimeMs && batchMaxTimestamp >= endTimeMs) {
      break;
    }

    // If we received fewer items than limit or batchMaxTimestamp didn't advance, stop pagination
    if (list.length < 50, batchMaxTimestamp === 0 || batchMaxTimestamp <= currentStartTime.getTime()) {
      break;
    }

    // Advance start_time to immediately after the last received candle timestamp
    currentStartTime = new Date(batchMaxTimestamp + parseIntervalToMs(interval));

    // Safety guard against infinite loops
    if (list.length < 10) {
      break;
    }
  }

  const candles = Array.from(allCandlesMap.values());
  candles.sort((a, b) => a.timestamp - b.timestamp);

  // Fill zero volume / missing trades
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].isNoTrade && candles[i].volume.isZero()) {
      candles[i].open = candles[i - 1].close;
      candles[i].high = candles[i - 1].close;
      candles[i].low = candles[i - 1].close;
      candles[i].close = candles[i - 1].close;
    }
  }

  return {
    candles,
    rawResponse: lastRawResponse,
    urlCalled: lastUrl
  };
}

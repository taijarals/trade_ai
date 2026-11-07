import Decimal from 'decimal.js';
import { Candle, Market } from '../types';

export const SUPPORTED_MARKETS: Market[] = [
  { symbol: 'xrpbrl', baseCurrency: 'XRP', quoteCurrency: 'BRL', displayName: 'XRP / BRL' },
  { symbol: 'btcbrl', baseCurrency: 'BTC', quoteCurrency: 'BRL', displayName: 'Bitcoin / BRL' },
  { symbol: 'ethbrl', baseCurrency: 'ETH', quoteCurrency: 'BRL', displayName: 'Ethereum / BRL' },
  { symbol: 'solbrl', baseCurrency: 'SOL', quoteCurrency: 'BRL', displayName: 'Solana / BRL' },
  { symbol: 'usdtbrl', baseCurrency: 'USDT', quoteCurrency: 'BRL', displayName: 'USDT / BRL' },
];

export async function fetchFoxbitRaw(endpoint: string, params?: Record<string, string>): Promise<any> {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  const response = await fetch(`/api/foxbit/${endpoint}${query}`);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || `Erro na API da Foxbit (${response.status})`);
  }
  return data;
}

export async function fetchTicker24hr(market: string): Promise<any> {
  return fetchFoxbitRaw(`markets/${market}/ticker/24hr`);
}

/**
 * Fetches candlesticks for a market from Foxbit API v3.
 * Validates fields strictly. Throws error if invalid or missing data.
 */
export async function fetchCandlesticks(
  market: string,
  resolution: string = '1h',
  from?: number,
  to?: number,
  limit: number = 300
): Promise<Candle[]> {
  const params: Record<string, string> = {
    resolution,
    limit: String(limit)
  };
  if (from) params.from = String(Math.floor(from / 1000));
  if (to) params.to = String(Math.floor(to / 1000));

  const raw = await fetchFoxbitRaw(`markets/${market}/candlesticks`, params);
  
  // Foxbit v3 candlestick response structure handling
  // Typically an array of candles or an object containing data array
  let list: any[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && Array.isArray(raw.data)) {
    list = raw.data;
  } else if (raw && Array.isArray(raw.result)) {
    list = raw.result;
  } else {
    // Diagnostic check
    throw new Error(`Formato de resposta de candlesticks inválido da Foxbit para o mercado ${market}. Resposta bruta: ${JSON.stringify(raw).slice(0, 200)}`);
  }

  if (list.length === 0) {
    throw new Error(`A API da Foxbit retornou 0 candles para o mercado ${market} no período selecionado.`);
  }

  const candles: Candle[] = list.map((item, index) => {
    // Validate required fields
    const timeVal = item.time || item.timestamp || item.t;
    const openVal = item.open !== undefined ? item.open : item.o;
    const highVal = item.high !== undefined ? item.high : item.h;
    const lowVal = item.low !== undefined ? item.low : item.l;
    const closeVal = item.close !== undefined ? item.close : item.c;
    const volumeVal = item.volume !== undefined ? item.volume : item.v;

    if (openVal === undefined || highVal === undefined || lowVal === undefined || closeVal === undefined) {
      throw new Error(`Candle #${index} da Foxbit possui campos de preço ausentes ou inválidos.`);
    }

    const timestamp = typeof timeVal === 'number' 
      ? (timeVal < 10000000000 ? timeVal * 1000 : timeVal) 
      : new Date(timeVal).getTime();

    const open = new Decimal(openVal);
    const high = new Decimal(highVal);
    const low = new Decimal(lowVal);
    const close = new Decimal(closeVal);
    const volume = new Decimal(volumeVal || 0);

    if (isNaN(open.toNumber()) || isNaN(close.toNumber())) {
      throw new Error(`Candle #${index} contém valores numéricos inválidos.`);
    }

    const isNoTrade = volume.isZero() || (open.eq(high) && high.eq(low) && low.eq(close) && volume.isZero());

    return {
      timestamp: isNaN(timestamp) ? Date.now() : timestamp,
      open,
      high,
      low,
      close,
      volume,
      isNoTrade
    };
  });

  // Sort ascending by timestamp
  candles.sort((a, b) => a.timestamp - b.timestamp);

  // For consecutive candles with zero volume or missing trade, repeat last close price if needed or mark isNoTrade
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].isNoTrade && candles[i].volume.isZero()) {
      candles[i].open = candles[i - 1].close;
      candles[i].high = candles[i - 1].close;
      candles[i].low = candles[i - 1].close;
      candles[i].close = candles[i - 1].close;
    }
  }

  return candles;
}

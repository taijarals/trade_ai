import Decimal from 'decimal.js';

export type AppMode = 'replay' | 'live';

export type FallPolicy = 'ignore' | 'profitable' | 'all';

export type GuardrailAction = 'stop' | 'sell_all';

export interface Market {
  symbol: string;         // e.g. "xrpbrl", "btcbrl", "ethbrl"
  baseCurrency: string;   // e.g. "XRP"
  quoteCurrency: string;  // e.g. "BRL"
  displayName: string;
}

export interface Candle {
  timestamp: number;      // Epoch ms
  open: Decimal;
  high: Decimal;
  low: Decimal;
  close: Decimal;
  volume: Decimal;
  isNoTrade?: boolean;    // true if volume is zero or missing
}

export interface RawCandle {
  time?: string | number;
  timestamp?: number;
  open: string | number;
  high: string | number;
  low: string | number;
  close: string | number;
  volume: string | number;
}

export interface Lot {
  id: string;
  createdAt: number;
  stepIndex: number;
  buyPrice: Decimal;
  quantity: Decimal;
  spentBRL: Decimal;
  feeBRL: Decimal;
  buyProbability: number;
  targetPrice: Decimal;
  stopLossPrice: Decimal | null;
  status: 'open' | 'sold_target' | 'sold_stop' | 'sold_signal' | 'sold_guardrail' | 'open_at_end';
  soldAtPrice?: Decimal;
  soldAtTime?: number;
  soldAtStep?: number;
  netProceedsBRL?: Decimal;
  netProfitBRL?: Decimal;
  netProfitPercent?: Decimal;
}

export interface WalletState {
  cashBRL: Decimal;
  coinQuantity: Decimal;
  initialCapitalBRL: Decimal;
  initialCoinQuantity: Decimal;
  totalFeesPaidBRL: Decimal;
  totalTrades: number;
}

export interface PredictionRecord {
  id: string;
  sessionId: string;
  stepIndex: number;
  timestamp: number;
  priceAtPrediction: Decimal;
  horizon: number;
  probabilidadeAlta: number;
  justificativa: string;
  actualPrice?: Decimal;
  didPriceRise?: boolean;
  evaluated?: boolean;
  correct?: boolean;
  isTie?: boolean;
}

export interface Config {
  market: string;               // e.g. "xrpbrl"
  resolution: string;           // e.g. "1m", "5m", "15m", "1h"
  mode: AppMode;
  replayDate: string;           // YYYY-MM-DD
  replayStartTime: string;      // HH:MM (Brasília)
  replayEndTime: string;        // HH:MM (Brasília)
  replayDelayMs: number;        // e.g. 3000
  initialCapitalBRL: number;    // default 100
  initialCoins: number;         // default 0
  feePercent: number;           // default 0.5 (%)
  slippagePercent: number;      // default 0.1 (%)
  minOrderValueBRL: number;     // default 10
  buySizeMode: 'fixed' | 'percent'; // 'fixed' or 'percent'
  buySizeValue: number;         // e.g. 20 (R$ or %)
  candleWindowSize: number;     // default 30
  predictionHorizon: number;    // default 4 candles
  geminiModel: string;          // 'gemini-2.5-flash' or 'gemini-2.5-pro'
  temperature: number;          // default 0.2
  anonymized: boolean;          // default true
  buyThreshold: number;         // default 70 (%)
  sellThreshold: number;        // default 85 (%)
  fallPolicy: FallPolicy;       // 'ignore', 'profitable', 'all'
  gainTargetPercent: number;    // default 3 (%)
  stopLossPercent: number | null; // default 5 (%) or null
  cooldownSteps: number;        // default 2
  maxActiveLots: number;        // default 5
  maxDailyTrades: number;       // default 20
  generalGuardrailPercent: number; // default 20 (%)
  guardrailAction: GuardrailAction; // 'stop' or 'sell_all'
  dailyLossLimitBRL: number | null; // null or number
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
  config: Partial<Config>;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  stepIndex: number;
  type: 'info' | 'buy' | 'sell' | 'guardrail' | 'warning' | 'error';
  message: string;
}

export interface SessionRecord {
  id: string;
  title: string;
  createdAt: number;
  config: Config;
  status: 'completed' | 'stopped' | 'guardrail_triggered' | 'error' | 'running';
  initialNetWorthBRL: string;
  finalNetWorthBRL: string;
  buyAndHoldNetWorthBRL: string;
  totalReturnPercent: string;
  buyAndHoldReturnPercent: string;
  totalFeesBRL: string;
  aiCallsCount: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  lots: Lot[];
  predictions: PredictionRecord[];
  netWorthHistory: { timestamp: number; netWorth: Decimal; buyAndHold: Decimal; price: Decimal }[];
  logs: LogEntry[];
  notes: string;
}

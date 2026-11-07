import Decimal from 'decimal.js';
import { calculateBuyOrder, calculateSellOrder } from '../src/utils/wallet';
import { processStep } from '../src/utils/engine';
import { Candle, Config, WalletState, Lot } from '../src/types';
import { DEFAULT_CONFIG } from '../src/services/storage';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

async function runVerification() {
  console.log('--- Running Wallet & Stop-Loss Daily Limit Verification Tests ---');

  const cashBRL = new Decimal(100);
  const amountToSpendBRL = new Decimal(20);
  const currentPrice = new Decimal(10.00);
  const feePercent = 0.5; // 0.5%
  const slippagePercent = 0;
  const gainTargetPercent = 3.0; // 3%

  const buyResult = calculateBuyOrder({
    cashBRL,
    amountToSpendBRL,
    currentPrice,
    feePercent,
    slippagePercent,
    buyProbability: 80,
    stepIndex: 1,
    gainTargetPercent,
    stopLossPercent: 5.0
  });

  assert(buyResult.success && !!buyResult.lot, 'Buy order successful');
  const lot = buyResult.lot!;

  const expectedQty = new Decimal(1.99);
  assert(lot.quantity.minus(expectedQty).abs().lte(0.001), `Quantity is 1.99 (got ${lot.quantity.toString()})`);

  const expectedTarget = new Decimal(10.30);
  assert(lot.targetPrice.minus(expectedTarget).abs().lte(0.001), `Target price is 10.30 (got ${lot.targetPrice.toString()})`);

  // Test 2: Daily limit = 1, buy at step 5, step 6 candle has low below stop loss -> lot must sell at stop loss even with daily limit reached
  console.log('--- Running Daily Limit Stop-Loss Execution Test ---');

  (global as any).fetch = async (url: string) => {
    if (url.includes('/api/ai/predict')) {
      return {
        ok: true,
        json: async () => ({
          probabilidadeAlta: 90,
          justificativa: 'Teste'
        })
      };
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const mockCandles: Candle[] = Array.from({ length: 10 }, (_, i) => ({
    timestamp: Date.now() + i * 3600000,
    open: new Decimal(10),
    high: new Decimal(10.5),
    low: i === 6 ? new Decimal(9.0) : new Decimal(9.5), // candle 6 has low 9.0 (below stop loss 9.50)
    close: new Decimal(10),
    volume: new Decimal(1000)
  }));

  let wallet: WalletState = {
    cashBRL: new Decimal(100),
    coinQuantity: new Decimal(0),
    initialCapitalBRL: new Decimal(100),
    initialCoinQuantity: new Decimal(0),
    totalFeesPaidBRL: new Decimal(0),
    totalTrades: 0
  };

  const testConfig: Config = {
    ...DEFAULT_CONFIG,
    buyThreshold: 70,
    buySizeMode: 'fixed',
    buySizeValue: 20,
    maxDailyTrades: 1,
    stopLossPercent: 5.0, // stop loss at 9.50
    candleWindowSize: 5,
    cooldownSteps: 0
  };

  let allLots: Lot[] = [];
  let predictions: any[] = [];

  // Step 5: Buy
  const res1 = await processStep({
    stepIndex: 5,
    candles: mockCandles,
    currentCandleIndex: 5,
    wallet,
    openLots: allLots.filter(l => l.status === 'open'),
    allLots,
    config: testConfig,
    predictions,
    sessionId: 'test_session',
    lastBuyStepIndex: -99,
    initialSessionPrice: new Decimal(10),
    canOpenTrades: true
  });

  wallet = res1.updatedWallet;
  allLots = res1.updatedLots;
  predictions = res1.updatedPredictions;

  assert(allLots.length === 1 && allLots[0].status === 'open', 'Lot opened at step 5');

  // Step 6: Daily limit reached (maxDailyTrades = 1), but candle low (9.0) hits stop loss -> must sell at stop loss
  const res2 = await processStep({
    stepIndex: 6,
    candles: mockCandles,
    currentCandleIndex: 6,
    wallet,
    openLots: allLots.filter(l => l.status === 'open'),
    allLots,
    config: testConfig,
    predictions,
    sessionId: 'test_session',
    lastBuyStepIndex: 5,
    initialSessionPrice: new Decimal(10),
    canOpenTrades: false // daily limit reached
  });

  wallet = res2.updatedWallet;
  allLots = res2.updatedLots;

  assert(allLots[0].status === 'sold_stop', `Lot sold at stop loss even with daily limit reached (status: ${allLots[0].status})`);

  console.log('All verification tests passed successfully!');
}

runVerification();

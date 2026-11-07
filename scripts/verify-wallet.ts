import Decimal from 'decimal.js';
import { calculateBuyOrder } from '../src/utils/wallet';
import { WalletState, Lot } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

function runVerification() {
  console.log('--- Running Wallet & Replay Verification Tests ---');

  // Test 1: Required Wallet & Lot Test Case
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

  // Quantity = 1.99
  const expectedQty = new Decimal(1.99);
  assert(lot.quantity.minus(expectedQty).abs().lte(0.001), `Quantity is 1.99 (got ${lot.quantity.toString()})`);

  // Target price (3%) = 10.30
  const expectedTarget = new Decimal(10.30);
  assert(lot.targetPrice.minus(expectedTarget).abs().lte(0.001), `Target price is 10.30 (got ${lot.targetPrice.toString()})`);

  // Sell at 10.30
  const sellResult = calculateSellOrderTest(lot, new Decimal(10.30), feePercent, slippagePercent, 5);

  // Net proceeds ≈ 20.394515
  const expectedProceeds = new Decimal(20.394515);
  assert(sellResult.proceedsBRL.minus(expectedProceeds).abs().lte(0.001), `Net proceeds ≈ 20.394 (got ${sellResult.proceedsBRL.toString()})`);

  // Net profit ≈ 0.394515
  const expectedProfit = new Decimal(0.394515);
  assert(sellResult.netProfitBRL.minus(expectedProfit).abs().lte(0.001), `Net profit ≈ 0.394 (got ${sellResult.netProfitBRL.toString()})`);

  // Test 2: Replay Test (3 consecutive steps with forced buy)
  console.log('--- Running Replay 3-Step Forced Buy Test ---');
  let wallet: WalletState = {
    cashBRL: new Decimal(100),
    coinQuantity: new Decimal(0),
    initialCapitalBRL: new Decimal(100),
    initialCoinQuantity: new Decimal(0),
    totalFeesPaidBRL: new Decimal(0),
    totalTrades: 0
  };

  let allLots: Lot[] = [];

  for (let step = 1; step <= 3; step++) {
    const buyRes = calculateBuyOrder({
      cashBRL: wallet.cashBRL,
      amountToSpendBRL: new Decimal(20),
      currentPrice: new Decimal(10),
      feePercent: 0.5,
      slippagePercent: 0,
      buyProbability: 80,
      stepIndex: step,
      gainTargetPercent: 3.0,
      stopLossPercent: 5.0
    });

    assert(buyRes.success && !!buyRes.lot, `Step ${step} buy order successful`);
    const newLot = buyRes.lot!;
    wallet.cashBRL = buyRes.newCashBRL!;
    wallet.coinQuantity = wallet.coinQuantity.plus(newLot.quantity);
    wallet.totalFeesPaidBRL = wallet.totalFeesPaidBRL.plus(buyRes.feePaidBRL!);
    wallet.totalTrades += 1;
    allLots.push(newLot);
  }

  const openLotsCount = allLots.filter(l => l.status === 'open').length;
  assert(openLotsCount === 3, `Expected 3 open lots after 3 steps (got ${openLotsCount})`);
  assert(wallet.cashBRL.equals(40), `Expected cash BRL to be 40 (got ${wallet.cashBRL.toString()})`);

  console.log('All verification tests passed successfully!');
}

function calculateSellOrderTest(lot: Lot, sellPrice: Decimal, feePercent: number, slippagePercent: number, stepIndex: number) {
  const slippageMultiplier = new Decimal(1).minus(new Decimal(slippagePercent).div(100));
  const effectiveSellPrice = sellPrice.mul(slippageMultiplier);
  const grossProceedsBRL = lot.quantity.mul(effectiveSellPrice);
  const feeRate = new Decimal(feePercent).div(100);
  const feeBRL = grossProceedsBRL.mul(feeRate);
  const netProceedsBRL = grossProceedsBRL.minus(feeBRL);
  const totalInvestedBRL = lot.spentBRL;
  const netProfitBRL = netProceedsBRL.minus(totalInvestedBRL);
  const netProfitPercent = totalInvestedBRL.isZero() ? new Decimal(0) : netProfitBRL.div(totalInvestedBRL).mul(100);

  return {
    proceedsBRL: netProceedsBRL,
    netProfitBRL,
    netProfitPercent
  };
}

runVerification();

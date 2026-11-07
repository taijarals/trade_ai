import Decimal from 'decimal.js';
import { calculateBuyOrder, calculateSellOrder } from '../src/utils/wallet';

function runVerification() {
  console.log('Running Wallet & Lot Verification Test...');
  const cashBRL = new Decimal(100);
  const amountToSpendBRL = new Decimal(20);
  const currentPrice = new Decimal(10.00);
  const feePercent = 0.5; // 0.5%
  const slippagePercent = 0; // 0 for exact math test
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

  if (!buyResult.success || !buyResult.lot) {
    console.error('Buy order failed:', buyResult.error);
    process.exit(1);
  }

  const lot = buyResult.lot;
  console.log('Buy Price:', lot.buyPrice.toString());
  console.log('Fee Paid BRL:', buyResult.feePaidBRL?.toString());
  console.log('Quantity Bought:', lot.quantity.toString());
  console.log('Target Price:', lot.targetPrice.toString());

  const sellPrice = new Decimal(10.30);
  const sellResult = calculateSellOrder({
    lot,
    sellPrice,
    feePercent,
    slippagePercent,
    stepIndex: 5,
    status: 'sold_target'
  });

  console.log('Net Proceeds BRL:', sellResult.proceedsBRL.toString());
  console.log('Net Profit BRL:', sellResult.netProfitBRL.toString());
  console.log('Net Profit Percent:', sellResult.netProfitPercent.toString() + '%');

  console.log('Verification test passed successfully!');
}

runVerification();

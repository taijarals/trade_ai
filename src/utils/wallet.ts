import Decimal from 'decimal.js';
import { Lot, WalletState } from '../types';

export function calculateBuyOrder({
  cashBRL,
  amountToSpendBRL,
  currentPrice,
  feePercent,
  slippagePercent,
  buyProbability,
  stepIndex,
  gainTargetPercent,
  stopLossPercent
}: {
  cashBRL: Decimal;
  amountToSpendBRL: Decimal;
  currentPrice: Decimal;
  feePercent: number; // e.g. 0.5 for 0.5%
  slippagePercent: number; // e.g. 0.1 for 0.1%
  buyProbability: number;
  stepIndex: number;
  gainTargetPercent: number; // e.g. 3 (%)
  stopLossPercent: number | null; // e.g. 5 (%) or null
}): {
  success: boolean;
  lot?: Lot;
  newCashBRL?: Decimal;
  feePaidBRL?: Decimal;
  error?: string;
} {
  if (cashBRL.lt(amountToSpendBRL)) {
    return { success: false, error: 'Saldo em reais insuficiente para o lote.' };
  }

  // Apply slippage to buy price: price * (1 + slippage/100)
  const slippageMultiplier = new Decimal(1).plus(new Decimal(slippagePercent).div(100));
  const effectiveBuyPrice = currentPrice.mul(slippageMultiplier);

  // Fee on spent BRL
  const feeRate = new Decimal(feePercent).div(100);
  const feeBRL = amountToSpendBRL.mul(feeRate);
  const netSpentBRL = amountToSpendBRL.minus(feeBRL);

  if (netSpentBRL.lte(0)) {
    return { success: false, error: 'Valor líquido após taxa é inválido ou zero.' };
  }

  // Quantity bought = netSpentBRL / effectiveBuyPrice
  const quantity = netSpentBRL.div(effectiveBuyPrice);

  // Target price = buyPrice * (1 + gainTargetPercent / 100)
  const targetMultiplier = new Decimal(1).plus(new Decimal(gainTargetPercent).div(100));
  const targetPrice = effectiveBuyPrice.mul(targetMultiplier);

  // Stop loss price = buyPrice * (1 - stopLossPercent / 100)
  let stopLossPrice: Decimal | null = null;
  if (stopLossPercent !== null && stopLossPercent > 0) {
    const stopMultiplier = new Decimal(1).minus(new Decimal(stopLossPercent).div(100));
    stopLossPrice = effectiveBuyPrice.mul(stopMultiplier);
  }

  const lot: Lot = {
    id: `lot_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    createdAt: Date.now(),
    stepIndex,
    buyPrice: effectiveBuyPrice,
    quantity,
    spentBRL: amountToSpendBRL,
    feeBRL,
    buyProbability,
    targetPrice,
    stopLossPrice,
    status: 'open'
  };

  const newCashBRL = cashBRL.minus(amountToSpendBRL);

  return {
    success: true,
    lot,
    newCashBRL,
    feePaidBRL: feeBRL
  };
}

export function calculateSellOrder({
  lot,
  sellPrice,
  feePercent,
  slippagePercent,
  stepIndex,
  status = 'sold_target'
}: {
  lot: Lot;
  sellPrice: Decimal;
  feePercent: number;
  slippagePercent: number;
  stepIndex: number;
  status?: Lot['status'];
}): {
  soldLot: Lot;
  proceedsBRL: Decimal;
  feeBRL: Decimal;
  netProfitBRL: Decimal;
  netProfitPercent: Decimal;
} {
  // Apply slippage to sell price: price * (1 - slippage/100)
  const slippageMultiplier = new Decimal(1).minus(new Decimal(slippagePercent).div(100));
  const effectiveSellPrice = sellPrice.mul(slippageMultiplier);

  // Gross proceeds = quantity * effectiveSellPrice
  const grossProceedsBRL = lot.quantity.mul(effectiveSellPrice);

  // Fee on gross proceeds
  const feeRate = new Decimal(feePercent).div(100);
  const feeBRL = grossProceedsBRL.mul(feeRate);
  const netProceedsBRL = grossProceedsBRL.minus(feeBRL);

  // Total invested including buy fee
  const totalInvestedBRL = lot.spentBRL; // spentBRL already includes buy amount (which had fee deducted or added)
  // Let's check net profit: netProceedsBRL - lot.spentBRL
  const netProfitBRL = netProceedsBRL.minus(totalInvestedBRL);
  const netProfitPercent = totalInvestedBRL.isZero() ? new Decimal(0) : netProfitBRL.div(totalInvestedBRL).mul(100);

  const soldLot: Lot = {
    ...lot,
    status,
    soldAtPrice: effectiveSellPrice,
    soldAtTime: Date.now(),
    soldAtStep: stepIndex,
    netProceedsBRL,
    netProfitBRL,
    netProfitPercent
  };

  return {
    soldLot,
    proceedsBRL: netProceedsBRL,
    feeBRL,
    netProfitBRL,
    netProfitPercent
  };
}

export function calculateNetWorth({
  cashBRL,
  coinQuantity,
  currentPrice
}: {
  cashBRL: Decimal;
  coinQuantity: Decimal;
  currentPrice: Decimal;
}): {
  netWorthBRL: Decimal;
  coinValueBRL: Decimal;
} {
  const coinValueBRL = coinQuantity.mul(currentPrice);
  const netWorthBRL = cashBRL.plus(coinValueBRL);
  return { netWorthBRL, coinValueBRL };
}

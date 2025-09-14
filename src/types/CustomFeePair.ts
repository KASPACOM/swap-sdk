import { CurrencyAmount, Token } from '@uniswap/sdk-core';
import { Pair as UniPair } from '@uniswap/v2-sdk';
import JSBI from 'jsbi';


export class CustomFeePair extends UniPair {
  // Override getOutputAmount for 1% fee
  getOutputAmount(inputAmount: CurrencyAmount<Token>): [CurrencyAmount<Token>, CustomFeePair] {
    const inputReserve = this.reserveOf(inputAmount.currency);
    const outputCurrency = this.token0.equals(inputAmount.currency) ? this.token1 : this.token0;
    const outputReserve = this.reserveOf(outputCurrency);

    const feeNumerator = JSBI.BigInt(99); // 1% fee
    const feeDenominator = JSBI.BigInt(100);

    const inputAmountWithFee = JSBI.divide(JSBI.multiply(inputAmount.quotient, feeNumerator), feeDenominator);
    const numerator = JSBI.multiply(inputAmountWithFee, outputReserve.quotient);
    const denominator = JSBI.add(inputReserve.quotient, inputAmountWithFee);

    const outputAmount = JSBI.divide(numerator, denominator);

    return [
      CurrencyAmount.fromRawAmount(outputCurrency, outputAmount),
      this,
    ];
  }

  // Override getInputAmount for 1% fee
  getInputAmount(outputAmount: CurrencyAmount<Token>): [CurrencyAmount<Token>, CustomFeePair] {

    const outputReserve = this.reserveOf(outputAmount.currency);
    const inputCurrency = this.token0.equals(outputAmount.currency) ? this.token1 : this.token0;
    const inputReserve = this.reserveOf(inputCurrency);


    const feeNumerator = JSBI.BigInt(100);
    const feeDenominator = JSBI.BigInt(99); // invert to account for 1% fee

    const numerator = JSBI.multiply(JSBI.multiply(inputReserve.quotient, outputAmount.quotient), feeNumerator);
    const denominator = JSBI.multiply(JSBI.subtract(outputReserve.quotient, outputAmount.quotient), feeDenominator);

    if (JSBI.lessThanOrEqual(denominator, JSBI.BigInt(0))) {
      throw new Error('Insufficient liquidity for this trade');
    }
    
    const inputAmount = JSBI.add(JSBI.divide(numerator, denominator), JSBI.BigInt(1));

    return [
      CurrencyAmount.fromRawAmount(inputCurrency, inputAmount),
      this,
    ];
  }
}


import { WalletService } from '../services/wallet.service';
import { PARTNER_FEE_BPS_DIVISOR, SwapService } from '../services/swap.service';
import {
  SwapWidgetOptions,
  SwapSettings,
  SwapControllerOutput,
  SwapControllerInput,
  LoaderStatuses,
} from '../types';
import { SwapWidgetNetworkConfig } from '../types/networks';

const DEFAULT_SETTINGS: SwapSettings = {
  maxSlippage: '0.5',
  swapDeadline: 20,
}

export class SwapSdkController {
  private walletService: WalletService | undefined;
  private swapService: SwapService | undefined;

  private state: SwapControllerOutput = {
    loader: null,
  };



  private input: SwapControllerInput = {
    fromToken: null,
    toToken: null,
    amount: undefined,
    isOutputAmount: false,
    settings: DEFAULT_SETTINGS,
  };



  private options: SwapWidgetOptions;

  constructor(options: SwapWidgetOptions) {
    this.options = options;

    this.initServices();
  }

  initServices(): void {
    this.walletService = new WalletService(
      (this.options.networkConfig as SwapWidgetNetworkConfig),
      this.options.walletProvider
    );

    this.swapService = new SwapService(
      this.walletService.getProvider()!,
      (this.options.networkConfig as SwapWidgetNetworkConfig),
      this.options,
    );
  }

  private setChange(patch: Partial<SwapControllerOutput>): void {
    const next: SwapControllerOutput = {
      ...this.state,
      ...patch,
    };
    this.state = next;
    if (typeof this.options.onChange === 'function') {
      this.options.onChange(next, patch);
    }
  }

  async connectWallet(): Promise<string> {
    const address = await this.walletService!.connect();
    const signer = this.walletService!.getSigner();
    if (signer) this.swapService!.setSigner(signer);
    return address;
  }

  disconnectWallet(): void {
    this.walletService!.disconnect();
    this.swapService!.setSigner(null as any);
  }

  getState(): SwapControllerOutput {
    return this.state;
  }

  private get settings(): SwapSettings {
    return {
      ...DEFAULT_SETTINGS,
      ...(this.input.settings || {}),
    };
  }


  async calculateQuoteIfNeeded(): Promise<void> {
    const { fromToken, toToken, amount, isOutputAmount } = this.input;
    if (!fromToken || !toToken || !amount || amount <= 0) {
      return;
    }

    // Set loader to calculating
    this.setChange({ loader: LoaderStatuses.CALCULATING_QUOTE, error: undefined });


    try {
      // Use the calculateTrade method which returns both trade and computed amounts
      const tradeResult = await this.swapService!.calculateTrade(
        fromToken,
        toToken,
        String(amount),
        isOutputAmount == true, // isOutputAmount: true for input amount, false for output amount
        this.settings.maxSlippage
      );

      this.setChange({
        computed: tradeResult.computed,
        tradeInfo: tradeResult.trade,
        loader: null,
      });
    } catch (error: any) {
      this.setChange({ error: error?.message || String(error), loader: null });
    }
  }

  async setData(input: Partial<SwapControllerInput>): Promise<void> {
    // Merge input and settings
    this.input = {
      ...this.input,
      ...input,
    };

    await this.calculateQuoteIfNeeded();
  }

  async approveIfNeeded(): Promise<string | undefined> {
    if (!this.input || !this.walletService!.isConnected()) throw new Error('Wallet not connected or input missing');
    const { fromToken, amount } = this.input;
    if (!fromToken || amount === undefined || !this.state.computed?.amountInRaw) throw new Error('fromToken or amount missing');

    this.setChange({ loader: LoaderStatuses.APPROVING });

    try {
      const tx = await this.swapService?.approveIfNeedApproval(
        fromToken,
        BigInt(this.state.computed.amountInRaw),
      )

      let receipt;

      if (tx) {
        this.setChange({ approveTxHash: tx.hash });
        receipt = await tx.wait();

        if (!receipt) {
          throw new Error("Receipt not found, Please try again")
        }

        if (receipt.status != 1) {
          throw new Error("Transaction Rejected");
        }
      }

      return receipt?.hash;
    } catch (error: any) {
      this.setChange({ error: error?.message || String(error), loader: null });
      throw error;
    }
  }

  async swap(): Promise<string> {
    try {

      this.setChange({
        txHash: undefined,
        approveTxHash: undefined,
      })
      const { fromToken, toToken, amount, isOutputAmount } = this.input;
      if (!fromToken || !toToken || amount === undefined) throw new Error('Tokens or amount not set');

      await this.approveIfNeeded();

      this.setChange({ loader: LoaderStatuses.SWAPPING });

      // Get the trade path from the tradeInfo
      const trade = this.state.tradeInfo;
      if (!trade) throw new Error('Trade info missing - calculate quote first');

      // Extract path from the trade route
      const path = trade.route.path.map(token => token.address);
      if (path.length === 0) throw new Error('Trade path missing');

      // Use the computed amounts for the swap
      const computed = this.state.computed;
      if (!computed) throw new Error('Computed amounts missing');

      const transaction = await this.swapService!.swapTokens(
        fromToken,
        toToken,
        computed.maxAmountInRaw || computed.amountInRaw,
        computed.minAmountOutRaw || computed.amountOutRaw,
        path,
        this.input.isOutputAmount == true,
        this.settings.swapDeadline
      );


      this.setChange({ txHash: transaction.hash });

      const receipt = await transaction.wait();

      if (!receipt) {
        throw new Error("Receipt not found, Please try again")
      }

      if (receipt.status != 1) {
        throw new Error("Transaction Rejected");
      }

      this.setChange({
        loader: null,
      });

      return receipt.hash;
    } catch (error: any) {
      this.setChange({ error: error?.message || String(error), loader: null });
      throw error;
    }
  }

  async getPartnerFee(): Promise<number> {
    return Number(await this.swapService!.loadPartnerFee()) / Number(PARTNER_FEE_BPS_DIVISOR);
  }
} 
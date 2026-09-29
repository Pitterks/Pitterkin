import { HDNodeWallet } from "ethers";

/**
 * Address i of the store wallet, derived from the account-level xpub
 * (m/44'/60'/0'/0). Only public data lives on the server: it can receive
 * funds but can never spend them. Sweeping is done offline with the seed.
 */
export function deriveAddress(xpub: string, index: number): string {
  return HDNodeWallet.fromExtendedKey(xpub).deriveChild(index).address.toLowerCase();
}

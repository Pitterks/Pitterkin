import { HDNodeWallet } from "ethers";

// Run this ON YOUR OWN COMPUTER, offline if possible. Never on the server.
const w = HDNodeWallet.createRandom(undefined, "m/44'/60'/0'/0");
console.log("\n=== KEEP THE PHRASE OFFLINE. Anyone with it can take all funds. ===\n");
console.log("Seed phrase :", w.mnemonic!.phrase);
console.log("\nPut ONLY this into the server's CRYPTO_XPUB (public, cannot spend):\n");
console.log("CRYPTO_XPUB=" + w.neuter().extendedKey);
console.log("\nFirst deposit address (index 0):", w.deriveChild(0).address, "\n");

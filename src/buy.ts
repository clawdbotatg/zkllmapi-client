import { createPublicClient, createWalletClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { Barretenberg, Fr } from "@aztec/bb.js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import {
  CONTRACTS, ROUTER_ABI, PRICING_ABI, APICREDITS_ABI,
  getPrivateKey, getRpcUrl,
} from "./config.js";

interface Credit {
  nullifier: string;
  secret: string;
  commitment: string;
  spent: boolean;
}

function randomField(): bigint {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  return BigInt("0x" + Buffer.from(bytes).toString("hex"));
}

function loadCredits(): Credit[] {
  if (!existsSync("credits.json")) return [];
  return JSON.parse(readFileSync("credits.json", "utf-8"));
}

function saveCredits(credits: Credit[]) {
  writeFileSync("credits.json", JSON.stringify(credits, null, 2));
}

export async function buy(count = 1) {
  const account = privateKeyToAccount(getPrivateKey());
  const transport = http(getRpcUrl());
  const publicClient = createPublicClient({ chain: base, transport });
  const walletClient = createWalletClient({ chain: base, transport, account });

  console.log(`Wallet: ${account.address}`);
  console.log(`Buying ${count} credit(s) in one transaction...`);

  // Step 1: Generate nullifier + secret for each credit
  const bb = await Barretenberg.new({ threads: 1 });
  const newCredits: { nullifier: bigint; secret: bigint; commitment: bigint }[] = [];

  console.log("Computing commitments (poseidon2)...");
  for (let i = 0; i < count; i++) {
    const nullifier = randomField();
    const secret = randomField();
    const commitmentFr = await bb.poseidon2Hash([new Fr(nullifier), new Fr(secret)]);
    const commitment = BigInt("0x" + Buffer.from(commitmentFr.value).toString("hex"));
    newCredits.push({ nullifier, secret, commitment });
    console.log(`  [${i + 1}/${count}] commitment: ${commitment.toString().slice(0, 20)}...`);
  }
  await bb.destroy();

  // Step 2: Quote ETH cost + dynamic minCLAWDOut from oracle
  console.log("\nFetching pricing...");
  const oracleData = await publicClient.readContract({
    address: CONTRACTS.CLAWDPricing,
    abi: PRICING_ABI,
    functionName: "getOracleData",
  });

  const [clawdPerEth, , pricePerCreditCLAWD] = oracleData;
  // ETH for all credits + 25% buffer for price movement
  const ethNeeded = (pricePerCreditCLAWD * BigInt(count) * 125n * 10n ** 18n) / (clawdPerEth * 100n);
  console.log(`ETH needed for ${count} credits (25% buffer): ${formatEther(ethNeeded)} ETH`);

  // minCLAWDOut = oracle price per credit * count with 5% slippage (matches router's totalCLAWD calculation)
  // NOTE: set to 1 (minimum) because Uniswap spot price may diverge from oracle TWAP.
  // The router itself reverts if clawdReceived < totalCLAWD after the swap, so we don't
  // need Uniswap's slippage protection here.
  const minCLAWDOut = 1n;
  console.log(`minCLAWDOut: ${minCLAWDOut} (oracle-computed, router checks clawdReceived >= totalCLAWD)`);

  // Step 3: Buy all commitments in one tx
  const commitmentArgs = newCredits.map(c => c.commitment);
  console.log("\nSending buyWithETH transaction...");
  const hash = await walletClient.writeContract({
    address: CONTRACTS.CLAWDRouter,
    abi: ROUTER_ABI,
    functionName: "buyWithETH",
    args: [commitmentArgs, minCLAWDOut],
    value: ethNeeded,
  });
  console.log(`Tx hash: ${hash}`);

  console.log("Waiting for confirmation...");
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in block ${receipt.blockNumber}`);

  // Step 4: Save all credentials
  const credits = loadCredits();
  for (const c of newCredits) {
    credits.push({
      nullifier: c.nullifier.toString(),
      secret: c.secret.toString(),
      commitment: c.commitment.toString(),
      spent: false,
    });
  }
  saveCredits(credits);

  console.log(`\n✅ ${count} credit(s) purchased and saved!`);
  console.log(`Basescan: https://basescan.org/tx/${hash}`);
}

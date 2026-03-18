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

export async function buy() {
  const account = privateKeyToAccount(getPrivateKey());
  const transport = http(getRpcUrl());
  const publicClient = createPublicClient({ chain: base, transport });
  const walletClient = createWalletClient({ chain: base, transport, account });

  console.log(`Wallet: ${account.address}`);

  // Step 1: Generate nullifier + secret
  const nullifier = randomField();
  const secret = randomField();
  console.log("Generated nullifier and secret");

  // Step 2: Compute commitment via poseidon2
  console.log("Computing commitment (poseidon2)...");
  const bb = await Barretenberg.new({ threads: 1 });
  const commitmentFr = await bb.poseidon2Hash([new Fr(nullifier), new Fr(secret)]);
  const commitmentBigInt = BigInt("0x" + Buffer.from(commitmentFr.value).toString("hex"));
  await bb.destroy();
  console.log(`Commitment: ${commitmentBigInt.toString()}`);

  // Step 3: Quote ETH cost
  console.log("Fetching pricing...");
  const oracleData = await publicClient.readContract({
    address: CONTRACTS.CLAWDPricing,
    abi: PRICING_ABI,
    functionName: "getOracleData",
  });

  const [clawdPerEth, , pricePerCreditCLAWD] = oracleData;
  const ethNeeded = (pricePerCreditCLAWD * 125n * 10n ** 18n) / (clawdPerEth * 100n);
  console.log(`ETH needed (with 25% buffer): ${formatEther(ethNeeded)} ETH`);

  const pricePerCredit = await publicClient.readContract({
    address: CONTRACTS.APICredits,
    abi: APICREDITS_ABI,
    functionName: "pricePerCredit",
  });
  const minCLAWDOut = (pricePerCredit * 95n) / 100n;

  // Step 4: Buy
  console.log("Sending buyWithETH transaction...");
  const hash = await walletClient.writeContract({
    address: CONTRACTS.CLAWDRouter,
    abi: ROUTER_ABI,
    functionName: "buyWithETH",
    args: [[commitmentBigInt], minCLAWDOut],
    value: ethNeeded,
  });
  console.log(`Tx hash: ${hash}`);

  console.log("Waiting for confirmation...");
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in block ${receipt.blockNumber}`);

  // Step 5: Save credential
  const credits = loadCredits();
  credits.push({
    nullifier: nullifier.toString(),
    secret: secret.toString(),
    commitment: commitmentBigInt.toString(),
    spent: false,
  });
  saveCredits(credits);

  console.log("\n✅ Credit purchased and saved!");
  console.log(`Commitment (hex): 0x${commitmentBigInt.toString(16).padStart(64, "0")}`);
  console.log(`Commitment (dec): ${commitmentBigInt.toString()}`);
}

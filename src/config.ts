import "dotenv/config";

export const CONTRACTS = {
  APICredits:   "0xE476F94c93FF5385F84a29b4647fE122604814AB",
  CLAWDRouter:  "0x4a7884c1D02fD711DA9fc8611764eAdb5E0A7c24",
  CLAWDPricing: "0xaca9733Cc19aD837899dc7D1170aF1d5367C332E",
  CLAWD:        "0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07",
} as const;

export const API_URL = "https://backend.zkllmapi.com";
export const CHAIN_ID = 8453; // Base mainnet

export const ROUTER_ABI = [
  {
    inputs: [{name: "commitments", type: "uint256[]"}, {name: "minCLAWDOut", type: "uint256"}],
    name: "buyWithETH",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;

export const PRICING_ABI = [
  {
    inputs: [],
    name: "getOracleData",
    outputs: [
      {name: "clawdPerEth", type: "uint256"},
      {name: "ethUsd", type: "uint256"},
      {name: "pricePerCreditCLAWD", type: "uint256"},
      {name: "usdPerCredit", type: "uint256"},
      {name: "clawdUsd", type: "uint256"},
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const APICREDITS_ABI = [
  {
    inputs: [],
    name: "pricePerCredit",
    outputs: [{name: "", type: "uint256"}],
    stateMutability: "view",
    type: "function",
  },
] as const;

export function getPrivateKey(): `0x${string}` {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY not set in .env");
  return pk as `0x${string}`;
}

export function getRpcUrl(): string {
  return process.env.RPC_URL || "https://mainnet.base.org";
}

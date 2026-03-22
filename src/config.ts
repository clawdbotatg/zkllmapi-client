import "dotenv/config";

export const CONTRACTS = {
  APICredits:   "0x1530e5681372494830a8e183Bfe1B00e2197a37E",
  CLAWDRouter:  "0x1E0C57ED5a29A4DDcfC36A0268e49D69eB7231Ef",
  CLAWDPricing: "0xF9AF4C43a06009C42EB5d111eA67c29d754cb88E",
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

# zkllmapi-client

CLI for buying ZK credits and chatting via [zkllmapi.com](https://zkllmapi.com).

## Setup

```bash
cd zkllmapi-client
cp .env.example .env
# Edit .env — add your PRIVATE_KEY (Base wallet with ETH)
npm install
```

## Commands

```bash
# Buy credits
npx tsx src/index.ts buy 1          # buy 1 credit
npx tsx src/index.ts buy 5          # buy 5 credits

# Chat (uses unspent credits)
npx tsx src/index.ts chat "hello"   # single message
npx tsx src/index.ts chat           # interactive mode

# Check credit inventory
npx tsx src/index.ts status
```

## How It Works

1. Generates a random nullifier + secret locally
2. Computes `commitment = Poseidon2(nullifier, secret)` client-side
3. Calls `buyWithETH` on the router — swaps ETH → CLAWD → stakes + registers commitment onchain
4. When you chat, generates a ZK proof proving membership in the Merkle tree
5. Backend verifies proof, burns nullifier, proxies to Venice

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PRIVATE_KEY` | — | Base wallet private key |
| `RPC_URL` | `https://base-mainnet.g.alchemy.com/v2/...` | Base RPC |

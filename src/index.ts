import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";

const command = process.argv[2];
const arg = process.argv.slice(3).join(" ");

if (command === "buy") {
  const { buy } = await import("./buy.js");
  await buy();
} else if (command === "chat") {
  if (!arg) {
    console.error("Usage: tsx src/index.ts chat <message>");
    process.exit(1);
  }
  const { chat } = await import("./chat.js");
  await chat(arg);
} else if (command === "address") {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) {
    console.error("Set PRIVATE_KEY in .env, then run: tsx src/index.ts address");
    process.exit(1);
  }
  const account = privateKeyToAccount(pk as `0x${string}`);
  console.log(`Wallet address: ${account.address}`);
} else {
  console.log("Usage: tsx src/index.ts <command>");
  console.log("  buy          Buy a ZK API credit with ETH");
  console.log("  chat <msg>   Use a credit to chat privately");
  console.log("  address      Print wallet address for funding");
}

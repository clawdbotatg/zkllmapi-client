// check-credits.ts — compute nullifier hashes for unspent credits, verify against API
import { Barretenberg, Fr } from "@aztec/bb.js";
import { readFileSync, writeFileSync } from "fs";
import { API_URL } from "./src/config.js";

const credits = JSON.parse(readFileSync("credits.json", "utf-8"));
const unspent = credits.filter((c: any) => !c.spent);
console.log(`Checking ${unspent.length} unspent credits against ${API_URL}...\n`);

const bb = await Barretenberg.new({ threads: 1 });

let markedSpent = 0;
for (const credit of unspent) {
  const nullifierFr = new Fr(BigInt(credit.nullifier));
  const hashFr = await bb.poseidon2Hash([nullifierFr]);
  const hashHex = "0x" + BigInt("0x" + Buffer.from(hashFr.value).toString("hex")).toString(16).padStart(64, "0");

  const res = await fetch(`${API_URL}/nullifier/${hashHex}`);
  const { spent } = await res.json() as { spent: boolean };

  console.log(`commitment ${credit.commitment.slice(0,16)}...`);
  console.log(`  nullifier_hash: ${hashHex.slice(0,20)}...`);
  console.log(`  server says: ${spent ? "SPENT ❌" : "unspent ✅"}`);
  console.log(`  credits.json:  ${credit.spent ? "spent" : "unspent"}`);

  if (spent && !credit.spent) {
    credit.spent = true;
    markedSpent++;
    console.log(`  → marking as spent in credits.json`);
  }
  console.log();
}

await bb.destroy();

if (markedSpent > 0) {
  writeFileSync("credits.json", JSON.stringify(credits, null, 2));
  console.log(`Updated credits.json — marked ${markedSpent} credits as spent.`);
}

const remaining = credits.filter((c: any) => !c.spent).length;
console.log(`\nFresh unspent credits ready: ${remaining}`);

import { readFileSync, writeFileSync, existsSync } from "fs";
import { generateProof } from "./prove.js";
import { API_URL } from "./config.js";

interface Credit {
  nullifier: string;
  secret: string;
  commitment: string;
  spent: boolean;
}

function loadCredits(): Credit[] {
  if (!existsSync("credits.json")) return [];
  return JSON.parse(readFileSync("credits.json", "utf-8"));
}

function saveCredits(credits: Credit[]) {
  writeFileSync("credits.json", JSON.stringify(credits, null, 2));
}

export async function chat(message: string) {
  const credits = loadCredits();
  const credit = credits.find((c) => !c.spent);
  if (!credit) {
    console.error("No unspent credits. Run `buy` first.");
    process.exit(1);
  }

  console.log(`Using commitment: ${credit.commitment.slice(0, 20)}...`);

  const { proofHex, publicInputs, nullifierHashHex, rootHex, depth } =
    await generateProof(credit);

  console.log("Sending to API...");
  const response = await fetch(`${API_URL}/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      proof: proofHex,
      publicInputs,
      nullifier_hash: nullifierHashHex,
      root: rootHex,
      depth,
      messages: [{ role: "user", content: message }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  console.log("\n=== Response ===");
  console.log(data.choices[0].message.content);

  // Mark spent
  credit.spent = true;
  saveCredits(credits);
  console.log("\n(Credit marked as spent)");
}

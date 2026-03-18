import { Barretenberg, Fr, UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import { API_URL } from "./config.js";

interface TreeData {
  leaves: string[];
  levels: string[][];
  root: string;
  depth: number;
}

interface Credit {
  nullifier: string;
  secret: string;
  commitment: string;
  spent: boolean;
}

const MAX_DEPTH = 16;

function computeMerklePath(treeData: TreeData, commitment: string) {
  const leafIndex = treeData.leaves.findIndex((l) => l === commitment);
  if (leafIndex === -1) return null;

  const siblings: string[] = [];
  const indices: number[] = [];

  for (let i = 0; i < treeData.depth; i++) {
    const levelIndex = leafIndex >> i;
    const siblingIndex = levelIndex % 2 === 0 ? levelIndex + 1 : levelIndex - 1;

    if (siblingIndex < treeData.levels[i].length) {
      siblings.push(treeData.levels[i][siblingIndex]);
    } else {
      siblings.push("0");
    }
    indices.push(levelIndex & 1);
  }

  return { leafIndex, siblings, indices, root: treeData.root, depth: treeData.depth };
}

export async function generateProof(credit: Credit) {
  console.log("Fetching Merkle tree...");
  const treeData: TreeData = await fetch(`${API_URL}/tree`).then((r) => r.json());

  const merkleData = computeMerklePath(treeData, credit.commitment);
  if (!merkleData) {
    throw new Error(`Commitment ${credit.commitment} not found in tree. Wait for on-chain sync.`);
  }
  console.log(`Found commitment at leaf index ${merkleData.leafIndex}`);

  console.log("Initializing Barretenberg...");
  const bb = await Barretenberg.new({ threads: 1 });

  // Compute nullifier hash = poseidon2([nullifier])
  const nullifierFr = new Fr(BigInt(credit.nullifier));
  const nullifierHashFr = await bb.poseidon2Hash([nullifierFr]);
  const nullifierHashBig = BigInt("0x" + Buffer.from(nullifierHashFr.value).toString("hex"));

  await bb.destroy();

  // Pad to MAX_DEPTH=16
  const paddedIndices = [
    ...merkleData.indices,
    ...Array(MAX_DEPTH - merkleData.depth).fill(0),
  ].map(String);
  const paddedSiblings = [
    ...merkleData.siblings,
    ...Array(MAX_DEPTH - merkleData.depth).fill("0"),
  ].map(String);

  // Fetch circuit
  console.log("Fetching circuit...");
  const circuit = await fetch(`${API_URL}/circuit`).then((r) => r.json());

  // Generate witness
  console.log("Generating witness...");
  const noir = new Noir(circuit);
  const { witness } = await noir.execute({
    nullifier_hash: nullifierHashBig.toString(),
    root: merkleData.root,
    depth: merkleData.depth.toString(),
    nullifier: credit.nullifier,
    secret: credit.secret,
    indices: paddedIndices,
    siblings: paddedSiblings,
  });

  // Generate proof (this takes 30-60 seconds)
  console.log("Generating ZK proof (this may take 30-60 seconds)...");
  const backend = new UltraHonkBackend(circuit.bytecode);
  const { proof: proofBytes, publicInputs } = await backend.generateProof(witness);
  await backend.destroy();

  const proofHex = "0x" + Buffer.from(proofBytes).toString("hex");
  const rootHex = "0x" + BigInt(merkleData.root).toString(16).padStart(64, "0");
  const nullifierHashHex = "0x" + nullifierHashBig.toString(16).padStart(64, "0");

  console.log("✅ Proof generated!");
  return { proofHex, publicInputs, nullifierHashHex, rootHex, depth: merkleData.depth };
}

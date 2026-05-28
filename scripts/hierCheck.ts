// Reconstruct the LimbNode hierarchy straight from the FBX we wrote (not via
// FBXLoader) to see if parenting matches expectations.
// Run: node --experimental-strip-types scripts/hierCheck.ts "<path.fbx>"
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) throw new Error("usage: hierCheck.ts <path>");
const text = readFileSync(path, "utf8");

// id -> bone name
const limb = new Map<number, string>();
const reModel = /Model: (\d+), "Model::([^"]*)", "LimbNode"/g;
let m: RegExpExecArray | null;
while ((m = reModel.exec(text))) limb.set(Number(m[1]), m[2]);

// all OO connections: child -> [parents]
const conn = new Map<number, number[]>();
const reConn = /C: "OO",(\d+),(\d+)/g;
while ((m = reConn.exec(text))) {
  const child = Number(m[1]);
  const parent = Number(m[2]);
  if (!conn.has(child)) conn.set(child, []);
  conn.get(child)!.push(parent);
}

// for each bone, its transform parent = a connection target that is 0 or a limbnode
const parentOf = new Map<number, number>();
for (const id of limb.keys()) {
  const parents = conn.get(id) ?? [];
  const transformParent = parents.find((p) => p === 0 || limb.has(p));
  parentOf.set(id, transformParent ?? -1);
}

const roots = [...limb.keys()].filter((id) => (parentOf.get(id) ?? -1) === 0);
const orphans = [...limb.keys()].filter((id) => (parentOf.get(id) ?? -1) === -1);

console.log("LimbNodes:", limb.size);
console.log("root bones (parent = scene root 0):", roots.length);
console.log("root names:", roots.map((id) => limb.get(id)).slice(0, 40).join(", "));
console.log("orphans (no valid parent found):", orphans.length);

// sample: walk a deep-ish chain from a leaf
const hasChildren = new Set([...parentOf.values()]);
const leaves = [...limb.keys()].filter((id) => !hasChildren.has(id));
if (leaves.length) {
  let cur = leaves[0];
  const chain: string[] = [];
  let guard = 0;
  while (cur !== 0 && cur !== -1 && guard++ < 50) {
    chain.push(limb.get(cur) ?? `?${cur}`);
    cur = parentOf.get(cur) ?? -1;
  }
  console.log("sample leaf->root chain:", chain.join(" -> ") + " -> ROOT");
}

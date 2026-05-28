// Simulate the exporter's name + hierarchy logic from a VRM's JSON alone
// (no GLTFLoader needed) to verify roots/names against real files.
// Run: node --experimental-strip-types scripts/simExport.ts "<path>"
import { readFileSync } from "node:fs";
import { parseGLB, sanitizeGlb } from "../src/vrm/glb.ts";

const path = process.argv[2];
const buf = readFileSync(path);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const { json } = parseGLB(sanitizeGlb(ab as ArrayBuffer));
const nodes: any[] = json.nodes ?? [];

const parentOf = new Map<number, number>();
nodes.forEach((n, i) => {
  for (const c of n.children ?? []) parentOf.set(c, i);
});

const jointSet = new Set<number>();
for (const skin of json.skins ?? []) for (const j of skin.joints ?? []) jointSet.add(j);

const exportSet = new Set<number>();
for (const j of jointSet) {
  let cur: number | undefined = j;
  while (cur !== undefined && !exportSet.has(cur)) {
    exportSet.add(cur);
    cur = parentOf.get(cur);
  }
}

const nearestKept = (n: number): number | undefined => {
  let p = parentOf.get(n);
  while (p !== undefined) {
    if (exportSet.has(p)) return p;
    p = parentOf.get(p);
  }
  return undefined;
};

const name = (i: number) => nodes[i]?.name ?? `node_${i}`;
const exported = [...exportSet];
const roots = exported.filter((n) => nearestKept(n) === undefined);
const dotted = exported.filter((n) => name(n).includes(".")).length;
const hyphen = exported.filter((n) => name(n).includes("-")).map(name);

console.log("file:", path.split(/[\\/]/).pop());
console.log("skin joints:", jointSet.size, "| exported bones (with ancestors):", exportSet.size);
console.log("ROOT bones:", roots.length, "->", roots.map(name).join(", "));
console.log("names with dots preserved:", dotted);
console.log("names with hyphens (Shogun-risk):", hyphen.length, hyphen.slice(0, 8).join(", "));

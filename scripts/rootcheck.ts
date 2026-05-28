// Inspect transforms of the export root node(s) (the nodes above the skeleton).
import { readFileSync } from "node:fs";
import { parseGLB } from "../src/vrm/glb.ts";

const p = process.argv[2];
const b = readFileSync(p);
const { json } = parseGLB(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
const nodes: any[] = json.nodes ?? [];
const parentOf = new Map<number, number>();
nodes.forEach((n, i) => {
  for (const c of n.children ?? []) parentOf.set(c, i);
});
const joints = new Set<number>();
for (const s of json.skins ?? []) for (const j of s.joints ?? []) joints.add(j);
const exp = new Set<number>();
for (const j of joints) {
  let c: number | undefined = j;
  while (c !== undefined && !exp.has(c)) {
    exp.add(c);
    c = parentOf.get(c);
  }
}
const roots = [...exp].filter((n) => {
  let pp = parentOf.get(n);
  while (pp !== undefined) {
    if (exp.has(pp)) return false;
    pp = parentOf.get(pp);
  }
  return true;
});
const topJoint = [...joints].filter((j) => {
  let pp = parentOf.get(j);
  while (pp !== undefined) {
    if (joints.has(pp)) return false;
    pp = parentOf.get(pp);
  }
  return true;
});
console.log(p.split(/[\\/]/).pop());
for (const r of roots) {
  const n = nodes[r];
  console.log(
    `  export root: ${n.name}  T=${JSON.stringify(n.translation ?? [0, 0, 0])} R=${JSON.stringify(n.rotation ?? "identity")} S=${JSON.stringify(n.scale ?? [1, 1, 1])}`,
  );
}
console.log("  topmost skin joint(s):", topJoint.map((j) => nodes[j].name).join(", "));

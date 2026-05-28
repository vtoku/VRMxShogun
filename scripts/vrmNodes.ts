// Dump the glTF node hierarchy (original names) from a VRM/GLB.
// Run: node --experimental-strip-types scripts/vrmNodes.ts "<path>" [filter]
import { readFileSync } from "node:fs";
import { parseGLB } from "../src/vrm/glb.ts";

const path = process.argv[2];
const filter = process.argv[3]?.toLowerCase();
const buf = readFileSync(path);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const { json } = parseGLB(ab as ArrayBuffer);

const nodes: any[] = json.nodes ?? [];
const parentOf = new Map<number, number>();
nodes.forEach((n, i) => {
  for (const c of n.children ?? []) parentOf.set(c, i);
});

const name = (i: number) => nodes[i]?.name ?? `node_${i}`;

console.log("total nodes:", nodes.length);
nodes.forEach((n, i) => {
  const nm = name(i);
  if (filter && !nm.toLowerCase().includes(filter)) return;
  const p = parentOf.get(i);
  console.log(`${nm}  <-  ${p === undefined ? "(ROOT)" : name(p)}`);
});

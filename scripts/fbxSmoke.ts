// Structural smoke test for the ASCII FBX writer.
// Builds a tiny 2-bone skinned triangle, writes FBX, then parses it back with
// three's FBXLoader. Run: node --experimental-strip-types scripts/fbxSmoke.ts
import { writeFbx } from "../src/fbx/asciiFbx.ts";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { writeFileSync } from "node:fs";

const bones = [
  { id: 1000001, name: "Hips", parentIndex: -1, worldPos: [0, 100, 0] as [number, number, number] },
  { id: 1000002, name: "Spine", parentIndex: 0, worldPos: [0, 120, 0] as [number, number, number] },
];

const model = {
  bones,
  boneCount: bones.length,
  totalVertices: 3,
  meshes: [
    {
      name: "Body",
      positions: [0, 100, 0, 10, 100, 0, 0, 120, 0],
      normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
      uvs: [0, 0, 1, 0, 0, 1],
      polygonVertexIndex: [0, 1, -3],
      vertexCount: 3,
      color: [0.8, 0.8, 0.8] as [number, number, number],
      clusters: [
        { boneIndex: 0, indexes: [0, 1], weights: [1, 1] },
        { boneIndex: 1, indexes: [2], weights: [1] },
      ],
    },
  ],
};

let id = 2000000;
const idGen = () => (id += 1);
const fbx = writeFbx(model as any, idGen);
writeFileSync("scripts/sample-out.fbx", fbx);

const loader = new FBXLoader();
const group = loader.parse(new TextEncoder().encode(fbx).buffer, "");

let boneCount = 0;
let meshCount = 0;
let foundHips = false;
let foundSpine = false;
group.traverse((o: any) => {
  if (o.isBone) {
    boneCount++;
    if (o.name === "Hips") foundHips = true;
    if (o.name === "Spine") foundSpine = true;
  }
  if (o.isMesh || o.isSkinnedMesh) meshCount++;
});

console.log("FBX bytes:", fbx.length);
console.log("parsed bones:", boneCount, "meshes:", meshCount);
console.log("found Hips:", foundHips, "found Spine:", foundSpine);

if (boneCount >= 2 && meshCount >= 1 && foundHips && foundSpine) {
  console.log("SMOKE TEST PASS");
} else {
  console.error("SMOKE TEST FAIL");
  process.exit(1);
}

// Diagnostic: parse a produced FBX and report skeleton/mesh health.
// Run: node --experimental-strip-types scripts/checkFbx.ts "<path-to.fbx>"
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import * as THREE from "three";
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) throw new Error("usage: checkFbx.ts <path>");

const head = readFileSync(path).subarray(0, 64).toString("utf8").replace(/\n/g, " ");
console.log("header:", head.slice(0, 60));

const buf = readFileSync(path);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const loader = new FBXLoader();
const group = loader.parse(ab as ArrayBuffer, "");

const bones: THREE.Bone[] = [];
const skinned: THREE.SkinnedMesh[] = [];
let totalVerts = 0;
let nonIdentityRot = 0;
const q = new THREE.Quaternion();
group.traverse((o: any) => {
  if (o.isBone) {
    bones.push(o);
    o.getWorldQuaternion(q);
    const angle = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
    if (angle > 0.01) nonIdentityRot++;
  }
  if (o.isSkinnedMesh) {
    skinned.push(o);
    const g = o.geometry as THREE.BufferGeometry;
    totalVerts += g.getAttribute("position")?.count ?? 0;
  }
});

const names = bones.map((b) => b.name);
const humanoid = ["Hips", "Spine", "Chest", "Neck", "Head", "LeftUpperArm", "LeftLowerArm", "LeftHand", "RightUpperArm", "LeftUpperLeg", "LeftFoot"];
const foundHumanoid = humanoid.filter((n) => names.includes(n));
const missingHumanoid = humanoid.filter((n) => !names.includes(n));

// overall bounding box (scale / explosion check)
const box = new THREE.Box3().setFromObject(group);
const size = box.getSize(new THREE.Vector3());

// NaN scan in first skinned mesh
let nanCount = 0;
if (skinned[0]) {
  const pos = skinned[0].geometry.getAttribute("position");
  for (let i = 0; i < pos.count * 3 && i < 300000; i++) {
    if (!Number.isFinite((pos.array as any)[i])) nanCount++;
  }
}

console.log("bones:", bones.length);
console.log("skinned meshes:", skinned.length, "| total verts:", totalVerts.toLocaleString());
console.log("humanoid bones found:", foundHumanoid.join(", ") || "(none)");
console.log("humanoid bones MISSING:", missingHumanoid.join(", ") || "(none)");
console.log(
  "bounding box (units):",
  `x=${size.x.toFixed(1)} y=${size.y.toFixed(1)} z=${size.z.toFixed(1)}`,
);
console.log("bones with non-identity WORLD rotation:", nonIdentityRot, "/", bones.length);
console.log("NaN vertex components (first mesh sample):", nanCount);
console.log("sample bone names:", names.slice(0, 12).join(", "));

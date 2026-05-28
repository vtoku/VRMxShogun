// Build-logic tests. Run: node --experimental-strip-types scripts/stripTest.ts
import * as THREE from "three";
import { buildExportModel } from "../src/convert/build.ts";
import type { BuildInput } from "../src/convert/build.ts";

let pass = true;
function check(label: string, cond: boolean) {
  console.log((cond ? "  ok  " : " FAIL ") + label);
  if (!cond) pass = false;
}

// ---- Test 1: spring strip reweights to parent (+ merges duplicate weights) ----
{
  const hips = new THREE.Bone();
  hips.position.set(0, 1, 0);
  const head = new THREE.Bone();
  head.position.set(0, 0.5, 0);
  hips.add(head);
  const hair = new THREE.Bone(); // spring
  hair.position.set(0, 0.2, 0);
  head.add(hair);

  const skeleton = new THREE.Skeleton([hips, head, hair]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1.5, 0, 0, 1.7, 0, 0, 1.6, 0]), 3),
  );
  geo.setAttribute(
    "skinIndex",
    new THREE.BufferAttribute(new Uint16Array([0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 2, 0, 0]), 4),
  );
  geo.setAttribute(
    "skinWeight",
    new THREE.BufferAttribute(
      new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0.5, 0.5, 0, 0]),
      4,
    ),
  );
  geo.setIndex([0, 1, 2]);
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial());
  mesh.add(hips);
  mesh.bind(skeleton);
  const scene = new THREE.Group();
  scene.add(mesh);
  scene.updateMatrixWorld(true);

  const input: BuildInput = {
    scene,
    vrm: null,
    json: {
      nodes: [{ name: "Hips", children: [1] }, { name: "Head", children: [2] }, { name: "Hair" }],
      skins: [{ joints: [0, 1, 2] }],
    },
    nodeToObj: new Map<number, THREE.Object3D>([[0, hips], [1, head], [2, hair]]),
    objToNode: new Map<THREE.Object3D, number>([[hips, 0], [head, 1], [hair, 2]]),
    springNodes: new Set([2]),
    stripSprings: true,
  };
  let id = 1000;
  const r = buildExportModel(input, () => ++id);
  const names = r.model.bones.map((b) => b.name);
  const headIdx = names.indexOf("Head");
  const hc = r.model.meshes[0].clusters.find((c) => c.boneIndex === headIdx);
  const v3pos = hc ? hc.indexes.indexOf(3) : -1;
  console.log("T1 bones:", names.join(", "));
  check("Hair stripped", !names.includes("Hair"));
  check("2 bones kept", names.length === 2);
  check("hair vert reweighted to Head", !!hc && hc.indexes.includes(2));
  check("v3 merged once", !!hc && hc.indexes.filter((x) => x === 3).length === 1);
  check("v3 weight summed to 1.0", v3pos >= 0 && Math.abs(hc!.weights[v3pos] - 1) < 1e-6);
}

// ---- Test 2: intermediate (non-joint) node keeps hierarchy + original names ----
{
  const hips = new THREE.Bone();
  hips.position.set(0, 1, 0);
  const sub = new THREE.Object3D(); // NOT a skin joint
  sub.position.set(0, 0.1, 0);
  hips.add(sub);
  const lower = new THREE.Bone();
  lower.position.set(0, 0.4, 0);
  sub.add(lower);
  const scene = new THREE.Group();
  scene.add(hips);
  scene.updateMatrixWorld(true);

  const input: BuildInput = {
    scene,
    vrm: null,
    json: {
      nodes: [
        { name: "Hips", children: [1] },
        { name: "thigh.l_SubBone", children: [2] }, // intermediate + a dot to confirm name kept
        { name: "thigh.l" },
      ],
      skins: [{ joints: [0, 2] }], // node 1 is NOT a joint
    },
    nodeToObj: new Map<number, THREE.Object3D>([[0, hips], [1, sub], [2, lower]]),
    objToNode: new Map<THREE.Object3D, number>([[hips, 0], [sub, 1], [lower, 2]]),
    springNodes: new Set(),
    stripSprings: false,
  };
  let id = 2000;
  const r = buildExportModel(input, () => ++id);
  const names = r.model.bones.map((b) => b.name);
  const idxOf = (n: string) => names.indexOf(n);
  const bone = (n: string) => r.model.bones[idxOf(n)];
  console.log("T2 bones:", names.join(", "));
  check("intermediate non-joint kept", names.includes("thigh.l_SubBone"));
  check("original dotted name preserved", names.includes("thigh.l"));
  check("thigh.l parent = SubBone", bone("thigh.l").parentIndex === idxOf("thigh.l_SubBone"));
  check("SubBone parent = Hips", bone("thigh.l_SubBone").parentIndex === idxOf("Hips"));
  check("Hips is root", bone("Hips").parentIndex === -1);
}

// ---- Test 3: skeleton-only export drops meshes but keeps bones ----
{
  const hips = new THREE.Bone();
  hips.position.set(0, 1, 0);
  const scene = new THREE.Group();
  scene.add(hips);
  scene.updateMatrixWorld(true);
  const input: BuildInput = {
    scene,
    vrm: null,
    json: { nodes: [{ name: "Hips" }], skins: [{ joints: [0] }] },
    nodeToObj: new Map<number, THREE.Object3D>([[0, hips]]),
    objToNode: new Map<THREE.Object3D, number>([[hips, 0]]),
    springNodes: new Set(),
    stripSprings: false,
    skeletonOnly: true,
  };
  let id = 3000;
  const r = buildExportModel(input, () => ++id);
  console.log("T3 meshes:", r.model.meshes.length, "bones:", r.model.boneCount);
  check("skeleton-only: no meshes", r.model.meshes.length === 0);
  check("skeleton-only: bones present", r.model.boneCount === 1);
}

console.log(pass ? "BUILD TESTS PASS" : "BUILD TESTS FAIL");
if (!pass) process.exit(1);

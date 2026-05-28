// Verifies spring-bone stripping reweights to the parent instead of dropping
// weights. Run: node --experimental-strip-types scripts/stripTest.ts
import * as THREE from "three";
import { buildExportModel } from "../src/convert/build.ts";

function makeScene() {
  const hips = new THREE.Bone();
  hips.name = "Hips";
  hips.position.set(0, 1, 0);
  const head = new THREE.Bone();
  head.name = "Head";
  head.position.set(0, 0.5, 0);
  hips.add(head);
  const hair = new THREE.Bone(); // spring bone
  hair.name = "Hair";
  hair.position.set(0, 0.2, 0);
  head.add(hair);

  const bones = [hips, head, hair];
  const skeleton = new THREE.Skeleton(bones);

  // v0->Hips, v1->Head, v2->Hair(spring), v3->Head 0.5 + Hair 0.5 (merge case)
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([0, 1, 0, 0, 1.5, 0, 0, 1.7, 0, 0, 1.6, 0]),
      3,
    ),
  );
  geo.setAttribute(
    "normal",
    new THREE.BufferAttribute(
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
      3,
    ),
  );
  geo.setAttribute(
    "skinIndex",
    new THREE.BufferAttribute(
      new Uint16Array([0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 2, 0, 0]),
      4,
    ),
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
  return { scene, hair };
}

let idA = 1000;
const { scene, hair } = makeScene();
const stripped = buildExportModel(scene, null, () => ++idA, {
  stripBones: new Set([hair]),
});

const names = stripped.model.bones.map((b) => b.name);
const headIdx = names.indexOf("Head");
// gather which vertices each export bone influences
const clusters = stripped.model.meshes[0].clusters;
const headCluster = clusters.find((c) => c.boneIndex === headIdx);
const anyHairBone = names.includes("Hair");
const maxBoneIdx = Math.max(...clusters.map((c) => c.boneIndex));

// vertex 3 was 0.5 Head + 0.5 Hair -> after strip should be Head once @ 1.0
const v3pos = headCluster ? headCluster.indexes.indexOf(3) : -1;
const v3count = headCluster ? headCluster.indexes.filter((x) => x === 3).length : 0;
const v3weight = v3pos >= 0 ? headCluster!.weights[v3pos] : 0;

console.log("bones after strip:", names.join(", "));
console.log("Hair bone present:", anyHairBone);
console.log("Head cluster verts:", headCluster?.indexes);
console.log("max cluster boneIndex:", maxBoneIdx, "(bones:", names.length, ")");
console.log("v3 in Head cluster:", v3count, "time(s), weight:", v3weight);

const ok =
  !anyHairBone &&
  names.length === 2 &&
  headCluster !== undefined &&
  headCluster.indexes.includes(1) && // head's own vertex
  headCluster.indexes.includes(2) && // hair's vertex, reweighted to head
  v3count === 1 && // merged, not duplicated
  Math.abs(v3weight - 1) < 1e-6 && // 0.5 + 0.5 summed
  maxBoneIdx < names.length; // no dangling reference to a removed bone

console.log(ok ? "STRIP TEST PASS" : "STRIP TEST FAIL");
if (!ok) process.exit(1);

import * as THREE from "three";
import { VRM_TO_SHOGUN } from "../vrm/boneMap";
import type { VrmInfo } from "../vrm/humanoid";

// glTF is meters; we author the FBX in centimeters and declare UnitScaleFactor=1
// so the avatar imports at correct human size regardless of whether the importer
// applies UnitScaleFactor. See README "Axis & scale".
const METERS_TO_CM = 100;

export interface ExportBone {
  id: number;
  name: string;
  parentIndex: number; // index into bones[], -1 if root
  worldPos: [number, number, number]; // rebaked world position, cm
}

export interface ExportCluster {
  boneIndex: number;
  indexes: number[];
  weights: number[];
}

export interface ExportMesh {
  name: string;
  positions: number[]; // flat xyz, world-baked, cm
  normals: number[]; // per polygon-vertex (Direct)
  uvs: number[]; // per polygon-vertex (Direct), V-flipped
  polygonVertexIndex: number[]; // last vertex of each polygon is ~i
  vertexCount: number;
  color: [number, number, number];
  clusters: ExportCluster[];
}

export interface ExportModel {
  bones: ExportBone[];
  meshes: ExportMesh[];
  boneCount: number;
  totalVertices: number;
}

export interface BuildResult {
  model: ExportModel;
  /** humanoid bones present in the rig, by VRM name. */
  mappedHumanoid: string[];
}

function collectSkinnedMeshes(root: THREE.Object3D): THREE.SkinnedMesh[] {
  const out: THREE.SkinnedMesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) out.push(o as THREE.SkinnedMesh);
  });
  return out;
}

// Build the union of all bones referenced by the skinned meshes, ordered so a
// parent always precedes its children. Returns bones plus a reference->index map.
function collectBones(meshes: THREE.SkinnedMesh[]): {
  bones: THREE.Bone[];
  indexOf: Map<THREE.Bone, number>;
} {
  const set = new Set<THREE.Bone>();
  for (const m of meshes) for (const b of m.skeleton.bones) set.add(b);

  const indexOf = new Map<THREE.Bone, number>();
  const ordered: THREE.Bone[] = [];
  const visit = (b: THREE.Bone) => {
    if (indexOf.has(b)) return;
    const parent = b.parent as THREE.Bone | null;
    if (parent && (parent as THREE.Bone).isBone && set.has(parent)) visit(parent);
    indexOf.set(b, ordered.length);
    ordered.push(b);
  };
  for (const b of set) visit(b);
  return { bones: ordered, indexOf };
}

export function buildExportModel(
  root: THREE.Object3D,
  vrm: VrmInfo | null,
  idGen: () => number,
): BuildResult {
  root.updateMatrixWorld(true);

  const skinned = collectSkinnedMeshes(root);
  const { bones, indexOf } = collectBones(skinned);

  // Map glTF node names -> Shogun-friendly names for humanoid bones.
  const nodeNameToShogun = new Map<string, string>();
  const mappedHumanoid: string[] = [];
  if (vrm) {
    for (const [vrmBone, ref] of Object.entries(vrm.humanoidBones)) {
      const shogun = VRM_TO_SHOGUN[vrmBone];
      if (shogun) {
        nodeNameToShogun.set(ref.nodeName, shogun);
        mappedHumanoid.push(vrmBone);
      }
    }
  }

  const tmp = new THREE.Vector3();
  const exportBones: ExportBone[] = bones.map((b, i) => {
    b.matrixWorld.decompose(tmp, new THREE.Quaternion(), new THREE.Vector3());
    const parent = b.parent as THREE.Bone | null;
    const parentIndex = parent && indexOf.has(parent) ? indexOf.get(parent)! : -1;
    const shogun = nodeNameToShogun.get(b.name);
    return {
      id: idGen(),
      name: shogun ?? b.name ?? `bone_${i}`,
      parentIndex,
      worldPos: [tmp.x * METERS_TO_CM, tmp.y * METERS_TO_CM, tmp.z * METERS_TO_CM],
    };
  });

  let totalVertices = 0;
  const meshes: ExportMesh[] = skinned.map((mesh, mi) =>
    buildMesh(mesh, mi, indexOf),
  );
  for (const m of meshes) totalVertices += m.vertexCount;

  return {
    model: { bones: exportBones, meshes, boneCount: exportBones.length, totalVertices },
    mappedHumanoid,
  };
}

function buildMesh(
  mesh: THREE.SkinnedMesh,
  meshIndex: number,
  indexOf: Map<THREE.Bone, number>,
): ExportMesh {
  const geo = mesh.geometry as THREE.BufferGeometry;
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const nrm = geo.getAttribute("normal") as THREE.BufferAttribute | undefined;
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute | undefined;
  const skinIndex = geo.getAttribute("skinIndex") as THREE.BufferAttribute | undefined;
  const skinWeight = geo.getAttribute("skinWeight") as THREE.BufferAttribute | undefined;
  const vertexCount = pos.count;

  const world = mesh.matrixWorld;
  const normalMat = new THREE.Matrix3().getNormalMatrix(world);

  // World-baked vertex positions (cm).
  const positions = new Array<number>(vertexCount * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < vertexCount; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(world);
    positions[i * 3] = v.x * METERS_TO_CM;
    positions[i * 3 + 1] = v.y * METERS_TO_CM;
    positions[i * 3 + 2] = v.z * METERS_TO_CM;
  }

  // Triangle list -> FBX polygon vertex index (last vertex of poly is ~i).
  const triIndices: number[] = [];
  if (geo.index) {
    const idx = geo.index;
    for (let i = 0; i < idx.count; i += 3) {
      triIndices.push(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
    }
  } else {
    for (let i = 0; i < vertexCount; i++) triIndices.push(i);
  }

  const polygonVertexIndex: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const n = new THREE.Vector3();
  for (let t = 0; t < triIndices.length; t += 3) {
    const tri = [triIndices[t], triIndices[t + 1], triIndices[t + 2]];
    for (let k = 0; k < 3; k++) {
      const vi = tri[k];
      polygonVertexIndex.push(k === 2 ? -(vi + 1) : vi);
      if (nrm) {
        n.fromBufferAttribute(nrm, vi).applyMatrix3(normalMat).normalize();
        normals.push(n.x, n.y, n.z);
      } else {
        normals.push(0, 1, 0);
      }
      if (uv) {
        uvs.push(uv.getX(vi), 1 - uv.getY(vi)); // FBX V is bottom-up
      } else {
        uvs.push(0, 0);
      }
    }
  }

  // Skin weights -> per-bone clusters (global bone index).
  const clusterMap = new Map<number, ExportCluster>();
  if (skinIndex && skinWeight) {
    const localBones = mesh.skeleton.bones;
    for (let i = 0; i < vertexCount; i++) {
      for (let c = 0; c < 4; c++) {
        const w = skinWeight.getComponent(i, c);
        if (w <= 0) continue;
        const localBone = skinIndex.getComponent(i, c);
        const bone = localBones[localBone];
        const gIdx = bone ? indexOf.get(bone) : undefined;
        if (gIdx === undefined) continue;
        let cl = clusterMap.get(gIdx);
        if (!cl) {
          cl = { boneIndex: gIdx, indexes: [], weights: [] };
          clusterMap.set(gIdx, cl);
        }
        cl.indexes.push(i);
        cl.weights.push(w);
      }
    }
  }

  const mat = mesh.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
  const single = Array.isArray(mat) ? mat[0] : mat;
  const color = single && (single as any).color
    ? [(single as any).color.r, (single as any).color.g, (single as any).color.b]
    : [0.8, 0.8, 0.8];

  return {
    name: mesh.name || `mesh_${meshIndex}`,
    positions,
    normals,
    uvs,
    polygonVertexIndex,
    vertexCount,
    color: color as [number, number, number],
    clusters: [...clusterMap.values()],
  };
}

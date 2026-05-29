import type { ExportBone } from "./build";

// Diamond/octahedral bone wireframe (Blender-style limbs) for the PREVIEW only.
// Returns a flat list of line-segment endpoints (pairs of xyz) scaled to the
// preview's units. Nothing is baked into the FBX — skeleton-only export is just
// the LimbNode skeleton.

type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const length = (a: V) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V): V => {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// octahedron edges as index pairs into [head, tail, r0, r1, r2, r3]
const EDGES = [
  [0, 2], [0, 3], [0, 4], [0, 5],
  [1, 2], [1, 3], [1, 4], [1, 5],
  [2, 3], [3, 4], [4, 5], [5, 2],
];

export function boneDiamondEdges(bones: ExportBone[], scale: number): number[] {
  const childrenOf = new Map<number, number[]>();
  bones.forEach((b, i) => {
    if (b.parentIndex >= 0) {
      const arr = childrenOf.get(b.parentIndex) ?? [];
      arr.push(i);
      childrenOf.set(b.parentIndex, arr);
    }
  });

  const out: number[] = [];
  bones.forEach((bone, i) => {
    if (bone.parentIndex < 0) return; // skip the armature root's diamond
    const head = bone.worldPos as V;
    const kids = childrenOf.get(i) ?? [];
    let tail: V;
    if (kids.length > 0) {
      tail = bones[kids[0]].worldPos as V;
    } else if (bone.parentIndex >= 0) {
      const pdir = norm(sub(head, bones[bone.parentIndex].worldPos as V));
      const plen = length(sub(head, bones[bone.parentIndex].worldPos as V));
      tail = add(head, mul(pdir, Math.max(plen * 0.4, 1)));
    } else {
      tail = add(head, [0, 5, 0]);
    }

    let axis = sub(tail, head);
    let L = length(axis);
    if (L < 1e-3) {
      axis = [0, 5, 0];
      L = 5;
    }
    const dir = norm(axis);
    const ref: V = Math.abs(dir[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
    const u = norm(cross(dir, ref));
    const v = cross(dir, u);
    const w = Math.max(L * 0.1, 0.4);
    const ringC = add(head, mul(dir, L * 0.12));
    const verts: V[] = [
      head,
      tail,
      add(ringC, mul(u, w)),
      add(ringC, mul(v, w)),
      add(ringC, mul(u, -w)),
      add(ringC, mul(v, -w)),
    ];
    for (const [a, b] of EDGES) {
      out.push(
        verts[a][0] * scale, verts[a][1] * scale, verts[a][2] * scale,
        verts[b][0] * scale, verts[b][1] * scale, verts[b][2] * scale,
      );
    }
  });

  // Connection lines from each bone to its parent, so branching joints (e.g.
  // pelvis -> both legs) clearly show the parenting, not just the first child.
  bones.forEach((bone) => {
    if (bone.parentIndex < 0) return; // root has no parent
    if (bones[bone.parentIndex].parentIndex < 0) return; // skip pelvis -> armature root
    const p = bones[bone.parentIndex].worldPos as V;
    const h = bone.worldPos as V;
    out.push(
      p[0] * scale, p[1] * scale, p[2] * scale,
      h[0] * scale, h[1] * scale, h[2] * scale,
    );
  });

  return out;
}

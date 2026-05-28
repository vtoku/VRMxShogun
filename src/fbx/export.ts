import * as THREE from "three";
import { buildExportModel } from "../convert/build";
import type { BuildResult } from "../convert/build";
import type { VrmInfo } from "../vrm/humanoid";
import { writeFbx } from "./asciiFbx";

// FBX object ids must be unique int64s. A single generator is shared by the
// build step (bones) and the writer (everything else) so ids never collide.
function makeIdGen(): () => number {
  let id = 1000000;
  return () => (id += 1);
}

export function buildModel(root: THREE.Object3D, vrm: VrmInfo | null): {
  result: BuildResult;
  toFbx: () => string;
} {
  const idGen = makeIdGen();
  const result = buildExportModel(root, vrm, idGen);
  return { result, toFbx: () => writeFbx(result.model, idGen) };
}

export function sanitizeFilename(name: string): string {
  const base = name.replace(/\.(vrm|glb)$/i, "").trim();
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned || "character";
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

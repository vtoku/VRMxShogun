import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

// Parse a VRM/GLB ArrayBuffer with three's GLTFLoader. VRM-specific extensions
// are ignored by the loader, but the mesh, skeleton, and skin weights come
// through intact — which is exactly the input the FBX exporter needs.
export function loadGltf(buffer: ArrayBuffer): Promise<GLTF> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(buffer, "", resolve, reject);
  });
}

// Minimal GLB container reader. We only need the JSON chunk to pull the VRM
// humanoid + meta extensions; the mesh/skeleton come from three's GLTFLoader.

export interface GLBChunks {
  json: any;
  bin: Uint8Array | null;
}

const GLB_MAGIC = 0x46546c67; // 'glTF' little-endian
const JSON_CHUNK = 0x4e4f534a; // 'JSON'
const BIN_CHUNK = 0x004e4942; // 'BIN\0'

export function parseGLB(arrayBuffer: ArrayBuffer): GLBChunks {
  const dv = new DataView(arrayBuffer);
  if (dv.byteLength < 12 || dv.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error("Not a GLB/VRM file (bad magic header).");
  }
  const version = dv.getUint32(4, true);
  if (version !== 2) {
    throw new Error(`Unsupported GLB container version ${version} (expected 2).`);
  }
  const totalLength = dv.getUint32(8, true);

  let offset = 12;
  let json: any = null;
  let bin: Uint8Array | null = null;

  while (offset + 8 <= totalLength) {
    const chunkLength = dv.getUint32(offset, true);
    const chunkType = dv.getUint32(offset + 4, true);
    const dataStart = offset + 8;
    if (chunkType === JSON_CHUNK) {
      const bytes = new Uint8Array(arrayBuffer, dataStart, chunkLength);
      json = JSON.parse(new TextDecoder().decode(bytes));
    } else if (chunkType === BIN_CHUNK) {
      bin = new Uint8Array(arrayBuffer, dataStart, chunkLength);
    }
    offset = dataStart + chunkLength;
  }

  if (!json) throw new Error("GLB has no JSON chunk.");
  return { json, bin };
}

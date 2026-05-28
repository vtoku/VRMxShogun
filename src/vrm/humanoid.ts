// Normalizes the VRM humanoid + meta block across VRM 0.x and 1.0 into one shape.

export type VrmVersion = "1.0" | "0.x";

export interface VrmMeta {
  title: string;
  author: string;
  license: string;
  version: VrmVersion;
  contactInformation: string;
}

export interface HumanoidBoneRef {
  /** Index into glTF `nodes`. */
  nodeIndex: number;
  /** Original node name as authored in the VRM (often Japanese). */
  nodeName: string;
}

export interface VrmInfo {
  version: VrmVersion;
  meta: VrmMeta;
  /** key = VRM humanoid bone name (e.g. "hips"), value = node reference. */
  humanoidBones: Record<string, HumanoidBoneRef>;
}

// The humanoid bones VRM treats as required. Used to flag incomplete rigs.
export const REQUIRED_HUMANOID_BONES = [
  "hips",
  "spine",
  "head",
  "leftUpperArm",
  "leftLowerArm",
  "leftHand",
  "rightUpperArm",
  "rightLowerArm",
  "rightHand",
  "leftUpperLeg",
  "leftLowerLeg",
  "leftFoot",
  "rightUpperLeg",
  "rightLowerLeg",
  "rightFoot",
];

function nodeName(json: any, index: number): string {
  const n = json?.nodes?.[index];
  return (n && typeof n.name === "string" && n.name) || `node_${index}`;
}

export function extractVrm(json: any): VrmInfo | null {
  const ext = json?.extensions;
  if (!ext) return null;

  if (ext.VRMC_vrm) return extractVrm1(json, ext.VRMC_vrm);
  if (ext.VRM) return extractVrm0(json, ext.VRM);
  return null;
}

function extractVrm1(json: any, vrm: any): VrmInfo {
  const humanoidBones: Record<string, HumanoidBoneRef> = {};
  const humanBones = vrm?.humanoid?.humanBones ?? {};
  for (const boneName of Object.keys(humanBones)) {
    const node = humanBones[boneName]?.node;
    if (typeof node === "number") {
      humanoidBones[boneName] = { nodeIndex: node, nodeName: nodeName(json, node) };
    }
  }
  const m = vrm?.meta ?? {};
  const meta: VrmMeta = {
    title: m.name ?? "—",
    author: Array.isArray(m.authors) ? m.authors.join(", ") : m.authors ?? "—",
    license: m.licenseUrl ?? m.thirdPartyLicenses ?? "VRM 1.0 meta",
    version: "1.0",
    contactInformation: m.contactInformation ?? "",
  };
  return { version: "1.0", meta, humanoidBones };
}

function extractVrm0(json: any, vrm: any): VrmInfo {
  const humanoidBones: Record<string, HumanoidBoneRef> = {};
  const humanBones: any[] = vrm?.humanoid?.humanBones ?? [];
  for (const entry of humanBones) {
    if (entry && typeof entry.bone === "string" && typeof entry.node === "number") {
      humanoidBones[entry.bone] = {
        nodeIndex: entry.node,
        nodeName: nodeName(json, entry.node),
      };
    }
  }
  const m = vrm?.meta ?? {};
  const meta: VrmMeta = {
    title: m.title ?? "—",
    author: m.author ?? "—",
    license: m.licenseName ?? "—",
    version: "0.x",
    contactInformation: m.contactInformation ?? "",
  };
  return { version: "0.x", meta, humanoidBones };
}

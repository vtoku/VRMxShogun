// VRM humanoid bone name -> Shogun-friendly bone name.
//
// Shogun's retargeter matches on bone names. The spec's target schema is the
// PascalCase form of the VRM humanoid names (hips -> Hips, leftUpperArm ->
// LeftUpperArm). Kept as an explicit table rather than a capitalize() so it is
// trivial to diverge per-bone if a specific Shogun template wants different
// names (e.g. LeftArm/LeftForeArm instead of LeftUpperArm/LeftLowerArm).

export const VRM_TO_SHOGUN: Record<string, string> = {
  hips: "Hips",
  spine: "Spine",
  chest: "Chest",
  upperChest: "UpperChest",
  neck: "Neck",
  head: "Head",
  leftEye: "LeftEye",
  rightEye: "RightEye",
  jaw: "Jaw",

  leftShoulder: "LeftShoulder",
  leftUpperArm: "LeftUpperArm",
  leftLowerArm: "LeftLowerArm",
  leftHand: "LeftHand",
  rightShoulder: "RightShoulder",
  rightUpperArm: "RightUpperArm",
  rightLowerArm: "RightLowerArm",
  rightHand: "RightHand",

  leftUpperLeg: "LeftUpperLeg",
  leftLowerLeg: "LeftLowerLeg",
  leftFoot: "LeftFoot",
  leftToes: "LeftToes",
  rightUpperLeg: "RightUpperLeg",
  rightLowerLeg: "RightLowerLeg",
  rightFoot: "RightFoot",
  rightToes: "RightToes",

  leftThumbMetacarpal: "LeftThumbMetacarpal",
  leftThumbProximal: "LeftThumbProximal",
  leftThumbDistal: "LeftThumbDistal",
  leftIndexProximal: "LeftIndexProximal",
  leftIndexIntermediate: "LeftIndexIntermediate",
  leftIndexDistal: "LeftIndexDistal",
  leftMiddleProximal: "LeftMiddleProximal",
  leftMiddleIntermediate: "LeftMiddleIntermediate",
  leftMiddleDistal: "LeftMiddleDistal",
  leftRingProximal: "LeftRingProximal",
  leftRingIntermediate: "LeftRingIntermediate",
  leftRingDistal: "LeftRingDistal",
  leftLittleProximal: "LeftLittleProximal",
  leftLittleIntermediate: "LeftLittleIntermediate",
  leftLittleDistal: "LeftLittleDistal",

  rightThumbMetacarpal: "RightThumbMetacarpal",
  rightThumbProximal: "RightThumbProximal",
  rightThumbDistal: "RightThumbDistal",
  rightIndexProximal: "RightIndexProximal",
  rightIndexIntermediate: "RightIndexIntermediate",
  rightIndexDistal: "RightIndexDistal",
  rightMiddleProximal: "RightMiddleProximal",
  rightMiddleIntermediate: "RightMiddleIntermediate",
  rightMiddleDistal: "RightMiddleDistal",
  rightRingProximal: "RightRingProximal",
  rightRingIntermediate: "RightRingIntermediate",
  rightRingDistal: "RightRingDistal",
  rightLittleProximal: "RightLittleProximal",
  rightLittleIntermediate: "RightLittleIntermediate",
  rightLittleDistal: "RightLittleDistal",

  // VRM 0.x thumb naming (no metacarpal; uses proximal/intermediate/distal).
  leftThumbIntermediate: "LeftThumbProximal",
  rightThumbIntermediate: "RightThumbProximal",
};

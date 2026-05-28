# VRM → Vicon Shogun FBX

A browser tool that converts a VRM avatar into an FBX for Vicon Shogun.

https://vtoku.github.io/VRMxShogun/

## What it does

Reads a `.vrm` file and exports an `.fbx` containing the avatar's skeleton, mesh, and skin weights. The bone names and hierarchy are kept as they are in the VRM; the bind pose is aligned to the orientation Shogun expects. Conversion runs locally in the browser — the file is not uploaded.

## How to use

1. Drag a `.vrm` file onto the page (or click to select one).
2. Review the 3D preview and avatar details.
3. Click **Download FBX** — the file is named `<name>_retarget.fbx`.
4. Import it into Shogun as a retarget target.

Supports VRM 0.x and VRM 1.0.

## Not included

Textures, blendshapes, spring/jiggle bones, and animation are not exported.

## Trademarks

Independent, unofficial tool. "Vicon" and "Shogun" are trademarks of Vicon Motion Systems Ltd; "VRM" of the VRM Consortium. Not affiliated with or endorsed by either.

## License

MIT.

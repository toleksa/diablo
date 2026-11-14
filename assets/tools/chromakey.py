#!/usr/bin/env python3
# Cut pass for the chroma plates: how the four `*_cut_*` files in assets/ were
# made, so a rebuild is a recipe and not a memory.
#
# The Comfy graphs in assets/workflows/chroma_*_v01.json are the character
# graphs re-run at the same seed on a flat chroma-magenta ground. Keying on the
# raw magenta is not enough on its own: the models render that ground as a
# vignetted gradient with a cast shadow under the figure, so the local plate
# colour is estimated from the four border strips (which are guaranteed plate)
# and every pixel is compared against THAT. The distance is then ramped to alpha
# and the plate blend undone at the rim, which is what leaves no magenta fringe.
#
# The tool also crops to the figure and reports `cx`, the body line: the models
# centre the subject in the source frame, so the source midline is still the
# body line once the crop is taken, and `game.js` needs that to plant a figure
# on its own feet rather than on the middle of its plate.
#
#   chromakey.py '[["goblin","<chroma png>","assets/character_goblin_cut_v01.png",
#                   "<preview png>"], ...]'
#
# The chroma renders themselves are not kept in the repo: they are Comfy output.
# Rebuild = run the graph, then run this over the output.
import sys, json
from PIL import Image
import numpy as np


def field(a):
    """per-pixel estimate of the plate colour, from the border strips only"""
    h, w, _ = a.shape
    left = a[:, :4, :].mean(axis=1, keepdims=True)      # (h,1,3)
    right = a[:, w - 4:, :].mean(axis=1, keepdims=True)
    top = a[:4, :, :].mean(axis=0, keepdims=True)       # (1,w,3)
    bot = a[h - 4:, :, :].mean(axis=0, keepdims=True)
    xx = np.linspace(0.0, 1.0, w, dtype=np.float64)[None, :, None]
    yy = np.linspace(0.0, 1.0, h, dtype=np.float64)[:, None, None]
    horiz = left * (1.0 - xx) + right * xx              # (h,w,3)
    vert = top * (1.0 - yy) + bot * yy
    return horiz * 0.5 + vert * 0.5


def key(src_path, out_path, preview_path, d0=24.0, d1=86.0):
    im = Image.open(src_path).convert("RGB")
    a = np.asarray(im, dtype=np.float64)
    w, h = im.size
    bg = field(a)
    d = np.sqrt(((a - bg) ** 2).sum(axis=2))
    alpha = np.clip((d - d0) / (d1 - d0), 0.0, 1.0)
    # undo the plate blend on the rim so the edge carries no magenta fringe
    aa = np.maximum(alpha, 0.08)
    un = (a - (1.0 - aa[..., None]) * bg) / aa[..., None]
    b = np.where((alpha < 0.98)[..., None], np.clip(un, 0, 255), a)
    rgba = np.dstack([b.astype(np.uint8), (alpha * 255).astype(np.uint8)])
    fg = alpha > 0.04
    ys, xs = np.nonzero(fg)
    l, r = int(xs.min()), int(xs.max())
    t, bo = int(ys.min()), int(ys.max())
    crop = Image.fromarray(rgba[t:bo + 1, l:r + 1])
    crop.save(out_path)
    back = Image.new("RGBA", crop.size, (26, 21, 15, 255))  # the arena floor tone
    back.alpha_composite(crop)
    back.convert("RGB").save(preview_path)
    return {
        "crop": [l, t, r + 1, bo + 1],
        "size": [int(crop.size[0]), int(crop.size[1])],
        "cx": round(w / 2.0 - l, 1),
    }


if __name__ == "__main__":
    jobs = json.loads(sys.argv[1])
    out = {}
    for key_, src, dst, prev in jobs:
        out[key_] = key(src, dst, prev)
        print(key_, out[key_], flush=True)
    print(json.dumps(out))

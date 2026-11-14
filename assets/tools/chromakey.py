#!/usr/bin/env python3
# Cut pass for the chroma plates: how the four `*_cut_*` files and the eight
# `icon_skill_*` plates in assets/ were made, so a rebuild is a recipe and not
# a memory.
#
# The graphs in assets/workflows render each piece on a flat chroma-magenta
# ground. Keying on raw magenta is not enough: the models paint that ground as
# a vignetted gradient with a cast shadow under the subject, so the local ground
# colour is estimated from the four border strips (which are guaranteed ground)
# and every pixel is compared against THAT. The distance ramps to alpha, and the
# ground blend is undone at the rim, which is what leaves no magenta fringe.
#
# Two framings, because the two halves of the set need different ones:
#   figure   the character plates: cropped to the figure, and `cx` is reported -
#            the models centre the subject in the source frame, so the source
#            midline is still the body line once the crop is taken, and the arena
#            needs it to plant a figure on its own feet
#   panel    the icon set: cropped to the panel and scaled back up to one square
#            with a small margin, because eight icons cropped to their own bounds
#            would land in the slot at eight different visual weights, which is
#            exactly what ART_BIBLE.md 10.4 forbids
#
# A job may carry a fifth element: one box shared by a whole animation. Frames
# cropped to their own bounds land a couple of pixels apart, which shuffles
# visibly the moment the game switches frames, so the four beats of the goblin's
# run are cut through the union of their bounds and share one body line.
#
#   chromakey.py <framing> '[["name","<chroma png>","<out png>","<preview png>"], ...]'
#   e.g. chromakey.py figure '[["goblin","chroma.png","assets/character_goblin_cut_v01.png",
#                              "goblin-preview.png"]]'
import sys, json
from PIL import Image
import numpy as np

MARGIN = 0.055      # the small margin the icon block asks the panel for


def field(a):
    """per-pixel estimate of the ground colour, from the border strips only"""
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


def key(src_path, out_path, preview_path, d0=24.0, d1=86.0, framing='figure', box=None):
    im = Image.open(src_path).convert('RGB')
    a = np.asarray(im, dtype=np.float64)
    w, h = im.size
    bg = field(a)
    d = np.sqrt(((a - bg) ** 2).sum(axis=2))
    alpha = np.clip((d - d0) / (d1 - d0), 0.0, 1.0)
    # undo the ground blend at the edge so the rim carries no magenta fringe
    aa = np.maximum(alpha, 0.08)
    un = (a - (1.0 - aa[..., None]) * bg) / aa[..., None]
    b = np.where((alpha < 0.98)[..., None], np.clip(un, 0, 255), a)
    rgba = np.dstack([b.astype(np.uint8), (alpha * 255).astype(np.uint8)])
    if box:
        # one box shared by a whole animation: every frame keeps the same bounds
        # and the same body line, so switching frames cannot jitter
        l, t, r, bo = [int(v) for v in box]
        crop = Image.fromarray(rgba[t:bo + 1, l:r + 1])
    else:
        ys, xs = np.nonzero(alpha > 0.04)
        l, r = int(xs.min()), int(xs.max())
        t, bo = int(ys.min()), int(ys.max())
        crop = Image.fromarray(rgba[t:bo + 1, l:r + 1])
        if framing == 'panel':
            # one square for the whole set: the panel keeps its own shape but every
            # piece is scaled to the same side and centred in the same frame
            cw, ch = r - l + 1, bo - t + 1
            side = round(max(cw, ch) * (1.0 + 2 * MARGIN))
            sc = side / max(cw, ch)
            pw, ph = round(cw * sc), round(ch * sc)
            frame = Image.new('RGBA', (w, h), (0, 0, 0, 0))
            piece = crop.resize((pw, ph), Image.LANCZOS)
            ox, oy = (w - pw) // 2, (h - ph) // 2
            frame.paste(piece, (ox, oy), piece)
            crop = frame
            l, t, r, bo = ox, oy, ox + pw - 1, oy + ph - 1
    crop.save(out_path)
    back = Image.new('RGBA', crop.size, (26, 21, 15, 255))   # the arena floor tone
    back.alpha_composite(crop)
    back.convert('RGB').save(preview_path)
    return {
        'crop': [l, t, r + 1, bo + 1],
        'size': [int(crop.size[0]), int(crop.size[1])],
        'cx': round(w / 2.0 - l, 1),
    }


if __name__ == '__main__':
    framing = sys.argv[1]
    jobs = json.loads(sys.argv[2])
    out = {}
    for job in jobs:
        key_, src, dst, prev = job[:4]
        box = job[4] if len(job) > 4 else None
        out[key_] = key(src, dst, prev, framing=framing, box=box)
        print(key_, out[key_], flush=True)
    print(json.dumps(out))

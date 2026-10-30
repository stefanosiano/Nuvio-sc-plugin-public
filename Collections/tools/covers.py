# Renders the word covers of Decenni (decade-<slug>.png) and Generi
# (genre-tv-<slug>.png, genre-movie-<slug>.png) into Collections/covers. Usage: python3 Collections/tools/covers.py
import json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'covers')
FONT = '/usr/share/fonts/julietaula-montserrat-fonts/Montserrat-Black.otf'
CAPTION_FONT = '/usr/share/fonts/julietaula-montserrat-fonts/Montserrat-Bold.otf'
SS = 2


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def background(w, h, stops, shade=1.0):
    a, b = np.array(hex2rgb(stops[0]), np.float32) * shade, np.array(hex2rgb(stops[1]), np.float32) * shade
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    t = np.clip((x / w) * 0.6 + (1 - y / h) * 0.4, 0, 1)[..., None]
    img = a * (1 - t) + b * t
    d = np.sqrt(((x - w / 2) / (w / 2)) ** 2 + ((y - h / 2) / (h / 2)) ** 2)
    img *= (1 - 0.35 * np.clip(d - 0.4, 0, 1))[..., None]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')


def fitted(d, text, path, size, maxw):
    font = ImageFont.truetype(path, size)
    b = d.textbbox((0, 0), text, font=font)
    if b[2] - b[0] > maxw:
        font = ImageFont.truetype(path, int(size * maxw / (b[2] - b[0])))
        b = d.textbbox((0, 0), text, font=font)
    return font, b


def icon(d, kind, h, fill):
    # small corner mark: a screen on a stand for series, a film strip for films
    s, m = int(h * 0.11), int(h * 0.07)
    if kind == 'TV':
        d.rounded_rectangle((m, m, m + s * 1.4, m + s), radius=s // 8, outline=fill, width=max(2, s // 10))
        d.line((m + s * 0.5, m + s * 1.2, m + s * 0.9, m + s * 1.2), fill=fill, width=max(2, s // 10))
        d.line((m + s * 0.7, m + s, m + s * 0.7, m + s * 1.2), fill=fill, width=max(2, s // 10))
    else:
        d.rectangle((m, m, m + s * 1.4, m + s), fill=fill)
        hole = s // 7
        for i in range(5):
            x = m + s * 0.12 + i * s * 0.28
            for y in (m + s * 0.08, m + s - s * 0.08 - hole):
                d.rectangle((x, y, x + hole, y + hole), fill=(0, 0, 0, 0))
        d.rectangle((m + s * 0.3, m + s * 0.32, m + s * 1.1, m + s * 0.68), fill=(0, 0, 0, 0))


def cover(name, label, caption, stops, glow, colour, size, W, H, prefix=None, kind=None, shade=1.0):
    w, h = W * SS, H * SS
    img = background(w, h, stops, shade)
    text = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(text)
    if kind:
        icon(d, kind, h, hex2rgb(colour) + (200,))
    font, nb = fitted(d, label, FONT, int(h * size), w * 0.82)
    nh = nb[3] - nb[1]
    if prefix:  # small line above the label (PRE ’70), so the label keeps its size
        pfont = ImageFont.truetype(FONT, int(h * size / 3))
        pb = d.textbbox((0, 0), prefix, font=pfont)
        ph, pgap = pb[3] - pb[1], int(h * 0.02)
    else:
        ph = pgap = 0
    if caption:
        cfont, cb = fitted(d, caption, CAPTION_FONT, int(h * 0.075), w * 0.86)
        ch, gap = cb[3] - cb[1], int(h * 0.06)
    else:
        ch = gap = 0
    top = (h - (ph + pgap + nh + gap + ch)) // 2
    if prefix:
        d.text(((w - (pb[2] - pb[0])) // 2 - pb[0], top - pb[1]), prefix, font=pfont, fill=hex2rgb(colour) + (255,))
        top += ph + pgap
    d.text(((w - (nb[2] - nb[0])) // 2 - nb[0], top - nb[1]), label, font=font, fill=hex2rgb(colour) + (255,))
    if caption:
        d.text(((w - (cb[2] - cb[0])) // 2 - cb[0], top + nh + gap - cb[1]), caption, font=cfont,
               fill=hex2rgb(colour) + (200,))

    halo = Image.new('RGBA', (w, h), hex2rgb(glow) + (0,))
    halo.putalpha(text.getchannel('A').filter(ImageFilter.GaussianBlur(w / 45)).point(lambda v: int(v * 0.8)))
    img.alpha_composite(halo)
    img.alpha_composite(text)
    img.resize((W, H), Image.LANCZOS).convert('RGB').save(os.path.join(OUT, name + '.png'), optimize=True)


def load(name):
    with open(os.path.join(HERE, name), encoding='utf-8') as f:
        return json.load(f)


for d in load('decades.json'):
    cover('decade-' + d['slug'], d['label'], d['caption'], d['bg'], d['glow'], d['colour'], 0.36, 512, 512,
          d.get('prefix'))
# one cover per collection: films get a darker gradient, both a corner icon
for g in load('genres.json'):
    for kind, shade in (('TV', 1.0), ('MOVIE', 0.55)):
        caption = g['caption'][kind] if isinstance(g['caption'], dict) else g['caption']
        cover('genre-%s-%s' % (kind.lower(), g['slug']), g['label'], caption, g['bg'], g['glow'], '#FFFFFF', 0.30,
              640, 360, kind=kind, shade=shade)

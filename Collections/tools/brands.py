# Renders the Serie Originali assets: covers/<slug>.png (logo on brand colours)
# and logos/<slug>.png (white title logo). Logos come from TMDB's image CDN
# (no key) and are cached in tools/.logos.
# Usage: python3 Collections/tools/brands.py [slug ...]
import json, os, sys, urllib.request
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
CACHE = os.path.join(HERE, '.logos')

W, H = 640, 360          # cover size


def hex2rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def background(w, h, stops):
    a, b = hex2rgb(stops[0]), hex2rgb(stops[1])
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    t = np.clip((x / w) * 0.6 + (1 - y / h) * 0.4, 0, 1)[..., None]
    img = a * (1 - t) + b * t
    d = np.sqrt(((x - w / 2) / (w / 2)) ** 2 + ((y - h / 2) / (h / 2)) ** 2)
    img *= (1 - 0.35 * np.clip(d - 0.4, 0, 1))[..., None]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB')


def load_logo(path, mode):
    os.makedirs(CACHE, exist_ok=True)
    local = os.path.join(CACHE, os.path.basename(path))
    if not os.path.exists(local):
        urllib.request.urlretrieve('https://image.tmdb.org/t/p/original' + path, local)
    a = np.array(Image.open(local).convert('RGBA')).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3:]
    if mode == 'white':
        rgb[:] = 255
    elif mode == 'rai':
        # blue -> white, white "Rai" letters -> knocked out
        whiteish = rgb.min(axis=2) > 200
        rgb[:] = 255
        al[whiteish] = 0
    elif mode == 'grey2white':
        sat = rgb.max(axis=2) - rgb.min(axis=2)
        rgb[sat < 40] = 255
    im = Image.fromarray(np.concatenate([rgb, al], axis=2).astype(np.uint8), 'RGBA')
    return im.crop(im.getbbox())


def fit(logo, w, h, mw=0.62, mh=0.42):
    s = min(w * mw / logo.width, h * mh / logo.height)
    return logo.resize((max(1, round(logo.width * s)), max(1, round(logo.height * s))), Image.LANCZOS)


def paste_center(base, logo, glow):
    x, y = (base.width - logo.width) // 2, (base.height - logo.height) // 2
    g = Image.new('RGBA', base.size, (0, 0, 0, 0))
    g.alpha_composite(logo, (x, y))
    g = g.filter(ImageFilter.GaussianBlur(base.width / 40))
    r, gg, b, a = g.split()
    g = Image.merge('RGBA', (r, gg, b, a.point(lambda v: int(v * glow))))
    base.alpha_composite(g)
    base.alpha_composite(logo, (x, y))


def make(b):
    slug, stops = b['slug'], b['bg']
    logo = load_logo(b['logo'], b['mode'])

    tl = logo.copy()
    tl.thumbnail((800, 300), Image.LANCZOS)
    tl.save(os.path.join(ROOT, 'logos', slug + '.png'), optimize=True)

    cover = background(W * 2, H * 2, stops).convert('RGBA')
    paste_center(cover, fit(logo, W * 2, H * 2), glow=0.35)
    cover.resize((W, H), Image.LANCZOS).convert('RGB').save(os.path.join(ROOT, 'covers', slug + '.png'), optimize=True)
    print(slug)


with open(os.path.join(HERE, 'brands.json'), encoding='utf-8') as f:
    BRANDS = json.load(f)
only = sys.argv[1:]
for b in BRANDS:
    if not only or b['slug'] in only:
        make(b)

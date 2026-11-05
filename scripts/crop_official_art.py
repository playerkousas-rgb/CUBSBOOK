#!/usr/bin/env python3
"""由官方《幼童軍紀錄冊》(© 2026) PDF 裁出封面、章節扉頁及徽章原圖。

用法：
    python3 scripts/crop_official_art.py /path/to/幼童軍紀錄冊2026Sep version.pdf

輸出：web/public/official/*.webp / *.png
（官方 PDF 不放入 repo；本 script 只記錄裁圖範圍，方便日後重新產生。）

需要：pip install pypdfium2 pillow
"""
import os
import sys

import pypdfium2 as pdfium
from PIL import Image, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'web', 'public', 'official')

# PDF 頁（1 = 封面）→ 裁圖範圍（左、上、右、下，以頁面比例表示）
ART = {
    'membership-emblem.png': (11, (72.6 / 216, (306 - 270.6) / 306, 143.4 / 216, (306 - 199.8) / 306)),
    'badge-experience.png': (14, (7.4 / 216, (306 - 270.6) / 306, 63.4 / 216, (306 - 214.8) / 306)),
    'badge-adventure.png': (15, (7.4 / 216, (306 - 270.6) / 306, 63.4 / 216, (306 - 214.8) / 306)),
    'badge-crest.png': (17, (7.4 / 216, (306 - 270.6) / 306, 63.4 / 216, (306 - 214.8) / 306)),
    'badge-golden.png': (19, (7.4 / 216, (306 - 270.6) / 306, 63.4 / 216, (306 - 214.8) / 306)),
    'hexagons.png': (28, (0.045, 0.570, 0.935, 0.885)),
    'grand-howl.png': (33, (0.02, 0.648, 0.79, 0.895)),
}


def render(pdf, page_no, scale):
    return pdf[page_no - 1].render(scale=scale).to_pil().convert('RGB')


def cut(page, box, alpha_gain=6, quantize=True):
    width, height = page.size
    left, top, right, bottom = [
        int(round(v * size)) for v, size in zip(box, (width, height, width, height))
    ]
    tile = page.crop((left, top, right, bottom))
    paper = page.getpixel((3, height - 3))
    diff = ImageChops.difference(tile, Image.new('RGB', tile.size, paper)).convert('L')
    art = tile.convert('RGBA')
    art.putalpha(diff.point(lambda v: min(255, v * alpha_gain)))
    if quantize:
        art = art.quantize(colors=128, method=Image.FASTOCTREE)
    return art


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    os.makedirs(OUT, exist_ok=True)
    pdf = pdfium.PdfDocument(sys.argv[1])

    render(pdf, 1, 4).save(os.path.join(OUT, 'cover.webp'), 'WEBP', quality=90, method=6)
    render(pdf, 13, 4).save(os.path.join(OUT, 'divider.webp'), 'WEBP', quality=90, method=6)

    for name, (page_no, box) in ART.items():
        scale = 6 if 'badge' in name or 'membership' in name else 6
        cut(render(pdf, page_no, scale), box).save(os.path.join(OUT, name), optimize=True)

    print('已輸出：', ', '.join(sorted(os.listdir(OUT))))


if __name__ == '__main__':
    main()

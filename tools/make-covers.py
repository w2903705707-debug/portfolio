# -*- coding: utf-8 -*-
"""
生成作品封面占位图（16:9 / 960x540 / JPEG）。
用法：python tools/make-covers.py
生成后可直接用同名文件替换：assets/covers/w01.jpg ... w32.jpg, reel.jpg

分类有各自的「视觉语言」：
  宣传片  → 冷蓝青 + 地平线 + 天际线
  动效    → 紫 + 同心圆环与网格
  短视频  → 暖橙 + 竖向光柱 + 取景框
  AIGC    → 靛蓝 + 星带粒子
  混剪    → 炭灰 + 斜向强光
同一类内部再叠加每张独立的色相偏移、曝光、构图与元素疏密，避免 32 张长得一样。
"""
import os
import sys
import math
import zlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 960, 540
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "covers")
os.makedirs(OUT, exist_ok=True)

# 莫兰迪配色：低饱和、冷暖平衡（--morandi 启用）
PALETTES_MORANDI = {
    "xcp":   [(0x1d, 0x2b, 0x2a), (0x33, 0x4b, 0x47), (0x5e, 0x7a, 0x74), (0xad, 0xc4, 0xbd)],  # 雾青
    "ae":    [(0x2a, 0x24, 0x2f), (0x45, 0x3d, 0x4e), (0x72, 0x68, 0x7e), (0xbd, 0xb4, 0xc7)],  # 雾紫灰
    "short": [(0x2e, 0x23, 0x24), (0x4a, 0x37, 0x38), (0x7a, 0x5f, 0x5e), (0xc2, 0xa8, 0xa4)],  # 雾玫瑰
    "aigc":  [(0x1b, 0x25, 0x2b), (0x2f, 0x42, 0x4c), (0x54, 0x6e, 0x7a), (0xa8, 0xbc, 0xc4)],  # 靛灰
    "mix":   [(0x24, 0x26, 0x26), (0x3a, 0x3e, 0x3e), (0x64, 0x69, 0x68), (0xb2, 0xb6, 0xb3)],  # 石墨
}

# 电影感配色（默认）：高饱和、为深色底做了提亮
PALETTES_CINEMA = {
    "xcp":   [(0x12, 0x28, 0x34), (0x24, 0x52, 0x66), (0x58, 0x9c, 0xae), (0xcc, 0xe8, 0xee)],
    "ae":    [(0x21, 0x17, 0x30), (0x42, 0x2e, 0x66), (0x84, 0x64, 0xac), (0xd8, 0xc4, 0xea)],
    "short": [(0x28, 0x19, 0x0e), (0x5e, 0x36, 0x1e), (0xb0, 0x72, 0x42), (0xf2, 0xd0, 0xa8)],
    "aigc":  [(0x0e, 0x1b, 0x36), (0x20, 0x40, 0x70), (0x4a, 0x86, 0xba), (0xba, 0xdc, 0xf2)],
    "mix":   [(0x18, 0x18, 0x1d), (0x33, 0x33, 0x3c), (0x66, 0x66, 0x72), (0xc6, 0xc6, 0xd2)],
}

MORANDI = "--morandi" in sys.argv
CINEMA = not MORANDI          # 默认：深色站用的电影感配色
PALETTES = PALETTES_MORANDI if MORANDI else PALETTES_CINEMA

WORKS = [
    ("w01", "xcp"), ("w02", "xcp"), ("w03", "xcp"),
    ("w04", "ae"), ("w05", "ae"), ("w06", "ae"), ("w07", "ae"),
    ("w08", "ae"), ("w09", "ae"), ("w10", "ae"), ("w11", "ae"),
    ("w12", "short"), ("w13", "short"), ("w14", "short"), ("w15", "short"),
    ("w16", "short"), ("w17", "short"), ("w18", "short"), ("w19", "short"), ("w20", "short"),
    ("w21", "aigc"), ("w22", "aigc"), ("w23", "aigc"), ("w24", "aigc"), ("w25", "aigc"),
    ("w26", "aigc"), ("w27", "aigc"), ("w28", "aigc"), ("w29", "aigc"), ("w30", "aigc"),
    ("w31", "mix"), ("w32", "mix"),
]

YY, XX = np.mgrid[0:H, 0:W]
NX = XX / (W - 1)
NY = YY / (H - 1)


def seed_of(uid):
    return zlib.crc32(uid.encode("utf-8")) & 0xFFFFFFFF


def f(rng, lo, hi):
    return float(rng.uniform(lo, hi))


def linear_gradient(stops, angle_deg, shift=0.0):
    ang = math.radians(angle_deg)
    t = NX * math.cos(ang) + NY * math.sin(ang)
    t = (t - t.min()) / (t.max() - t.min() + 1e-6)
    t = np.clip(t + shift, 0, 1)

    arr = np.zeros((H, W, 3), dtype=np.float32)
    n = len(stops) - 1
    pos = np.linspace(0.0, 1.0, n + 1)
    for i in range(n):
        c0 = np.array(stops[i], dtype=np.float32)
        c1 = np.array(stops[i + 1], dtype=np.float32)
        seg = np.clip((t - pos[i]) / (pos[i + 1] - pos[i] + 1e-6), 0, 1)[..., None]
        blended = c0 + (c1 - c0) * seg
        mask = ((t >= pos[i]) & (t <= pos[i + 1]))[..., None]
        arr = np.where(mask, blended, arr)
    return arr


def glow(arr, cx, cy, r, color, strength):
    d = np.sqrt(((NX - cx) / r) ** 2 + ((NY - cy) / (r * W / H)) ** 2)
    g = np.clip(1 - d, 0, 1) ** 2
    return arr + g[..., None] * np.array(color, dtype=np.float32) * strength


def horizon(arr, y, thickness, color, strength):
    band = np.exp(-((NY - y) ** 2) / (2 * thickness ** 2))[..., None]
    return arr + band * np.array(color, dtype=np.float32) * strength


def vertical_bar(arr, x, width, color, strength):
    band = np.exp(-((NX - x) ** 2) / (2 * width ** 2))[..., None]
    return arr + band * np.array(color, dtype=np.float32) * strength


def diagonal_streak(arr, offset, width, color, strength):
    d = NX - NY * 0.8 - offset
    band = np.exp(-(d ** 2) / (2 * width ** 2))[..., None]
    return arr + band * np.array(color, dtype=np.float32) * strength


def star_band(arr, rng, color):
    """随机角度的一条星带，而不是满屏均匀噪点"""
    ang = f(rng, 0, math.pi)
    nx, ny = math.cos(ang), math.sin(ang)
    off = f(rng, -0.3, 0.3)
    d = NX * nx + NY * ny - off
    band = np.exp(-(d ** 2) / (2 * f(rng, 0.05, 0.16) ** 2))[..., None]

    layer = np.zeros((H, W, 1), dtype=np.float32)
    for _ in range(int(rng.integers(40, 120))):
        cx, cy = rng.integers(0, W), rng.integers(0, H)
        r = float(rng.uniform(0.9, 3.0))
        dd = np.sqrt((XX - cx) ** 2 + (YY - cy) ** 2)
        layer += np.exp(-(dd ** 2) / (2 * (r * 2.2) ** 2))[..., None] * float(rng.uniform(0.2, 1.0))
    layer = np.clip(layer, 0, 1.6)
    return arr + (layer * band) * np.array(color, dtype=np.float32) * f(rng, 0.5, 1.0)


def vignette(arr, power, amount, cx, cy):
    d = np.sqrt(((NX - cx) * 2) ** 2 + ((NY - cy) * 2) ** 2) / 1.6
    return arr * (1 - amount * (d ** power)).clip(0, 1)[..., None]


def paint_shapes(img, cat, rng, pal):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    bright, mid = pal[-1], pal[2]

    def rgba(c, a):
        return (int(c[0]), int(c[1]), int(c[2]), int(max(0, min(255, a))))

    if cat == "xcp":
        base = int(rng.integers(H * 0.58, H * 0.82))
        if rng.random() < 0.85:                      # 大部分有天际线，少部分是纯空镜
            x = -int(rng.integers(0, 60))
            while x < W:
                w = int(rng.integers(18, 110))
                h = int(rng.integers(10, 120))
                d.rectangle([x, base - h, x + w, base], fill=rgba(pal[0], int(rng.integers(50, 150))))
                x += w + int(rng.integers(0, 22))
        d.rectangle([0, base, W, H], fill=rgba(pal[0], int(rng.integers(120, 190))))

    elif cat == "ae":
        rings = int(rng.integers(2, 6))
        cx, cy = int(rng.integers(-W * 0.2, W * 1.2)), int(rng.integers(-H * 0.3, H * 1.3))
        r0 = int(rng.integers(40, 190))
        for i in range(rings):
            r = r0 + i * int(rng.integers(24, 58))
            d.ellipse([cx - r, cy - r, cx + r, cy + r],
                      outline=rgba(bright, int(rng.integers(22, 70))), width=int(rng.integers(1, 3)))
        if rng.random() < 0.7:
            step = int(rng.integers(34, 78))
            for gx in range(0, W, step):
                d.line([gx, 0, gx, H], fill=rgba(mid, int(rng.integers(8, 26))), width=1)

    elif cat == "short":
        for _ in range(int(rng.integers(1, 5))):
            x = int(rng.integers(-20, W + 20))
            w = int(rng.integers(2, 16))
            d.rectangle([x, 0, x + w, H], fill=rgba(bright, int(rng.integers(14, 55))))
        if rng.random() < 0.65:
            bw, bh = int(rng.integers(W * 0.22, W * 0.46)), int(rng.integers(H * 0.6, H * 0.85))
            fx, fy = int(rng.integers(-30, W - bw)), int(rng.integers(-20, H - bh))
            d.rectangle([fx, fy, fx + bw, fy + bh], outline=rgba(bright, 38), width=1)

    elif cat == "aigc":
        if rng.random() < 0.75:
            for _ in range(int(rng.integers(20, 55))):
                px, py = int(rng.integers(0, W)), int(rng.integers(0, H))
                r = int(rng.integers(1, 3))
                d.ellipse([px - r, py - r, px + r, py + r], fill=rgba(bright, int(rng.integers(40, 160))))
        if rng.random() < 0.5:
            cy = int(rng.integers(H * 0.3, H * 0.7))
            d.line([0, cy, W, cy], fill=rgba(mid, 22), width=1)

    else:  # mix
        if rng.random() < 0.8:
            for _ in range(int(rng.integers(1, 4))):
                off = int(rng.integers(-W, W))
                th = int(rng.integers(2, 11))
                skew = int(rng.integers(-160, 200))
                d.polygon([(off, 0), (off + th, 0), (off + th + skew, H), (off + skew, H)],
                          fill=rgba(bright, int(rng.integers(24, 85))))

    layer = layer.filter(ImageFilter.GaussianBlur(f(rng, 0.6, 2.8)))
    return Image.alpha_composite(img, layer)


def hue_shift(img, hs, sm, vm):
    h, s, v = img.convert("HSV").split()
    h = h.point(lambda x: (x + hs) % 256)
    s = s.point(lambda x: max(0, min(255, int(x * sm))))
    v = v.point(lambda x: max(0, min(255, int(x * vm))))
    return Image.merge("HSV", (h, s, v)).convert("RGB")


def cloud(rng, gw, gh):
    """低频云状纹理：让每张图有各自的体积感，而不是纯渐变"""
    low = rng.random((gh, gw)).astype(np.float32) * 255
    im = Image.fromarray(low.astype(np.uint8), "L").resize((W, H), Image.BICUBIC)
    return np.asarray(im, dtype=np.float32) / 255.0


def norm_luma(arr, target):
    luma = 0.2126 * arr[..., 0] + 0.7152 * arr[..., 1] + 0.0722 * arr[..., 2]
    mean = float(luma.mean()) + 1e-3
    return arr * (target / mean)


def make(uid, cat, idx):
    rng = np.random.default_rng(seed_of(uid))
    pal = PALETTES[cat]

    angle = f(rng, 0, 360)
    shift = f(rng, -0.22, 0.22)
    arr = linear_gradient(pal, angle, shift)

    if cat == "xcp":
        arr = horizon(arr, f(rng, 0.5, 0.74), f(rng, 0.04, 0.13), pal[3], f(rng, 0.35, 0.95))
        arr = glow(arr, f(rng, 0.15, 0.9), f(rng, 0.4, 0.7), f(rng, 0.2, 0.5), pal[3], f(rng, 0.2, 0.45))
    elif cat == "ae":
        arr = glow(arr, f(rng, 0.2, 0.85), f(rng, 0.25, 0.7), f(rng, 0.2, 0.5), pal[3], f(rng, 0.25, 0.5))
        if rng.random() < 0.7:
            arr = glow(arr, f(rng, 0.1, 0.4), f(rng, 0.7, 0.95), f(rng, 0.2, 0.4), pal[1], f(rng, 0.15, 0.3))
    elif cat == "short":
        arr = vertical_bar(arr, f(rng, 0.1, 0.9), f(rng, 0.04, 0.12), pal[3], f(rng, 0.2, 0.7))
        arr = glow(arr, f(rng, 0.25, 0.8), f(rng, 0.45, 0.8), f(rng, 0.2, 0.5), pal[2], f(rng, 0.2, 0.38))
    elif cat == "aigc":
        arr = glow(arr, f(rng, 0.25, 0.8), f(rng, 0.2, 0.6), f(rng, 0.2, 0.55), pal[3], f(rng, 0.2, 0.45))
        arr = star_band(arr, rng, pal[3])
    else:
        arr = diagonal_streak(arr, f(rng, -0.5, 0.5), f(rng, 0.04, 0.13), pal[3], f(rng, 0.2, 0.8))
        arr = glow(arr, f(rng, 0.3, 0.85), f(rng, 0.2, 0.6), f(rng, 0.2, 0.45), pal[3], f(rng, 0.15, 0.32))

    arr = vignette(arr, f(rng, 0.85, 1.3), f(rng, 0.35, 0.66), f(rng, 0.38, 0.62), f(rng, 0.38, 0.62))

    # 两层云状纹理，制造体积与局部明暗
    arr = arr * (0.86 + 0.28 * cloud(rng, 20, 34))[..., None]
    arr = arr * (0.94 + 0.12 * cloud(rng, 72, 120))[..., None]

    # 统一亮度基准，保证 32 张在网格里明暗一致
    arr = norm_luma(arr, f(rng, 62, 84) if CINEMA else f(rng, 52, 70))

    arr = arr + np.random.default_rng(seed_of(uid) + 1).normal(0, 5.0, (H, W, 1))

    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    img = paint_shapes(img, cat, rng, pal)

    # 每张独立的色相/饱和/明度微调，拉开同类作品之间的差异
    if CINEMA:
        # 深色站：略提饱和，避免在炭灰底上发灰
        img = hue_shift(img, int(rng.integers(-9, 10)), f(rng, 1.00, 1.18), f(rng, 0.97, 1.06))
    else:
        # 莫兰迪：几乎不做饱和增强，避免把颜色拉出主题
        img = hue_shift(img, int(rng.integers(-7, 8)), f(rng, 0.90, 1.00), f(rng, 0.97, 1.04))

    path = os.path.join(OUT, f"{uid}.jpg")
    img.convert("RGB").save(path, "JPEG", quality=85, optimize=True, progressive=True)
    return path


def main():
    total = 0
    for i, (uid, cat) in enumerate(WORKS):
        total += os.path.getsize(make(uid, cat, i))
    total += os.path.getsize(make("reel", "aigc", 5))
    print(f"OK  {len(WORKS) + 1} covers -> {OUT}")
    print(f"total {total / 1024 / 1024:.2f} MB")


if __name__ == "__main__":
    main()

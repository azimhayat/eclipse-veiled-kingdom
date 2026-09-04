"""Deterministic native-1080 2.5D compositor for the V5 cinematic benchmark.

Generated raster sources are composited at native size or reduced. No source
layer is ever enlarged. Camera movement is translation/parallax only; semantic
motion comes from actors, mechanisms, light routes, sand, smoke and debris.
"""

from __future__ import annotations

import argparse
import math
import shutil
import subprocess
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


W, H, FPS = 1920, 1080, 30
ROOT = Path(__file__).resolve().parents[1]
LAYERS = ROOT / "layers"
AUDIO = ROOT / "audio"
RENDERS = ROOT / "renders"
BUNDLED_FFMPEG = Path.home() / "AppData" / "Local" / "CodexMediaTools" / "ffmpeg-static-5.2.0" / "node_modules" / "ffmpeg-static" / "ffmpeg.exe"

OPENING_SHOTS = (("OP-01", 7), ("OP-02", 8), ("OP-03", 8), ("OP-04", 8),
                 ("OP-05", 9), ("OP-06", 9), ("OP-07", 8), ("OP-08", 9), ("OP-09", 6))
INTRO_SHOTS = (("C1-01", 6), ("C1-02", 7), ("C1-03", 7), ("C1-04", 7), ("C1-05", 7), ("C1-06", 6))
BRIDGE_10_SHOTS = (("B10-01", 7), ("B10-02", 8), ("B10-03", 8), ("B10-04", 8),
                   ("B10-05", 8), ("B10-06", 7), ("B10-07", 6))
BRIDGE_20_SHOTS = (("B20-01", 7), ("B20-02", 8), ("B20-03", 9), ("B20-04", 9),
                   ("B20-05", 8), ("B20-06", 8), ("B20-07", 8), ("B20-08", 7))

COLORS = {
    "navy": (4, 8, 18), "gold": (232, 197, 106), "bright": (255, 231, 155),
    "cyan": (79, 213, 244), "vermilion": (194, 65, 52), "black": (1, 2, 6),
}


def ffmpeg_path() -> str:
    found = shutil.which("ffmpeg")
    if found:
        return found
    if BUNDLED_FFMPEG.exists():
        return str(BUNDLED_FFMPEG)
    raise FileNotFoundError("FFmpeg is required for cinematic rendering")


def ease(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


def load_assets() -> dict[str, Image.Image]:
    files = {
        "orun": "orun-skyline-master.png", "engine": "engine-chamber-master.png",
        "veil": "outer-veil-master.png", "aren-kneel": "aren-awakening.png",
        "aren-stand": "aren-standing.png", "serath-open": "serath-command.png",
        "serath-fist": "serath-fist.png", "mira": "mira-lamp.png",
        "heir": "unnamed-heir.png", "warden-restored": "warden-restored.png",
        "liora-light": "liora-living-light.png",
    }
    assets = {}
    for key, name in files.items():
        mode = "RGB" if key in {"orun", "engine", "veil"} else "RGBA"
        assets[key] = Image.open(LAYERS / name).convert(mode)
    return assets


ASSETS = load_assets()


def fit_native(image: Image.Image, max_width: int, max_height: int) -> Image.Image:
    ratio = min(max_width / image.width, max_height / image.height, 1.0)
    if ratio >= 1:
        return image.copy()
    size = (max(1, round(image.width * ratio)), max(1, round(image.height * ratio)))
    return image.resize(size, Image.Resampling.LANCZOS)


CHARACTERS = {
    "aren-kneel": fit_native(ASSETS["aren-kneel"], 730, 720),
    "aren-stand": fit_native(ASSETS["aren-stand"], 610, 850),
    "serath-open": fit_native(ASSETS["serath-open"], 590, 840),
    "serath-fist": fit_native(ASSETS["serath-fist"], 590, 840),
    "mira": fit_native(ASSETS["mira"], 600, 870),
    "heir": fit_native(ASSETS["heir"], 520, 820),
    "warden-restored": fit_native(ASSETS["warden-restored"], 384, 512),
    "liora-light": fit_native(ASSETS["liora-light"], 490, 850),
    "aren-small": fit_native(ASSETS["aren-stand"], 245, 360),
}


def plate(name: str, dx: int = 0, dy: int = 0, brightness: float = 1.0) -> Image.Image:
    source = ASSETS[name]
    # Native 1920x1080 extension: source pixels are pasted 1:1; the narrow
    # outer margin is a new procedural gradient, never a scaled copy.
    base = Image.new("RGB", (W, H), COLORS["navy"])
    draw = ImageDraw.Draw(base)
    for y in range(H):
        amount = y / H
        draw.line((0, y, W, y), fill=(round(6 + 8 * amount), round(10 + 6 * amount), round(21 + 4 * amount)))
    x = (W - source.width) // 2 + dx
    y = (H - source.height) // 2 + dy
    base.paste(source, (x, y))
    if brightness != 1:
        base = ImageEnhance.Brightness(base).enhance(brightness)
    return base.convert("RGBA")


@lru_cache(maxsize=64)
def glow(radius: int, red: int, green: int, blue: int) -> Image.Image:
    size = radius * 4
    sprite = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(sprite)
    center = size // 2
    for r in range(radius * 2, 1, -3):
        alpha = round(110 * (1 - r / (radius * 2)) ** 1.8)
        draw.ellipse((center-r, center-r, center+r, center+r), fill=(red, green, blue, alpha))
    return sprite.filter(ImageFilter.GaussianBlur(max(2, radius // 9)))


def add_glow(frame: Image.Image, x: float, y: float, radius: int, color: tuple[int, int, int], opacity: float = 1) -> None:
    sprite = glow(radius, *color).copy()
    if opacity < 1:
        sprite.putalpha(sprite.getchannel("A").point(lambda a: round(a * max(0, opacity))))
    frame.alpha_composite(sprite, (round(x - sprite.width / 2), round(y - sprite.height / 2)))


def add_vignette(frame: Image.Image, strength: int = 125) -> None:
    overlay = Image.new("RGBA", (W, H))
    draw = ImageDraw.Draw(overlay)
    for index in range(14):
        inset_x = index * 24
        inset_y = index * 14
        alpha = round(strength * (1 - index / 14) ** 2 / 4)
        draw.rounded_rectangle((inset_x, inset_y, W-inset_x, H-inset_y), radius=90, outline=(0, 0, 0, alpha), width=36)
    frame.alpha_composite(overlay)


def draw_particles(frame: Image.Image, t: float, seed: int, count: int, color: tuple[int, int, int],
                   area: tuple[int, int, int, int], velocity: tuple[float, float], size: tuple[int, int] = (1, 4), alpha: int = 150) -> None:
    draw = ImageDraw.Draw(frame, "RGBA")
    left, top, right, bottom = area
    span_x, span_y = right-left, bottom-top
    for index in range(count):
        phase = (seed * 97 + index * 193) % 1009 / 1009
        phase2 = (seed * 53 + index * 127) % 997 / 997
        x = left + (phase * span_x + velocity[0] * t + 17 * math.sin(t * .7 + index)) % span_x
        y = top + (phase2 * span_y + velocity[1] * t + 9 * math.cos(t * .53 + index * .4)) % span_y
        radius = size[0] + (index % max(1, size[1]-size[0]+1))
        draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill=(*color, alpha - index % 45))


def draw_fog(frame: Image.Image, t: float, warm: bool = False) -> None:
    overlay = Image.new("RGBA", (W, H))
    draw = ImageDraw.Draw(overlay)
    color = (135, 112, 72, 18) if warm else (66, 83, 116, 16)
    for index in range(8):
        x = ((index * 310 + t * (13 + index)) % (W + 600)) - 300
        y = 170 + (index % 4) * 170 + 28 * math.sin(t * .18 + index)
        draw.ellipse((x-280, y-80, x+340, y+95), fill=color)
    frame.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(38)))


def actor_motion(image: Image.Image, t: float, sway: float = 3, breathe: float = 2) -> Image.Image:
    result = Image.new("RGBA", image.size)
    split = round(image.height * .58)
    overlap = 18
    upper = image.crop((0, 0, image.width, split + overlap))
    lower = image.crop((0, split-overlap, image.width, image.height))
    upper_y = round(breathe * math.sin(t * 1.65))
    lower_x = round(sway * math.sin(t * .86 + .7))
    result.alpha_composite(upper, (0, upper_y))
    result.alpha_composite(lower, (lower_x, split-overlap))
    return result


def composite_actor(frame: Image.Image, name: str, x: float, y: float, t: float,
                    opacity: float = 1, sway: float = 3, breathe: float = 2) -> None:
    actor = actor_motion(CHARACTERS[name], t, sway=sway, breathe=breathe)
    if opacity < 1:
        actor.putalpha(actor.getchannel("A").point(lambda a: round(a * max(0, min(1, opacity)))))
    frame.alpha_composite(actor, (round(x), round(y)))


def draw_citizens(frame: Image.Image, t: float, count: int = 26, dark: bool = False) -> None:
    draw = ImageDraw.Draw(frame, "RGBA")
    color = (4, 6, 12, 225) if dark else (24, 25, 30, 215)
    for index in range(count):
        x = 55 + index * (W - 110) / max(1, count-1)
        base_y = 1034 + 5 * math.sin(index * .8)
        height = 58 + (index * 17) % 52
        sway = 5 * math.sin(t * .9 + index * .73)
        draw.ellipse((x-8, base_y-height-18, x+8, base_y-height-2), fill=color)
        draw.polygon(((x-14, base_y-height), (x+13, base_y-height), (x+22+sway, base_y), (x-22+sway, base_y)), fill=color)
        arm = 12 * math.sin(t * 1.1 + index)
        draw.line((x-4, base_y-height+12, x-22, base_y-height-7-arm), fill=color, width=6)


def draw_engine(frame: Image.Image, t: float, inverse: float = 0, center: tuple[int, int] = (960, 395)) -> None:
    overlay = Image.new("RGBA", (W, H))
    draw = ImageDraw.Draw(overlay, "RGBA")
    cx, cy = center
    for index, radius in enumerate((108, 158, 218, 286)):
        angle = (t * (17 + index * 6) * (-1 if index % 2 else 1)) % 360
        color = COLORS["vermilion"] if inverse > .45 and index < 3 else COLORS["gold"]
        alpha = round(105 + inverse * 70)
        draw.arc((cx-radius, cy-radius, cx+radius, cy+radius), angle, angle+235, fill=(*color, alpha), width=4-index//2)
        for spoke in range(8):
            a = math.radians(angle + spoke * 45)
            px, py = cx + radius * math.cos(a), cy + radius * math.sin(a)
            draw.ellipse((px-4, py-4, px+4, py+4), fill=(*color, alpha))
    frame.alpha_composite(overlay)
    add_glow(frame, cx, cy, 95 + round(inverse * 110), COLORS["gold"], .7)
    if inverse > 0:
        draw = ImageDraw.Draw(frame, "RGBA")
        black_radius = round(25 + inverse * 122)
        draw.ellipse((cx-black_radius, cy-black_radius, cx+black_radius, cy+black_radius), fill=(0, 0, 2, round(210 + inverse * 45)), outline=(*COLORS["vermilion"], round(inverse*150)), width=4)


def draw_memory_streams(frame: Image.Image, t: float, reverse: float = 0) -> None:
    draw = ImageDraw.Draw(frame, "RGBA")
    target = (960, 395)
    for index in range(34):
        start_x = 80 + index * 53
        start_y = 1010 - (index % 5) * 10
        phase = (t * (.16 + reverse * .18) + index * .037) % 1
        if reverse:
            phase = 1 - phase
        x = start_x + (target[0] - start_x) * phase
        y = start_y + (target[1] - start_y) * phase - math.sin(phase * math.pi) * (80 + index % 6 * 12)
        color = COLORS["cyan"] if reverse > .55 and index % 3 == 0 else COLORS["gold"]
        draw.line((start_x, start_y, x, y), fill=(*color, 44), width=2)
        draw.ellipse((x-3, y-3, x+3, y+3), fill=(*color, 205))


def draw_map_table(frame: Image.Image, t: float) -> None:
    overlay = Image.new("RGBA", (W, H))
    draw = ImageDraw.Draw(overlay, "RGBA")
    draw.polygon(((560, 685), (1360, 685), (1495, 915), (430, 915)), fill=(18, 19, 24, 245), outline=(*COLORS["gold"], 150))
    for route in range(10):
        start = (530 + route * 75, 853)
        end = (660 + route * 57, 712)
        progress = ease((t - route * .18) / 2.4)
        ex = start[0] + (end[0]-start[0]) * progress
        ey = start[1] + (end[1]-start[1]) * progress
        draw.line((start[0], start[1], ex, ey), fill=(*COLORS["gold"], 210), width=4)
        if progress > .05:
            draw.ellipse((ex-5, ey-5, ex+5, ey+5), fill=(*COLORS["cyan"], 210))
    frame.alpha_composite(overlay)


def draw_sunrise(frame: Image.Image, t: float, intensity: float) -> None:
    overlay = Image.new("RGBA", (W, H))
    draw = ImageDraw.Draw(overlay, "RGBA")
    width = 70 + 420 * ease(intensity)
    center = 1160 + 35 * math.sin(t * .22)
    draw.polygon(((center-35, -30), (center+35, -30), (center+width, H), (center-width, H)), fill=(255, 220, 142, round(26 + 98*intensity)))
    frame.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(26)))
    add_glow(frame, center, 40, 170, COLORS["bright"], .7 * intensity)


def opening_frame(t: float) -> tuple[Image.Image, str]:
    cursor = 0.0
    shot, local, duration = OPENING_SHOTS[-1][0], 0.0, OPENING_SHOTS[-1][1]
    for candidate, length in OPENING_SHOTS:
        if t < cursor + length:
            shot, local, duration = candidate, t-cursor, length
            break
        cursor += length
    p = local / duration

    if shot == "OP-01":
        frame = plate("orun", round(8*math.sin(local*.2)), round(3*math.cos(local*.25)), .78 + .2*ease(p))
        draw_fog(frame, local, warm=True); draw_citizens(frame, local)
        draw_particles(frame, local, 101, 120, COLORS["gold"], (0, 250, W, 1030), (4, -38), (1, 3), 160)
        add_glow(frame, 1275, 275, 145, COLORS["gold"], .45 + .35*ease(p))
    elif shot == "OP-02":
        frame = plate("engine", round(5*math.sin(local*.26)), 0, .9)
        draw_engine(frame, local); draw_memory_streams(frame, local); draw_citizens(frame, local, 20)
        draw_particles(frame, local, 102, 70, COLORS["gold"], (300, 300, 1620, 1000), (2, -26), (1, 3), 145)
    elif shot == "OP-03":
        frame = plate("engine", round(-6 + 12*ease(p)), 0, .68)
        draw_engine(frame, local*.8)
        x = 430 + 175*ease(min(1, p*1.5))
        composite_actor(frame, "serath-open", x, 205, local, sway=5, breathe=1)
        line_draw = ImageDraw.Draw(frame, "RGBA")
        for index in range(7):
            reach = ease(max(0, (p-index*.045)/.7))
            y = 355 + index*55
            line_draw.line((975, y, 975 + reach*650, y-90+index*8), fill=(*COLORS["vermilion"], round(170*reach)), width=2)
        draw_particles(frame, local, 103, 55, COLORS["gold"], (200, 150, 1700, 980), (-3, -18), (1, 2), 110)
    elif shot == "OP-04":
        frame = plate("engine", round(5*math.sin(local*.3)), 0, .54)
        draw_engine(frame, local, inverse=ease(p))
        composite_actor(frame, "serath-fist", 595, 205, local, sway=4, breathe=.7)
        draw_memory_streams(frame, local, reverse=ease(p))
        draw_particles(frame, local, 104, 90, COLORS["cyan"], (120, 120, 1800, 1020), (8, 26), (1, 4), 165)
    elif shot == "OP-05":
        frame = plate("engine", round(4*math.sin(local*.21)), 16, .48)
        composite_actor(frame, "aren-stand", 350-18*ease(p), 176, local, sway=6)
        composite_actor(frame, "heir", 1090+16*ease(p), 150, local+.4, sway=6)
        draw_map_table(frame, local)
        draw_particles(frame, local, 105, 85, COLORS["cyan"], (360, 250, 1550, 970), (1, -24), (1, 3), 135)
    elif shot == "OP-06":
        frame = plate("orun", round(-8*ease(p)), round(2*math.sin(local*.3)), .54)
        draw_fog(frame, local)
        draw = ImageDraw.Draw(frame, "RGBA")
        for index in range(35):
            x = 70 + (index*149 % 1780)
            start_y = 860 - (index % 6)*60
            rise = ((local*55 + index*23) % 760)
            y = start_y-rise
            draw.line((x-8, y, x+8, y), fill=(*COLORS["cyan"], 145), width=2)
            draw.line((x, y-7, x, y+7), fill=(*COLORS["cyan"], 110), width=2)
        draw_particles(frame, local, 106, 130, COLORS["cyan"], (0, 120, W, H), (12, -62), (1, 4), 165)
        add_glow(frame, 1470, 205, 130, COLORS["gold"], .32)
    elif shot == "OP-07":
        frame = plate("orun", round(8*math.sin(local*.35)), round(10*ease(p)), .32*(1-.28*p))
        draw = ImageDraw.Draw(frame, "RGBA")
        draw.ellipse((1325, 48, 1665, 388), fill=(0, 0, 3, 245), outline=(*COLORS["gold"], 140), width=5)
        for index in range(44):
            x = (index*211+77) % W
            y = ((index*89 + local*(70+index%5*12)) % 970) - 90
            size = 8 + index % 18
            draw.polygon(((x, y), (x+size, y+5), (x+size//2, y+size)), fill=(30, 24, 20, 210))
        draw_particles(frame, local, 107, 120, (164, 116, 67), (0, 100, W, H), (-24, 42), (1, 5), 150)
    elif shot == "OP-08":
        frame = plate("veil", round(5*math.sin(local*.18)), 0, .7)
        draw_sunrise(frame, local, ease(p))
        composite_actor(frame, "aren-kneel", 270+12*ease(p), 325-round(7*math.sin(local*1.4)), local, sway=7, breathe=3)
        draw_particles(frame, local, 108, 120, (186, 157, 105), (0, 0, W, H), (8, 48), (1, 4), 150)
        add_glow(frame, 978, 785, 75, COLORS["gold"], .35+.35*ease(p))
    else:
        frame = Image.new("RGBA", (W, H), COLORS["black"]+(255,))
        draw = ImageDraw.Draw(frame, "RGBA")
        cx, cy = W//2, 450
        for index, radius in enumerate((146, 184, 225)):
            angle = local*(20+index*11) * (-1 if index % 2 else 1)
            draw.arc((cx-radius, cy-radius, cx+radius, cy+radius), angle, angle+245, fill=(*COLORS["gold"], 130-index*20), width=3)
        draw.ellipse((cx-126, cy-126, cx+126, cy+126), fill=(0,0,2,255), outline=(*COLORS["gold"], 205), width=4)
        draw_particles(frame, local, 109, 75, COLORS["gold"], (460, 120, 1460, 860), (9, -12), (1, 3), 165)
        title_font = ImageFont.truetype(r"C:\Windows\Fonts\palab.ttf", 72)
        story_font = ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", 27)
        title = "ECLIPSE OF THE VEILED KINGDOM"
        box = draw.textbbox((0,0), title, font=title_font)
        draw.text(((W-(box[2]-box[0]))/2, 735), title, font=title_font, fill=(*COLORS["bright"], round(255*ease(min(1,p*2)))))
        story = "STORY ONE"
        box = draw.textbbox((0,0), story, font=story_font)
        draw.text(((W-(box[2]-box[0]))/2, 835), story, font=story_font, fill=(177, 222, 238, round(230*ease(min(1,p*2)))))

    draw_film_finish(frame, t, 410)
    add_vignette(frame, 115)
    fade = min(1, t/.8, (72-t)/1.0)
    if fade < 1:
        frame.alpha_composite(Image.new("RGBA", (W,H), (0,0,0,round(255*(1-fade)))))
    return frame.convert("RGB"), shot


def draw_path(frame: Image.Image, t: float, progress: float) -> None:
    draw = ImageDraw.Draw(frame, "RGBA")
    points = [(525, 930), (690, 850), (865, 790), (1045, 745), (1220, 700), (1390, 662)]
    for index in range(len(points)-1):
        active = ease((progress*1.25 - index/(len(points)-1)) * 3)
        if active <= 0: continue
        a, b = points[index], points[index+1]
        end = (a[0]+(b[0]-a[0])*active, a[1]+(b[1]-a[1])*active)
        draw.line((a[0],a[1],end[0],end[1]), fill=(*COLORS["gold"], 210), width=6)
        add_glow(frame, end[0], end[1], 28, COLORS["gold"], .6)
    draw_particles(frame, t, 304, 70, (178, 136, 83), (350, 610, 1510, 1030), (-15, -28), (1, 3), 140)


def draw_film_finish(frame: Image.Image, t: float, seed: int) -> None:
    # Native-size deterministic fine grain and a slow exposure pulse.
    overlay = Image.new("RGBA", (W, H))
    draw = ImageDraw.Draw(overlay, "RGBA")
    for index in range(220):
        x = (index*613 + seed*31 + round(t*47)) % W
        y = (index*337 + seed*17 + round(t*23)) % H
        value = 170 if index % 2 else 18
        draw.point((x, y), fill=(value, value, value, 8))
    frame.alpha_composite(overlay)


def intro_frame(t: float) -> tuple[Image.Image, str]:
    cursor = 0.0
    shot, local, duration = INTRO_SHOTS[-1][0], 0.0, INTRO_SHOTS[-1][1]
    for candidate, length in INTRO_SHOTS:
        if t < cursor + length:
            shot, local, duration = candidate, t-cursor, length
            break
        cursor += length
    p = local/duration

    if shot == "C1-01":
        frame = plate("veil", round(3*math.sin(local*.2)), 0, .42)
        opacity = ease(min(1, p*1.7)) * (.76 + .14*math.sin(local*2.1))
        composite_actor(frame, "mira", 1120, 142, local, opacity=opacity, sway=5)
        add_glow(frame, 1288, 244, 125, COLORS["gold"], .45+.35*math.sin(local*1.8)**2)
        draw_particles(frame, local, 201, 95, COLORS["gold"], (1000, 100, 1650, 940), (3, -32), (1, 3), 155)
        draw = ImageDraw.Draw(frame, "RGBA")
        for index in range(5):
            x = 280+index*300 + 6*math.sin(local*.6+index)
            draw.line((x,0,x+16*math.sin(local*.45+index),250), fill=(68,75,91,100), width=3)
    elif shot == "C1-02":
        frame = plate("veil", round(-4+8*ease(p)), 0, .54)
        composite_actor(frame, "aren-stand", 250+25*ease(p), 165, local, sway=6)
        composite_actor(frame, "mira", 1115, 142, local+.3, opacity=.9, sway=5)
        add_glow(frame, 1288, 244, 145, COLORS["gold"], .72)
        add_glow(frame, 525, 595, 50, COLORS["cyan"], .25+.25*math.sin(local*2.2)**2)
        draw_particles(frame, local, 202, 80, COLORS["gold"], (200,100,1700,980), (-2,-22), (1,3), 130)
    elif shot == "C1-03":
        frame = Image.new("RGBA", (W,H), (4,7,15,255))
        # Original pixels at 1:1; the cutout is cropped by the frame, not enlarged.
        close = actor_motion(ASSETS["aren-kneel"], local, sway=3, breathe=1)
        frame.alpha_composite(close, (80, -165))
        draw = ImageDraw.Draw(frame, "RGBA")
        progress = ease(p)
        start, end = (1000, 435), (1375, 865)
        glow_end = (start[0]+(end[0]-start[0])*progress, start[1]+(end[1]-start[1])*progress)
        draw.line((start[0],start[1],glow_end[0],glow_end[1]), fill=(*COLORS["gold"],190), width=6)
        add_glow(frame, glow_end[0], glow_end[1], 46, COLORS["gold"], .65)
        draw_particles(frame, local, 203, 75, COLORS["cyan"], (760,300,1540,980), (20,-18), (1,3), 150)
    elif shot == "C1-04":
        frame = plate("veil", round(5*math.sin(local*.2)), 0, .5+.18*ease(p))
        draw_sunrise(frame, local, ease(p))
        composite_actor(frame, "aren-stand", 285-18*ease(p), 165, local, sway=7, breathe=2)
        draw_particles(frame, local, 204, 125, (202,174,118), (0,0,W,H), (9,45), (1,4), 155)
    elif shot == "C1-05":
        frame = plate("veil", round(-6*ease(p)), 0, .62)
        draw_path(frame, local, p)
        for index in range(7):
            add_glow(frame, 520+index*145, 910-index*43, 36, COLORS["gold"], .25+.35*ease(max(0,p-index*.08)))
        draw = ImageDraw.Draw(frame, "RGBA")
        cx, cy = 1390, 655
        radius = 54
        draw.arc((cx-radius,cy-radius,cx+radius,cy+radius), local*24, local*24+285, fill=(*COLORS["cyan"],205), width=4)
        draw.line((cx-radius*.7,cy,cx+radius*.7,cy), fill=(*COLORS["gold"],175), width=3)
    else:
        frame = plate("veil", round(-5+10*ease(p)), 0, .66)
        draw_path(frame, local, 1)
        composite_actor(frame, "aren-stand", 300+75*ease(p), 165, local, sway=7)
        mira_opacity = max(0, 1-p*1.35) * .75
        composite_actor(frame, "mira", 1220, 295, local, opacity=mira_opacity, sway=4)
        add_glow(frame, 1390, 655, 80, COLORS["gold"], .35+.25*math.sin(local*1.5)**2)
        add_glow(frame, 515, 596, 48, COLORS["cyan"], .3+.3*ease(p))
        draw_particles(frame, local, 206, 90, COLORS["gold"], (250,100,1680,1020), (4,-28), (1,3), 145)

    draw_fog(frame, local, warm=shot in {"C1-01","C1-02","C1-06"})
    draw_film_finish(frame, t, 520)
    add_vignette(frame, 120)
    fade = min(1, t/.6, (40-t)/.8)
    if fade < 1:
        frame.alpha_composite(Image.new("RGBA",(W,H),(0,0,0,round(255*(1-fade)))))
    return frame.convert("RGB"), shot


@lru_cache(maxsize=16)
def font(size: int, serif: bool = False, bold: bool = False) -> ImageFont.FreeTypeFont:
    if serif:
        name = "palab.ttf" if bold else "pala.ttf"
    else:
        name = "seguisb.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(str(Path(r"C:\Windows\Fonts") / name), size)


def centered_text(frame: Image.Image, text: str, y: int, size: int, color: tuple[int, int, int],
                  opacity: float = 1, *, serif: bool = False, bold: bool = False,
                  tracking: int = 0) -> None:
    draw = ImageDraw.Draw(frame, "RGBA")
    face = font(size, serif=serif, bold=bold)
    if tracking <= 0:
        box = draw.textbbox((0, 0), text, font=face)
        x = (W - (box[2] - box[0])) / 2
        draw.text((x, y), text, font=face, fill=(*color, round(255 * opacity)))
        return
    widths = [draw.textlength(character, font=face) for character in text]
    total = sum(widths) + tracking * max(0, len(text) - 1)
    x = (W - total) / 2
    for character, width in zip(text, widths):
        draw.text((x, y), character, font=face, fill=(*color, round(255 * opacity)))
        x += width + tracking


def shot_time(t: float, shots: tuple[tuple[str, int], ...]) -> tuple[str, float, float]:
    cursor = 0.0
    for shot, duration in shots:
        if t < cursor + duration:
            return shot, t - cursor, duration
        cursor += duration
    shot, duration = shots[-1]
    return shot, float(duration), float(duration)


def composite_fragmented_actor(frame: Image.Image, name: str, x: float, y: float, t: float,
                               coherence: float, *, strips: int = 10, opacity: float = 1) -> None:
    """Assemble a native-resolution actor from independently moving vertical shards."""
    actor = actor_motion(CHARACTERS[name], t, sway=4, breathe=2)
    coherence = ease(coherence)
    strip_width = math.ceil(actor.width / strips)
    for index in range(strips):
        left = index * strip_width
        right = min(actor.width, left + strip_width + 1)
        if left >= actor.width:
            continue
        shard = actor.crop((left, 0, right, actor.height))
        shard_alpha = shard.getchannel("A").point(lambda a: round(a * opacity * (.54 + .46 * coherence)))
        shard.putalpha(shard_alpha)
        spread = (1 - coherence) * (92 + 13 * (index % 4))
        offset_x = spread * math.sin(index * 2.1 + t * (1.1 + index * .025))
        offset_y = spread * .58 * math.cos(index * 1.37 - t * .83)
        frame.alpha_composite(shard, (round(x + left + offset_x), round(y + offset_y)))


def draw_crown_seal(frame: Image.Image, center: tuple[int, int], t: float, progress: float,
                    color: tuple[int, int, int] = COLORS["gold"]) -> None:
    draw = ImageDraw.Draw(frame, "RGBA")
    cx, cy = center
    progress = ease(progress)
    for index, radius in enumerate((46, 72, 101)):
        extent = max(4, 305 * progress - index * 16)
        start = t * (24 + index * 7) * (-1 if index % 2 else 1)
        draw.arc((cx-radius, cy-radius, cx+radius, cy+radius), start, start + extent,
                 fill=(*color, 195 - index * 26), width=4)
    for index in range(5):
        angle = -math.pi / 2 + index * math.tau / 5 + t * .035
        radius = 64
        px, py = cx + math.cos(angle) * radius, cy + math.sin(angle) * radius
        draw.line((cx, cy, px, py), fill=(*color, round(150 * progress)), width=2)
    add_glow(frame, cx, cy, 38, color, .45 * progress)


def draw_inner_gate(frame: Image.Image, t: float, openness: float) -> None:
    openness = ease(openness)
    cx, top, bottom = 960, 92, 1005
    half = 310 + 250 * openness
    light_half = 8 + 270 * openness
    aperture = Image.new("RGBA", (W, H))
    aperture_draw = ImageDraw.Draw(aperture, "RGBA")
    aperture_draw.polygon(((cx-light_half, top+34), (cx+light_half, top+34),
                           (cx+light_half*.68, bottom-25), (cx-light_half*.68, bottom-25)),
                          fill=(21, 102, 132, round(18 + 47 * openness)))
    for index in range(12):
        y = top + 88 + index * 69
        inset = index * 7
        shift = 12 * math.sin(t * .55 + index * .7)
        aperture_draw.line((cx-light_half+inset+shift, y, cx+light_half-inset+shift, y-14),
                           fill=(*COLORS["cyan"], round(10 + 34 * openness)), width=3)
    frame.alpha_composite(aperture.filter(ImageFilter.GaussianBlur(4)))

    draw = ImageDraw.Draw(frame, "RGBA")
    draw.rounded_rectangle((cx-half, top, cx+half, bottom), radius=220,
                           outline=(*COLORS["gold"], 170), width=8)
    # Distant nameless towers create depth beyond the moving aperture.
    for index in range(7):
        tower_x = cx-light_half*.52 + index * light_half*.17
        tower_w = 16 + (index % 3) * 8
        tower_top = 430 + (index*79 % 230)
        draw.polygon(((tower_x-tower_w, bottom-42), (tower_x-tower_w*.7, tower_top),
                      (tower_x, tower_top-45-(index%2)*38), (tower_x+tower_w*.7, tower_top),
                      (tower_x+tower_w, bottom-42)), fill=(2, 8, 16, 218))
        for light in range(3):
            window_y = tower_top + 38 + light*66
            draw.rectangle((tower_x-3, window_y, tower_x+3, window_y+11), fill=(*COLORS["gold"], 115))
    for side in (-1, 1):
        slab_x = cx + side * (25 + 245 * openness)
        draw.line((slab_x, top+55, slab_x-side*45, bottom-20), fill=(6, 9, 18, 245), width=90)
        draw.line((slab_x-side*46, top+55, slab_x-side*90, bottom-20),
                  fill=(*COLORS["gold"], 105), width=5)
    for index in range(9):
        y = 160 + index * 91 + 9 * math.sin(t * .7 + index)
        draw.line((cx-light_half*.7, y, cx+light_half*.7, y-18),
                  fill=(*COLORS["cyan"], round(30 + 100 * openness)), width=2)
    add_glow(frame, cx, 545, 135, COLORS["cyan"], .22 + .35 * openness)


def draw_ten_path_map(frame: Image.Image, t: float, progress: float) -> None:
    draw = ImageDraw.Draw(frame, "RGBA")
    cx, cy = 960, 545
    draw.ellipse((cx-390, cy-390, cx+390, cy+390), fill=(3, 7, 14, 218),
                 outline=(*COLORS["gold"], 110), width=4)
    for index in range(10):
        angle = -math.pi/2 + index * math.tau/10 + .025 * math.sin(t*.25)
        inner = 112
        outer = 315
        reveal = ease((progress * 1.5 - index * .045) / .7)
        x1, y1 = cx + math.cos(angle)*inner, cy + math.sin(angle)*inner
        x2, y2 = cx + math.cos(angle)*(inner+(outer-inner)*reveal), cy + math.sin(angle)*(inner+(outer-inner)*reveal)
        route_color = COLORS["gold"] if index < 2 else COLORS["cyan"]
        route_alpha = 225 if index < 2 else 72
        draw.line((x1, y1, x2, y2), fill=(*route_color, round(route_alpha * reveal)), width=6 if index < 2 else 3)
        draw_crown_seal(frame, (round(x2), round(y2)), t + index*.19, reveal, route_color)
    draw_crown_seal(frame, (cx, cy), t, progress, COLORS["gold"])


def draw_scales(frame: Image.Image, t: float, progress: float) -> None:
    draw = ImageDraw.Draw(frame, "RGBA")
    cx, cy = 960, 334
    tilt = (1-progress) * 12 * math.sin(t * 1.5)
    draw.line((cx, cy-155, cx, cy+215), fill=(*COLORS["gold"], 210), width=8)
    draw.line((cx-285, cy+tilt, cx+285, cy-tilt), fill=(*COLORS["gold"], 210), width=7)
    for side in (-1, 1):
        pan_x = cx + side * 275
        pan_y = cy - side * tilt + 165
        draw.line((pan_x, cy-side*tilt, pan_x-side*52, pan_y-5), fill=(*COLORS["gold"], 145), width=3)
        draw.line((pan_x, cy-side*tilt, pan_x+side*52, pan_y-5), fill=(*COLORS["gold"], 145), width=3)
        draw.arc((pan_x-100, pan_y-25, pan_x+100, pan_y+65), 0, 180, fill=(*COLORS["gold"], 210), width=5)
    add_glow(frame, cx, cy+215, 58, COLORS["gold"], .35 + .25 * progress)


def draw_aqueduct(frame: Image.Image, t: float, progress: float) -> None:
    draw = ImageDraw.Draw(frame, "RGBA")
    horizon = 405
    draw.rectangle((0, horizon, W, H), fill=(3, 12, 21, 105))
    for tier in range(3):
        y = horizon + tier * 172
        scale = 1 + tier * .18
        spacing = round(265 * scale)
        offset = round((t * (5 + tier * 2)) % spacing)
        for x in range(-spacing, W+spacing, spacing):
            left = x - offset
            width = round(165 * scale)
            height = round(235 * scale)
            draw.rectangle((left-27, y, left+width+27, min(H, y+height)), fill=(7, 13, 20, 238))
            draw.ellipse((left, y+45, left+width, y+45+height), fill=(16, 36, 48, 225),
                         outline=(*COLORS["cyan"], 52), width=3)
    water_y = 812 - 35 * ease(progress)
    for index in range(17):
        y = water_y + index * 12
        shift = 33 * math.sin(t * (1.35 + index*.025) + index*.67)
        draw.line((-40+shift, y, W+40+shift, y), fill=(55, 173, 207, 26 + index*3), width=4)
    add_glow(frame, 960, water_y, 145, COLORS["cyan"], .25 + .3*progress)


def bridge10_frame(t: float) -> tuple[Image.Image, str]:
    shot, local, duration = shot_time(t, BRIDGE_10_SHOTS)
    p = local / duration

    if shot == "B10-01":
        frame = plate("engine", round(8*math.sin(local*.24)), 18, .42+.13*ease(p))
        draw_engine(frame, local*.55, inverse=.12*(1-ease(p)), center=(1220, 410))
        composite_actor(frame, "aren-small", 535+18*ease(p), 648, local, sway=4)
        composite_actor(frame, "warden-restored", 1035, 466-13*ease(p), local, opacity=.58+.42*ease(p), sway=2, breathe=1)
        add_glow(frame, 1215, 674, 72, COLORS["gold"], .2+.55*ease(p))
        draw_particles(frame, local, 710, 130, (173,132,82), (130,170,1780,1040), (-12,-46), (1,5), 175)
    elif shot == "B10-02":
        frame = plate("engine", round(-8+16*ease(p)), 5, .37)
        composite_actor(frame, "warden-restored", 775+10*math.sin(local*.28), 266, local, sway=2, breathe=1)
        composite_actor(frame, "aren-small", 420, 655, local+.3, opacity=.78, sway=3)
        draw_crown_seal(frame, (954, 506), local, .75+.25*math.sin(local*.7)**2)
        for index in range(8):
            y = 315+index*59
            reach = ease((p-index*.035)/.55)
            ImageDraw.Draw(frame,"RGBA").line((1170,y,1170+reach*410,y-55), fill=(*COLORS["gold"], round(105*reach)), width=2)
        draw_particles(frame, local, 711, 86, COLORS["gold"], (320,130,1590,980), (5,-22), (1,3), 145)
    elif shot == "B10-03":
        frame = plate("veil", round(10*math.sin(local*.18)), 0, .29+.08*ease(p))
        coherence = min(1, p*1.23)
        composite_fragmented_actor(frame, "heir", 710, 132, local, coherence, strips=10, opacity=.82)
        draw = ImageDraw.Draw(frame, "RGBA")
        veil_y = 273 + 7*math.sin(local*.9)
        draw.rectangle((690, veil_y, 1260, veil_y+92), fill=(1,5,13,218))
        draw.line((690,veil_y+45,1260,veil_y+45), fill=(*COLORS["cyan"], 110), width=3)
        orbit_points = []
        for index in range(10):
            angle = index*math.tau/10 + local*.08
            radius = 300-125*coherence
            x, y = 960+math.cos(angle)*radius, 520+math.sin(angle)*radius
            orbit_points.append((x, y))
            shard_color = COLORS["cyan"] if index > 1 else COLORS["gold"]
            draw.ellipse((x-7, y-7, x+7, y+7), fill=(*shard_color, 220), outline=(*COLORS["bright"], 130), width=2)
            add_glow(frame, x, y, 24, shard_color, .3+.3*coherence)
        draw.line(orbit_points + [orbit_points[0]], fill=(*COLORS["cyan"], 58), width=2)
        draw_particles(frame, local, 712, 150, COLORS["cyan"], (260,70,1660,1000), (13,-34), (1,4), 175)
    elif shot == "B10-04":
        frame = plate("engine", round(5*math.sin(local*.18)), 35, .36)
        draw_map_table(frame, local*.9)
        draw_crown_seal(frame, (735, 725), local, min(1,p*1.7), COLORS["gold"])
        draw_crown_seal(frame, (1178, 725), -local, min(1,max(0,p-.18)*1.7), COLORS["cyan"])
        draw = ImageDraw.Draw(frame,"RGBA")
        pulse = .55+.45*math.sin(local*1.6)**2
        draw.line((805,725,1108,725), fill=(*COLORS["bright"], round(190*pulse)), width=5)
        draw.line((956,725,956,855), fill=(*COLORS["gold"], round(145*ease(p))), width=3)
        draw_particles(frame, local, 713, 75, COLORS["gold"], (400,470,1510,980), (1,-24), (1,3), 150)
    elif shot == "B10-05":
        frame = plate("veil", round(-5+10*ease(p)), 0, .28+.19*ease(p))
        draw_inner_gate(frame, local, p)
        draw_particles(frame, local, 714, 150, COLORS["cyan"], (320,70,1600,1030), (7,-52), (1,4), 165)
        draw_fog(frame, local)
    elif shot == "B10-06":
        frame = plate("veil", round(-16*ease(p)), 0, .24+.12*ease(p))
        draw_inner_gate(frame, local, 1)
        composite_actor(frame, "aren-small", 675+105*ease(p), 654-22*ease(p), local, sway=4)
        composite_actor(frame, "warden-restored", 1060+18*ease(p), 470, local+.4, opacity=.82, sway=2, breathe=1)
        draw_particles(frame, local, 715, 115, COLORS["cyan"], (300,100,1650,1040), (10,-36), (1,4), 150)
    else:
        frame = Image.new("RGBA", (W,H), COLORS["black"]+(255,))
        draw_crown_seal(frame, (960,370), local, 1, COLORS["cyan"])
        opacity = ease(min(1,p*2)) * ease(min(1,(1-p)*4))
        centered_text(frame, "THE FIRST CROWN PATH IS RESTORED", 620, 32, COLORS["gold"], opacity, bold=True, tracking=3)
        centered_text(frame, "CHAPTER II", 706, 82, COLORS["bright"], opacity, serif=True, bold=True)
        centered_text(frame, "THE INNER KINGDOM", 818, 41, COLORS["cyan"], opacity, bold=True, tracking=5)
        draw_particles(frame, local, 716, 100, COLORS["cyan"], (400,100,1520,960), (5,-20), (1,3), 155)

    draw_film_finish(frame, t, 710)
    add_vignette(frame, 122)
    fade = min(1, t/.65, (52-t)/.85)
    if fade < 1:
        frame.alpha_composite(Image.new("RGBA", (W,H), (0,0,0,round(255*(1-fade)))))
    return frame.convert("RGB"), shot


def bridge20_frame(t: float) -> tuple[Image.Image, str]:
    shot, local, duration = shot_time(t, BRIDGE_20_SHOTS)
    p = local / duration

    if shot == "B20-01":
        frame = plate("engine", round(6*math.sin(local*.2)), 45, .31+.09*ease(p))
        draw_scales(frame, local, p)
        draw = ImageDraw.Draw(frame, "RGBA")
        for index in range(18):
            x = 250 + (index*197) % 1420
            y = 830 + 38*math.sin(local*.7+index)
            glyph = chr(ord("A") + index%13)
            draw.text((x,y), glyph, font=font(32, serif=True), fill=(*COLORS["cyan"], 38+index%4*18))
        draw_particles(frame, local, 820, 88, COLORS["gold"], (210,110,1710,1000), (-3,-23), (1,3), 135)
    elif shot == "B20-02":
        frame = plate("veil", round(7*math.sin(local*.17)), 0, .27+.16*ease(p))
        coherence = min(1, p*1.18)
        composite_fragmented_actor(frame, "liora-light", 720, 95, local, coherence, strips=12)
        for index in range(10):
            angle = index*math.tau/10-local*.07
            radius = 345-185*ease(coherence)
            x, y = 960+math.cos(angle)*radius, 515+math.sin(angle)*radius
            add_glow(frame, x, y, 27, COLORS["cyan"] if index>1 else COLORS["gold"], .35+.35*coherence)
        draw_particles(frame, local, 821, 175, COLORS["cyan"], (220,40,1690,1030), (16,-42), (1,5), 185)
    elif shot == "B20-03":
        frame = plate("veil", round(-7+14*ease(p)), 0, .39+.08*ease(p))
        composite_actor(frame, "liora-light", 835+8*math.sin(local*.25), 92, local, sway=4, breathe=2)
        composite_actor(frame, "aren-small", 470+32*ease(p), 651, local+.4, sway=4)
        draw_crown_seal(frame, (1080, 405), local, .7+.3*math.sin(local*.75)**2, COLORS["cyan"])
        draw_particles(frame, local, 822, 118, COLORS["gold"], (250,80,1660,1030), (5,-31), (1,4), 155)
        draw_fog(frame, local, warm=True)
    elif shot == "B20-04":
        frame = plate("engine", round(5*math.sin(local*.18)), 35, .28)
        draw_ten_path_map(frame, local, p)
        draw_particles(frame, local, 823, 90, COLORS["cyan"], (330,90,1600,1030), (3,-27), (1,3), 140)
    elif shot == "B20-05":
        frame = plate("veil", round(6*math.sin(local*.22)), 0, .33)
        composite_actor(frame, "liora-light", 870, 104, local, sway=3, breathe=2)
        composite_actor(frame, "aren-small", 488+17*ease(p), 646, local+.2, sway=4)
        shadow = Image.new("RGBA", (W,H))
        d = ImageDraw.Draw(shadow,"RGBA")
        width = 110+210*ease(p)
        d.polygon(((575,945),(1190,930),(960-width,1080),(960+width,1080)), fill=(0,0,4,155))
        frame.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(20)))
        draw = ImageDraw.Draw(frame,"RGBA")
        for index in range(10):
            x = 685+index*55
            progress = ease((p-index*.035)/.7)
            draw.line((x,870,x+(960-x)*progress,1030), fill=(*COLORS["gold"],round(95*progress)),width=3)
        draw_particles(frame, local, 824, 105, COLORS["cyan"], (250,80,1680,1030), (-2,-28), (1,4), 145)
    elif shot == "B20-06":
        frame = plate("engine", round(-10+20*ease(p)), 0, .31)
        draw_engine(frame, local*.72, inverse=.55+.2*math.sin(local*.55)**2, center=(1240,365))
        composite_actor(frame, "serath-open", 500-28*ease(p), 190, local, sway=4, breathe=1)
        draw = ImageDraw.Draw(frame,"RGBA")
        for index in range(12):
            angle = index*math.tau/12-local*.15
            x, y = 1240+math.cos(angle)*240, 365+math.sin(angle)*240
            draw.line((1240,365,x,y), fill=(*COLORS["vermilion"],55+index%3*18),width=2)
        draw_particles(frame, local, 825, 115, COLORS["vermilion"], (260,60,1720,1020), (12,32), (1,4), 170)
    elif shot == "B20-07":
        frame = plate("orun", round(-13*ease(p)), round(7*math.sin(local*.18)), .24+.12*ease(p))
        draw_aqueduct(frame, local, p)
        draw_particles(frame, local, 826, 135, COLORS["cyan"], (0,170,W,H), (22,-18), (1,4), 160)
        draw_fog(frame, local)
    else:
        frame = Image.new("RGBA", (W,H), COLORS["black"]+(255,))
        opacity = ease(min(1,p*2.4)) * ease(min(1,(1-p)*5))
        draw_crown_seal(frame, (960,275), local, 1, COLORS["gold"])
        centered_text(frame, "CHAPTER II COMPLETE", 470, 31, COLORS["gold"], opacity, bold=True, tracking=3)
        centered_text(frame, "THE SECOND CROWN PATH IS OPEN", 550, 31, COLORS["bright"], opacity, bold=True, tracking=2)
        centered_text(frame, "CHAPTER III — THE SUNDERED AQUEDUCT", 665, 52, COLORS["cyan"], opacity, serif=True, bold=True)
        centered_text(frame, "COMING SOON", 765, 30, COLORS["gold"], opacity, bold=True, tracking=7)
        draw_particles(frame, local, 827, 110, COLORS["cyan"], (350,70,1570,990), (6,-22), (1,3), 150)

    draw_film_finish(frame, t, 820)
    add_vignette(frame, 125)
    fade = min(1, t/.65, (64-t)/.9)
    if fade < 1:
        frame.alpha_composite(Image.new("RGBA", (W,H), (0,0,0,round(255*(1-fade)))))
    return frame.convert("RGB"), shot


def render_raw(frame_function, duration: float, silent_output: Path, *, shot_only: str | None = None) -> None:
    command = [ffmpeg_path(), "-hide_banner", "-loglevel", "warning", "-y",
               "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
               "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
               "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
               "-movflags", "+faststart", str(silent_output)]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    assert process.stdin is not None
    try:
        if shot_only:
            if shot_only.startswith("OP-"):
                shots = OPENING_SHOTS
            elif shot_only.startswith("C1-"):
                shots = INTRO_SHOTS
            elif shot_only.startswith("B10-"):
                shots = BRIDGE_10_SHOTS
            elif shot_only.startswith("B20-"):
                shots = BRIDGE_20_SHOTS
            else:
                raise ValueError(f"Unknown shot family {shot_only}")
            offset = 0.0
            length = 0.0
            for shot, shot_length in shots:
                if shot == shot_only:
                    length = shot_length
                    break
                offset += shot_length
            if not length:
                raise ValueError(f"Unknown shot {shot_only}")
            frame_count = round(length * FPS)
            for index in range(frame_count):
                frame, _ = frame_function(offset + index/FPS)
                process.stdin.write(frame.tobytes())
        else:
            frame_count = round(duration * FPS)
            for index in range(frame_count):
                frame, _ = frame_function(index/FPS)
                process.stdin.write(frame.tobytes())
                if index and index % (FPS*10) == 0:
                    print(f"rendered {index/FPS:.0f}/{duration:.0f} seconds", flush=True)
    finally:
        process.stdin.close()
    code = process.wait()
    if code:
        raise RuntimeError(f"FFmpeg video encode failed with exit code {code}")


def mux(silent_video: Path, audio: Path, output: Path) -> None:
    command = [ffmpeg_path(), "-hide_banner", "-loglevel", "warning", "-y", "-i", str(silent_video), "-i", str(audio),
               "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,volume=-1.4dB",
               "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2", "-shortest", "-movflags", "+faststart", str(output)]
    subprocess.run(command, check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--movie", choices=("opening", "intro", "bridge10", "bridge20", "bridges", "both", "all"), default="both")
    parser.add_argument("--preview-shot")
    args = parser.parse_args()
    RENDERS.mkdir(parents=True, exist_ok=True)
    if args.preview_shot:
        if args.preview_shot.startswith("OP-"):
            fn = opening_frame
        elif args.preview_shot.startswith("C1-"):
            fn = intro_frame
        elif args.preview_shot.startswith("B10-"):
            fn = bridge10_frame
        elif args.preview_shot.startswith("B20-"):
            fn = bridge20_frame
        else:
            raise ValueError(f"Unknown shot family {args.preview_shot}")
        target = ROOT / "review" / f"{args.preview_shot.lower()}-motion-proof.mp4"
        target.parent.mkdir(parents=True, exist_ok=True)
        render_raw(fn, 0, target, shot_only=args.preview_shot)
        print(target)
        return

    jobs = []
    if args.movie in {"opening", "both", "all"}:
        jobs.append(("opening-prologue-v1", opening_frame, 72.0, AUDIO / "opening-prologue-master.wav"))
    if args.movie in {"intro", "both", "all"}:
        jobs.append(("chapter-one-introduction-v1", intro_frame, 40.0, AUDIO / "chapter-one-introduction-master.wav"))
    if args.movie in {"bridge10", "bridges", "all"}:
        jobs.append(("chapter-one-to-two-bridge-v1", bridge10_frame, 52.0, AUDIO / "chapter-one-to-two-bridge-master.wav"))
    if args.movie in {"bridge20", "bridges", "all"}:
        jobs.append(("chapter-two-to-three-bridge-v1", bridge20_frame, 64.0, AUDIO / "chapter-two-to-three-bridge-master.wav"))
    for stem, fn, duration, audio in jobs:
        silent = RENDERS / f"{stem}-silent.mp4"
        output = RENDERS / f"{stem}.mp4"
        render_raw(fn, duration, silent)
        mux(silent, audio, output)
        print(output)


if __name__ == "__main__":
    main()

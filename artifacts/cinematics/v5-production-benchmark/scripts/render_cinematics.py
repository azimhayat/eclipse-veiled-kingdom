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
WINDOWS_FFMPEG = Path(r"C:\Users\azimh\AppData\Local\CodexMediaTools\ffmpeg-static-5.2.0\node_modules\ffmpeg-static\ffmpeg.exe")

OPENING_SHOTS = (("OP-01", 7), ("OP-02", 8), ("OP-03", 8), ("OP-04", 8),
                 ("OP-05", 9), ("OP-06", 9), ("OP-07", 8), ("OP-08", 9), ("OP-09", 6))
INTRO_SHOTS = (("C1-01", 6), ("C1-02", 7), ("C1-03", 7), ("C1-04", 7), ("C1-05", 7), ("C1-06", 6))

COLORS = {
    "navy": (4, 8, 18), "gold": (232, 197, 106), "bright": (255, 231, 155),
    "cyan": (79, 213, 244), "vermilion": (194, 65, 52), "black": (1, 2, 6),
}


def ffmpeg_path() -> str:
    if WINDOWS_FFMPEG.exists():
        return str(WINDOWS_FFMPEG)
    found = shutil.which("ffmpeg")
    if not found:
        raise FileNotFoundError("FFmpeg is required for cinematic rendering")
    return found


def ease(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


def load_assets() -> dict[str, Image.Image]:
    files = {
        "orun": "orun-skyline-master.png", "engine": "engine-chamber-master.png",
        "veil": "outer-veil-master.png", "aren-kneel": "aren-awakening.png",
        "aren-stand": "aren-standing.png", "serath-open": "serath-command.png",
        "serath-fist": "serath-fist.png", "mira": "mira-lamp.png",
        "heir": "unnamed-heir.png",
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
            shots = OPENING_SHOTS if shot_only.startswith("OP-") else INTRO_SHOTS
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
    parser.add_argument("--movie", choices=("opening", "intro", "both"), default="both")
    parser.add_argument("--preview-shot")
    args = parser.parse_args()
    RENDERS.mkdir(parents=True, exist_ok=True)
    if args.preview_shot:
        fn = opening_frame if args.preview_shot.startswith("OP-") else intro_frame
        target = ROOT / "review" / f"{args.preview_shot.lower()}-motion-proof.mp4"
        target.parent.mkdir(parents=True, exist_ok=True)
        render_raw(fn, 0, target, shot_only=args.preview_shot)
        print(target)
        return

    jobs = []
    if args.movie in {"opening", "both"}:
        jobs.append(("opening-prologue-v1", opening_frame, 72.0, AUDIO / "opening-prologue-master.wav"))
    if args.movie in {"intro", "both"}:
        jobs.append(("chapter-one-introduction-v1", intro_frame, 40.0, AUDIO / "chapter-one-introduction-master.wav"))
    for stem, fn, duration, audio in jobs:
        silent = RENDERS / f"{stem}-silent.mp4"
        output = RENDERS / f"{stem}.mp4"
        render_raw(fn, duration, silent)
        mux(silent, audio, output)
        print(output)


if __name__ == "__main__":
    main()

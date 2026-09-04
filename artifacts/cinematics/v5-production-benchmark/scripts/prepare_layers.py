"""Prepare approved cinematic character layers without enlarging them.

The built-in image generator sometimes returns a baked neutral checkerboard
despite a transparency request. This script removes only edge-connected,
low-chroma bright pixels. It never resizes source artwork.

The V5 bridge additions also crop two already approved local sources: the
accepted Warden restoration cell and Liora's accepted living-light concept.
The Liora crop receives a soft luminance/chroma matte because the source is a
living-light presentation on a neutral black review ground. No pixels are
painted, synthesized, downloaded or enlarged.
"""

from __future__ import annotations

from collections import deque
from pathlib import Path
import shutil

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
LAYERS = ROOT / "layers"
REPO = ROOT.parents[2]
CONCEPTS = REPO / "artifacts" / "character-design" / "v5-core-cast-concepts" / "sheets"
PUBLIC_ASSETS = REPO / "public" / "assets"

JOBS = (
    ("aren-awakening-source.png", "aren-awakening.png"),
    ("aren-standing-source.png", "aren-standing.png"),
    ("serath-fist-source.png", "serath-fist.png"),
    ("unnamed-heir-source.png", "unnamed-heir.png"),
)


def is_checker_pixel(pixel: tuple[int, int, int]) -> bool:
    red, green, blue = pixel
    return max(pixel) - min(pixel) <= 22 and (red + green + blue) / 3 >= 178


def edge_connected_checker(rgb: Image.Image) -> Image.Image:
    width, height = rgb.size
    pixels = rgb.load()
    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if visited[index] or not is_checker_pixel(pixels[x, y]):
            return
        visited[index] = 1
        queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        if x > 0:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y > 0:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    alpha = Image.new("L", (width, height), 255)
    alpha_pixels = alpha.load()
    for y in range(height):
        row = y * width
        for x in range(width):
            if visited[row + x]:
                alpha_pixels[x, y] = 0

    # A one-pixel soft boundary removes hard checkerboard stairsteps while
    # retaining fine cloth and weapon detail.
    return alpha.filter(ImageFilter.GaussianBlur(radius=0.65))


def living_light_alpha(rgb: Image.Image) -> Image.Image:
    """Key a cyan/gold living-light figure from its dark concept-sheet ground."""
    width, height = rgb.size
    source = rgb.load()
    alpha = Image.new("L", (width, height), 0)
    target = alpha.load()
    feather = 24
    for y in range(height):
        for x in range(width):
            red, green, blue = source[x, y]
            luma = .2126 * red + .7152 * green + .0722 * blue
            chroma = max(red, green, blue) - min(red, green, blue)
            signal = luma + chroma * .58
            value = max(0, min(255, round((signal - 17) * 5.4)))
            edge = min(1, x / feather, (width - 1 - x) / feather,
                       y / feather, (height - 1 - y) / feather)
            target[x, y] = round(value * max(0, edge))
    return alpha.filter(ImageFilter.GaussianBlur(radius=0.75))


def prepare_bridge_layers() -> None:
    with Image.open(PUBLIC_ASSETS / "warden-of-dust-combat-v1.png") as source:
        # Accepted 4x2 grid, restoration is column four / row two.
        restored = source.convert("RGBA").crop((1152, 512, 1536, 1024))
        restored.save(LAYERS / "warden-restored.png", optimize=True)
        print("warden-of-dust-combat-v1.png cell 8 -> warden-restored.png: 384x512 (no resize)")

    with Image.open(CONCEPTS / "02-liora-concept.png") as source:
        # Accepted living-light figure at the right of the direction-setting
        # sheet; the crop excludes the adjacent back view.
        crop = source.convert("RGB").crop((1160, 30, 1672, 920))
        result = crop.convert("RGBA")
        result.putalpha(living_light_alpha(crop))
        layer_path = LAYERS / "liora-living-light.png"
        result.save(layer_path, optimize=True)
        shutil.copyfile(layer_path, PUBLIC_ASSETS / "liora-memory-fragment-v1.png")
        print("02-liora-concept.png living-light crop -> liora-living-light.png: 512x890 (no resize)")
        print("liora-living-light.png -> public/assets/liora-memory-fragment-v1.png (byte-identical optimized copy)")


def main() -> None:
    for source_name, output_name in JOBS:
        source_path = LAYERS / source_name
        output_path = LAYERS / output_name
        with Image.open(source_path) as source:
            rgb = source.convert("RGB")
            alpha = edge_connected_checker(rgb)
            output = rgb.convert("RGBA")
            output.putalpha(alpha)
            output.save(output_path, optimize=True)
            print(f"{source_name} -> {output_name}: {source.size[0]}x{source.size[1]} (no resize)")
    prepare_bridge_layers()


if __name__ == "__main__":
    main()

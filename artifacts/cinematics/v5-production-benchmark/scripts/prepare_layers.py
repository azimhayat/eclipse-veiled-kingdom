"""Prepare generated cinematic character layers without enlarging them.

The built-in image generator sometimes returns a baked neutral checkerboard
despite a transparency request. This script removes only edge-connected,
low-chroma bright pixels. It never resizes source artwork.
"""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
LAYERS = ROOT / "layers"

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


if __name__ == "__main__":
    main()

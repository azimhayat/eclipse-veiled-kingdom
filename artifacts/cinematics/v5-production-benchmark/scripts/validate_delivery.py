"""Build review contact sheets and validate the locked WebVTT tracks."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / "review"

MOVIES = {
    "opening": {
        "duration": 72.0,
        "frames": 9,
        "vtt": ROOT / "opening-prologue-v1.en.vtt",
        "expected_cues": 8,
        "contact": REVIEW / "opening-prologue-contact-sheet.png",
    },
    "chapter-one": {
        "duration": 40.0,
        "frames": 6,
        "vtt": ROOT / "chapter-one-introduction-v1.en.vtt",
        "expected_cues": 6,
        "contact": REVIEW / "chapter-one-introduction-contact-sheet.png",
    },
}


def timestamp_seconds(value: str) -> float:
    hours, minutes, seconds = value.split(":")
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def validate_vtt(path: Path, duration: float, expected_cues: int) -> dict:
    text = path.read_text(encoding="utf-8-sig")
    if not text.startswith("WEBVTT"):
        raise ValueError(f"{path.name}: missing WEBVTT header")
    pattern = re.compile(
        r"(?m)^(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})\n([^\n]+(?:\n(?!\n)[^\n]+)*)"
    )
    cues = []
    previous_end = 0.0
    for start_text, end_text, payload in pattern.findall(text):
        start = timestamp_seconds(start_text)
        end = timestamp_seconds(end_text)
        words = len(re.findall(r"\b[\w'-]+\b", payload))
        if start < previous_end or not start < end or end > duration:
            raise ValueError(f"{path.name}: invalid timing {start_text} --> {end_text}")
        cue_duration = end - start
        reading_speed = words / cue_duration
        if payload.count("\n") + 1 > 2 or reading_speed > 3.5:
            raise ValueError(f"{path.name}: readability limit exceeded at {start_text}")
        cues.append(
            {
                "start": start,
                "end": end,
                "lines": payload.count("\n") + 1,
                "words_per_second": round(reading_speed, 2),
            }
        )
        previous_end = end
    if len(cues) != expected_cues:
        raise ValueError(f"{path.name}: expected {expected_cues} cues, found {len(cues)}")
    return {
        "file": path.name,
        "cues": len(cues),
        "last_cue_end_seconds": cues[-1]["end"],
        "max_words_per_second": max(cue["words_per_second"] for cue in cues),
        "max_lines": max(cue["lines"] for cue in cues),
        "status": "PASS",
    }


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for name in ("C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf"):
        if Path(name).exists():
            return ImageFont.truetype(name, size)
    return ImageFont.load_default()


def contact_sheet(prefix: str, frame_count: int, target: Path) -> None:
    columns = 3
    rows = (frame_count + columns - 1) // columns
    cell_w, cell_h = 640, 360
    sheet = Image.new("RGB", (columns * cell_w, rows * cell_h), "black")
    draw = ImageDraw.Draw(sheet)
    label_font = font(24)
    for index in range(1, frame_count + 1):
        source = REVIEW / f"{prefix}-shot-{index:02d}.png"
        frame = Image.open(source).convert("RGB").resize((cell_w, cell_h), Image.Resampling.LANCZOS)
        x = ((index - 1) % columns) * cell_w
        y = ((index - 1) // columns) * cell_h
        sheet.paste(frame, (x, y))
        draw.rounded_rectangle((x + 12, y + 12, x + 122, y + 48), radius=6, fill=(3, 7, 14, 220))
        draw.text((x + 24, y + 17), f"SHOT {index:02d}", font=label_font, fill=(237, 200, 115))
    sheet.save(target, optimize=True)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    results = {"subtitles": {}, "files": {}}
    for prefix, spec in MOVIES.items():
        contact_sheet(prefix, spec["frames"], spec["contact"])
        results["subtitles"][prefix] = validate_vtt(
            spec["vtt"], spec["duration"], spec["expected_cues"]
        )
        results["files"][spec["contact"].name] = {
            "bytes": spec["contact"].stat().st_size,
            "sha256": sha256(spec["contact"]),
        }
    output = REVIEW / "validation-summary.json"
    output.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()

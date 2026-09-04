"""Create the story-preserving V5 pace cut from the reviewed V1 masters.

The picture, authored score, ambience, effects and caption copy remain intact.
Only editorial pace changes: every stream is retimed by the same ratio, so
picture, sound and subtitles cannot drift. The mild audio finishing stage adds
presence after the long holds are removed without introducing external media.
"""

from __future__ import annotations

import argparse
import math
import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
PUBLIC = ROOT / "public" / "assets" / "cinematics"
BUNDLED_FFMPEG = (
    Path.home()
    / "AppData"
    / "Local"
    / "CodexMediaTools"
    / "ffmpeg-static-5.2.0"
    / "node_modules"
    / "ffmpeg-static"
    / "ffmpeg.exe"
)
TIMESTAMP = re.compile(r"(?P<h>\d{2}):(?P<m>\d{2}):(?P<s>\d{2})\.(?P<ms>\d{3})")


@dataclass(frozen=True)
class Recut:
    stem: str
    source_seconds: float
    target_seconds: float

    @property
    def ratio(self) -> float:
        return self.source_seconds / self.target_seconds


RECUTS = (
    Recut("opening-prologue", 72.0, 34.0),
    Recut("chapter-one-introduction", 40.0, 20.0),
    Recut("chapter-one-to-two-bridge", 52.0, 23.0),
    Recut("chapter-two-to-three-bridge", 64.0, 29.0),
)


def ffmpeg_path() -> str:
    installed = shutil.which("ffmpeg")
    if installed:
        return installed
    if BUNDLED_FFMPEG.exists():
        return str(BUNDLED_FFMPEG)
    raise FileNotFoundError("FFmpeg is required for the pace cut")


def format_timestamp(seconds: float) -> str:
    milliseconds = max(0, round(seconds * 1000))
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    whole_seconds, millis = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{whole_seconds:02d}.{millis:03d}"


def retime_timestamp(match: re.Match[str], ratio: float) -> str:
    seconds = (
        int(match.group("h")) * 3600
        + int(match.group("m")) * 60
        + int(match.group("s"))
        + int(match.group("ms")) / 1000
    )
    return format_timestamp(seconds / ratio)


def retime_captions(source: Path, target: Path, ratio: float) -> None:
    text = source.read_text(encoding="utf-8-sig")
    retimed = TIMESTAMP.sub(lambda match: retime_timestamp(match, ratio), text)
    target.write_text(retimed, encoding="utf-8", newline="\n")


def render_recut(recut: Recut) -> None:
    source = PUBLIC / f"{recut.stem}-v1.mp4"
    output = PUBLIC / f"{recut.stem}-v2.mp4"
    captions = PUBLIC / f"{recut.stem}-v1.en.vtt"
    caption_output = PUBLIC / f"{recut.stem}-v2.en.vtt"
    if not source.exists() or not captions.exists():
        raise FileNotFoundError(f"Missing reviewed V1 master for {recut.stem}")

    tempo = math.sqrt(recut.ratio)
    command = [
        ffmpeg_path(), "-hide_banner", "-loglevel", "warning", "-y",
        "-i", str(source),
        "-filter_complex",
        (
            f"[0:v]setpts=PTS/{recut.ratio:.9f},fps=30[v];"
            f"[0:a]atempo={tempo:.9f},atempo={tempo:.9f},"
            "highpass=f=32,lowpass=f=15500,"
            "equalizer=f=110:t=q:w=1.1:g=1.2,"
            "equalizer=f=3200:t=q:w=1.0:g=0.8,"
            "loudnorm=I=-16:TP=-2:LRA=10[a]"
        ),
        "-map", "[v]", "-map", "[a]", "-t", f"{recut.target_seconds:.3f}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
        "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
        "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart", str(output),
    ]
    subprocess.run(command, check=True)
    retime_captions(captions, caption_output, recut.ratio)
    print(f"{recut.stem}: {recut.source_seconds:.0f}s -> {recut.target_seconds:.0f}s ({recut.ratio:.3f}x)")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--movie", choices=("all", *(recut.stem for recut in RECUTS)), default="all")
    args = parser.parse_args()
    selected = RECUTS if args.movie == "all" else tuple(recut for recut in RECUTS if recut.stem == args.movie)
    for recut in selected:
        render_recut(recut)


if __name__ == "__main__":
    main()

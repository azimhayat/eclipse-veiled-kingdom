"""Generate original deterministic music, ambience and effects for V5 films."""

from __future__ import annotations

import argparse
import math
import wave
from pathlib import Path

import numpy as np


RATE = 48_000
ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / "audio"


def env(t: np.ndarray, start: float, end: float, attack: float = 0.4, release: float = 0.8) -> np.ndarray:
    gate = ((t >= start) & (t <= end)).astype(np.float64)
    gate *= np.clip((t - start) / max(attack, 1e-4), 0, 1)
    gate *= np.clip((end - t) / max(release, 1e-4), 0, 1)
    return gate


def osc(t: np.ndarray, frequency: float, phase: float = 0, wobble: float = 0) -> np.ndarray:
    modulation = wobble * np.sin(2 * math.pi * 0.071 * t)
    return np.sin(2 * math.pi * frequency * t + phase + modulation)


def pan(mono: np.ndarray, position: float) -> np.ndarray:
    angle = (position + 1) * math.pi / 4
    return np.column_stack((mono * math.cos(angle), mono * math.sin(angle)))


def filtered_noise(rng: np.random.Generator, count: int, width: int) -> np.ndarray:
    noise = rng.normal(0, 1, count)
    # Cumulative-sum moving average avoids a multi-billion-operation direct
    # convolution on the minute-long 48 kHz masters.
    cumulative = np.cumsum(np.insert(noise, 0, 0.0))
    core = (cumulative[width:] - cumulative[:-width]) / width
    left = width // 2
    right = count - len(core) - left
    return np.pad(core, (left, right), mode="edge")


def impact(t: np.ndarray, at: float, strength: float, rng: np.random.Generator) -> np.ndarray:
    local = t - at
    active = local >= 0
    decay = active * np.exp(-np.clip(local, 0, None) / 0.62)
    sweep = np.sin(2 * math.pi * (61 * local - 17 * local * local))
    grit = filtered_noise(rng, len(t), 72)
    return strength * decay * (0.82 * sweep + 0.42 * grit)


def shimmer(t: np.ndarray, at: float, pitch: float, decay: float = 1.8) -> np.ndarray:
    local = t - at
    active = local >= 0
    falloff = active * np.exp(-np.clip(local, 0, None) / decay)
    return falloff * (osc(t, pitch) + 0.42 * osc(t, pitch * 2.01, 0.4) + 0.2 * osc(t, pitch * 3.97, 1.2))


def compose_opening() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    duration = 72.0
    count = round(duration * RATE)
    t = np.arange(count, dtype=np.float64) / RATE
    rng = np.random.default_rng(2026090401)
    music = np.zeros((count, 2), dtype=np.float64)
    ambience = np.zeros_like(music)
    effects = np.zeros_like(music)

    # Orun: low human-memory fundamental with slowly opening fifths.
    memory = (0.5 * osc(t, 73.42, wobble=.5) + 0.24 * osc(t, 110, .7, .2)
              + 0.15 * osc(t, 146.83, 1.3) + 0.08 * osc(t, 293.66, 2.1))
    music += pan(memory * env(t, 0, 18, 2.2, 2.5) * .22, -.12)
    for when, pitch, position in ((3.0, 440, -.6), (7.6, 554.37, .5), (11.2, 659.25, -.25), (14.4, 880, .65)):
        music += pan(shimmer(t, when, pitch, 1.7) * .055, position)

    # Engine and inversion: bowed-metal dissonance plus restrained authority pulses.
    inversion = (0.42 * osc(t, 55, wobble=1.2) + 0.38 * osc(t, 58.27, .8, 1.0)
                 + 0.12 * np.sign(osc(t, 27.5))) * env(t, 14, 34, 2.0, 2.2)
    music += pan(inversion * .19, 0)
    for when, position in ((17.2, -.35), (20.8, .35), (24.0, -.2), (27.6, .2), (30.2, 0)):
        effects += pan(impact(t, when, .32 + (when - 17) * .012, rng), position)

    # Countermeasure: split-circle motif in two voices.
    counter = (0.25 * osc(t, 98, .2) + 0.18 * osc(t, 123.47, 1.0)
               + 0.14 * osc(t, 146.83, 1.9) + 0.08 * osc(t, 246.94, 2.4))
    music += pan(counter * env(t, 29, 43, 1.5, 2.5), -.3)
    music += pan(np.roll(counter, 1600) * env(t, 31, 43, 1.5, 2.5), .35)
    for when, pitch, position in ((32.0, 493.88, -.4), (35.1, 587.33, .42), (38.2, 739.99, -.05)):
        effects += pan(shimmer(t, when, pitch, 2.0) * .065, position)

    # Falling city: low wind, stone drops and memory hiss.
    wind = filtered_noise(rng, count, 1100)
    wind /= max(np.max(np.abs(wind)), 1e-9)
    wind *= (.11 + .035 * np.sin(2 * math.pi * .13 * t)) * env(t, 38, 58, 1.0, 3.2)
    ambience[:, 0] += wind
    ambience[:, 1] += np.roll(wind, 2900) * .92
    for when, strength, position in ((41.1, .58, -.5), (45.6, .72, .38), (50.2, .82, -.12), (54.6, .56, .55)):
        effects += pan(impact(t, when, strength, rng), position)

    # Awakening and title: breath, fragile dawn interval, one earned resolve.
    breath = filtered_noise(rng, count, 650)
    breath /= max(np.max(np.abs(breath)), 1e-9)
    ambience += pan(breath * env(t, 56, 67, 1.5, 2.0) * .055, -.25)
    dawn = (0.36 * osc(t, 73.42, wobble=.2) + 0.22 * osc(t, 110, .4)
            + 0.16 * osc(t, 146.83, 1.1) + 0.1 * osc(t, 184.99, 1.8)
            + 0.05 * osc(t, 369.99, 2.5)) * env(t, 55, 72, 2.8, 1.8)
    music += pan(dawn * .5, .05)
    effects += pan(shimmer(t, 62.1, 587.33, 2.8) * .09, .25)
    effects += pan(impact(t, 66.4, .72, rng), 0)
    effects += pan(shimmer(t, 66.6, 739.99, 3.4) * .1, 0)

    return music, ambience, effects


def compose_intro() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    duration = 40.0
    count = round(duration * RATE)
    t = np.arange(count, dtype=np.float64) / RATE
    rng = np.random.default_rng(2026090402)
    music = np.zeros((count, 2), dtype=np.float64)
    ambience = np.zeros_like(music)
    effects = np.zeros_like(music)

    cavern = filtered_noise(rng, count, 950)
    cavern /= max(np.max(np.abs(cavern)), 1e-9)
    ambience[:, 0] += cavern * .07
    ambience[:, 1] += np.roll(cavern, 4100) * .063

    # Mira's warm testimony motif.
    lamp = (0.38 * osc(t, 82.41, wobble=.28) + 0.23 * osc(t, 123.47, .7)
            + 0.14 * osc(t, 164.81, 1.4) + 0.07 * osc(t, 329.63, 2.1))
    music += pan(lamp * env(t, 0, 15, 1.5, 2.2) * .36, .18)
    for when, pitch, position in ((1.0, 523.25, .3), (4.0, 659.25, -.25), (7.2, 783.99, .35), (11.0, 587.33, -.2)):
        effects += pan(shimmer(t, when, pitch, 1.5) * .07, position)

    # Broken blade and remembered sunrise.
    fracture = (0.3 * osc(t, 73.42) + 0.18 * osc(t, 92.5, .5)
                + 0.12 * osc(t, 146.83, 1.2)) * env(t, 11.5, 23, 1.1, 2.0)
    music += pan(fracture * .48, -.18)
    effects += pan(impact(t, 13.2, .24, rng), -.2)
    for when, pitch in ((14.1, 440), (16.1, 554.37), (18.1, 659.25), (20.4, 880)):
        effects += pan(shimmer(t, when, pitch, 1.7) * .065, (when % 2) - .5)

    # Crown Path ignition: route pulses and brighter human interval.
    path = (0.34 * osc(t, 98, wobble=.18) + 0.24 * osc(t, 123.47, .2)
            + 0.18 * osc(t, 164.81, .9) + 0.1 * osc(t, 196, 1.6)) * env(t, 20, 40, 2.0, 1.6)
    music += pan(path * .55, 0)
    for when, position in ((27.2, -.65), (28.5, -.35), (29.8, 0), (31.1, .35), (32.4, .65)):
        effects += pan(shimmer(t, when, 493.88 + (when - 27) * 54, 1.3) * .06, position)
    effects += pan(impact(t, 34.0, .52, rng), 0)
    effects += pan(shimmer(t, 35.0, 739.99, 2.8) * .085, .15)

    return music, ambience, effects


def compose_bridge10() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    duration = 52.0
    count = round(duration * RATE)
    t = np.arange(count, dtype=np.float64) / RATE
    rng = np.random.default_rng(2026090403)
    music = np.zeros((count, 2), dtype=np.float64)
    ambience = np.zeros_like(music)
    effects = np.zeros_like(music)

    # Dust settling after the Warden fight: one continuous, non-verbal chamber bed.
    chamber = filtered_noise(rng, count, 1200)
    chamber /= max(np.max(np.abs(chamber)), 1e-9)
    chamber *= .058 + .018 * np.sin(2 * math.pi * .093 * t)
    ambience[:, 0] += chamber
    ambience[:, 1] += np.roll(chamber, 4700) * .88
    oath = (0.36 * osc(t, 55, wobble=.34) + 0.2 * osc(t, 82.41, .5)
            + 0.12 * osc(t, 110, 1.2) + 0.06 * osc(t, 220, 2.1))
    music += pan(oath * env(t, 0, 18, 1.2, 2.4) * .38, -.1)
    for when, pitch, position in ((1.1, 329.63, -.25), (3.2, 440, .25), (7.3, 493.88, -.15),
                                  (10.6, 587.33, .28), (14.5, 659.25, 0)):
        effects += pan(shimmer(t, when, pitch, 1.9) * .065, position)
    effects += pan(impact(t, 6.7, .44, rng), 0)

    # Ten memory shards orbit and cohere without identifying the heir by name.
    memory = (0.29 * osc(t, 73.42, wobble=.5) + 0.19 * osc(t, 98, .4)
              + 0.13 * osc(t, 146.83, 1.1) + 0.07 * osc(t, 293.66, 2.0))
    music += pan(memory * env(t, 14, 33, 2.0, 2.6) * .46, .12)
    for index in range(10):
        when = 15.0 + index * 1.37
        effects += pan(shimmer(t, when, 369.99 + index * 23.5, 1.15) * .045,
                       -0.72 + index * .16)
    effects += pan(impact(t, 23.0, .38, rng), -.05)
    effects += pan(impact(t, 31.0, .52, rng), .08)

    # The Inner Kingdom gate opens: low mechanism, widening fifth, restrained resolve.
    gate = (0.34 * osc(t, 49, wobble=.22) + 0.22 * osc(t, 73.42, .7)
            + 0.17 * osc(t, 98, 1.25) + 0.08 * osc(t, 196, 2.0))
    music += pan(gate * env(t, 30, 52, 2.1, 1.4) * .55, 0)
    rumble = filtered_noise(rng, count, 90)
    rumble /= max(np.max(np.abs(rumble)), 1e-9)
    ambience += pan(rumble * env(t, 31.5, 45.5, 1.4, 2.2) * .055, 0)
    effects += pan(impact(t, 32.1, .72, rng), 0)
    for when, pitch, position in ((34.0, 440, -.5), (36.2, 554.37, -.2),
                                  (38.4, 659.25, .2), (40.6, 880, .5), (46.2, 739.99, 0)):
        effects += pan(shimmer(t, when, pitch, 2.5) * .072, position)
    effects += pan(impact(t, 46.0, .62, rng), 0)

    return music, ambience, effects


def compose_bridge20() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    duration = 64.0
    count = round(duration * RATE)
    t = np.arange(count, dtype=np.float64) / RATE
    rng = np.random.default_rng(2026090404)
    music = np.zeros((count, 2), dtype=np.float64)
    ambience = np.zeros_like(music)
    effects = np.zeros_like(music)

    court = filtered_noise(rng, count, 1050)
    court /= max(np.max(np.abs(court)), 1e-9)
    ambience[:, 0] += court * (.052 + .012*np.sin(2*math.pi*.11*t))
    ambience[:, 1] += np.roll(court, 3900) * .047

    # Court scales and Liora's self-possession use related, but distinct intervals.
    scales = (0.32 * osc(t, 61.74, wobble=.28) + 0.19 * osc(t, 92.5, .6)
              + 0.11 * osc(t, 123.47, 1.5))
    music += pan(scales * env(t, 0, 15.5, 1.2, 2.4) * .42, -.16)
    effects += pan(impact(t, 1.2, .38, rng), -.45)
    effects += pan(impact(t, 5.9, .38, rng), .45)
    liora = (0.3 * osc(t, 82.41, wobble=.22) + 0.22 * osc(t, 123.47, .45)
             + 0.15 * osc(t, 164.81, 1.1) + 0.08 * osc(t, 329.63, 1.9))
    music += pan(liora * env(t, 6.5, 35.5, 1.8, 2.8) * .5, .1)
    for index in range(10):
        when = 8.0 + index * 1.18
        effects += pan(shimmer(t, when, 415.3 + index * 27.4, 1.35) * .05,
                       -0.75 + index * .165)
    effects += pan(shimmer(t, 18.0, 659.25, 2.7) * .085, 0)

    # Ten Crown Paths: two bright, eight unresolved, with no victory fanfare.
    path = (0.31 * osc(t, 73.42, wobble=.18) + 0.2 * osc(t, 110, .55)
            + 0.15 * osc(t, 146.83, 1.25) + 0.07 * osc(t, 220, 2.2))
    music += pan(path * env(t, 23, 44, 2.0, 2.6) * .54, 0)
    for index in range(10):
        when = 24.8 + index * 1.24
        effects += pan(shimmer(t, when, 349.23 + index * 18.5, 1.0) * (.062 if index < 2 else .035),
                       -.78 + index * .17)
    effects += pan(impact(t, 31.8, .5, rng), 0)

    # Serath's address introduces an inharmonic threat; still purely musical/SFX.
    serath = (0.3 * osc(t, 46.25, wobble=1.1) + 0.25 * osc(t, 49, 1.0, .9)
              + 0.1 * np.sign(osc(t, 23.12)))
    music += pan(serath * env(t, 39, 49, 1.2, 2.1) * .35, -.05)
    effects += pan(impact(t, 40.5, .72, rng), 0)
    effects += pan(impact(t, 47.0, .6, rng), .1)

    # Chapter III reveal: real moving water bed and a sober unresolved cadence.
    water = filtered_noise(rng, count, 240)
    water /= max(np.max(np.abs(water)), 1e-9)
    water *= env(t, 46, 58.5, 1.4, 2.1) * (.08 + .02*np.sin(2*math.pi*.36*t))
    ambience[:, 0] += water
    ambience[:, 1] += np.roll(water, 2200) * .92
    resolve = (0.36 * osc(t, 55, wobble=.17) + 0.24 * osc(t, 82.41, .5)
               + 0.17 * osc(t, 110, 1.2) + 0.09 * osc(t, 164.81, 2.0))
    music += pan(resolve * env(t, 47, 64, 2.2, 1.5) * .55, 0)
    effects += pan(shimmer(t, 48.5, 493.88, 2.2) * .065, -.25)
    effects += pan(shimmer(t, 52.5, 659.25, 2.6) * .08, .25)
    effects += pan(impact(t, 56.9, .68, rng), 0)
    effects += pan(shimmer(t, 57.2, 739.99, 3.4) * .09, 0)

    return music, ambience, effects


def write_wav(path: Path, signal: np.ndarray) -> None:
    peak = max(float(np.max(np.abs(signal))), 1e-9)
    limited = np.tanh(signal * (1.08 / peak))
    limited *= .58 / max(float(np.max(np.abs(limited))), 1e-9)
    pcm = np.clip(limited * 32767, -32768, 32767).astype("<i2")
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm.tobytes())


def render_set(prefix: str, composer) -> None:
    music, ambience, effects = composer()
    master = music * .82 + ambience * .72 + effects * .88
    AUDIO.mkdir(parents=True, exist_ok=True)
    write_wav(AUDIO / f"{prefix}-music.wav", music)
    write_wav(AUDIO / f"{prefix}-ambience.wav", ambience)
    write_wav(AUDIO / f"{prefix}-effects.wav", effects)
    write_wav(AUDIO / f"{prefix}-master.wav", master)
    print(f"Wrote original {prefix} stems and master at {RATE} Hz stereo")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--movie", choices=("opening", "intro", "bridge10", "bridge20", "bridges", "both", "all"), default="both")
    args = parser.parse_args()
    if args.movie in {"opening", "both", "all"}:
        render_set("opening-prologue", compose_opening)
    if args.movie in {"intro", "both", "all"}:
        render_set("chapter-one-introduction", compose_intro)
    if args.movie in {"bridge10", "bridges", "all"}:
        render_set("chapter-one-to-two-bridge", compose_bridge10)
    if args.movie in {"bridge20", "bridges", "all"}:
        render_set("chapter-two-to-three-bridge", compose_bridge20)


if __name__ == "__main__":
    main()

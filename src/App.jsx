import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './engine.js';
import { TILE, VIEW_H, VIEW_W, createLevels } from './levels.js';
import { bakeAllLevels } from './render.js';

const ASSET_URLS = {
  title: `${import.meta.env.BASE_URL}assets/title-still.png`,
  background: `${import.meta.env.BASE_URL}assets/kingdom-panorama.png`,
  atlas: `${import.meta.env.BASE_URL}assets/character-prop-atlas.png`,
  hero: `${import.meta.env.BASE_URL}assets/hero-sheet-v2.png`,
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function formatTime(seconds) {
  const safe = Math.max(0, seconds || 0);
  const minutes = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const centis = Math.floor((safe % 1) * 100);
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

function readBest() {
  try {
    const value = JSON.parse(localStorage.getItem('eotvk-save-v1') || 'null');
    return value?.campaignLevels === 10 && typeof value?.bestTime === 'number' ? value.bestTime : null;
  } catch {
    return null;
  }
}

function TouchButton({ action, label, className = '', engineRef }) {
  const set = (active, event) => {
    event.preventDefault();
    if (active) event.currentTarget.setPointerCapture?.(event.pointerId);
    engineRef.current?.setInput(action, active);
  };
  return (
    <button
      className={`touch-button ${className}`}
      aria-label={label}
      onPointerDown={(event) => set(true, event)}
      onPointerUp={(event) => set(false, event)}
      onPointerCancel={(event) => set(false, event)}
      onLostPointerCapture={(event) => set(false, event)}
    >{label}</button>
  );
}

export default function App() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const resourcesRef = useRef(null);
  const [screen, setScreen] = useState('boot');
  const [ready, setReady] = useState(false);
  const [bootLabel, setBootLabel] = useState('Loading the veil');
  const [progress, setProgress] = useState(0);
  const [hint, setHint] = useState('');
  const [muted, setMuted] = useState(true);
  const [bestTime, setBestTime] = useState(readBest);
  const [results, setResults] = useState({ time: 0, deaths: 0 });
  const [hud, setHud] = useState({ hp: 4, maxHp: 4, relics: 0, time: 0, level: 1, levelName: 'The Outer Veil', demo: false, bossHp: null, bossMaxHp: null });

  useEffect(() => {
    let cancelled = false;
    async function preload() {
      const entries = Object.entries(ASSET_URLS);
      const loaded = {};
      for (let i = 0; i < entries.length; i += 1) {
        const [key, url] = entries[i];
        loaded[key] = await loadImage(url);
        if (cancelled) return;
        setProgress(((i + 1) / entries.length) * .52);
      }

      if (document.fonts) {
        await Promise.all([
          document.fonts.load("600 48px 'Cinzel'"),
          document.fonts.load("500 16px 'Outfit'"),
          document.fonts.ready,
        ]);
      }
      if (cancelled) return;
      setProgress(.58);
      setBootLabel('Painting the kingdom');
      const levels = createLevels();
      const bank = await bakeAllLevels(levels, (value) => {
        if (!cancelled) setProgress(.58 + value * .42);
      });
      if (cancelled) return;
      resourcesRef.current = { assets: loaded, levels, bank };
      setProgress(1);
      setReady(true);
      setScreen('title');
    }
    preload().catch((error) => {
      console.error(error);
      setBootLabel('The veil could not be painted · reload to try again');
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!resourcesRef.current || !canvasRef.current || engineRef.current) return undefined;
    const { assets, levels, bank } = resourcesRef.current;
    const engine = new GameEngine(canvasRef.current, assets, levels, bank, {
      hud: setHud,
      hint: setHint,
      pause: () => {
        setScreen((current) => {
          const paused = current !== 'pause';
          engine.pause(paused);
          return paused ? 'pause' : 'play';
        });
      },
      mode: (mode) => setScreen(mode),
      death: ({ deaths, demo }) => {
        setResults((current) => ({ ...current, deaths }));
        if (demo) {
          window.setTimeout(() => engine.respawn(), 900);
        } else setScreen('dead');
      },
      win: ({ time, deaths }) => {
        setResults({ time, deaths });
        const previous = readBest();
        if (previous === null || time < previous) {
          localStorage.setItem('eotvk-save-v1', JSON.stringify({
            campaignLevels: 10,
            bestTime: time,
            achievedAt: new Date().toISOString(),
          }));
          setBestTime(time);
        }
        setScreen('win');
      },
      transition: (level, name) => setHint(`LEVEL ${level} · ${name.toUpperCase()}`),
    });
    engineRef.current = engine;
    if (import.meta.env.DEV) {
      const demoLevel = Number(new URLSearchParams(window.location.search).get('demoLevel'));
      if (Number.isInteger(demoLevel) && demoLevel >= 1 && demoLevel <= 10) {
        engine.start(true);
        if (demoLevel > 1) engine.loadLevel(demoLevel - 1);
        setScreen('play');
      }
      if (new URLSearchParams(window.location.search).get('demoBoss') === '1') {
        engine.start(true);
        engine.loadLevel(9);
        engine.level.relics.forEach((relic) => { relic.collected = true; });
        engine.openGate();
        engine.player.x = 62 * TILE;
        engine.player.y = 24 * TILE - engine.player.h;
        engine.level.boss.active = true;
        engine.pushHud(true);
        setScreen('play');
      }
    }
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [ready]);

  const start = (demo = false) => {
    engineRef.current?.start(demo);
    setScreen('play');
  };

  const resume = () => {
    engineRef.current?.pause(false);
    setScreen('play');
  };

  const returnToTitle = () => {
    if (engineRef.current) {
      engineRef.current.mode = 'title';
      engineRef.current.clearInputs();
    }
    setScreen('title');
  };

  const toggleMute = () => setMuted(engineRef.current?.toggleMute() ?? true);

  return (
    <main className="app" aria-label="Eclipse of the Veiled Kingdom">
      <div className="game-stage">
        <canvas ref={canvasRef} className="game-canvas" width={VIEW_W} height={VIEW_H} tabIndex={0} aria-label="Game world" />
      </div>

      {screen === 'boot' && (
        <section className="boot" aria-live="polite">
          <div className="boot-card">
            <div className="sigil" />
            <div className="boot-label">{bootLabel}</div>
            <div className="progress-track"><div className="progress-bar" style={{ width: `${progress * 100}%` }} /></div>
          </div>
        </section>
      )}

      {screen === 'title' && (
        <section className="title-screen">
          <div className="title-layout">
            <div className="title-content">
              <div className="eyebrow">A kingdom buried · an eclipse awake</div>
              <h1>Eclipse <span>of the Veiled Kingdom</span></h1>
              <p className="title-subtitle">Cross ten buried realms. Carve living sand, bend ancient mechanisms, break the occupation, and face the Guardian beneath the final eclipse.</p>
              <div className="title-actions">
                <button className="primary" disabled={progress < 1} onClick={() => start(false)}>Enter the ruins</button>
                <button className="secondary" onClick={() => start(true)}>Watch a run</button>
                <button className="secondary" onClick={() => setScreen('help')}>How to play</button>
              </div>
              <div className="best-time">{bestTime === null ? 'No journey recorded' : `Best eclipse · ${formatTime(bestTime)}`}</div>
            </div>
          </div>
        </section>
      )}

      {(screen === 'play' || screen === 'pause' || screen === 'dead' || screen === 'win') && (
        <>
          <header className="hud">
            <div className="hud-left">
              <div>
                <div className="hud-kicker">LVL {hud.level}</div>
                <div className="hud-level">{hud.levelName}</div>
              </div>
              <div className="health">
                <div className="health-label"><span>HEALTH</span><span>{hud.hp}/{hud.maxHp}</span></div>
                <div className="health-track"><div className="health-value" style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }} /></div>
              </div>
            </div>
            <div className="hud-center">
              <span className="diamond" /><span className="relic-count">RELICS {hud.relics}/3</span>
              <span className="timer">{formatTime(hud.time)}</span>
            </div>
            <div className="hud-right">
              <button className="icon-button" aria-label={muted ? 'Unmute audio' : 'Mute audio'} onClick={toggleMute}>{muted ? '◇' : '◆'}</button>
              <button className="icon-button" aria-label="Pause" onClick={() => { engineRef.current?.pause(true); setScreen('pause'); }}>Ⅱ</button>
            </div>
          </header>
          {screen === 'play' && <div className="context-hint">{hud.demo ? 'DEMO PILGRIM · ' : ''}{hint}</div>}
          {screen === 'play' && hud.bossHp !== null && hud.bossHp > 0 && (
            <div className="boss-hud">
              <span>VEILED GUARDIAN</span>
              <div><i style={{ width: `${(hud.bossHp / hud.bossMaxHp) * 100}%` }} /></div>
            </div>
          )}
          {screen === 'play' && (
            <div className="touch-controls" aria-label="Touch controls">
              <div className="touch-cluster touch-move">
                <TouchButton engineRef={engineRef} action="climb" label="Up" className="touch-up" />
                <TouchButton engineRef={engineRef} action="left" label="←" className="touch-left" />
                <TouchButton engineRef={engineRef} action="down" label="Down" className="touch-down" />
                <TouchButton engineRef={engineRef} action="right" label="→" className="touch-right" />
              </div>
              <div className="touch-cluster touch-actions">
                <TouchButton engineRef={engineRef} action="attack" label="Strike" />
                <TouchButton engineRef={engineRef} action="dig" label="Dig" />
                <TouchButton engineRef={engineRef} action="jump" label="Jump" className="touch-jump" />
              </div>
            </div>
          )}
        </>
      )}

      {screen === 'help' && (
        <section className="overlay">
          <div className="overlay-card">
            <div className="eyebrow">Scavenger field notes</div>
            <h2>How to play</h2>
            <div className="help-grid">
              <div><span>Move</span><kbd>A / D · ← / →</kbd></div>
              <div><span>Jump</span><kbd>SPACE · ↑</kbd></div>
              <div><span>Climb wall</span><kbd>W + toward</kbd></div>
              <div><span>Drop through</span><kbd>S · ↓</kbd></div>
              <div><span>Strike</span><kbd>J · X</kbd></div>
              <div><span>Dig sand</span><kbd>K · SHIFT</kbd></div>
              <div><span>Pause</span><kbd>ESC · P</kbd></div>
              <div><span>Touch</span><kbd>On-screen pads</kbd></div>
              <div><span>Swim</span><kbd>Tap jump</kbd></div>
              <div><span>Veil bridges</span><kbd>Follow the pulse</kbd></div>
            </div>
            <button className="primary" onClick={() => setScreen('title')}>Return</button>
          </div>
        </section>
      )}

      {screen === 'pause' && (
        <section className="overlay">
          <div className="overlay-card">
            <div className="eyebrow">The veil is still</div>
            <h2>Journey paused</h2>
            <p>Your place in the kingdom is held.</p>
            <div className="overlay-actions">
              <button className="primary" onClick={resume}>Continue</button>
              <button className="secondary" onClick={returnToTitle}>Title screen</button>
            </div>
          </div>
        </section>
      )}

      {screen === 'dead' && (
        <section className="overlay">
          <div className="overlay-card">
            <div className="eyebrow">The kingdom remembers</div>
            <h2>You have fallen</h2>
            <p>This realm will reform: relics, mechanisms, enemies, and gates return to their starting state.</p>
            <div className="overlay-actions">
              <button className="primary" onClick={() => engineRef.current?.respawn()}>Restart realm</button>
              <button className="secondary" onClick={returnToTitle}>Abandon journey</button>
            </div>
          </div>
        </section>
      )}

      {screen === 'win' && (
        <section className="overlay">
          <div className="overlay-card">
            <div className="eyebrow">The eclipse is broken</div>
            <h2>Kingdom unveiled</h2>
            <p>All ten realms are free. Light reaches the buried halls once more, and your path has become part of the ruins.</p>
            <div className="results">
              <div className="result"><strong>{formatTime(results.time)}</strong><span>Journey time</span></div>
              <div className="result"><strong>{results.deaths}</strong><span>Falls</span></div>
            </div>
            <div className="overlay-actions">
              <button className="primary" onClick={() => start(false)}>Journey again</button>
              <button className="secondary" onClick={returnToTitle}>Title screen</button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

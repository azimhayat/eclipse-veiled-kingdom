import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './engine.js';
import { buildLevelPresentation, detectPresentationInput } from './level-presentation.js';
import { TILE, VIEW_H, VIEW_W } from './levels/constants.js';
import { bakeAllLevels } from './render.js';
import { releaseRenderedLevel, RenderedLevelCache } from './rendered-level-cache.js';
import {
  getOuterVeilContinueTarget,
  loadCampaignSave,
  persistCampaignSave,
  recordLegacyPrototypeCompletion,
  recordProductionLevelCompletion,
} from './save-data.js';
import { AuthoredLevelRepository } from './campaign/AuthoredLevelRepository.js';
import {
  createProductionPreviewRepository,
  getProductionPreviewDescriptor,
  PRODUCTION_PREVIEW_KEYS,
} from './campaign/productionPreview.js';
import {
  createOuterVeilCampaignRepository,
  OUTER_VEIL_COMPLETION,
} from './campaign/outerVeilCampaign.js';
import {
  resolveDevelopmentSession,
  sessionUsesPersistentSave,
  shouldPersistCampaignCompletion,
  shouldPersistProductionProgress,
} from './campaign/sessionRoute.js';

const ASSET_URLS = {
  title: `${import.meta.env.BASE_URL}assets/title-still.png`,
  background: `${import.meta.env.BASE_URL}assets/kingdom-panorama.png`,
  outerVeilBackground: `${import.meta.env.BASE_URL}assets/outer-veil-buried-dawn-v1.png`,
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

function getBrowserStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function TouchButton({ action, label, className = '', engineRef }) {
  const set = (active, event) => {
    event.preventDefault();
    if (active) {
      try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* synthetic and cancelled pointers need no capture */ }
    }
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
  const saveRef = useRef(null);
  const [screen, setScreen] = useState('boot');
  const [ready, setReady] = useState(false);
  const [bootLabel, setBootLabel] = useState('Loading the veil');
  const [progress, setProgress] = useState(0);
  const [hint, setHint] = useState('');
  const [muted, setMuted] = useState(true);
  const [bestTime, setBestTime] = useState(null);
  const [saveWarning, setSaveWarning] = useState('');
  const [sessionKind, setSessionKind] = useState('prototype-campaign');
  const [previewPresentation, setPreviewPresentation] = useState(null);
  const [outerProgress, setOuterProgress] = useState(null);
  const [results, setResults] = useState({ time: 0, deaths: 0, targetTime: null });
  const [presentationCard, setPresentationCard] = useState(null);
  const presentationTimerRef = useRef(null);
  const presentationGenerationRef = useRef(0);
  const [hud, setHud] = useState({ hp: 4, maxHp: 4, relics: 0, objectiveLabel: 'RELICS', objectiveCurrent: 0, objectiveTarget: 3, objectiveProgressText: null, time: 0, level: 1, levelName: 'The Outer Veil', demo: false, bossHp: null, bossMaxHp: null });

  useEffect(() => {
    let cancelled = false;
    async function preload() {
      const route = resolveDevelopmentSession(window.location.search, {
        dev: import.meta.env.DEV,
        previewKeys: PRODUCTION_PREVIEW_KEYS,
      });
      if (route.kind === 'error') {
        setBootLabel(`${route.message} Remove the conflicting address option and reload.`);
        setProgress(1);
        return;
      }
      const preview = route.kind === 'production-preview';
      setSessionKind(route.kind);
      setPreviewPresentation(preview ? getProductionPreviewDescriptor(route.previewLevel)?.completion : null);
      if (sessionUsesPersistentSave(route.kind)) {
        const { save } = loadCampaignSave({ storage: getBrowserStorage() });
        saveRef.current = save;
        if (route.kind === 'production-campaign') {
          setOuterProgress(save.progress);
          setBestTime(save.records.realmsByKey?.['outer-veil']?.bestTimeSeconds ?? null);
        } else setBestTime(save.records.legacyPrototype?.bestTimeSeconds ?? null);
      }

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
      setBootLabel('Preparing the first path');
      const repository = preview
        ? createProductionPreviewRepository(route.previewLevel)
        : route.kind === 'production-campaign'
          ? createOuterVeilCampaignRepository()
          : new AuthoredLevelRepository();
      if (!repository) throw new Error('The requested production preview is not available.');
      await repository.loadTemplate(0);
      if (cancelled) return;
      const firstLevel = repository.createRuntime(0);
      const initialBank = await bakeAllLevels([firstLevel], (value) => {
        if (!cancelled) setProgress(.58 + value * .42);
      }, { isCancelled: () => cancelled });
      if (cancelled || !initialBank) {
        if (initialBank) for (const chunks of initialBank.values()) releaseRenderedLevel(chunks);
        return;
      }
      const bank = new RenderedLevelCache({ entries: initialBank });
      resourcesRef.current = { assets: loaded, repository, firstLevel, bank, sessionKind: route.kind };
      setProgress(1);
      setReady(true);
      setScreen(preview ? 'loading' : 'title');
    }
    preload().catch((error) => {
      console.error(error);
      setBootLabel('The veil could not be painted · reload to try again');
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!resourcesRef.current || !canvasRef.current || engineRef.current) return undefined;
    const { assets, repository, firstLevel, bank, sessionKind: activeSessionKind } = resourcesRef.current;
    let demoRespawnTimer;
    const clearPresentation = ({ hide = true } = {}) => {
      presentationGenerationRef.current += 1;
      window.clearTimeout(presentationTimerRef.current);
      presentationTimerRef.current = null;
      if (hide) setPresentationCard(null);
    };
    const announceLevel = (entry) => {
      clearPresentation();
      const cards = buildLevelPresentation(entry, {
        productionCampaign: activeSessionKind === 'production-campaign',
        inputMode: detectPresentationInput(window),
      });
      if (cards.length === 0) return;
      const generation = presentationGenerationRef.current;
      const show = (index) => {
        if (presentationGenerationRef.current !== generation) return;
        const card = cards[index] || null;
        setPresentationCard(card ? { ...card, sequenceId: generation, sequenceIndex: index } : null);
        if (!card) {
          presentationTimerRef.current = null;
          return;
        }
        presentationTimerRef.current = window.setTimeout(() => show(index + 1), card.durationMs);
      };
      show(0);
    };
    const engine = new GameEngine(canvasRef.current, assets, [firstLevel], bank, {
      hud: setHud,
      hint: setHint,
      level: announceLevel,
      pause: () => {
        setScreen((current) => {
          const paused = current !== 'pause';
          engine.pause(paused);
          return paused ? 'pause' : 'play';
        });
      },
      mode: (mode) => {
        if (mode !== 'play') clearPresentation();
        setScreen(mode);
      },
      death: ({ deaths, demo }) => {
        clearPresentation();
        setResults((current) => ({ ...current, deaths }));
        if (demo) {
          window.clearTimeout(demoRespawnTimer);
          demoRespawnTimer = window.setTimeout(() => engine.respawn(), 900);
        } else setScreen('dead');
      },
      levelComplete: ({
        campaignId,
        sessionKind: completedSessionKind,
        levelKey,
        levelTime,
        campaignTime,
      }) => {
        if (!shouldPersistProductionProgress({ sessionKind: completedSessionKind, campaignId })) return;
        const completedAt = new Date().toISOString();
        const currentSave = saveRef.current || loadCampaignSave({ storage: getBrowserStorage() }).save;
        const updated = recordProductionLevelCompletion(currentSave, {
          levelKey,
          levelTime,
          campaignTime,
          completedAt,
        });
        if (!updated) return;
        const result = persistCampaignSave({ storage: getBrowserStorage(), save: updated });
        saveRef.current = result.save || updated;
        setOuterProgress(saveRef.current.progress);
        setBestTime(saveRef.current.records.realmsByKey?.['outer-veil']?.bestTimeSeconds ?? null);
        setSaveWarning(result.persisted ? '' : 'Progress is held for this session only · browser storage is unavailable.');
      },
      win: ({ time, deaths, campaignId, sessionKind: completedSessionKind, completedLevels, targetTime }) => {
        setResults({ time, deaths, targetTime });
        if (shouldPersistCampaignCompletion({
          sessionKind: completedSessionKind,
          campaignId,
          completedLevels,
        })) {
          const completedAt = new Date().toISOString();
          const currentSave = saveRef.current || loadCampaignSave({ storage: getBrowserStorage() }).save;
          const updated = recordLegacyPrototypeCompletion(currentSave, { time, completedAt });
          const result = persistCampaignSave({ storage: getBrowserStorage(), save: updated });
          saveRef.current = result.save || updated;
          setBestTime(saveRef.current.records.legacyPrototype?.bestTimeSeconds ?? null);
          setSaveWarning(result.persisted ? '' : 'Record saved for this session only · browser storage is unavailable.');
        }
        setScreen('win');
      },
      transition: (level, name) => {
        if (activeSessionKind !== 'production-campaign') setHint(`LEVEL ${level} · ${name.toUpperCase()}`);
      },
    }, repository);
    engineRef.current = engine;
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      const demoLevel = Number(params.get('demoLevel'));
      const prepareDemo = async () => {
        if (activeSessionKind === 'production-preview') {
          engine.start(false);
          setScreen('play');
        } else if (params.get('demoBoss') === '1') {
          await engine.startAt(9, { demo: true });
          if (!engine.running || engine.levelIndex !== 9) return;
          engine.level.relics.forEach((relic) => { relic.collected = true; });
          engine.openGate();
          engine.player.x = 62 * TILE;
          engine.player.y = 24 * TILE - engine.player.h;
          engine.level.boss.active = true;
          engine.pushHud(true);
          setScreen('play');
        } else if (Number.isInteger(demoLevel) && demoLevel >= 1 && demoLevel <= 10) {
          await engine.startAt(demoLevel - 1, { demo: true });
          if (engine.running) setScreen('play');
        }
      };
      void prepareDemo().catch((error) => console.error('Could not prepare demo route', error));
    }
    return () => {
      clearPresentation({ hide: false });
      window.clearTimeout(demoRespawnTimer);
      engine.destroy();
      engineRef.current = null;
    };
  }, [ready]);

  const start = (demo = false) => {
    setSaveWarning('');
    engineRef.current?.start(demo);
    setScreen('play');
  };

  const startOuterVeilAt = async (index) => {
    setSaveWarning('');
    setScreen(index === 0 ? 'play' : 'loading');
    const opened = await engineRef.current?.startAt(index, { demo: false });
    if (opened) setScreen('play');
  };

  const continueOuterVeil = () => {
    const target = getOuterVeilContinueTarget(saveRef.current);
    if (target.kind === 'realm-slot') {
      setScreen('realm-slot');
      return;
    }
    void startOuterVeilAt(target.campaignOrder - 1);
  };

  const resume = () => {
    engineRef.current?.pause(false);
    setScreen('play');
  };

  const returnToTitle = () => {
    presentationGenerationRef.current += 1;
    window.clearTimeout(presentationTimerRef.current);
    presentationTimerRef.current = null;
    setPresentationCard(null);
    engineRef.current?.returnToTitle();
    setScreen('title');
  };

  const toggleMute = () => setMuted(engineRef.current?.toggleMute() ?? true);
  const productionCampaign = sessionKind === 'production-campaign';
  const outerContinueTarget = productionCampaign && saveRef.current
    ? getOuterVeilContinueTarget(saveRef.current)
    : null;

  return (
    <main
      className="app"
      aria-label="Eclipse of the Veiled Kingdom"
      style={{ '--title-art': `url("${ASSET_URLS.title}")` }}
    >
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
              <div className="eyebrow">{productionCampaign ? 'REALM I · THE OUTER VEIL' : 'A kingdom buried · an eclipse awake'}</div>
              <h1>Eclipse <span>of the Veiled Kingdom</span></h1>
              <p className="title-subtitle">{productionCampaign
                ? 'Ten chapters beneath the first Crown Path. Recover Aren’s buried memory, restore the Veil, and free the guardian without opening the deeper archive.'
                : 'Cross ten buried realms. Carve living sand, bend ancient mechanisms, break the occupation, and face the Guardian beneath the final eclipse.'}</p>
              <div className="title-actions">
                {productionCampaign ? (
                  <>
                    <button className="primary" disabled={progress < 1} onClick={continueOuterVeil}>
                      {outerContinueTarget?.kind === 'realm-slot'
                        ? 'Continue to Inner Kingdom'
                        : outerContinueTarget?.campaignOrder > 1
                          ? `Continue · Chapter ${String(outerContinueTarget.campaignOrder).padStart(2, '0')}`
                          : 'Begin Buried Dawn'}
                    </button>
                    {outerContinueTarget?.campaignOrder > 1 || outerContinueTarget?.kind === 'realm-slot'
                      ? <button className="secondary" onClick={() => { void startOuterVeilAt(0); }}>Replay Outer Veil</button>
                      : null}
                  </>
                ) : (
                  <>
                    <button className="primary" disabled={progress < 1} onClick={() => start(false)}>Enter the ruins</button>
                    <button className="secondary" onClick={() => start(true)}>Watch a run</button>
                  </>
                )}
                <button className="secondary" onClick={() => setScreen('help')}>How to play</button>
              </div>
              <div className="best-time">{productionCampaign
                ? `${outerProgress?.completedLevelKeys?.length || 0}/10 chapters restored${bestTime === null ? '' : ` · best realm ${formatTime(bestTime)}`}`
                : bestTime === null ? 'No journey recorded' : `Best eclipse · ${formatTime(bestTime)}`}</div>
            </div>
          </div>
        </section>
      )}

      {(screen === 'play' || screen === 'pause' || screen === 'dead' || screen === 'win' || screen === 'loading' || screen === 'load-error') && (
        <>
          <header className="hud">
            <div className="hud-left">
              <div>
              <div className="hud-kicker">{sessionKind === 'production-preview' ? 'PRODUCTION PREVIEW · ' : productionCampaign ? 'OUTER VEIL · ' : ''}LVL {hud.level}</div>
                <div className="hud-level">{hud.levelName}</div>
              </div>
              <div className="health">
                <div className="health-label"><span>HEALTH</span><span>{hud.hp}/{hud.maxHp}</span></div>
                <div className="health-track"><div className="health-value" style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }} /></div>
              </div>
            </div>
            <div className="hud-center">
              <span className="diamond" /><span className="relic-count">{hud.objectiveProgressText || `${hud.objectiveLabel} ${hud.objectiveCurrent}/${hud.objectiveTarget}`}</span>
              <span className="timer">{formatTime(hud.time)}</span>
            </div>
            <div className="hud-right">
              <button className="icon-button" aria-label={muted ? 'Unmute audio' : 'Mute audio'} onClick={toggleMute}>{muted ? '◇' : '◆'}</button>
              <button
                className="icon-button"
                aria-label="Pause"
                disabled={screen !== 'play'}
                onClick={() => { engineRef.current?.pause(true); setScreen('pause'); }}
              >Ⅱ</button>
            </div>
          </header>
          {screen === 'play' && !presentationCard && <div className="context-hint">{hud.demo ? 'DEMO PILGRIM · ' : ''}{hint}</div>}
          {screen === 'play' && presentationCard && (
            <div
              key={`${presentationCard.sequenceId}-${presentationCard.sequenceIndex}-${presentationCard.kind}`}
              className={`chapter-card presentation-card presentation-${presentationCard.kind}`}
              data-presentation-kind={presentationCard.kind}
              aria-live="polite"
              role="status"
              style={{ '--presentation-duration': `${presentationCard.durationMs}ms` }}
            >
              <div className="chapter-rule" />
              <div className="chapter-kicker">{presentationCard.kicker}</div>
              <div className="chapter-title">{presentationCard.title}</div>
              {presentationCard.detail && <div className="chapter-story">{presentationCard.detail}</div>}
              {presentationCard.input && (
                <div className="presentation-input">
                  <span>{presentationCard.inputLabel}</span>{presentationCard.input}
                </div>
              )}
            </div>
          )}
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
              <button className="secondary" onClick={sessionKind === 'production-preview' ? () => { window.location.href = window.location.pathname; } : returnToTitle}>{sessionKind === 'production-preview' ? 'Return to live prototype' : 'Title screen'}</button>
            </div>
          </div>
        </section>
      )}

      {screen === 'dead' && (
        <section className="overlay">
          <div className="overlay-card">
            <div className="eyebrow">The kingdom remembers</div>
            <h2>You have fallen</h2>
            <p>This realm will reform: objectives, hazards, mechanisms, health, and gates return to their starting state.</p>
            <div className="overlay-actions">
              <button className="primary" onClick={() => engineRef.current?.respawn()}>Restart realm</button>
              <button className="secondary" onClick={sessionKind === 'production-preview' ? () => { window.location.href = window.location.pathname; } : returnToTitle}>{sessionKind === 'production-preview' ? 'Return to live prototype' : 'Abandon journey'}</button>
            </div>
          </div>
        </section>
      )}

      {screen === 'loading' && (
        <section className="overlay path-loading" aria-live="polite">
          <div className="overlay-card">
            <div className="sigil" />
            <div className="eyebrow">The kingdom is reforming</div>
            <h2>Opening the next path</h2>
            <p>The current realm remains safely held while the next one is prepared.</p>
          </div>
        </section>
      )}

      {screen === 'load-error' && (
        <section className="overlay" role="alert">
          <div className="overlay-card">
            <div className="eyebrow">The veil resisted</div>
            <h2>The next path could not open</h2>
            <p>Your completed realm is safely frozen. Reload the game to retry the download, or return to the title screen.</p>
            <div className="overlay-actions">
              <button className="primary" onClick={() => window.location.reload()}>Reload game</button>
              <button className="secondary" onClick={returnToTitle}>Title screen</button>
            </div>
          </div>
        </section>
      )}

      {screen === 'win' && (
        <section className="overlay">
          <div className="overlay-card">
            <div className="eyebrow">{sessionKind === 'production-preview'
              ? previewPresentation?.eyebrow
              : productionCampaign ? OUTER_VEIL_COMPLETION.eyebrow : 'The eclipse is broken'}</div>
            <h2>{sessionKind === 'production-preview'
              ? previewPresentation?.heading
              : productionCampaign ? OUTER_VEIL_COMPLETION.heading : 'Kingdom unveiled'}</h2>
            <p>{sessionKind === 'production-preview'
              ? previewPresentation?.body
              : productionCampaign
                ? OUTER_VEIL_COMPLETION.body
                : 'All ten realms are free. Light reaches the buried halls once more, and your path has become part of the ruins.'}</p>
            {saveWarning && <div className="save-warning" role="status">{saveWarning}</div>}
            <div className="results">
              <div className="result"><strong>{formatTime(results.time)}</strong><span>Journey time</span></div>
              <div className="result"><strong>{results.deaths}</strong><span>Falls</span></div>
            </div>
            <div className="overlay-actions">
              {productionCampaign ? (
                <>
                  <button className="primary" onClick={() => setScreen('realm-slot')}>View the revealed path</button>
                  <button className="secondary" onClick={() => { void startOuterVeilAt(0); }}>Replay Outer Veil</button>
                  <button className="secondary" onClick={returnToTitle}>Title screen</button>
                </>
              ) : (
                <>
                  <button className="primary" onClick={() => start(false)}>{sessionKind === 'production-preview' ? 'Replay level' : 'Journey again'}</button>
                  <button className="secondary" onClick={sessionKind === 'production-preview' ? () => { window.location.href = window.location.pathname; } : returnToTitle}>{sessionKind === 'production-preview' ? 'Return to live prototype' : 'Title screen'}</button>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {screen === 'realm-slot' && (
        <section className="overlay">
          <div className="overlay-card realm-slot-card">
            <div className="eyebrow">{OUTER_VEIL_COMPLETION.nextSlot.label}</div>
            <h2>{OUTER_VEIL_COMPLETION.nextSlot.chapter}</h2>
            <p>The Warden’s restored road now points beneath the second veil. This realm slot is unlocked, but its chapters have not been authored yet.</p>
            <div className="save-warning" role="status">{OUTER_VEIL_COMPLETION.nextSlot.status}</div>
            <div className="overlay-actions">
              <button className="primary" onClick={() => { void startOuterVeilAt(0); }}>Replay Outer Veil</button>
              <button className="secondary" onClick={returnToTitle}>Return to title</button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

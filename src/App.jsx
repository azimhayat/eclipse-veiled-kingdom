import React, { useEffect, useRef, useState } from 'react';
import { DEFAULT_AUDIO_SETTINGS } from './audio-settings.js';
import { GameEngine } from './engine.js';
import {
  buildLevelPresentation,
  buildLevelTransitionPresentation,
  detectPresentationInput,
} from './level-presentation.js';
import { TILE, VIEW_H, VIEW_W } from './levels/constants.js';
import { bakeAllLevels } from './render.js';
import { releaseRenderedLevel, RenderedLevelCache } from './rendered-level-cache.js';
import {
  beginStageOneRun,
  getStageOneRunCheckpoint,
  getStageOneChronicle,
  getOuterVeilContinueTarget,
  loadCampaignSave,
  persistCampaignSave,
  recordLegacyPrototypeCompletion,
  recordProductionLevelCompletion,
  recordStageOnePlayerName,
  recordStageOneRunCheckpoint,
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
  createV4CampaignRepository,
  V4_CAMPAIGN_CATALOG,
  V4_LEVEL_KEYS,
  V5_LAUNCH_PRESENTATION,
} from './campaign/v4Campaign.js';
import {
  beginNewV4Run,
  getV4ChapterTarget,
  getV4ContinueTarget,
  getV4LocalTopTen,
  getV4RunCheckpoint,
  loadV4Save,
  persistV4Save,
  recordV4LevelCompletion,
  recordV4PlayerNameAndScore,
  recordV4RunCheckpoint,
} from './v4-save-data.js';
import {
  fetchGlobalTopTen,
  globalLeaderboardStatus,
  submitGlobalV4Score,
} from './global-leaderboard.js';
import {
  resolveDevelopmentSession,
  sessionUsesPersistentSave,
  shouldPersistCampaignCompletion,
  shouldPersistProductionProgress,
  shouldPersistV4Progress,
} from './campaign/sessionRoute.js';
import { getCinematicSequence } from './cinematics/catalog.js';
import { CinematicPlayer } from './cinematics/CinematicPlayer.jsx';
import { isolateGameForCinematic } from './cinematics/runtime.js';
import {
  DEFAULT_GUIDANCE_SETTINGS,
  isEssentialGuidance,
  loadGuidanceSettings,
  persistGuidanceSettings,
} from './guidance-settings.js';

const ASSET_URLS = {
  title: `${import.meta.env.BASE_URL}assets/title-still.png`,
  background: `${import.meta.env.BASE_URL}assets/kingdom-panorama.png`,
  outerVeilBackground: `${import.meta.env.BASE_URL}assets/outer-veil-buried-dawn-v1.png`,
  hero: `${import.meta.env.BASE_URL}assets/hero-sheet-v2.png`,
};

const OPTIONAL_COMBAT_ASSET_URLS = Object.freeze({
  'outer-veil-08-parachute-choir': Object.freeze({
    veilRaider: `${import.meta.env.BASE_URL}assets/veil-raider-combat-v1.png`,
    veilKeeper: `${import.meta.env.BASE_URL}assets/veil-keeper-combat-v1.png`,
    veilSpearman: `${import.meta.env.BASE_URL}assets/veil-spearman-combat-v1.png`,
  }),
  'outer-veil-09-gate-of-the-veil': Object.freeze({
    veilKeeper: `${import.meta.env.BASE_URL}assets/veil-keeper-combat-v1.png`,
  }),
  'outer-veil-10-warden-of-dust': Object.freeze({
    warden: `${import.meta.env.BASE_URL}assets/warden-of-dust-combat-v1.png`,
  }),
});
const INNER_KINGDOM_COMBAT_ASSET_URLS = Object.freeze({
  veilRaider: `${import.meta.env.BASE_URL}assets/veil-raider-combat-v1.png`,
  veilKeeper: `${import.meta.env.BASE_URL}assets/veil-keeper-combat-v1.png`,
  veilSpearman: `${import.meta.env.BASE_URL}assets/veil-spearman-combat-v1.png`,
});
const optionalAssetLoads = new Map();

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function ensureCombatVisualAssets(assets, levelKey) {
  const urls = levelKey?.startsWith('inner-kingdom-')
    ? INNER_KINGDOM_COMBAT_ASSET_URLS
    : OPTIONAL_COMBAT_ASSET_URLS[levelKey] || {};
  const entries = Object.entries(urls);
  await Promise.all(entries.map(async ([assetKey, url]) => {
    if (assets[assetKey]) return assets[assetKey];
    if (!optionalAssetLoads.has(url)) {
      optionalAssetLoads.set(url, loadImage(url).catch((error) => {
        optionalAssetLoads.delete(url);
        console.warn(`Optional combat artwork could not be loaded: ${assetKey}`, error);
        return null;
      }));
    }
    const image = await optionalAssetLoads.get(url);
    if (image) assets[assetKey] = image;
    return image;
  }));
  return assets;
}

function formatTime(seconds) {
  const safe = Math.max(0, seconds || 0);
  const minutes = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const centis = Math.floor((safe % 1) * 100);
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

function formatRecordedTime(seconds) {
  return Number.isFinite(seconds) ? formatTime(seconds) : 'Not recorded';
}

function formatCompletionDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not recorded';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
}

function unrankedChronicleCopy(chronicle) {
  const provenance = chronicle?.metrics.provenance || 'unknown';
  if (provenance.startsWith('historic-')) return {
    title: 'Historic path',
    note: 'Historic completion · duel and full-stage statistics were not recorded by the earlier save format.',
  };
  if (provenance.startsWith('partial-migration-')) return {
    title: 'Partial record',
    note: 'This journey began in an earlier save format, so a complete performance rank would not be truthful.',
  };
  return {
    title: 'Statistics incomplete',
    note: 'This completion is safe, but some live-run statistics are incomplete. No performance rank was awarded.',
  };
}

function getBrowserStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function TouchButton({ action, label, className = '', engineRef }) {
  const assistiveReleaseRef = useRef(null);
  const lastKeyboardRef = useRef(0);
  const set = (active, event) => {
    event?.preventDefault();
    if (active && event?.pointerId !== undefined) {
      try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* synthetic and cancelled pointers need no capture */ }
    }
    engineRef.current?.setInput(action, active);
  };
  useEffect(() => () => window.clearTimeout(assistiveReleaseRef.current), []);
  const keyboard = (active, event) => {
    if (!['Enter', ' '].includes(event.key)) return;
    event.stopPropagation();
    lastKeyboardRef.current = Date.now();
    set(active, event);
  };
  const assistiveClick = (event) => {
    if (event.detail !== 0 || Date.now() - lastKeyboardRef.current < 300) return;
    set(true, event);
    window.clearTimeout(assistiveReleaseRef.current);
    assistiveReleaseRef.current = window.setTimeout(() => engineRef.current?.setInput(action, false), 130);
  };
  return (
    <button
      type="button"
      className={`touch-button ${className}`}
      aria-label={label}
      onPointerDown={(event) => set(true, event)}
      onPointerUp={(event) => set(false, event)}
      onPointerCancel={(event) => set(false, event)}
      onLostPointerCapture={(event) => set(false, event)}
      onKeyDown={(event) => keyboard(true, event)}
      onKeyUp={(event) => keyboard(false, event)}
      onBlur={(event) => set(false, event)}
      onClick={assistiveClick}
    >{label}</button>
  );
}

function AudioControls({ settings, onToggleMute, onMusicVolume, onEffectsVolume, compact = false }) {
  const musicPercent = Math.round(settings.musicVolume * 100);
  const effectsPercent = Math.round(settings.effectsVolume * 100);
  return (
    <section className={`audio-controls${compact ? ' audio-controls-compact' : ''}`} aria-label="Audio settings">
      <div className="audio-controls-heading">
        <span>Soundscape</span>
        <button className="audio-mute" type="button" onClick={onToggleMute} aria-label="Mute all audio" aria-pressed={settings.muted}>
          {settings.muted ? 'Unmute' : 'Mute all'}
        </button>
      </div>
      <label>
        <span>Music <output>{musicPercent}%</output></span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.musicVolume}
          onInput={(event) => onMusicVolume(Number(event.currentTarget.value))}
          aria-label="Music volume"
        />
      </label>
      <label>
        <span>Effects <output>{effectsPercent}%</output></span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.effectsVolume}
          onInput={(event) => onEffectsVolume(Number(event.currentTarget.value))}
          aria-label="Effects volume"
        />
      </label>
    </section>
  );
}

function PresentationPanel({ card, className = '' }) {
  if (!card) return null;
  return (
    <div
      key={`${card.sequenceId}-${card.sequenceIndex}-${card.kind}`}
      className={`chapter-card presentation-card presentation-${card.kind}${className ? ` ${className}` : ''}`}
      data-presentation-kind={card.kind}
      aria-live="polite"
      role="status"
      style={{ '--presentation-duration': `${card.durationMs}ms` }}
    >
      {card.portraitPath && (
        <img
          className="chapter-portrait"
          src={`${import.meta.env.BASE_URL}${card.portraitPath}`}
          alt={card.portraitAlt}
        />
      )}
      <div className="chapter-rule" />
      <div className="chapter-kicker">{card.kicker}</div>
      <div className="chapter-title">{card.title}</div>
      {card.subtitle && <div className="chapter-subtitle">{card.subtitle}</div>}
      {card.detail && <div className="chapter-story">{card.detail}</div>}
      {card.input && (
        <div className="presentation-input">
          <span>{card.inputLabel}</span>{card.input}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const canvasRef = useRef(null);
  const titlePrimaryRef = useRef(null);
  const chronicleHeadingRef = useRef(null);
  const overlayHeadingRef = useRef(null);
  const engineRef = useRef(null);
  const resourcesRef = useRef(null);
  const saveRef = useRef(null);
  const runCheckpointRef = useRef(() => {});
  const [screen, setScreen] = useState('boot');
  const [ready, setReady] = useState(false);
  const [bootLabel, setBootLabel] = useState('Loading the veil');
  const [progress, setProgress] = useState(0);
  const [hint, setHint] = useState('');
  const [hintVisible, setHintVisible] = useState(false);
  const [guidanceSettings, setGuidanceSettings] = useState(() => (
    loadGuidanceSettings({ storage: getBrowserStorage() }).settings || DEFAULT_GUIDANCE_SETTINGS
  ));
  const [audioSettings, setAudioSettings] = useState(DEFAULT_AUDIO_SETTINGS);
  const [bestTime, setBestTime] = useState(null);
  const [saveWarning, setSaveWarning] = useState('');
  const [sessionKind, setSessionKind] = useState('prototype-campaign');
  const [previewPresentation, setPreviewPresentation] = useState(null);
  const [outerProgress, setOuterProgress] = useState(null);
  const [v4Progress, setV4Progress] = useState(null);
  const [v4LatestScore, setV4LatestScore] = useState(null);
  const [localTopTen, setLocalTopTen] = useState([]);
  const [globalTopTen, setGlobalTopTen] = useState([]);
  const [globalHall, setGlobalHall] = useState(() => globalLeaderboardStatus());
  const [results, setResults] = useState({ time: 0, deaths: 0, targetTime: null });
  const [chronicle, setChronicle] = useState(null);
  const [chronicleView, setChronicleView] = useState('name');
  const [chronicleName, setChronicleName] = useState('');
  const [chronicleNameError, setChronicleNameError] = useState('');
  const [presentationCard, setPresentationCard] = useState(null);
  const presentationTimerRef = useRef(null);
  const presentationGenerationRef = useRef(0);
  const hintVisibilityTimerRef = useRef(null);
  const cinematicSessionRef = useRef(null);
  const cinematicGenerationRef = useRef(0);
  const dismissPresentationRef = useRef(null);
  const finishLevelTransitionRef = useRef(null);
  const levelTransitionRef = useRef(null);
  const levelTransitionTimerRef = useRef(null);
  const [cinematicSession, setCinematicSession] = useState(null);
  const [levelTransition, setLevelTransition] = useState(null);
  const [hud, setHud] = useState({ hp: 4, maxHp: 4, relics: 0, objectiveLabel: 'RELICS', objectiveCurrent: 0, objectiveTarget: 3, objectiveProgressText: null, time: 0, level: 1, levelName: 'The Outer Veil', demo: false, bossHp: null, bossMaxHp: null, bossLabel: 'VEILED GUARDIAN', wardenFightActive: false, bossPhase: null, bossAction: null, bossGuard: null, bossGuardMax: null, playerCombo: 0, playerGuard: null, playerGuardMax: null });

  useEffect(() => () => {
    cinematicSessionRef.current?.isolation.restore();
    cinematicSessionRef.current = null;
    window.clearTimeout(hintVisibilityTimerRef.current);
    window.clearTimeout(levelTransitionTimerRef.current);
  }, []);

  useEffect(() => {
    window.clearTimeout(hintVisibilityTimerRef.current);
    const essential = isEssentialGuidance(hint);
    if (!hint || (guidanceSettings.mode === 'off' && !essential)) {
      setHintVisible(false);
      return undefined;
    }
    setHintVisible(true);
    if (guidanceSettings.mode === 'on') return undefined;
    hintVisibilityTimerRef.current = window.setTimeout(
      () => setHintVisible(false),
      essential ? 2800 : 4200,
    );
    return () => window.clearTimeout(hintVisibilityTimerRef.current);
  }, [hint, guidanceSettings.mode]);

  useEffect(() => {
    if (screen === 'win') chronicleHeadingRef.current?.focus({ preventScroll: true });
    if (screen === 'title' && ready) titlePrimaryRef.current?.focus({ preventScroll: true });
    if (['help', 'pause', 'dead', 'load-error', 'realm-slot', 'leaderboard'].includes(screen)) {
      overlayHeadingRef.current?.focus({ preventScroll: true });
    }
  }, [screen, chronicleView, ready]);

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
        if (route.kind === 'v4-campaign') {
          const { save } = loadV4Save({ storage: getBrowserStorage() });
          saveRef.current = save;
          setV4Progress(save.progress);
          setLocalTopTen(getV4LocalTopTen(save));
        } else {
          const { save } = loadCampaignSave({ storage: getBrowserStorage() });
          saveRef.current = save;
          if (route.kind === 'production-campaign') {
            setOuterProgress(save.progress);
            setBestTime(save.records.realmsByKey?.['outer-veil']?.bestTimeSeconds ?? null);
          } else setBestTime(save.records.legacyPrototype?.bestTimeSeconds ?? null);
        }
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
        : route.kind === 'v4-campaign'
          ? createV4CampaignRepository()
        : route.kind === 'production-campaign'
          ? createOuterVeilCampaignRepository()
          : new AuthoredLevelRepository();
      if (!repository) throw new Error('The requested production preview is not available.');
      await repository.loadTemplate(0);
      if (cancelled) return;
      const firstLevel = repository.createRuntime(0);
      if (preview) await ensureCombatVisualAssets(loaded, firstLevel.levelKey);
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
    const params = new URLSearchParams(window.location.search);
    const demoLevel = Number(params.get('demoLevel'));
    const localV4LevelDemo = import.meta.env.DEV
      && activeSessionKind === 'v4-campaign'
      && params.has('demoLevel')
      && Number.isInteger(demoLevel);
    const manualLevelDemo = localV4LevelDemo && params.get('manual') === '1';
    let demoRespawnTimer;
    let runCheckpointTimer;
    const clearPresentation = ({ hide = true } = {}) => {
      presentationGenerationRef.current += 1;
      window.clearTimeout(presentationTimerRef.current);
      presentationTimerRef.current = null;
      dismissPresentationRef.current = null;
      if (hide) setPresentationCard(null);
    };
    const revealPreparedLevel = () => {
      const transition = levelTransitionRef.current;
      if (!transition?.ready) return false;
      window.clearTimeout(levelTransitionTimerRef.current);
      levelTransitionTimerRef.current = null;
      levelTransitionRef.current = null;
      finishLevelTransitionRef.current = null;
      setLevelTransition(null);
      engine.pause(false, { silent: true });
      setScreen('play');
      window.requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
      return true;
    };
    const beginLevelTransition = ({
      campaignOrder,
      nextCampaignOrder,
      nextLevelKey,
      totalLevels,
      proceed,
    }) => {
      const nextEntry = repository.entryAt?.(nextCampaignOrder - 1) || null;
      const authoredNextEntry = repository.peekTemplate?.(nextCampaignOrder - 1) || nextEntry;
      const presentation = buildLevelTransitionPresentation(authoredNextEntry, {
        completedLevel: campaignOrder,
        nextLevel: nextCampaignOrder,
        totalLevels,
        nextLevelKey,
      });
      const transition = {
        id: `${nextLevelKey || nextCampaignOrder}-${Date.now()}`,
        ...presentation,
        ready: false,
        minimumVisibleUntil: performance.now() + 4200,
      };
      clearPresentation();
      window.clearTimeout(levelTransitionTimerRef.current);
      levelTransitionRef.current = transition;
      finishLevelTransitionRef.current = revealPreparedLevel;
      setLevelTransition(transition);
      setScreen('level-transition');
      void proceed().then((opened) => {
        if (!opened && levelTransitionRef.current?.id === transition.id) {
          levelTransitionRef.current = null;
          finishLevelTransitionRef.current = null;
          setLevelTransition(null);
        }
      });
      return true;
    };
    const announceLevel = (entry) => {
      void ensureCombatVisualAssets(assets, entry.levelKey);
      const entryIndex = Number.isInteger(entry.level) ? entry.level - 1 : -1;
      if (entryIndex >= 0 && entryIndex + 1 < repository.length) {
        void ensureCombatVisualAssets(assets, repository.keyAt(entryIndex + 1));
      }
      clearPresentation();
      const pendingTransition = levelTransitionRef.current;
      if (pendingTransition?.nextLevelKey === entry.levelKey) {
        engine.pause(true, { silent: true });
        const readyTransition = {
          ...pendingTransition,
          ...buildLevelTransitionPresentation(entry, pendingTransition),
          ready: true,
        };
        levelTransitionRef.current = readyTransition;
        setLevelTransition(readyTransition);
        const remaining = Math.max(0, pendingTransition.minimumVisibleUntil - performance.now());
        levelTransitionTimerRef.current = window.setTimeout(revealPreparedLevel, remaining);
        return;
      }
      const cards = buildLevelPresentation(entry, {
        productionCampaign: activeSessionKind === 'production-campaign' || activeSessionKind === 'v4-campaign',
        inputMode: detectPresentationInput(window),
        campaignTotal: activeSessionKind === 'v4-campaign' ? 20 : 10,
        realmLabel: activeSessionKind === 'v4-campaign'
          ? entry.level <= 10 ? 'Chapter I · Outer Veil' : 'Chapter II · Inner Kingdom'
          : activeSessionKind === 'production-campaign' ? 'Realm I' : null,
        unitLabel: activeSessionKind === 'v4-campaign' ? 'Level' : 'Chapter',
      });
      if (cards.length === 0) return;
      engine.pause(true, { silent: true });
      setScreen('level-intro');
      const generation = presentationGenerationRef.current;
      const finish = () => {
        if (presentationGenerationRef.current !== generation) return false;
        presentationGenerationRef.current += 1;
        window.clearTimeout(presentationTimerRef.current);
        presentationTimerRef.current = null;
        dismissPresentationRef.current = null;
        setPresentationCard(null);
        engine.pause(false, { silent: true });
        setScreen('play');
        window.requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
        return true;
      };
      dismissPresentationRef.current = finish;
      const show = (index) => {
        if (presentationGenerationRef.current !== generation) return;
        const card = cards[index] || null;
        setPresentationCard(card ? { ...card, sequenceId: generation, sequenceIndex: index } : null);
        if (!card) {
          presentationTimerRef.current = null;
          finish();
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
        runCheckpointRef.current();
        setScreen((current) => {
          const paused = current !== 'pause';
          engine.pause(paused);
          return paused ? 'pause' : 'play';
        });
      },
      mode: (mode) => {
        if (levelTransitionRef.current && ['loading', 'play'].includes(mode)) return;
        if (mode === 'load-error') {
          window.clearTimeout(levelTransitionTimerRef.current);
          levelTransitionTimerRef.current = null;
          levelTransitionRef.current = null;
          finishLevelTransitionRef.current = null;
          setLevelTransition(null);
        }
        if (mode !== 'play') clearPresentation();
        setScreen(mode);
      },
      death: ({ deaths, levelDeaths, levelTime, levelKey, wardenStats, demo }) => {
        clearPresentation();
        setResults((current) => ({ ...current, deaths }));
        if (!demo
          && !localV4LevelDemo
          && (activeSessionKind === 'production-campaign' || activeSessionKind === 'v4-campaign')
          && levelKey) {
          const updated = activeSessionKind === 'v4-campaign'
            ? recordV4RunCheckpoint(saveRef.current, { levelKey, levelTime, levelDeaths, wardenStats })
            : recordStageOneRunCheckpoint(saveRef.current, {
            levelKey, levelTime, levelDeaths, wardenStats,
          });
          if (updated) {
            const persisted = activeSessionKind === 'v4-campaign'
              ? persistV4Save({ storage: getBrowserStorage(), save: updated })
              : persistCampaignSave({ storage: getBrowserStorage(), save: updated });
            saveRef.current = persisted.save || updated;
            setSaveWarning(persisted.persisted ? '' : 'Run statistics are held for this session only · browser storage is unavailable.');
          }
        }
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
        levelDeaths,
        completionStats,
        realmComplete,
      }) => {
        if (localV4LevelDemo || engine.demo) return;
        if (shouldPersistV4Progress({ sessionKind: completedSessionKind, campaignId })) {
          const completedAt = new Date().toISOString();
          const currentSave = saveRef.current || loadV4Save({ storage: getBrowserStorage() }).save;
          const updated = recordV4LevelCompletion(currentSave, {
            levelKey, levelTime, levelDeaths, completionStats, completedAt,
          });
          if (!updated) return;
          const result = persistV4Save({ storage: getBrowserStorage(), save: updated });
          saveRef.current = result.save || updated;
          setV4Progress(saveRef.current.progress);
          setLocalTopTen(getV4LocalTopTen(saveRef.current));
          if (realmComplete) {
            setChronicleName(saveRef.current.playerName || '');
            setChronicleNameError('');
            setChronicleView('name');
          }
          setSaveWarning(result.persisted ? '' : 'Progress is held for this session only · browser storage is unavailable.');
          return;
        }
        if (!shouldPersistProductionProgress({ sessionKind: completedSessionKind, campaignId })) return;
        const completedAt = new Date().toISOString();
        const currentSave = saveRef.current || loadCampaignSave({ storage: getBrowserStorage() }).save;
        const updated = recordProductionLevelCompletion(currentSave, {
          levelKey,
          levelTime,
          levelDeaths,
          completionStats,
          completedAt,
        });
        if (!updated) return;
        const result = persistCampaignSave({ storage: getBrowserStorage(), save: updated });
        saveRef.current = result.save || updated;
        setOuterProgress(saveRef.current.progress);
        setBestTime(saveRef.current.records.realmsByKey?.['outer-veil']?.bestTimeSeconds ?? null);
        if (realmComplete) {
          const nextChronicle = getStageOneChronicle(saveRef.current);
          setChronicle(nextChronicle);
          setChronicleName(nextChronicle?.playerName || '');
          setChronicleView(nextChronicle?.playerName ? 'chronicle' : 'name');
        }
        setSaveWarning(result.persisted ? '' : 'Progress is held for this session only · browser storage is unavailable.');
      },
      beforeLevelTransition: ({
        sessionKind: transitioningSessionKind,
        campaignOrder,
        nextLevelKey,
        nextCampaignOrder,
        proceed,
      }) => {
        if (!['production-campaign', 'v4-campaign'].includes(transitioningSessionKind)
          || (localV4LevelDemo && !manualLevelDemo)) return false;
        const transition = {
          campaignOrder,
          nextLevelKey,
          nextCampaignOrder,
          totalLevels: transitioningSessionKind === 'v4-campaign' ? 20 : 10,
          proceed,
        };
        if (transitioningSessionKind === 'v4-campaign'
          && campaignOrder === 10
          && nextCampaignOrder === 11) {
          return openCinematicSequence('chapter-one-to-two-bridge', {
            returnScreen: 'play',
            after: () => beginLevelTransition(transition),
          });
        }
        return beginLevelTransition(transition);
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
        if (completedSessionKind === 'production-campaign') {
          const nextChronicle = getStageOneChronicle(saveRef.current);
          setChronicle(nextChronicle);
          setChronicleName(nextChronicle?.playerName || '');
          setChronicleNameError('');
          setChronicleView(nextChronicle?.playerName ? 'chronicle' : 'name');
        }
        if (completedSessionKind === 'v4-campaign') {
          setChronicleName(saveRef.current?.playerName || '');
          setChronicleNameError('');
          setChronicleView('name');
          if ((!localV4LevelDemo || manualLevelDemo)
            && openCinematicSequence('chapter-two-to-three-bridge', {
              returnScreen: 'win',
              after: () => setScreen('win'),
            })) return;
        }
        setScreen('win');
      },
      transition: (level, name) => {
        if (activeSessionKind !== 'production-campaign' && activeSessionKind !== 'v4-campaign') {
          setHint(`LEVEL ${level} · ${name.toUpperCase()}`);
        }
      },
      audioSettings: setAudioSettings,
    }, repository);
    engineRef.current = engine;
    const persistRunCheckpoint = () => {
      if (!['production-campaign', 'v4-campaign'].includes(activeSessionKind)
        || localV4LevelDemo
        || engine.demo
        || (engine.mode !== 'play' && engine.mode !== 'paused')) return;
      const snapshot = engine.snapshot();
      const previous = activeSessionKind === 'v4-campaign'
        ? getV4RunCheckpoint(saveRef.current, snapshot.levelKey)
        : getStageOneRunCheckpoint(saveRef.current, snapshot.levelKey);
      const wardenStats = snapshot.warden ? {
        attempts: snapshot.warden.duelAttempts,
        damageTaken: snapshot.warden.duelDamageTaken,
        combatTimeSeconds: snapshot.warden.duelTotalSeconds,
      } : null;
      if (previous
        && previous.timeSeconds >= snapshot.levelTime
        && previous.deaths >= snapshot.levelDeaths
        && (!wardenStats || (previous.warden?.attempts >= wardenStats.attempts
          && previous.warden?.damageTaken >= wardenStats.damageTaken
          && previous.warden?.combatTimeSeconds >= wardenStats.combatTimeSeconds))) return;
      const checkpointInput = {
        levelKey: snapshot.levelKey, levelTime: snapshot.levelTime,
        levelDeaths: snapshot.levelDeaths, wardenStats,
      };
      const updated = activeSessionKind === 'v4-campaign'
        ? recordV4RunCheckpoint(saveRef.current, checkpointInput)
        : recordStageOneRunCheckpoint(saveRef.current, checkpointInput);
      if (!updated) return;
      const persisted = activeSessionKind === 'v4-campaign'
        ? persistV4Save({ storage: getBrowserStorage(), save: updated })
        : persistCampaignSave({ storage: getBrowserStorage(), save: updated });
      saveRef.current = persisted.save || updated;
      if (!persisted.persisted) setSaveWarning('Run statistics are held for this session only · browser storage is unavailable.');
    };
    runCheckpointRef.current = persistRunCheckpoint;
    const persistHiddenRun = () => { if (document.visibilityState === 'hidden') persistRunCheckpoint(); };
    runCheckpointTimer = window.setInterval(persistRunCheckpoint, 5000);
    document.addEventListener('visibilitychange', persistHiddenRun);
    window.addEventListener('pagehide', persistRunCheckpoint);
    setAudioSettings(engine.getAudioSettings());
    const prepareRequestedSession = async () => {
      if (activeSessionKind === 'production-preview') {
        engine.start(false);
        const localProductionBenchmark = !import.meta.env.DEV
          && ['127.0.0.1', 'localhost'].includes(window.location.hostname);
        if (localProductionBenchmark && params.get('benchmarkFight') === '1'
          && engine.level.objective?.type === 'warden-restoration') {
          const objective = engine.level.objective;
          objective.phase = 'unbind';
          objective.breath.firstBreathComplete = true;
          objective.memorySeam.revealed = true;
          objective.heartstone.bound = true;
          objective.heartstone.locked = true;
          objective.rememberedHand.raised = true;
          objective.rememberedHand.reached = true;
          objective.bridle.exposed = true;
          objective.bridle.struck = true;
          engine.level.block.bound = true;
          if (engine.beginWardenDuel()) clearPresentation();
        }
        setScreen('play');
      } else if (import.meta.env.DEV) {
        if (params.get('demoBoss') === '1') {
          await engine.startAt(9, { demo: true });
          if (!engine.running || engine.levelIndex !== 9) return;
          engine.level.relics.forEach((relic) => { relic.collected = true; });
          engine.openGate();
          engine.player.x = 62 * TILE;
          engine.player.y = 24 * TILE - engine.player.h;
          engine.level.boss.active = true;
          engine.pushHud(true);
          setScreen('play');
        } else if (
          Number.isInteger(demoLevel) &&
          demoLevel >= 1 &&
          demoLevel <= (activeSessionKind === 'v4-campaign' ? repository.length : 10)
        ) {
          await ensureCombatVisualAssets(assets, repository.keyAt(demoLevel - 1));
          await engine.startAt(demoLevel - 1, { demo: !manualLevelDemo });
          if (engine.running) setScreen('play');
        }
      }
    };
    void prepareRequestedSession().catch((error) => console.error('Could not prepare requested session', error));
    return () => {
      clearPresentation({ hide: false });
      window.clearTimeout(demoRespawnTimer);
      window.clearInterval(runCheckpointTimer);
      window.clearTimeout(levelTransitionTimerRef.current);
      levelTransitionTimerRef.current = null;
      levelTransitionRef.current = null;
      finishLevelTransitionRef.current = null;
      dismissPresentationRef.current = null;
      document.removeEventListener('visibilitychange', persistHiddenRun);
      window.removeEventListener('pagehide', persistRunCheckpoint);
      runCheckpointRef.current = () => {};
      engine.destroy();
      engineRef.current = null;
    };
  }, [ready]);

  const start = (demo = false) => {
    setSaveWarning('');
    engineRef.current?.start(demo);
  };

  const setGuidanceMode = (mode) => {
    const result = persistGuidanceSettings({
      storage: getBrowserStorage(),
      settings: { ...guidanceSettings, mode },
    });
    setGuidanceSettings(result.settings);
  };

  const showCurrentHint = () => {
    if (!hint) return;
    window.clearTimeout(hintVisibilityTimerRef.current);
    setHintVisible(true);
    if (guidanceSettings.mode !== 'on') {
      hintVisibilityTimerRef.current = window.setTimeout(() => setHintVisible(false), 5000);
    }
  };

  const startOuterVeilAt = async (index, { restartCompletedV4 = true } = {}) => {
    setSaveWarning('');
    if (restartCompletedV4 && v4Campaign && index === 0
      && saveRef.current?.progress.completedLevelKeys?.length === V4_LEVEL_KEYS.length) {
      const restarted = beginNewV4Run(saveRef.current);
      if (restarted) {
        const persisted = persistV4Save({ storage: getBrowserStorage(), save: restarted });
        saveRef.current = persisted.save || restarted;
        setV4Progress(saveRef.current.progress);
        setSaveWarning(persisted.persisted ? '' : 'Replay progress is held for this session only · browser storage is unavailable.');
      }
    }
    if (productionCampaign && index === 0
      && saveRef.current?.progress.completedRealmKeys?.includes('outer-veil')) {
      const restarted = beginStageOneRun(saveRef.current);
      if (restarted) {
        const persisted = persistCampaignSave({ storage: getBrowserStorage(), save: restarted });
        saveRef.current = persisted.save || restarted;
        setOuterProgress(saveRef.current.progress);
        setSaveWarning(persisted.persisted ? '' : 'Replay progress is held for this session only · browser storage is unavailable.');
      }
    }
    setScreen(index === 0 ? 'play' : 'loading');
    const activeResources = resourcesRef.current;
    if (activeResources?.repository && activeResources?.assets) {
      await ensureCombatVisualAssets(activeResources.assets, activeResources.repository.keyAt(index));
    }
    const opened = await engineRef.current?.startAt(index, { demo: false });
    if (opened) {
      const levelKey = engineRef.current?.level?.levelKey;
      const checkpoint = v4Campaign
        ? getV4RunCheckpoint(saveRef.current, levelKey)
        : getStageOneRunCheckpoint(saveRef.current, levelKey);
      if (checkpoint) engineRef.current?.restoreLevelRunStats({
        levelTime: checkpoint.timeSeconds,
        levelDeaths: checkpoint.deaths,
        wardenStats: checkpoint.warden,
      });
    }
  };

  const continueOuterVeil = () => {
    const target = v4Campaign
      ? getV4ContinueTarget(saveRef.current)
      : getOuterVeilContinueTarget(saveRef.current);
    if (target.kind === 'complete') {
      void openV4Leaderboard();
      return;
    }
    if (target.kind === 'realm-slot') {
      setScreen('realm-slot');
      return;
    }
    void startOuterVeilAt(target.campaignOrder - 1);
  };

  const viewStageOneChronicle = () => {
    const nextChronicle = getStageOneChronicle(saveRef.current);
    setChronicle(nextChronicle);
    setChronicleName(nextChronicle?.playerName || '');
    setChronicleNameError('');
    setChronicleView(nextChronicle?.playerName ? 'chronicle' : 'name');
    setScreen('win');
  };

  const rememberChronicleName = (event) => {
    event.preventDefault();
    if (v4Campaign) {
      const recorded = recordV4PlayerNameAndScore(saveRef.current, { name: chronicleName });
      if (!recorded.save) {
        setChronicleNameError(recorded.validation?.valid
          ? 'This journey has no pending Chronicle result to record.'
          : recorded.validation?.message || 'Enter a name or nickname.');
        return;
      }
      const persisted = persistV4Save({ storage: getBrowserStorage(), save: recorded.save });
      saveRef.current = persisted.save || recorded.save;
      setChronicleName(recorded.validation.name);
      setChronicleNameError('');
      setChronicleView('chronicle');
      setV4LatestScore(recorded.score);
      setLocalTopTen(getV4LocalTopTen(saveRef.current));
      setSaveWarning(recorded.score
        ? persisted.persisted ? '' : 'The result is held for this session only · browser storage is unavailable.'
        : 'Name remembered, but this migrated journey lacks complete timing evidence and is not ranked.');
      if (recorded.score) {
        void submitGlobalV4Score(recorded.score).then((submission) => {
          setGlobalHall(submission.status === 'accepted'
            ? { configured: true, message: submission.position ? `Global Hall position · #${submission.position}` : 'Score accepted by the Global Hall' }
            : { configured: submission.status !== 'disabled', message: submission.message });
          return fetchGlobalTopTen();
        }).then((hall) => {
          if (hall.status === 'ready') setGlobalTopTen(hall.scores);
        });
      }
      return;
    }
    const recorded = recordStageOnePlayerName(saveRef.current, { name: chronicleName });
    if (!recorded.save) {
      setChronicleNameError(recorded.validation?.message || 'Enter a name or nickname.');
      return;
    }
    const persisted = persistCampaignSave({ storage: getBrowserStorage(), save: recorded.save });
    saveRef.current = persisted.save || recorded.save;
    setChronicle(getStageOneChronicle(saveRef.current));
    setChronicleName(recorded.validation.name);
    setChronicleNameError('');
    setChronicleView('chronicle');
    setSaveWarning(persisted.persisted ? '' : 'The Chronicle is held for this session only · browser storage is unavailable.');
  };

  const openV4Leaderboard = async () => {
    setLocalTopTen(getV4LocalTopTen(saveRef.current));
    setScreen('leaderboard');
    const hall = await fetchGlobalTopTen();
    setGlobalHall({ configured: hall.status !== 'disabled', message: hall.message || 'Global Hall connected' });
    if (hall.status === 'ready') setGlobalTopTen(hall.scores);
  };

  const resume = () => {
    engineRef.current?.pause(false);
    setScreen('play');
  };

  const returnToTitle = () => {
    runCheckpointRef.current();
    presentationGenerationRef.current += 1;
    window.clearTimeout(presentationTimerRef.current);
    presentationTimerRef.current = null;
    setPresentationCard(null);
    engineRef.current?.returnToTitle();
    setScreen('title');
  };

  const toggleMute = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.toggleMute();
    setAudioSettings(engine.getAudioSettings());
  };
  const setMusicVolume = (value) => {
    const next = engineRef.current?.setMusicVolume(value);
    if (next) setAudioSettings(next);
  };
  const setEffectsVolume = (value) => {
    const next = engineRef.current?.setEffectsVolume(value);
    if (next) setAudioSettings(next);
  };
  const productionCampaign = sessionKind === 'production-campaign';
  const v4Campaign = sessionKind === 'v4-campaign';
  const authoredCampaign = productionCampaign || v4Campaign;
  const activeRouteParams = new URLSearchParams(window.location.search);
  const requestedPlaytestLevel = Number(activeRouteParams.get('demoLevel'));
  const localV4LevelPlaytest = import.meta.env.DEV
    && v4Campaign
    && activeRouteParams.has('demoLevel')
    && Number.isInteger(requestedPlaytestLevel)
    && requestedPlaytestLevel >= 1
    && requestedPlaytestLevel <= V4_LEVEL_KEYS.length;
  const outerContinueTarget = authoredCampaign && saveRef.current
    ? v4Campaign ? getV4ContinueTarget(saveRef.current) : getOuterVeilContinueTarget(saveRef.current)
    : null;
  const v4ChapterOneTarget = v4Campaign ? getV4ChapterTarget(saveRef.current, 1) : null;
  const v4ChapterTwoTarget = v4Campaign ? getV4ChapterTarget(saveRef.current, 2) : null;
  const v4CompletedCount = v4Progress?.completedLevelKeys?.length || 0;
  const v4CurrentEntry = v4Campaign && outerContinueTarget?.kind === 'level'
    ? V4_CAMPAIGN_CATALOG[outerContinueTarget.campaignOrder - 1]
    : null;

  const completeCinematicSession = (detail) => {
    const session = cinematicSessionRef.current;
    if (!session || session.finished) return false;
    session.finished = true;
    cinematicSessionRef.current = null;
    session.isolation.restore();
    setCinematicSession(null);
    if (session.after) {
      void Promise.resolve(session.after(detail)).catch((error) => {
        console.error('Could not continue after cinematic', error);
        setScreen(session.returnScreen);
      });
    } else setScreen(session.returnScreen);
    return true;
  };

  const openCinematicSequence = (sequenceId, { returnScreen = screen, after = null } = {}) => {
    const sequence = getCinematicSequence(sequenceId, { baseUrl: import.meta.env.BASE_URL });
    if (!sequence?.length || cinematicSessionRef.current) return false;
    if (engineRef.current?.mode === 'play') runCheckpointRef.current();
    presentationGenerationRef.current += 1;
    window.clearTimeout(presentationTimerRef.current);
    presentationTimerRef.current = null;
    setPresentationCard(null);
    const session = {
      id: `${sequenceId}-${++cinematicGenerationRef.current}`,
      sequenceId,
      sequence,
      returnScreen,
      after,
      finished: false,
      isolation: isolateGameForCinematic(engineRef.current),
    };
    cinematicSessionRef.current = session;
    setCinematicSession({ id: session.id, sequenceId, sequence });
    setScreen('cinematic');
    return true;
  };

  const beginChapterOne = () => {
    const startChapter = () => startOuterVeilAt(
      v4ChapterOneTarget.campaignOrder - 1,
      { restartCompletedV4: false },
    );
    if (!openCinematicSequence('chapter-one-opening', { returnScreen: 'title', after: startChapter })) {
      void startChapter();
    }
  };

  const enterV4Journey = () => {
    if (v4CompletedCount === 0) beginChapterOne();
    else continueOuterVeil();
  };

  return (
    <main
      className="app"
      aria-label="Eclipse of the Veiled Kingdom"
      style={{ '--title-art': `url("${ASSET_URLS.title}")` }}
    >
      <div className="game-stage" aria-hidden={screen !== 'play'}>
        <canvas ref={canvasRef} className="game-canvas" width={VIEW_W} height={VIEW_H} tabIndex={screen === 'play' ? 0 : -1} aria-label="Game world" aria-describedby="game-status" />
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
        <section className={`title-screen${v4Campaign ? ' title-screen-v5' : ''}`}>
          <div className="title-layout">
            <div className={`title-content${v4Campaign ? ' title-content-v5' : ''}`}>
              {v4Campaign ? (
                <>
                  <div className="title-brand">
                    <div className="eyebrow">{V5_LAUNCH_PRESENTATION.releaseLabel}</div>
                    <h1>Eclipse <span>of the Veiled Kingdom</span></h1>
                    <p className="title-subtitle">Restore the Outer Veil. Recover the kingdom’s missing names. Open the second Crown Path.</p>
                  </div>
                  <div className="title-command-deck">
                    <div className="title-journey-status">
                      <span>{v4CompletedCount >= 20 ? 'Story One · Chapters I–II restored' : `Current journey · ${v4CompletedCount} of 20 restored`}</span>
                      <div className="title-progress-track" aria-hidden="true"><i style={{ width: `${(v4CompletedCount / 20) * 100}%` }} /></div>
                    </div>
                    <button
                      ref={titlePrimaryRef}
                      className="primary title-enter"
                      disabled={progress < 1}
                      onClick={enterV4Journey}
                    >
                      <span>{v4CompletedCount >= 20 ? 'View Chronicle' : v4CompletedCount === 0 ? 'Begin Story' : 'Continue Journey'}</span>
                      <small>{v4CompletedCount >= 20
                        ? 'Your restored path awaits'
                        : `Level ${String(outerContinueTarget?.campaignOrder || 1).padStart(2, '0')} · ${v4CurrentEntry?.title || 'Buried Dawn'}`}</small>
                    </button>
                    <div className="title-chapters" aria-label="Chapter selection">
                      <button className={v4CompletedCount < 10 ? 'active' : ''} disabled={progress < 1} onClick={beginChapterOne}>
                        <span>Chapter I</span><small>The Outer Veil</small>
                      </button>
                      <button
                        className={v4CompletedCount >= 10 && v4CompletedCount < 20 ? 'active' : ''}
                        disabled={progress < 1 || !v4ChapterTwoTarget.unlocked}
                        title={v4ChapterTwoTarget.unlocked ? '' : 'Complete Chapter I to unlock'}
                        aria-label={v4ChapterTwoTarget.unlocked ? 'Chapter II · The Inner Kingdom' : 'Chapter II · complete Chapter I to unlock'}
                        onClick={() => { void startOuterVeilAt(v4ChapterTwoTarget.campaignOrder - 1, { restartCompletedV4: false }); }}
                      >
                        <span>Chapter II</span><small>{v4ChapterTwoTarget.unlocked ? 'The Inner Kingdom' : 'Locked'}</small>
                      </button>
                    </div>
                    <div className="title-utility-actions">
                      <button onClick={() => { void openV4Leaderboard(); }}>Chronicle</button>
                      <button onClick={() => openCinematicSequence(
                        v4CompletedCount >= 20 ? 'story-one-films' : 'chapter-one-opening',
                        { returnScreen: 'title' },
                      )}>Story films</button>
                      <button onClick={() => setScreen('help')}>How to play</button>
                    </div>
                    <details className="title-audio-drawer">
                      <summary>Audio settings</summary>
                      <AudioControls
                        compact
                        settings={audioSettings}
                        onToggleMute={toggleMute}
                        onMusicVolume={setMusicVolume}
                        onEffectsVolume={setEffectsVolume}
                      />
                    </details>
                  </div>
                </>
              ) : (
                <>
                  <div className="eyebrow">{productionCampaign ? 'REALM I · THE OUTER VEIL' : 'A kingdom buried · an eclipse awake'}</div>
                  <h1>Eclipse <span>of the Veiled Kingdom</span></h1>
                  <p className="title-subtitle">{authoredCampaign
                    ? 'Ten chapters beneath the first Crown Path. Recover Aren’s buried memory, restore the Veil, and free the guardian without opening the deeper archive.'
                    : 'Cross ten buried realms. Carve living sand, bend ancient mechanisms, break the occupation, and face the Guardian beneath the final eclipse.'}</p>
                  <div className="title-actions">
                    {authoredCampaign ? (
                  <>
                    <button
                      ref={titlePrimaryRef}
                      className="primary"
                      disabled={progress < 1}
                      onClick={outerContinueTarget?.kind === 'realm-slot' ? viewStageOneChronicle : continueOuterVeil}
                    >
                      {outerContinueTarget?.kind === 'complete'
                        ? 'View Top 10'
                        : outerContinueTarget?.kind === 'realm-slot'
                        ? 'View Stage I Chronicle'
                        : outerContinueTarget?.campaignOrder > 1
                          ? `Continue · Chapter ${String(outerContinueTarget.campaignOrder).padStart(2, '0')}`
                          : 'Begin Buried Dawn'}
                    </button>
                    {outerContinueTarget?.campaignOrder > 1 || ['realm-slot', 'complete'].includes(outerContinueTarget?.kind)
                      ? <button className="secondary" onClick={() => { void startOuterVeilAt(0); }}>Replay Stage I</button>
                      : null}
                  </>
                    ) : (
                  <>
                    <button ref={titlePrimaryRef} className="primary" disabled={progress < 1} onClick={() => start(false)}>Enter the ruins</button>
                    <button className="secondary" onClick={() => start(true)}>Watch a run</button>
                  </>
                    )}
                    <button className="secondary" onClick={() => setScreen('help')}>How to play</button>
                  </div>
                  <AudioControls
                    settings={audioSettings}
                    onToggleMute={toggleMute}
                    onMusicVolume={setMusicVolume}
                    onEffectsVolume={setEffectsVolume}
                  />
                  <div className="best-time">{authoredCampaign
                    ? `${outerProgress?.completedLevelKeys?.length || 0}/10 chapters restored${outerContinueTarget?.kind === 'realm-slot' ? ' · Chronicle available' : ''}`
                    : bestTime === null ? 'No journey recorded' : `Best eclipse · ${formatTime(bestTime)}`}</div>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {screen === 'cinematic' && cinematicSession && (
        <CinematicPlayer
          key={cinematicSession.id}
          sequence={cinematicSession.sequence}
          audioSettings={audioSettings}
          onBeforePlay={() => cinematicSessionRef.current?.isolation.refresh()}
          onComplete={completeCinematicSession}
        />
      )}

      {screen === 'level-intro' && presentationCard && (
        <section
          className="level-entry-layer"
          role="dialog"
          aria-modal="true"
          aria-label="Level introduction"
        >
          <div className="level-entry-shade" />
          <PresentationPanel card={presentationCard} className="level-entry-card" />
          <button className="level-entry-skip" type="button" onClick={() => dismissPresentationRef.current?.()}>
            Skip intro
          </button>
        </section>
      )}

      {screen === 'level-transition' && levelTransition && (
        <section
          className="level-transition-layer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="next-level-title"
        >
          <div className="level-transition-complete">Level {String(levelTransition.completedLevel).padStart(2, '0')} restored</div>
          <div className="level-transition-rule" />
          <div className="level-transition-kicker">
            Next · Level {String(levelTransition.nextLevel).padStart(2, '0')} of {levelTransition.totalLevels}
          </div>
          <h2 id="next-level-title">{levelTransition.title}</h2>
          {levelTransition.subtitle && <div className="level-transition-subtitle">{levelTransition.subtitle}</div>}
          {levelTransition.storyLine && <p>{levelTransition.storyLine}</p>}
          <div className="level-transition-objective">
            <span>Objective</span>
            <strong>{levelTransition.objective}</strong>
          </div>
          <div className={`level-transition-status${levelTransition.ready ? ' ready' : ''}`}>
            <i />{levelTransition.ready ? 'Path ready' : 'Forming the next path'}
          </div>
          <button
            className="secondary level-transition-skip"
            type="button"
            disabled={!levelTransition.ready}
            onClick={() => finishLevelTransitionRef.current?.()}
          >
            {levelTransition.ready ? 'Skip intro' : 'Loading'}
          </button>
        </section>
      )}

      {(screen === 'play' || screen === 'pause' || screen === 'dead' || screen === 'win' || screen === 'loading' || screen === 'load-error' || screen === 'level-intro' || screen === 'level-transition') && (
        <>
          <header className={`hud${presentationCard?.kind === 'chapter' ? ' hud-title-suspended' : ''}`} aria-hidden={screen !== 'play'}>
            <div className="hud-left">
              <div>
              <div className="hud-kicker">{sessionKind === 'production-preview'
                ? 'PRODUCTION PREVIEW · '
                : v4Campaign
                  ? hud.level <= 10 ? 'OUTER VEIL · ' : 'INNER KINGDOM · '
                  : productionCampaign ? 'OUTER VEIL · ' : ''}LVL {hud.level}</div>
                <div className="hud-level">{hud.levelName}</div>
              </div>
              <div className="health">
                <div className="health-label"><span>HEALTH</span><span>{hud.hp}/{hud.maxHp}</span></div>
                <div className="health-track" role="progressbar" aria-label="Hero health" aria-valuemin="0" aria-valuemax={hud.maxHp} aria-valuenow={hud.hp}><div className="health-value" style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }} /></div>
                {hud.playerGuard !== null && !hud.wardenFightActive && (
                  <div className="combat-vitals" aria-live="polite">
                    GUARD {hud.playerGuard}/{hud.playerGuardMax}{hud.playerCombo > 0 ? ` · CHAIN ${hud.playerCombo}/3` : ''}
                  </div>
                )}
              </div>
            </div>
            <div className="hud-center">
              <span className="diamond" /><span className="relic-count" aria-live="polite" aria-atomic="true">{hud.objectiveProgressText || `${hud.objectiveLabel} ${hud.objectiveCurrent}/${hud.objectiveTarget}`}</span>
              <span className="timer">{formatTime(hud.time)}</span>
            </div>
            <div className="hud-right">
              <button
                className={`icon-button hint-button${hintVisible ? ' active' : ''}`}
                disabled={screen !== 'play' || !hint}
                aria-label={`Show current hint. Guidance ${guidanceSettings.mode}`}
                title={`Hints: ${guidanceSettings.mode}`}
                onClick={showCurrentHint}
              >?</button>
              <button className="icon-button" disabled={screen !== 'play'} aria-label="Mute all audio" aria-pressed={audioSettings.muted} onClick={toggleMute}>{audioSettings.muted ? '◇' : '◆'}</button>
              <button
                className="icon-button"
                aria-label="Pause"
                disabled={screen !== 'play'}
                onClick={() => { runCheckpointRef.current(); engineRef.current?.pause(true); setScreen('pause'); }}
              >Ⅱ</button>
            </div>
          </header>
          {screen === 'play' && !presentationCard && hintVisible && <div className="context-hint" role="status" aria-live="polite" aria-atomic="true">{hud.demo ? 'DEMO PILGRIM · ' : ''}{hint}</div>}
          {screen === 'play' && (
            <div className="sr-only" id="game-status">
              Level {hud.level}: {hud.levelName}. Hero health {hud.hp} of {hud.maxHp}. Objective: {hud.objectiveProgressText || `${hud.objectiveLabel} ${hud.objectiveCurrent} of ${hud.objectiveTarget}`}.
            </div>
          )}
          {screen === 'play' && presentationCard && (
            <PresentationPanel card={presentationCard} />
          )}
          {screen === 'play' && hud.bossHp !== null && hud.bossHp > 0 && (
            <div className="boss-hud">
              <span className="boss-hud-title">{hud.bossLabel}<small>{hud.bossPhase}</small></span>
              <div role="progressbar" aria-label={`${hud.bossLabel || 'Guardian'} strength`} aria-valuemin="0" aria-valuemax={hud.bossMaxHp} aria-valuenow={hud.bossHp}><i style={{ width: `${(hud.bossHp / hud.bossMaxHp) * 100}%` }} /></div>
              {hud.wardenFightActive && (
                <div className="fighter-readout" aria-live="polite">
                  <span>{`AREN GUARD ${hud.playerGuard}/${hud.playerGuardMax}`}</span>
                  <span>{hud.bossAction === 'guard' ? `WARDEN GUARD ${hud.bossGuard}/${hud.bossGuardMax}` : hud.bossAction?.replace('-', ' ')}</span>
                  <span>{hud.playerCombo > 0 ? `CHAIN ${hud.playerCombo}/3` : 'FREE MOVEMENT'}</span>
                </div>
              )}
            </div>
          )}
          {screen === 'play' && (
            <div className="touch-controls" role="group" aria-label="Touch controls">
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
        <section className="overlay" role="dialog" aria-modal="true" aria-labelledby="help-heading">
          <div className="overlay-card">
            <div className="eyebrow">Scavenger field notes</div>
            <h2 ref={overlayHeadingRef} tabIndex="-1" id="help-heading">How to play</h2>
            <div className="help-grid">
              <div><span>Move</span><kbd>A / D · ← / →</kbd></div>
              <div><span>Jump</span><kbd>SPACE</kbd></div>
              <div><span>Climb wall</span><kbd>W / ↑ + toward</kbd></div>
              <div><span>Guard / late parry</span><kbd>S · ↓</kbd></div>
              <div><span>Heavy guard-break</span><kbd>S / ↓ + Strike</kbd></div>
              <div><span>Aerial attack</span><kbd>Jump + Strike</kbd></div>
              <div><span>Drop through in combat</span><kbd>S / ↓ + Jump</kbd></div>
              <div><span>Drop through elsewhere</span><kbd>S · ↓</kbd></div>
              <div><span>Three-hit Strike chain</span><kbd>J · X</kbd></div>
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
        <section className="overlay" role="dialog" aria-modal="true" aria-labelledby="pause-heading">
          <div className="overlay-card">
            <div className="eyebrow">The veil is still</div>
            <h2 ref={overlayHeadingRef} tabIndex="-1" id="pause-heading">Journey paused</h2>
            <p>Your place in the kingdom is held.</p>
            <AudioControls
              compact
              settings={audioSettings}
              onToggleMute={toggleMute}
              onMusicVolume={setMusicVolume}
              onEffectsVolume={setEffectsVolume}
            />
            <section className="guidance-controls" aria-label="Hint settings">
              <div>
                <strong>Guidance</strong>
                <span>Auto appears briefly when the situation changes. Press ? anytime to recall it.</span>
              </div>
              <div className="guidance-options" role="group" aria-label="Guidance mode">
                {['auto', 'on', 'off'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={guidanceSettings.mode === mode ? 'active' : ''}
                    aria-pressed={guidanceSettings.mode === mode}
                    onClick={() => setGuidanceMode(mode)}
                  >{mode}</button>
                ))}
              </div>
            </section>
            <div className="overlay-actions">
              <button className="primary" onClick={resume}>Continue</button>
              <button className="secondary" onClick={sessionKind === 'production-preview' ? () => { window.location.href = window.location.pathname; } : returnToTitle}>{sessionKind === 'production-preview' ? 'Return to live prototype' : 'Title screen'}</button>
            </div>
          </div>
        </section>
      )}

      {screen === 'dead' && (
        <section className="overlay" role="alertdialog" aria-modal="true" aria-labelledby="death-heading" aria-describedby="death-copy">
          <div className="overlay-card">
            <div className="eyebrow">The kingdom remembers</div>
            <h2 ref={overlayHeadingRef} tabIndex="-1" id="death-heading">You have fallen</h2>
            <p id="death-copy">{hud.wardenFightActive
              ? 'The Warden duel will restart at its sealed arena. Every solved Level 10 vow remains restored.'
              : 'This realm will reform: objectives, hazards, mechanisms, health, and gates return to their starting state.'}</p>
            <div className="overlay-actions">
              <button className="primary" onClick={() => engineRef.current?.respawn()}>{hud.wardenFightActive ? 'Restart Warden duel' : 'Restart realm'}</button>
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
        <section className="overlay" role="alertdialog" aria-modal="true" aria-labelledby="load-error-heading">
          <div className="overlay-card">
            <div className="eyebrow">The veil resisted</div>
            <h2 ref={overlayHeadingRef} tabIndex="-1" id="load-error-heading">The next path could not open</h2>
            <p>Your completed realm is safely frozen. Reload the game to retry the download, or return to the title screen.</p>
            <div className="overlay-actions">
              <button className="primary" onClick={() => window.location.reload()}>Reload game</button>
              <button className="secondary" onClick={returnToTitle}>Title screen</button>
            </div>
          </div>
        </section>
      )}

      {screen === 'win' && (
        <section
          className="overlay chronicle-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="completion-heading"
          aria-describedby="completion-story"
        >
          <div className={`overlay-card${authoredCampaign ? ' chronicle-card' : ''}`}>
            {v4Campaign ? (
              localV4LevelPlaytest ? (
                <>
                  <div className="eyebrow">
                    {requestedPlaytestLevel === V4_LEVEL_KEYS.length
                      ? `LEVEL ${requestedPlaytestLevel} PLAYTEST COMPLETE`
                      : `LEVELS ${requestedPlaytestLevel}–${V4_LEVEL_KEYS.length} PLAYTEST COMPLETE`}
                  </div>
                  <h2 ref={chronicleHeadingRef} tabIndex="-1" id="completion-heading">Combat trial complete</h2>
                  <p id="completion-story">This direct test was kept separate from your twenty-level journey. It did not replace your campaign save or enter the Founders’ Chronicle.</p>
                  <div className="overlay-actions">
                    <button className="primary" onClick={() => { void startOuterVeilAt(requestedPlaytestLevel - 1); }}>Replay the playtest</button>
                    <button className="secondary" onClick={returnToTitle}>V5 title screen</button>
                  </div>
                </>
              ) : chronicleView === 'name' ? (
                <>
                  <div className="eyebrow">{V5_LAUNCH_PRESENTATION.completionEyebrow}</div>
                  <h2 ref={chronicleHeadingRef} tabIndex="-1" id="completion-heading">{V5_LAUNCH_PRESENTATION.completionHeading}</h2>
                  <p id="completion-story">The Outer Veil and Inner Kingdom stand restored across 20 / 20 levels.</p>
                  <div className="chronicle-next">
                    <span>NEXT</span>
                    <strong>{V5_LAUNCH_PRESENTATION.nextChapter}</strong>
                    <small>{V5_LAUNCH_PRESENTATION.nextStatus}</small>
                  </div>
                  <form className="chronicle-name-form" onSubmit={rememberChronicleName} noValidate>
                    <h3>What name shall the kingdom remember?</h3>
                    <label htmlFor="chronicle-player-name">Name or nickname · 1–24 characters</label>
                    <input
                      id="chronicle-player-name"
                      name="playerName"
                      type="text"
                      value={chronicleName}
                      onChange={(event) => { setChronicleName(event.currentTarget.value); setChronicleNameError(''); }}
                      maxLength="512"
                      autoComplete="nickname"
                      dir="auto"
                      aria-invalid={Boolean(chronicleNameError)}
                      aria-describedby={chronicleNameError ? 'chronicle-name-error' : undefined}
                    />
                    {chronicleNameError && <div id="chronicle-name-error" className="chronicle-name-error" role="alert">{chronicleNameError}</div>}
                    {saveWarning && <div className="save-warning" role="status">{saveWarning}</div>}
                    <div className="overlay-actions">
                      <button className="primary" type="submit">Enter the Chronicle</button>
                      <button className="secondary" type="button" onClick={returnToTitle}>Title screen</button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <div className="eyebrow">{V5_LAUNCH_PRESENTATION.chronicleLabel} · CHAPTERS I–II</div>
                  <h2 ref={chronicleHeadingRef} tabIndex="-1" id="completion-heading">The kingdom remembers <span dir="auto">{chronicleName}</span></h2>
                  <p id="completion-story">The Outer Veil is restored, the Inner Kingdom has recovered Liora’s testimony, and the second Crown Path now carries the names Serath tried to erase.</p>
                  {v4LatestScore ? (
                    <>
                      <div className="chronicle-rank" aria-label={`Performance rank ${v4LatestScore.rank.key}`}>
                        <span>{v4LatestScore.rank.key}</span>
                        <div>
                          <strong>{`Rank ${v4LatestScore.rank.key} · ${v4LatestScore.rank.title}`}</strong>
                          <small>{v4LatestScore.rank.criteria}</small>
                        </div>
                      </div>
                      <dl className="chronicle-grid">
                        <div><dt>Levels restored</dt><dd>20 / 20</dd></div>
                        <div><dt>Total journey time</dt><dd>{formatRecordedTime(v4LatestScore.totalTimeSeconds)}</dd></div>
                        <div><dt>Falls</dt><dd>{v4LatestScore.deaths}</dd></div>
                        <div><dt>Warden attempts</dt><dd>{v4LatestScore.wardenAttempts ?? 'Not recorded'}</dd></div>
                        <div><dt>Warden damage</dt><dd>{v4LatestScore.damageTaken ?? 'Not recorded'}</dd></div>
                        <div><dt>Completion date</dt><dd>{formatCompletionDate(v4LatestScore.completedAt)}</dd></div>
                      </dl>
                    </>
                  ) : <div className="chronicle-history-note">This journey was migrated from an earlier version, so incomplete timing evidence was not placed in the Founders’ Chronicle.</div>}
                  {saveWarning && <div className="save-warning" role="status">{saveWarning}</div>}
                  <div className="chronicle-next">
                    <span>{V5_LAUNCH_PRESENTATION.completionHeading}</span>
                    <strong>{V5_LAUNCH_PRESENTATION.nextChapter}</strong>
                    <small>{V5_LAUNCH_PRESENTATION.nextStatus} · no placeholder levels have been added</small>
                  </div>
                  <div className="overlay-actions">
                    <button className="primary" onClick={() => { void openV4Leaderboard(); }}>View Founders’ Chronicle</button>
                    <button className="secondary" onClick={() => openCinematicSequence('opening-prologue', { returnScreen: 'win' })}>Replay prologue</button>
                    <button className="secondary" onClick={() => openCinematicSequence('chapter-one-introduction', { returnScreen: 'win' })}>Replay Chapter I introduction</button>
                    <button className="secondary" onClick={() => openCinematicSequence('chapter-one-to-two-bridge', { returnScreen: 'win' })}>Replay Chapter I bridge</button>
                    <button className="secondary" onClick={() => openCinematicSequence('chapter-two-to-three-bridge', { returnScreen: 'win' })}>Replay Chapter II bridge</button>
                    <button className="secondary" onClick={() => { void startOuterVeilAt(0); }}>New journey</button>
                    <button className="secondary" onClick={returnToTitle}>Title screen</button>
                  </div>
                </>
              )
            ) : productionCampaign ? (
              chronicleView === 'name' ? (
                <>
                  <div className="eyebrow">STAGE I CLEAR · THE OUTER VEIL RESTORED</div>
                  <h2 ref={chronicleHeadingRef} tabIndex="-1" id="completion-heading">What name shall the kingdom remember?</h2>
                  <p id="completion-story">The Crown Path has recorded the restored Warden and every road you returned to the dawn.</p>
                  <form className="chronicle-name-form" onSubmit={rememberChronicleName} noValidate>
                    <label htmlFor="chronicle-player-name">Name or nickname · 1–24 characters · stored on this device only</label>
                    <input
                      id="chronicle-player-name"
                      name="playerName"
                      type="text"
                      value={chronicleName}
                      onChange={(event) => { setChronicleName(event.currentTarget.value); setChronicleNameError(''); }}
                      maxLength="512"
                      autoComplete="nickname"
                      dir="auto"
                      aria-invalid={Boolean(chronicleNameError)}
                      aria-describedby={chronicleNameError ? 'chronicle-name-error' : undefined}
                    />
                    {chronicleNameError && <div id="chronicle-name-error" className="chronicle-name-error" role="alert">{chronicleNameError}</div>}
                    {saveWarning && <div className="save-warning" role="status">{saveWarning}</div>}
                    <div className="overlay-actions">
                      <button className="primary" type="submit">Seal the Chronicle</button>
                      <button className="secondary" type="button" onClick={returnToTitle}>Title screen</button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <div className="eyebrow">STAGE I CLEAR · THE OUTER VEIL RESTORED</div>
                  <h2 ref={chronicleHeadingRef} tabIndex="-1" id="completion-heading">The kingdom remembers <span dir="auto">{chronicle?.playerName}</span></h2>
                  <p id="completion-story">{OUTER_VEIL_COMPLETION.body}</p>
                  {chronicle?.rank.status === 'unranked' && (
                    <div className="chronicle-history-note" role="note">
                      {unrankedChronicleCopy(chronicle).note}
                    </div>
                  )}
                  <div className="chronicle-rank" aria-label={`Performance rank ${chronicle?.rank.key || 'unranked'}`}>
                    <span>{chronicle?.rank.key || '—'}</span>
                    <div>
                      <strong>{chronicle?.rank.status === 'ranked'
                        ? `Rank ${chronicle.rank.key} · ${chronicle.rank.title}`
                        : `Unranked · ${unrankedChronicleCopy(chronicle).title}`}</strong>
                      <small>{chronicle?.rank.criteria}</small>
                    </div>
                  </div>
                  <dl className="chronicle-grid">
                    <div><dt>Levels restored</dt><dd>10 / 10</dd></div>
                    <div><dt>Total Stage I time</dt><dd>{formatRecordedTime(chronicle?.metrics.totalTimeSeconds)}</dd></div>
                    <div><dt>Falls</dt><dd>{Number.isInteger(chronicle?.metrics.retries) ? chronicle.metrics.retries : 'Not recorded'}</dd></div>
                    <div><dt>Warden attempts</dt><dd>{Number.isInteger(chronicle?.metrics.wardenAttempts) ? chronicle.metrics.wardenAttempts : 'Not recorded'}</dd></div>
                    <div><dt>Warden damage taken</dt><dd>{Number.isInteger(chronicle?.metrics.damageTaken) ? chronicle.metrics.damageTaken : 'Not recorded'}</dd></div>
                    <div><dt>Total Warden combat time · all attempts</dt><dd>{formatRecordedTime(chronicle?.metrics.wardenCombatTimeSeconds)}</dd></div>
                    <div><dt>Completion date</dt><dd><time dateTime={chronicle?.completedAt || undefined}>{formatCompletionDate(chronicle?.completedAt)}</time></dd></div>
                  </dl>
                  {saveWarning && <div className="save-warning" role="status">{saveWarning}</div>}
                  <aside className="chronicle-next" aria-label="Stage II preview">
                    <span>{OUTER_VEIL_COMPLETION.nextSlot.label}</span>
                    <strong>{OUTER_VEIL_COMPLETION.nextSlot.chapter}</strong>
                    <small>{OUTER_VEIL_COMPLETION.nextSlot.status}</small>
                  </aside>
                  <div className="overlay-actions">
                    <button className="primary" onClick={() => { void startOuterVeilAt(0); }}>Replay Stage I</button>
                    <button className="secondary" onClick={() => { setChronicleName(chronicle?.playerName || ''); setChronicleNameError(''); setChronicleView('name'); }}>Edit name</button>
                    <button className="secondary" onClick={returnToTitle}>Title screen</button>
                  </div>
                </>
              )
            ) : (
              <>
                <div className="eyebrow">{sessionKind === 'production-preview' ? previewPresentation?.eyebrow : 'The eclipse is broken'}</div>
                <h2 ref={chronicleHeadingRef} tabIndex="-1" id="completion-heading">{sessionKind === 'production-preview' ? previewPresentation?.heading : 'Kingdom unveiled'}</h2>
                <p id="completion-story">{sessionKind === 'production-preview'
                  ? previewPresentation?.body
                  : 'All ten realms are free. Light reaches the buried halls once more, and your path has become part of the ruins.'}</p>
                {saveWarning && <div className="save-warning" role="status">{saveWarning}</div>}
                <div className="results">
                  <div className="result"><strong>{formatTime(results.time)}</strong><span>Journey time</span></div>
                  <div className="result"><strong>{results.deaths}</strong><span>Falls</span></div>
                </div>
                <div className="overlay-actions">
                  <button className="primary" onClick={() => start(false)}>{sessionKind === 'production-preview' ? 'Replay level' : 'Journey again'}</button>
                  <button className="secondary" onClick={sessionKind === 'production-preview' ? () => { window.location.href = window.location.pathname; } : returnToTitle}>{sessionKind === 'production-preview' ? 'Return to live prototype' : 'Title screen'}</button>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {screen === 'leaderboard' && v4Campaign && (
        <section className="overlay chronicle-overlay" role="dialog" aria-modal="true" aria-labelledby="leaderboard-heading">
          <div className="overlay-card chronicle-card leaderboard-card">
            <div className="eyebrow">V5 · {V5_LAUNCH_PRESENTATION.chronicleLabel}</div>
            <h2 ref={overlayHeadingRef} tabIndex="-1" id="leaderboard-heading">Founders’ Top 10</h2>
            <p>The first twenty-level records remain permanently recognized here. This is not the complete 100-level Story One leaderboard. Personal records work offline; the Global Hall appears only after its separately protected Supabase service is connected.</p>
            <div className="leaderboard-columns">
              <section aria-labelledby="personal-top-ten">
                <h3 id="personal-top-ten">On this device</h3>
                {localTopTen.length ? (
                  <ol className="leaderboard-list">
                    {localTopTen.map((score, index) => (
                      <li key={score.id}>
                        <span className="leaderboard-position">{index + 1}</span>
                        <strong dir="auto">{score.playerName}</strong>
                        <time>{formatRecordedTime(score.totalTimeSeconds)}</time>
                        <small>{score.deaths} falls · Rank {score.rank.key}</small>
                      </li>
                    ))}
                  </ol>
                ) : <div className="leaderboard-empty">Complete all 20 levels to set the first record.</div>}
              </section>
              <section aria-labelledby="global-top-ten">
                <h3 id="global-top-ten">Global Hall</h3>
                {globalTopTen.length ? (
                  <ol className="leaderboard-list">
                    {globalTopTen.map((score, index) => (
                      <li key={`${score.player_name}-${score.completed_at}-${index}`}>
                        <span className="leaderboard-position">{score.position || index + 1}</span>
                        <strong dir="auto">{score.player_name}</strong>
                        <time>{formatRecordedTime(Number(score.total_time_seconds))}</time>
                        <small>{score.deaths} falls</small>
                      </li>
                    ))}
                  </ol>
                ) : <div className="leaderboard-empty">{globalHall.message}</div>}
              </section>
            </div>
            <div className="overlay-actions">
              <button className="primary" onClick={outerContinueTarget?.kind === 'complete' ? () => { void startOuterVeilAt(0); } : continueOuterVeil}>{outerContinueTarget?.kind === 'complete' ? 'Replay completed journey' : `Continue · Level ${String(outerContinueTarget?.campaignOrder || 1).padStart(2, '0')}`}</button>
              <button className="secondary" onClick={() => openCinematicSequence('opening-prologue', { returnScreen: 'leaderboard' })}>Replay prologue</button>
              <button className="secondary" onClick={() => openCinematicSequence('chapter-one-introduction', { returnScreen: 'leaderboard' })}>Replay Chapter I introduction</button>
              <button className="secondary" onClick={() => openCinematicSequence('chapter-one-to-two-bridge', { returnScreen: 'leaderboard' })}>Replay Chapter I bridge</button>
              <button className="secondary" onClick={() => openCinematicSequence('chapter-two-to-three-bridge', { returnScreen: 'leaderboard' })}>Replay Chapter II bridge</button>
              <button className="secondary" onClick={returnToTitle}>Title screen</button>
            </div>
          </div>
        </section>
      )}

      {screen === 'realm-slot' && (
        <section className="overlay" role="dialog" aria-modal="true" aria-labelledby="realm-slot-heading">
          <div className="overlay-card realm-slot-card">
            <div className="eyebrow">{OUTER_VEIL_COMPLETION.nextSlot.label}</div>
            <h2 ref={overlayHeadingRef} tabIndex="-1" id="realm-slot-heading">{OUTER_VEIL_COMPLETION.nextSlot.chapter}</h2>
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

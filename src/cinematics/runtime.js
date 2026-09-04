function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createCinematicSequenceController(sequence, onComplete = () => {}) {
  if (!Array.isArray(sequence) || sequence.length === 0) {
    throw new TypeError('A cinematic run requires at least one catalog entry.');
  }
  let index = 0;
  let currentSettled = false;
  let runSettled = false;

  const completeRun = (reason) => {
    if (runSettled) return { accepted: false, done: true, index };
    runSettled = true;
    currentSettled = true;
    onComplete({ reason, completedCount: index + 1, total: sequence.length });
    return { accepted: true, done: true, index };
  };

  return Object.freeze({
    current: () => sequence[index],
    index: () => index,
    settled: () => runSettled,
    settleCurrent(reason = 'ended', expectedIndex = index) {
      if (runSettled || currentSettled || expectedIndex !== index) {
        return { accepted: false, done: runSettled, index };
      }
      currentSettled = true;
      if (index >= sequence.length - 1) return completeRun(reason);
      index += 1;
      currentSettled = false;
      return { accepted: true, done: false, index };
    },
    skipRemaining(reason = 'skip-all') {
      if (runSettled) return { accepted: false, done: true, index };
      index = sequence.length - 1;
      return completeRun(reason);
    },
  });
}

export function isolateGameForCinematic(engine) {
  const originalMode = engine?.mode || null;
  const shouldResumePlay = originalMode === 'play';
  let context = null;
  let shouldResumeAudio = false;
  let suspendPromise = Promise.resolve();
  let restored = false;

  if (shouldResumePlay) engine.pause?.(true);
  const suspendCurrentAudio = () => {
    const current = engine?.audio?.context || null;
    if (restored || current?.state !== 'running' || (shouldResumeAudio && current === context)) return false;
    context = current;
    shouldResumeAudio = true;
    try {
      suspendPromise = Promise.resolve(current.suspend?.()).catch(() => {});
    } catch { /* audio isolation remains best effort */ }
    return true;
  };
  suspendCurrentAudio();

  return Object.freeze({
    originalMode,
    refresh: suspendCurrentAudio,
    restore() {
      if (restored) return false;
      restored = true;
      if (shouldResumeAudio && context?.state !== 'closed') {
        void suspendPromise.then(() => {
          if (context?.state === 'closed') return;
          try { context.resume?.(); } catch { /* a later user gesture can resume audio */ }
        });
      }
      if (shouldResumePlay && engine?.mode === 'paused') engine.pause?.(false);
      return true;
    },
  });
}

export function cinematicAudioSettings(settings = {}) {
  const muted = Boolean(settings.muted);
  const music = Number.isFinite(settings.musicVolume) ? settings.musicVolume : 1;
  return Object.freeze({
    muted,
    // Cinematics are delivered as one mastered soundtrack, so the persistent
    // Music control is the honest single master for both score and film mix.
    volume: muted ? 0 : clamp(music, 0, 1),
  });
}

export function reducedMotionRequested(matchMedia = globalThis.matchMedia) {
  try {
    return Boolean(matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  } catch {
    return false;
  }
}

export function cinematicPlaybackFailureStatus(error) {
  return error?.name === 'NotAllowedError' ? 'blocked' : 'error';
}

export function formatCinematicTime(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const remainder = Math.floor(safe % 60);
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  cinematicAudioSettings,
  createCinematicSequenceController,
  formatCinematicTime,
  reducedMotionRequested,
} from './runtime.js';

function showDefaultCaptions(video) {
  if (!video?.textTracks) return;
  for (let index = 0; index < video.textTracks.length; index += 1) {
    const track = video.textTracks[index];
    try {
      track.mode = index === 0 ? 'showing' : 'disabled';
    } catch {
      // The native `default` attribute remains the fallback on restricted players.
    }
  }
}

export function CinematicPlayer({ sequence, audioSettings, onBeforePlay, onComplete }) {
  const videoRef = useRef(null);
  const headingRef = useRef(null);
  const completeRef = useRef(onComplete);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState('ready');
  const [position, setPosition] = useState({ current: 0, duration: 0 });
  const reducedMotion = useMemo(() => reducedMotionRequested(), []);
  const mediaAudio = cinematicAudioSettings(audioSettings);
  const controllerRef = useRef(null);

  completeRef.current = onComplete;
  if (!controllerRef.current) {
    controllerRef.current = createCinematicSequenceController(sequence, (detail) => completeRef.current?.(detail));
  }

  const cinematic = sequence[index];
  const progress = position.duration > 0 ? Math.min(1, position.current / position.duration) : 0;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [index]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = mediaAudio.muted;
    video.volume = mediaAudio.volume;
  }, [mediaAudio.muted, mediaAudio.volume, index]);

  useEffect(() => () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  }, []);

  const finishCurrent = (reason, expectedIndex = index) => {
    videoRef.current?.pause();
    const result = controllerRef.current.settleCurrent(reason, expectedIndex);
    if (!result.accepted || result.done) return;
    setIndex(result.index);
    setStatus('ready');
    setPosition({ current: 0, duration: 0 });
  };

  const skipAll = () => {
    videoRef.current?.pause();
    controllerRef.current.skipRemaining('skip-all');
  };

  const readFallback = () => {
    videoRef.current?.pause();
    setStatus('fallback');
  };

  const play = () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      onBeforePlay?.();
      showDefaultCaptions(video);
      const pending = video.play();
      setStatus('loading');
      if (pending?.catch) pending.catch(() => setStatus('error'));
    } catch {
      setStatus('error');
    }
  };

  const pause = () => {
    videoRef.current?.pause();
    setStatus('paused');
  };

  const retry = () => {
    const video = videoRef.current;
    if (!video) return;
    setPosition({ current: 0, duration: 0 });
    video.load();
    play();
  };

  return (
    <section className="cinematic-layer" role="dialog" aria-modal="true" aria-labelledby="cinematic-heading" aria-describedby="cinematic-description">
      <div className="cinematic-shell">
        <video
          key={cinematic.id}
          ref={videoRef}
          className="cinematic-video"
          src={cinematic.src}
          preload="metadata"
          playsInline
          muted={mediaAudio.muted}
          onLoadedMetadata={(event) => {
            showDefaultCaptions(event.currentTarget);
            setPosition({ current: 0, duration: event.currentTarget.duration || 0 });
          }}
          onTimeUpdate={(event) => setPosition({
            current: event.currentTarget.currentTime || 0,
            duration: event.currentTarget.duration || 0,
          })}
          onPlaying={() => setStatus('playing')}
          onEnded={() => finishCurrent('ended', index)}
          onError={() => setStatus('error')}
        >
          {cinematic.captions.map((caption) => (
            <track
              key={caption.id}
              kind={caption.kind}
              src={caption.src}
              srcLang={caption.srcLang}
              label={caption.label}
              default={caption.default}
            />
          ))}
        </video>

        <div className="cinematic-scrim" aria-hidden="true" />
        <div className="cinematic-copy">
          <div className="cinematic-eyebrow">{cinematic.eyebrow} · Film {index + 1} of {sequence.length}</div>
          <h2 ref={headingRef} tabIndex="-1" id="cinematic-heading">{cinematic.title}</h2>
          <p id="cinematic-description">
            {status === 'error'
              ? 'The film could not be loaded. Your journey is safe; retry or continue with the story summary.'
              : status === 'fallback'
                ? cinematic.synopsis
                : reducedMotion
                  ? 'Reduced motion is enabled. Play the film when ready, or continue with the written story.'
                  : 'Captions are on. Playback begins only when you choose Play.'}
          </p>
        </div>

        {status !== 'fallback' && (
          <div className="cinematic-progress" role="progressbar" aria-label="Film progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress * 100)}>
            <i style={{ width: `${progress * 100}%` }} />
            <span>{formatCinematicTime(position.current)} / {position.duration ? formatCinematicTime(position.duration) : '--:--'}</span>
          </div>
        )}

        <div className="cinematic-actions">
          {status === 'playing' ? (
            <button type="button" className="primary" onClick={pause}>Pause</button>
          ) : status === 'error' ? (
            <button type="button" className="primary" onClick={retry}>Retry film</button>
          ) : status === 'fallback' ? (
            <button type="button" className="primary" onClick={() => finishCurrent('text-fallback', index)}>Continue story</button>
          ) : (
            <button type="button" className="primary" onClick={play}>{status === 'paused' ? 'Resume film' : 'Play film'}</button>
          )}
          {status !== 'fallback' && (
            <button type="button" className="secondary" onClick={readFallback}>
              {status === 'error' ? 'Continue without video' : 'Read story instead'}
            </button>
          )}
          <button type="button" className="secondary" onClick={() => finishCurrent('skip', index)}>Skip film</button>
          {sequence.length > 1 && <button type="button" className="secondary" onClick={skipAll}>Skip all films</button>}
        </div>
      </div>
    </section>
  );
}

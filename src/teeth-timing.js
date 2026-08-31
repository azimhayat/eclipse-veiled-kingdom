const positiveModulo = (value, divisor) => ((value % divisor) + divisor) % divisor;

export function timedTeethCycleSeconds(timing) {
  return timing.safeSeconds + timing.warningSeconds + timing.activeSeconds + timing.recoverySeconds;
}

export function getTimedTeethState(timing, hazard, clock) {
  if (hazard.restored || hazard.bound) {
    return { state: hazard.bound ? 'bound' : 'restored', phaseTime: 0, progress: 1, extension: 0, active: false };
  }
  const cycle = timedTeethCycleSeconds(timing);
  const phaseTime = positiveModulo(clock + (hazard.offsetSeconds || 0), cycle);
  const warningStart = timing.safeSeconds;
  const activeStart = warningStart + timing.warningSeconds;
  const recoveryStart = activeStart + timing.activeSeconds;

  if (phaseTime < warningStart) {
    return { state: 'safe', phaseTime, progress: phaseTime / timing.safeSeconds, extension: 0, active: false };
  }
  if (phaseTime < activeStart) {
    const progress = (phaseTime - warningStart) / timing.warningSeconds;
    return { state: 'warning', phaseTime, progress, extension: progress * .18, active: false };
  }
  if (phaseTime < recoveryStart) {
    const progress = (phaseTime - activeStart) / timing.activeSeconds;
    return { state: 'active', phaseTime, progress, extension: 1, active: true };
  }
  const progress = (phaseTime - recoveryStart) / timing.recoverySeconds;
  return { state: 'recovery', phaseTime, progress, extension: Math.max(0, 1 - progress), active: false };
}

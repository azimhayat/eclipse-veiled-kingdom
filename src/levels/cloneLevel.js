import { cloneObjective } from './cloneObjective.js';

export function cloneLevel(level) {
  return {
    ...level,
    map: level.map.map((row) => [...row]),
    relics: level.relics.map((relic) => ({ ...relic, collected: false })),
    block: { ...level.block, homeX: level.block.x, homeY: level.block.y, vx: 0, vy: 0, bound: false },
    plate: { ...level.plate },
    door: { ...level.door },
    ships: level.ships.map((ship) => ({ ...ship })),
    checkpoints: level.checkpoints.map((checkpoint) => ({
      ...checkpoint,
      spawn: checkpoint.spawn ? { ...checkpoint.spawn } : checkpoint.spawn,
      activationZone: checkpoint.activationZone ? { ...checkpoint.activationZone } : checkpoint.activationZone,
      reached: false,
      active: false,
    })),
    movers: (level.movers || []).map((item) => ({ ...item, baseX: item.x, baseY: item.y, dx: 0, dy: 0 })),
    water: (level.water || []).map((item) => ({ ...item })),
    crushers: (level.crushers || []).map((item) => ({ ...item, baseX: item.x, baseY: item.y })),
    mirrors: (level.mirrors || []).map((item) => ({ ...item })),
    veilPlatforms: (level.veilPlatforms || []).map((item) => ({ ...item, active: item.phase === 0 })),
    boss: level.boss ? { ...level.boss } : null,
    abilityUnlock: level.abilityUnlock ? { ...level.abilityUnlock } : null,
    objective: cloneObjective(level.objective),
  };
}

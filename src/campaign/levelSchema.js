import {
  TILE,
  Tile,
  WORLD_COLS,
  WORLD_H,
  WORLD_ROWS,
  WORLD_W,
} from '../levels/constants.js';
import { cloneObjective } from '../levels/cloneObjective.js';

export const OPTIONAL_LEVEL_ARRAYS = Object.freeze([
  'ships',
  'movers',
  'water',
  'crushers',
  'mirrors',
  'veilPlatforms',
]);

const LEVEL_KEY_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ALLOWED_TILES = new Set(Object.values(Tile));

export class LevelValidationError extends Error {
  constructor(levelKey, issues) {
    const details = issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n');
    super(`Invalid authored level "${levelKey}":\n${details}`);
    this.name = 'LevelValidationError';
    this.levelKey = levelKey;
    this.issues = issues;
  }
}

function cloneItems(items) {
  return Array.isArray(items) ? items.map((item) => ({ ...item })) : [];
}

function cloneMap(map) {
  if (!Array.isArray(map)) return map;
  return map.map((row) => (Array.isArray(row) ? [...row] : row));
}

function normalizeLevel(level, identity = {}) {
  const source = level && typeof level === 'object' ? level : {};
  const normalized = {
    ...source,
    levelKey: identity.levelKey,
    campaignOrder: identity.campaignOrder,
    map: cloneMap(source.map),
    spawn: source.spawn && typeof source.spawn === 'object' ? { ...source.spawn } : source.spawn,
    door: source.door && typeof source.door === 'object' ? { ...source.door } : source.door,
    checkpoints: cloneItems(source.checkpoints),
    relics: cloneItems(source.relics),
  };

  for (const field of OPTIONAL_LEVEL_ARRAYS) normalized[field] = cloneItems(source[field]);

  if (source.block && typeof source.block === 'object') normalized.block = { ...source.block };
  if (source.plate && typeof source.plate === 'object') normalized.plate = { ...source.plate };
  if (source.boss && typeof source.boss === 'object') normalized.boss = { ...source.boss };
  if (source.theme && typeof source.theme === 'object') normalized.theme = { ...source.theme };
  if (source.abilityUnlock && typeof source.abilityUnlock === 'object') {
    normalized.abilityUnlock = { ...source.abilityUnlock };
  }
  if (source.objective && typeof source.objective === 'object') normalized.objective = cloneObjective(source.objective);
  if (source.gameplay && typeof source.gameplay === 'object') {
    normalized.gameplay = {
      ...source.gameplay,
      enemyRoster: [...(source.gameplay.enemyRoster || [])],
      tutorialCues: cloneItems(source.gameplay.tutorialCues),
      deterministicRoute: [...(source.gameplay.deterministicRoute || [])],
    };
  }

  return normalized;
}

function addIssue(issues, path, code, message) {
  issues.push({ path, code, message });
}

function validateIdentity(identity, issues) {
  if (typeof identity.levelKey !== 'string' || !LEVEL_KEY_PATTERN.test(identity.levelKey)) {
    addIssue(
      issues,
      'levelKey',
      'invalid_level_key',
      'must be a stable lowercase kebab-case string',
    );
  }

  if (!Number.isInteger(identity.campaignOrder) || identity.campaignOrder < 1) {
    addIssue(issues, 'campaignOrder', 'invalid_campaign_order', 'must be a positive integer');
  }
}

function validateMap(map, issues) {
  if (!Array.isArray(map)) {
    addIssue(issues, 'map', 'invalid_map', 'must be an array of tile rows');
    return;
  }

  if (map.length !== WORLD_ROWS) {
    addIssue(issues, 'map', 'invalid_row_count', `must contain exactly ${WORLD_ROWS} rows`);
  }

  map.forEach((row, rowIndex) => {
    if (!Array.isArray(row)) {
      addIssue(issues, `map[${rowIndex}]`, 'invalid_row', 'must be an array');
      return;
    }

    if (row.length !== WORLD_COLS) {
      addIssue(
        issues,
        `map[${rowIndex}]`,
        'invalid_column_count',
        `must contain exactly ${WORLD_COLS} columns`,
      );
    }

    row.forEach((tile, columnIndex) => {
      if (!Number.isInteger(tile) || !ALLOWED_TILES.has(tile)) {
        addIssue(
          issues,
          `map[${rowIndex}][${columnIndex}]`,
          'invalid_tile',
          `must be one of the authored tile values (${[...ALLOWED_TILES].join(', ')})`,
        );
      }
    });
  });
}

function validatePoint(point, path, fields, issues) {
  if (!point || typeof point !== 'object') {
    addIssue(issues, path, 'missing_point', 'must be an object');
    return;
  }

  for (const [field, maximum] of fields) {
    const value = point[field];
    if (!Number.isFinite(value)) {
      addIssue(issues, `${path}.${field}`, 'invalid_coordinate', 'must be a finite number');
    } else if (value < 0 || value > maximum) {
      addIssue(issues, `${path}.${field}`, 'out_of_bounds', `must be between 0 and ${maximum}`);
    }
  }
}

function validateRect(rect, path, issues) {
  if (!rect || typeof rect !== 'object') {
    addIssue(issues, path, 'missing_rect', 'must be an object');
    return;
  }

  for (const field of ['x', 'y', 'w', 'h']) {
    if (!Number.isFinite(rect[field])) {
      addIssue(issues, `${path}.${field}`, 'invalid_number', 'must be a finite number');
    }
  }

  if (Number.isFinite(rect.w) && rect.w <= 0) {
    addIssue(issues, `${path}.w`, 'invalid_size', 'must be greater than zero');
  }
  if (Number.isFinite(rect.h) && rect.h <= 0) {
    addIssue(issues, `${path}.h`, 'invalid_size', 'must be greater than zero');
  }
  if (Number.isFinite(rect.x) && rect.x < 0) {
    addIssue(issues, `${path}.x`, 'out_of_bounds', 'must be inside the world');
  }
  if (Number.isFinite(rect.y) && rect.y < 0) {
    addIssue(issues, `${path}.y`, 'out_of_bounds', 'must be inside the world');
  }
  if (Number.isFinite(rect.x) && Number.isFinite(rect.w) && rect.x + rect.w > WORLD_W) {
    addIssue(issues, path, 'out_of_bounds', `must fit within the ${WORLD_W}px world width`);
  }
  if (Number.isFinite(rect.y) && Number.isFinite(rect.h) && rect.y + rect.h > WORLD_H) {
    addIssue(issues, path, 'out_of_bounds', `must fit within the ${WORLD_H}px world height`);
  }
}

function validateCheckpoints(checkpoints, issues) {
  if (!Array.isArray(checkpoints)) {
    addIssue(issues, 'checkpoints', 'invalid_checkpoints', 'must be an array');
    return;
  }

  checkpoints.forEach((checkpoint, index) => {
    const path = `checkpoints[${index}]`;
    validatePoint(
      checkpoint,
      path,
      [
        ['x', WORLD_W],
        ['spawnX', WORLD_W],
        ['spawnY', WORLD_H],
      ],
      issues,
    );

    if (
      checkpoint
      && checkpoint.label !== undefined
      && (typeof checkpoint.label !== 'string' || checkpoint.label.trim() === '')
    ) {
      addIssue(issues, `${path}.label`, 'invalid_label', 'must be a non-empty string when supplied');
    }
  });
}

function validateRelics(relics, issues) {
  if (!Array.isArray(relics)) {
    addIssue(issues, 'relics', 'invalid_relics', 'must be an array');
    return;
  }

  const ids = new Set();
  relics.forEach((relic, index) => {
    const path = `relics[${index}]`;
    validatePoint(relic, path, [['x', WORLD_W], ['y', WORLD_H]], issues);

    if (!relic || typeof relic.id !== 'string' || relic.id.trim() === '') {
      addIssue(issues, `${path}.id`, 'invalid_relic_id', 'must be a non-empty string');
      return;
    }

    if (ids.has(relic.id)) {
      addIssue(issues, `${path}.id`, 'duplicate_relic_id', `duplicates "${relic.id}"`);
    }
    ids.add(relic.id);
  });
}

function validateGate(map, gateColumn, issues) {
  if (!Number.isInteger(gateColumn) || gateColumn < 0 || gateColumn >= WORLD_COLS) {
    addIssue(
      issues,
      'gateColumn',
      'invalid_gate_column',
      `must be an integer between 0 and ${WORLD_COLS - 1}`,
    );
    return;
  }

  if (!Array.isArray(map)) return;

  const gateTiles = [];
  map.forEach((row, rowIndex) => {
    if (!Array.isArray(row)) return;
    row.forEach((tile, columnIndex) => {
      if (tile === Tile.GATE) gateTiles.push({ rowIndex, columnIndex });
    });
  });

  if (gateTiles.length === 0) {
    addIssue(issues, 'gateColumn', 'missing_gate_tiles', 'must reference at least one gate tile');
    return;
  }

  const misplacedGate = gateTiles.find((tile) => tile.columnIndex !== gateColumn);
  if (misplacedGate) {
    addIssue(
      issues,
      `map[${misplacedGate.rowIndex}][${misplacedGate.columnIndex}]`,
      'gate_column_mismatch',
      `gate tiles must be placed in declared column ${gateColumn}`,
    );
  }
}

function validateMemoryCarve(level, issues) {
  if (level.objective === undefined || level.objective === null) return;
  const objective = level.objective;
  if (typeof objective !== 'object' || objective.type !== 'memory-carve') return;
  for (const field of ['hudLabel', 'title', 'completionHint']) {
    if (typeof objective[field] !== 'string' || objective[field].trim() === '') {
      addIssue(issues, `objective.${field}`, 'invalid_text', 'must be a non-empty string');
    }
  }

  const unlock = level.abilityUnlock;
  for (const field of ['key', 'name', 'input', 'description']) {
    if (!unlock || typeof unlock[field] !== 'string' || unlock[field].trim() === '') {
      addIssue(issues, `abilityUnlock.${field}`, 'invalid_unlock', 'must be a non-empty string');
    }
  }

  if (!Array.isArray(objective.marks) || objective.marks.length === 0) {
    addIssue(issues, 'objective.marks', 'missing_marks', 'must contain at least one authored memory mark');
  } else {
    const ids = new Set();
    const cells = new Set();
    const roles = new Set();
    objective.marks.forEach((mark, index) => {
      const path = `objective.marks[${index}]`;
      if (!mark || typeof mark !== 'object') {
        addIssue(issues, path, 'invalid_mark', 'must be an object');
        return;
      }
      if (typeof mark.id !== 'string' || mark.id.trim() === '') {
        addIssue(issues, `${path}.id`, 'invalid_mark_id', 'must be a non-empty string');
      } else if (ids.has(mark.id)) {
        addIssue(issues, `${path}.id`, 'duplicate_mark_id', `duplicates "${mark.id}"`);
      }
      ids.add(mark.id);
      if (!Number.isInteger(mark.tx) || !Number.isInteger(mark.ty)
        || mark.tx < 0 || mark.tx >= WORLD_COLS || mark.ty < 0 || mark.ty >= WORLD_ROWS) {
        addIssue(issues, path, 'invalid_mark_cell', 'must identify an in-bounds integer tile cell');
      } else {
        const cell = `${mark.tx},${mark.ty}`;
        if (cells.has(cell)) addIssue(issues, path, 'duplicate_mark_cell', `duplicates cell ${cell}`);
        cells.add(cell);
        if (level.map?.[mark.ty]?.[mark.tx] !== Tile.SAND) {
          addIssue(issues, path, 'mark_not_sand', 'must begin on a SAND tile');
        }
      }
      if (typeof mark.role !== 'string' || mark.role.trim() === '') {
        addIssue(issues, `${path}.role`, 'invalid_mark_role', 'must be a non-empty string');
      } else roles.add(mark.role);
      if (typeof mark.revealText !== 'string' || mark.revealText.trim() === '') {
        addIssue(issues, `${path}.revealText`, 'invalid_reveal_text', 'must be a non-empty string');
      }
    });
    for (const role of ['safe-lesson', 'combination-test', 'mastery-payoff']) {
      if (!roles.has(role)) addIssue(issues, 'objective.marks', 'missing_teaching_role', `must include ${role}`);
    }
  }

  if (!Array.isArray(objective.restorationTiles) || objective.restorationTiles.length === 0) {
    addIssue(issues, 'objective.restorationTiles', 'missing_restoration', 'must contain visible restoration tiles');
  } else {
    const cells = new Set();
    objective.restorationTiles.forEach((tile, index) => {
      const path = `objective.restorationTiles[${index}]`;
      if (!tile || !Number.isInteger(tile.tx) || !Number.isInteger(tile.ty)
        || tile.tx < 0 || tile.tx >= WORLD_COLS || tile.ty < 0 || tile.ty >= WORLD_ROWS) {
        addIssue(issues, path, 'invalid_restoration_cell', 'must identify an in-bounds integer tile cell');
        return;
      }
      const cell = `${tile.tx},${tile.ty}`;
      if (cells.has(cell)) addIssue(issues, path, 'duplicate_restoration_cell', `duplicates cell ${cell}`);
      cells.add(cell);
      if (tile.tile !== Tile.GLOW) {
        addIssue(issues, `${path}.tile`, 'invalid_restoration_tile', 'must restore a GLOW tile');
      }
      const existing = level.map?.[tile.ty]?.[tile.tx];
      if (existing !== Tile.STONE && existing !== Tile.GLOW) {
        addIssue(issues, path, 'unsafe_restoration', 'must replace a solid STONE or GLOW tile');
      }
    });
  }
}

function validateBrokenProcession(level, issues) {
  const objective = level.objective;
  if (!objective || typeof objective !== 'object' || objective.type !== 'procession-restoration') return;
  for (const field of ['hudLabel', 'title', 'requiresAbility', 'completionHint']) {
    if (typeof objective[field] !== 'string' || objective[field].trim() === '') {
      addIssue(issues, `objective.${field}`, 'invalid_text', 'must be a non-empty string');
    }
  }
  if (objective.requiresAbility !== 'memory-carve') {
    addIssue(issues, 'objective.requiresAbility', 'invalid_required_ability', 'must explicitly require memory-carve');
  }

  const allowedPoses = new Set(['kneel', 'warning', 'blade', 'crown', 'erase', 'map']);
  const roles = new Set();
  const ids = new Set();
  let previousTx = -1;
  let previousZoneMax = -1;
  let markGatedStations = 0;
  if (!Array.isArray(objective.stations) || objective.stations.length < 2) {
    addIssue(issues, 'objective.stations', 'missing_stations', 'must contain an ordered authored procession');
  } else {
    objective.stations.forEach((item, index) => {
      const path = `objective.stations[${index}]`;
      if (!item || typeof item !== 'object') {
        addIssue(issues, path, 'invalid_station', 'must be an object');
        return;
      }
      if (typeof item.id !== 'string' || item.id.trim() === '') {
        addIssue(issues, `${path}.id`, 'invalid_station_id', 'must be a non-empty string');
      } else if (ids.has(item.id)) {
        addIssue(issues, `${path}.id`, 'duplicate_station_id', `duplicates "${item.id}"`);
      }
      ids.add(item.id);
      if (!Number.isFinite(item.tx) || item.tx < 0 || item.tx >= WORLD_COLS) {
        addIssue(issues, `${path}.tx`, 'invalid_station_cell', 'must be an in-bounds tile column');
      } else {
        if (item.tx <= previousTx) addIssue(issues, `${path}.tx`, 'unordered_station', 'must appear west-to-east in authored order');
        previousTx = item.tx;
      }
      if (!Number.isFinite(item.baseTy) || item.baseTy < 1 || item.baseTy >= WORLD_ROWS) {
        addIssue(issues, `${path}.baseTy`, 'invalid_station_cell', 'must be an in-bounds base row');
      }
      if (!allowedPoses.has(item.pose)) {
        addIssue(issues, `${path}.pose`, 'invalid_station_pose', `must be one of ${[...allowedPoses].join(', ')}`);
      }
      if (!Number.isFinite(item.rotation)) {
        addIssue(issues, `${path}.rotation`, 'invalid_station_rotation', 'must be a finite number');
      }
      if (typeof item.label !== 'string' || item.label.trim() === ''
        || typeof item.text !== 'string' || item.text.trim() === '') {
        addIssue(issues, path, 'invalid_station_text', 'must include a readable label and story line');
      }
      if (typeof item.role !== 'string' || item.role.trim() === '') {
        addIssue(issues, `${path}.role`, 'invalid_station_role', 'must be a non-empty string');
      } else roles.add(item.role);
      const zone = item.observeZone;
      if (!zone || !Number.isFinite(zone.minTx) || !Number.isFinite(zone.maxTx)
        || !Number.isInteger(zone.feetTy) || zone.minTx < 0 || zone.maxTx > WORLD_COLS
        || zone.minTx >= zone.maxTx || zone.feetTy < 1 || zone.feetTy >= WORLD_ROWS) {
        addIssue(issues, `${path}.observeZone`, 'invalid_observe_zone', 'must be a valid in-bounds traversal zone');
      } else {
        if (zone.minTx <= previousZoneMax) {
          addIssue(issues, `${path}.observeZone`, 'overlapping_observe_zone', 'must follow the prior scene without overlap');
        }
        previousZoneMax = zone.maxTx;
      }
      if (item.requiresMemoryMark) markGatedStations += 1;
    });
    for (const role of ['safe-read', 'traversal-read', 'betrayal-reveal', 'reversal-read', 'erasure-payoff']) {
      if (!roles.has(role)) addIssue(issues, 'objective.stations', 'missing_procession_role', `must include ${role}`);
    }
    if (markGatedStations !== 1) {
      addIssue(issues, 'objective.stations', 'invalid_station_gate', 'exactly one scene must require the Memory Carve reveal');
    }
  }

  const mark = objective.memoryMark;
  if (!mark || typeof mark !== 'object') {
    addIssue(issues, 'objective.memoryMark', 'missing_memory_mark', 'must define the single Memory Carve combination');
  } else {
    if (typeof mark.id !== 'string' || mark.id.trim() === '' || ids.has(mark.id)) {
      addIssue(issues, 'objective.memoryMark.id', 'invalid_mark_id', 'must be a unique non-empty string');
    }
    if (!Number.isInteger(mark.tx) || !Number.isInteger(mark.ty)
      || mark.tx < 0 || mark.tx >= WORLD_COLS || mark.ty < 0 || mark.ty >= WORLD_ROWS) {
      addIssue(issues, 'objective.memoryMark', 'invalid_mark_cell', 'must identify an in-bounds integer tile cell');
    } else {
      if (level.map?.[mark.ty]?.[mark.tx] !== Tile.SAND) {
        addIssue(issues, 'objective.memoryMark', 'mark_not_sand', 'must begin on a SAND tile');
      }
      const gatedStation = objective.stations?.find((item) => item.requiresMemoryMark);
      if (gatedStation && mark.tx >= gatedStation.observeZone?.maxTx) {
        addIssue(issues, 'objective.memoryMark.tx', 'late_memory_mark', 'must be encountered before its gated witness zone ends');
      }
    }
    if (mark.role !== 'memory-carve-combination') {
      addIssue(issues, 'objective.memoryMark.role', 'invalid_mark_role', 'must be the memory-carve-combination');
    }
    if (typeof mark.revealText !== 'string' || mark.revealText.trim() === '') {
      addIssue(issues, 'objective.memoryMark.revealText', 'invalid_reveal_text', 'must be a non-empty string');
    }
  }

  if (level.relics?.length) {
    addIssue(issues, 'relics', 'procession_relics_forbidden', 'must remain empty for this traversal objective');
  }

  const finalMonument = objective.finalMonument;
  if (!finalMonument || typeof finalMonument !== 'object'
    || typeof finalMonument.id !== 'string' || finalMonument.id.trim() === ''
    || typeof finalMonument.label !== 'string' || finalMonument.label.trim() === ''
    || !Number.isFinite(finalMonument.tx) || finalMonument.tx < 0 || finalMonument.tx >= WORLD_COLS
    || !Number.isFinite(finalMonument.baseTy) || finalMonument.baseTy < 1 || finalMonument.baseTy >= WORLD_ROWS
    || !allowedPoses.has(finalMonument.pose) || !Number.isFinite(finalMonument.rotation)) {
    addIssue(issues, 'objective.finalMonument', 'invalid_final_monument', 'must define one in-bounds readable restoration monument');
  }

  if (!Array.isArray(objective.restorationTiles) || objective.restorationTiles.length === 0) {
    addIssue(issues, 'objective.restorationTiles', 'missing_restoration', 'must contain visible same-solidity restoration tiles');
  } else {
    objective.restorationTiles.forEach((tile, index) => {
      const path = `objective.restorationTiles[${index}]`;
      if (!tile || !Number.isInteger(tile.tx) || !Number.isInteger(tile.ty)
        || tile.tx < 0 || tile.tx >= WORLD_COLS || tile.ty < 0 || tile.ty >= WORLD_ROWS
        || tile.tile !== Tile.GLOW || ![Tile.STONE, Tile.GLOW].includes(level.map?.[tile.ty]?.[tile.tx])) {
        addIssue(issues, path, 'unsafe_restoration', 'must replace an in-bounds solid STONE or GLOW tile with GLOW');
      }
    });
  }
}

function validateOathbind(level, issues) {
  const objective = level.objective;
  if (!objective || typeof objective !== 'object' || objective.type !== 'oathbind-restoration') return;

  for (const field of ['hudLabel', 'title', 'requiresAbility', 'completionHint']) {
    if (typeof objective[field] !== 'string' || objective[field].trim() === '') {
      addIssue(issues, `objective.${field}`, 'invalid_text', 'must be a non-empty string');
    }
  }
  if (objective.requiresAbility !== 'memory-carve') {
    addIssue(issues, 'objective.requiresAbility', 'invalid_required_ability', 'must explicitly combine with memory-carve');
  }

  const unlock = level.abilityUnlock;
  for (const field of ['key', 'name', 'input', 'description']) {
    if (!unlock || typeof unlock[field] !== 'string' || unlock[field].trim() === '') {
      addIssue(issues, `abilityUnlock.${field}`, 'invalid_unlock', 'must be a non-empty string');
    }
  }
  if (unlock?.key !== 'oathbind') {
    addIssue(issues, 'abilityUnlock.key', 'invalid_oathbind_unlock', 'must declare the oathbind ability');
  }

  validateRect(level.block, 'block', issues);
  if (level.block?.disabled) addIssue(issues, 'block.disabled', 'disabled_oath_block', 'must provide one movable rune block');
  if (level.block?.w > TILE || level.block?.h > TILE) {
    addIssue(issues, 'block', 'oversized_oath_block', 'must fit inside one world tile for recoverable side swapping');
  }

  for (const [field, role] of [['lessonZone', 'lesson'], ['finalSeal', 'final seal']]) {
    const rect = objective[field];
    validateRect(rect, `objective.${field}`, issues);
    if (typeof rect?.id !== 'string' || rect.id.trim() === ''
      || typeof rect?.label !== 'string' || rect.label.trim() === '') {
      addIssue(issues, `objective.${field}`, 'invalid_oath_zone', `must name the ${role}`);
    }
    if (rect && level.block && Math.abs((rect.y + rect.h) - (level.block.y + level.block.h)) >= 14) {
      addIssue(issues, `objective.${field}`, 'misaligned_oath_zone', 'must share the rune block floor elevation');
    }
  }
  if (objective.lessonZone?.x <= level.block?.x
    || objective.finalSeal?.x <= objective.lessonZone?.x + objective.lessonZone?.w) {
    addIssue(issues, 'objective.finalSeal', 'invalid_oath_route', 'must follow an eastward safe lesson with one later public seal');
  }

  const mark = objective.memoryMark;
  if (!mark || typeof mark !== 'object') {
    addIssue(issues, 'objective.memoryMark', 'missing_memory_mark', 'must define one Memory Carve combination testimony');
  } else {
    if (typeof mark.id !== 'string' || mark.id.trim() === '') {
      addIssue(issues, 'objective.memoryMark.id', 'invalid_mark_id', 'must be a non-empty string');
    }
    if (!Number.isInteger(mark.tx) || !Number.isInteger(mark.ty)
      || mark.tx < 0 || mark.tx >= WORLD_COLS || mark.ty < 0 || mark.ty >= WORLD_ROWS) {
      addIssue(issues, 'objective.memoryMark', 'invalid_mark_cell', 'must identify an in-bounds integer tile cell');
    } else if (level.map?.[mark.ty]?.[mark.tx] !== Tile.SAND) {
      addIssue(issues, 'objective.memoryMark', 'mark_not_sand', 'must begin on a SAND tile');
    }
    if (mark.role !== 'combination-test') {
      addIssue(issues, 'objective.memoryMark.role', 'invalid_mark_role', 'must be the one combination-test');
    }
    if (typeof mark.revealText !== 'string' || mark.revealText.trim() === '') {
      addIssue(issues, 'objective.memoryMark.revealText', 'invalid_reveal_text', 'must be a non-empty string');
    }
  }

  for (const phase of ['learn', 'cross', 'carve', 'seal', 'complete']) {
    if (typeof objective.phaseHints?.[phase] !== 'string' || objective.phaseHints[phase].trim() === '') {
      addIssue(issues, `objective.phaseHints.${phase}`, 'invalid_phase_hint', 'must be a non-empty string');
    }
  }

  const monument = objective.finalMonument;
  if (!monument || typeof monument.id !== 'string' || monument.id.trim() === ''
    || typeof monument.label !== 'string' || monument.label.trim() === ''
    || !Number.isFinite(monument.tx) || monument.tx < 0 || monument.tx >= WORLD_COLS
    || !Number.isFinite(monument.baseTy) || monument.baseTy < 1 || monument.baseTy >= WORLD_ROWS
    || !Number.isFinite(monument.rotation)) {
    addIssue(issues, 'objective.finalMonument', 'invalid_final_monument', 'must define one readable balanced civic scale');
  }

  if (!Array.isArray(objective.restorationTiles) || objective.restorationTiles.length === 0) {
    addIssue(issues, 'objective.restorationTiles', 'missing_restoration', 'must contain visible same-solidity restoration tiles');
  } else {
    const cells = new Set();
    objective.restorationTiles.forEach((tile, index) => {
      const path = `objective.restorationTiles[${index}]`;
      const cell = `${tile?.tx},${tile?.ty}`;
      if (!tile || !Number.isInteger(tile.tx) || !Number.isInteger(tile.ty)
        || tile.tx < 0 || tile.tx >= WORLD_COLS || tile.ty < 0 || tile.ty >= WORLD_ROWS
        || tile.tile !== Tile.GLOW || ![Tile.STONE, Tile.GLOW].includes(level.map?.[tile.ty]?.[tile.tx])) {
        addIssue(issues, path, 'unsafe_restoration', 'must replace an in-bounds solid STONE or GLOW tile with GLOW');
      } else if (cells.has(cell)) {
        addIssue(issues, path, 'duplicate_restoration_cell', `duplicates cell ${cell}`);
      }
      cells.add(cell);
    });
  }

  if (level.relics?.length || level.ships?.length || level.boss || level.gameplay?.enemyRoster?.length) {
    addIssue(issues, 'objective', 'oathbind_encounters_forbidden', 'must remain a finite non-combat civic puzzle');
  }

  if (level.block && objective.finalSeal) {
    const startTx = Math.floor(level.block.x / TILE);
    const endTx = Math.ceil((objective.finalSeal.x + objective.finalSeal.w) / TILE) + 1;
    for (let tx = startTx - 1; tx <= endTx; tx += 1) {
      if (![Tile.STONE, Tile.GLOW].includes(level.map?.[26]?.[tx]) || level.map?.[25]?.[tx] !== Tile.AIR) {
        addIssue(issues, `map[25..26][${tx}]`, 'unsafe_oath_corridor', 'the complete block route must stay flat, open, and reversible');
        break;
      }
    }
  }
}

function validateTimedTeeth(level, issues) {
  const objective = level.objective;
  if (!objective || objective.type !== 'timed-teeth-restoration') return;
  for (const field of ['hudLabel', 'title', 'requiresAbility', 'completionHint']) {
    if (typeof objective[field] !== 'string' || objective[field].trim() === '') {
      addIssue(issues, `objective.${field}`, 'invalid_text', 'must be a non-empty string');
    }
  }
  if (objective.requiresAbility !== 'oathbind' || !level.gameplay?.assumedAbilities?.includes('oathbind')) {
    addIssue(issues, 'objective.requiresAbility', 'invalid_teeth_ability', 'must explicitly combine with the established oathbind ability');
  }

  const timing = objective.timing || {};
  const cycle = ['safeSeconds', 'warningSeconds', 'activeSeconds', 'recoverySeconds']
    .reduce((sum, field) => sum + (Number.isFinite(timing[field]) ? timing[field] : 0), 0);
  if (!Number.isFinite(timing.safeSeconds) || timing.safeSeconds < 1.5
    || !Number.isFinite(timing.warningSeconds) || timing.warningSeconds < .75
    || !Number.isFinite(timing.activeSeconds) || timing.activeSeconds < .3 || timing.activeSeconds >= .9
    || !Number.isFinite(timing.recoverySeconds) || timing.recoverySeconds < .25) {
    addIssue(issues, 'objective.timing', 'unsafe_teeth_timing', 'must provide a long safe/readable warning, a sub-invulnerability active window, and recovery');
  }

  const hazards = objective.hazards;
  if (!Array.isArray(hazards) || hazards.length < 4 || hazards.length > 9) {
    addIssue(issues, 'objective.hazards', 'invalid_teeth_banks', 'must define four to nine finite tooth banks');
  } else {
    const ids = new Set();
    const cells = new Set();
    for (const [index, hazard] of hazards.entries()) {
      const path = `objective.hazards[${index}]`;
      if (!hazard || typeof hazard.id !== 'string' || hazard.id.trim() === '' || ids.has(hazard.id)) {
        addIssue(issues, `${path}.id`, ids.has(hazard?.id) ? 'duplicate_teeth_id' : 'invalid_teeth_id', 'must be a unique non-empty string');
      }
      ids.add(hazard?.id);
      if (typeof hazard?.role !== 'string' || hazard.role.trim() === '') {
        addIssue(issues, `${path}.role`, 'invalid_teeth_role', 'must state the bank’s authored lesson role');
      }
      const width = hazard?.endTx - hazard?.startTx + 1;
      if (!Number.isInteger(hazard?.startTx) || !Number.isInteger(hazard?.endTx)
        || !Number.isInteger(hazard?.baseTy) || width < 2 || width > 4
        || hazard.startTx < 2 || hazard.endTx >= WORLD_COLS - 1
        || hazard.baseTy < 2 || hazard.baseTy >= WORLD_ROWS) {
        addIssue(issues, path, 'invalid_teeth_geometry', 'must be an in-bounds two-to-four-tile bank');
        continue;
      }
      if (!Number.isFinite(hazard.offsetSeconds) || hazard.offsetSeconds < 0 || hazard.offsetSeconds >= cycle) {
        addIssue(issues, `${path}.offsetSeconds`, 'invalid_teeth_offset', 'must stay within the authored cycle');
      }
      for (let tx = hazard.startTx; tx <= hazard.endTx; tx += 1) {
        const cell = `${tx},${hazard.baseTy}`;
        if (cells.has(cell)) addIssue(issues, path, 'overlapping_teeth_banks', `overlaps bank cell ${cell}`);
        cells.add(cell);
        if (![Tile.STONE, Tile.GLOW].includes(level.map?.[hazard.baseTy]?.[tx])
          || level.map?.[hazard.baseTy - 1]?.[tx] !== Tile.AIR) {
          addIssue(issues, path, 'unsafe_teeth_recovery', 'must sit over solid recovery floor with an open tooth cell');
          break;
        }
      }
    }
    if (hazards.filter((hazard) => hazard.role === 'safe-lesson' && !hazard.damaging).length !== 1) {
      addIssue(issues, 'objective.hazards', 'missing_safe_teeth_lesson', 'must contain exactly one harmless demonstration bank');
    }
    if (hazards.filter((hazard) => hazard.role === 'oathbind-target' && hazard.damaging).length !== 1) {
      addIssue(issues, 'objective.hazards', 'invalid_oathbind_target', 'must contain exactly one damaging Oathbind target bank');
    }
  }

  if (level.map?.flat?.().some((tile) => tile === Tile.SPIKE || tile === Tile.CRUMBLE)
    || level.crushers?.length || level.relics?.length || level.ships?.length
    || level.boss || level.gameplay?.enemyRoster?.length) {
    addIssue(issues, 'objective', 'teeth_route_contamination', 'must use only deterministic dynamic teeth with no combat, static spikes, crumble, or arena state');
  }
  if (!level.block?.translationLocked || level.block?.disabled || !level.plate?.disabled) {
    addIssue(issues, 'block', 'invalid_oath_shelter', 'must provide one fixed enabled shelter block with no legacy plate authority');
  }
  const shelter = objective.oathShelter;
  if (!shelter || typeof shelter.id !== 'string' || typeof shelter.label !== 'string'
    || !objective.hazards?.some((hazard) => hazard.id === shelter.targetHazardId && hazard.role === 'oathbind-target')) {
    addIssue(issues, 'objective.oathShelter', 'invalid_oath_shelter', 'must name and target the one authored Oathbind bank');
  }
  const thresholds = objective.thresholds;
  const landing = thresholds?.masteryLanding;
  if (!Number.isFinite(thresholds?.lessonClearTx) || !Number.isFinite(thresholds?.controlledClearTx)
    || thresholds.lessonClearTx >= thresholds.controlledClearTx
    || !landing || !Number.isFinite(landing.minTx) || !Number.isFinite(landing.maxTx)
    || !Number.isInteger(landing.feetTy) || landing.minTx >= landing.maxTx) {
    addIssue(issues, 'objective.thresholds', 'invalid_teeth_thresholds', 'must define ordered lesson, controlled, and mastery landings');
  }
  for (const phase of ['observe', 'controlled', 'bind', 'mastery', 'complete']) {
    if (typeof objective.phaseHints?.[phase] !== 'string' || objective.phaseHints[phase].trim() === '') {
      addIssue(issues, `objective.phaseHints.${phase}`, 'invalid_phase_hint', 'must be a non-empty string');
    }
  }
  const monument = objective.finalMonument;
  if (!monument || typeof monument.id !== 'string' || typeof monument.label !== 'string'
    || !Number.isFinite(monument.tx) || monument.tx < 0 || monument.tx >= WORLD_COLS
    || !Number.isFinite(monument.baseTy) || monument.baseTy < 1 || monument.baseTy >= WORLD_ROWS) {
    addIssue(issues, 'objective.finalMonument', 'invalid_final_monument', 'must define the opened petitioners’ jaw');
  }
  if (!Array.isArray(objective.restorationTiles) || objective.restorationTiles.length === 0
    || objective.restorationTiles.some((tile) => !tile || tile.tile !== Tile.GLOW
      || !Number.isInteger(tile.tx) || !Number.isInteger(tile.ty)
      || ![Tile.STONE, Tile.GLOW].includes(level.map?.[tile.ty]?.[tile.tx]))) {
    addIssue(issues, 'objective.restorationTiles', 'unsafe_restoration', 'must replace bounded solid exit-dais cells with GLOW');
  }
}

function validateBellTower(level, issues) {
  const objective = level.objective;
  if (!objective || objective.type !== 'bell-tower-restoration') return;
  for (const field of ['hudLabel', 'title', 'requiresAbility', 'completionHint']) {
    if (typeof objective[field] !== 'string' || objective[field].trim() === '') {
      addIssue(issues, `objective.${field}`, 'invalid_text', 'must be a non-empty string');
    }
  }
  if (objective.requiresAbility !== 'memory-carve' || !level.gameplay?.assumedAbilities?.includes('memory-carve')) {
    addIssue(issues, 'objective.requiresAbility', 'invalid_bell_ability', 'must explicitly combine with the established memory-carve ability');
  }

  const unlock = level.abilityUnlock;
  if (!unlock || unlock.key !== 'pilgrims-grip'
    || ['name', 'input', 'description'].some((field) => typeof unlock[field] !== 'string' || unlock[field].trim() === '')) {
    addIssue(issues, 'abilityUnlock', 'invalid_pilgrims_grip', 'must name and explain the Pilgrim’s Grip input');
  }
  const target = level.targetTime;
  if (!target || !Number.isFinite(target.parSeconds) || !Number.isFinite(target.masterySeconds)
    || target.masterySeconds <= 0 || target.parSeconds <= target.masterySeconds) {
    addIssue(issues, 'targetTime', 'invalid_target_time', 'must define positive mastery and par times with mastery below par');
  }

  const lesson = objective.lesson;
  const lessonLanding = lesson?.landing;
  if (!lesson || ![-1, 1].includes(lesson.wallSide)
    || !Number.isFinite(lesson.minGripSeconds) || lesson.minGripSeconds < .35
    || !lessonLanding || !Number.isFinite(lessonLanding.minTx) || !Number.isFinite(lessonLanding.maxTx)
    || !Number.isInteger(lessonLanding.feetTy) || lessonLanding.minTx >= lessonLanding.maxTx) {
    addIssue(issues, 'objective.lesson', 'unsafe_grip_lesson', 'must require a deliberate grip and a broad safe landing');
  }
  for (let tx = 2; tx < WORLD_COLS - 1; tx += 1) {
    if (![Tile.STONE, Tile.GLOW].includes(level.map?.[26]?.[tx])) {
      addIssue(issues, 'map[26]', 'unsafe_climb_recovery', 'must keep a continuous solid ground recovery floor');
      break;
    }
  }

  const alternating = objective.alternating;
  const sides = alternating?.requiredJumpSides;
  const alternateLanding = alternating?.landing;
  if (!Array.isArray(sides) || sides.length < 2 || !sides.includes(-1) || !sides.includes(1)
    || sides.some((side, index) => ![-1, 1].includes(side) || (index > 0 && side === sides[index - 1]))
    || !alternateLanding || !Number.isFinite(alternateLanding.minTx) || !Number.isFinite(alternateLanding.maxTx)
    || !Number.isInteger(alternateLanding.feetTy) || alternateLanding.minTx >= alternateLanding.maxTx) {
    addIssue(issues, 'objective.alternating', 'invalid_wall_sequence', 'must require reachable alternating wall-jump sides and a safe upper landing');
  }

  const brace = objective.memoryBrace;
  if (!brace || brace.role !== 'wall-cling-carve' || typeof brace.id !== 'string' || brace.id.trim() === ''
    || !Number.isInteger(brace.tx) || !Number.isInteger(brace.ty)
    || brace.tx < 1 || brace.tx >= WORLD_COLS - 1 || brace.ty < 1 || brace.ty >= WORLD_ROWS - 1
    || level.map?.[brace.ty]?.[brace.tx] !== Tile.SAND
    || !brace.safeLanding || !Number.isFinite(brace.safeLanding.minTx)
    || !Number.isFinite(brace.safeLanding.maxTx) || !Number.isInteger(brace.safeLanding.feetTy)
    || typeof brace.revealText !== 'string' || brace.revealText.trim() === '') {
    addIssue(issues, 'objective.memoryBrace', 'invalid_memory_brace', 'must define one non-structural body-height SAND brace with a safe landing');
  }
  if (level.map?.flat?.().filter((tile) => tile === Tile.SAND).length !== 1) {
    addIssue(issues, 'map', 'ambiguous_memory_brace', 'must contain exactly one SAND cell for the authored combination');
  }

  const collapse = objective.collapse;
  if (!collapse || !Number.isFinite(collapse.warningSeconds) || collapse.warningSeconds < .9
    || !Number.isFinite(collapse.goneSeconds) || collapse.goneSeconds < 2 || collapse.goneSeconds > 6
    || !Array.isArray(collapse.sections) || collapse.sections.length < 3 || collapse.sections.length > 5) {
    addIssue(issues, 'objective.collapse', 'unsafe_grouped_collapse', 'must define three to five finite grouped ledges with readable warning and recovery time');
  }
  if (Array.isArray(collapse?.sections)) {
    const ids = new Set();
    const cells = new Set();
    let previousTy = WORLD_ROWS;
    collapse.sections.forEach((section, index) => {
      const path = `objective.collapse.sections[${index}]`;
      if (!section || typeof section.id !== 'string' || section.id.trim() === '' || ids.has(section.id)) {
        addIssue(issues, `${path}.id`, 'duplicate_collapse_id', 'must be a unique non-empty string');
      }
      ids.add(section?.id);
      if (!Number.isInteger(section?.tx) || !Number.isInteger(section?.ty)
        || !Number.isInteger(section?.widthTiles) || section.widthTiles !== 2
        || section.tx < 1 || section.tx + section.widthTiles > WORLD_COLS - 1
        || section.ty < 1 || section.ty >= WORLD_ROWS - 1
        || section.state !== 'stable' || section.timer !== 0
        || !Number.isFinite(section.x) || !Number.isFinite(section.y)
        || section.x !== section.tx * TILE || section.y !== section.ty * TILE
        || section.w !== section.widthTiles * TILE || section.h < 8 || section.h > 18) {
        addIssue(issues, path, 'invalid_collapse_geometry', 'must define a pristine two-tile overlay ledge in bounds');
        return;
      }
      if (section.ty >= previousTy) addIssue(issues, path, 'unordered_collapse', 'must rise in authored bottom-to-top order');
      previousTy = section.ty;
      for (let tx = section.tx; tx < section.tx + section.widthTiles; tx += 1) {
        const cell = `${tx},${section.ty}`;
        if (cells.has(cell)) addIssue(issues, path, 'overlapping_collapse', `overlaps ${cell}`);
        cells.add(cell);
        if (level.map?.[section.ty]?.[tx] !== Tile.AIR) {
          addIssue(issues, path, 'structural_collapse', 'must remain an overlay outside every permanent wall and platform');
        }
      }
    });
  }

  const exit = objective.masteryExit;
  const bell = objective.bell;
  if (!exit || !Number.isFinite(exit.minCenterTx) || !Number.isFinite(exit.maxFeetTy)
    || exit.minCenterTx < 2 || exit.minCenterTx >= WORLD_COLS - 1 || exit.maxFeetTy < 1
    || !bell || typeof bell.id !== 'string' || typeof bell.label !== 'string'
    || !Number.isFinite(bell.tx) || !Number.isFinite(bell.baseTy) || !Number.isFinite(bell.strikeRadius)
    || bell.tx < exit.minCenterTx || bell.tx >= WORLD_COLS - 1 || bell.baseTy < 1 || bell.baseTy >= WORLD_ROWS
    || bell.strikeRadius < TILE || bell.strikeRadius > TILE * 4) {
    addIssue(issues, 'objective.bell', 'invalid_bell_chamber', 'must define a reachable broad summit and named strikeable bell');
  }
  const puzzle = bell?.puzzle;
  const chimes = puzzle?.chimes;
  const chimeIds = Array.isArray(chimes) ? chimes.map((chime) => chime?.id) : [];
  const sequence = puzzle?.sequence;
  const uniqueChimeIds = new Set(chimeIds);
  if (!puzzle || typeof puzzle.clue !== 'string' || puzzle.clue.trim() === ''
    || !Array.isArray(chimes) || chimes.length !== 3 || uniqueChimeIds.size !== chimes.length
    || chimes.some((chime) => !chime || typeof chime.id !== 'string' || chime.id.trim() === ''
      || typeof chime.label !== 'string' || chime.label.trim() === ''
      || !Number.isFinite(chime.tx) || !Number.isInteger(chime.baseTy)
      || chime.tx < exit?.minCenterTx || chime.tx >= level.gateColumn
      || chime.baseTy !== exit?.maxFeetTy || chime.struck !== false)
    || !Array.isArray(sequence) || sequence.length !== chimes?.length
    || new Set(sequence).size !== sequence.length
    || sequence.some((id) => !uniqueChimeIds.has(id))
    || !Array.isArray(puzzle.progress) || puzzle.progress.length !== 0
    || puzzle.mistakes !== 0) {
    addIssue(issues, 'objective.bell.puzzle', 'invalid_bell_sequence', 'must define three pristine summit chimes and one clue-backed permutation');
  }
  if (exit && Number.isFinite(exit.minCenterTx) && Number.isInteger(exit.maxFeetTy)
    && Number.isInteger(level.gateColumn)) {
    const summitStart = Math.ceil(exit.minCenterTx);
    const summitRow = level.map?.[exit.maxFeetTy];
    for (let tx = summitStart; tx <= level.gateColumn; tx += 1) {
      if (summitRow?.[tx] !== Tile.ONEWAY) {
        addIssue(issues, 'objective.masteryExit', 'unsafe_summit', 'must provide an unbroken landing from the mastery threshold to the sealed bell chamber');
        break;
      }
    }
  }
  if (!Array.isArray(objective.lightWindows) || objective.lightWindows.length < 2
    || objective.lightWindows.some((window) => !window || typeof window.id !== 'string'
      || !Number.isFinite(window.tx) || !Number.isFinite(window.ty)
      || window.tx < 0 || window.tx >= WORLD_COLS || window.ty < 0 || window.ty >= WORLD_ROWS)) {
    addIssue(issues, 'objective.lightWindows', 'invalid_bell_restoration', 'must define multiple in-bounds tower lights for the restoration payoff');
  }
  for (const phase of ['learn', 'alternate', 'carve', 'collapse', 'ring', 'complete']) {
    if (typeof objective.phaseHints?.[phase] !== 'string' || objective.phaseHints[phase].trim() === '') {
      addIssue(issues, `objective.phaseHints.${phase}`, 'invalid_phase_hint', 'must be a non-empty string');
    }
  }

  if (!level.block?.disabled || !level.plate?.disabled || level.relics?.length || level.ships?.length
    || level.crushers?.length || level.movers?.length || level.water?.length || level.veilPlatforms?.length
    || level.boss || level.gameplay?.enemyRoster?.length
    || level.map?.flat?.().some((tile) => tile === Tile.SPIKE || tile === Tile.CRUMBLE || tile === Tile.CRYSTAL)) {
    addIssue(issues, 'objective', 'bell_route_contamination', 'must remain a finite non-combat climb with only authored overlay collapses');
  }
}

function validateSanctumLamp(level, issues) {
  const objective = level.objective;
  if (!objective || objective.type !== 'sanctum-lamp-restoration') return;
  for (const field of ['hudLabel', 'title', 'requiresAbility', 'completionHint']) {
    if (typeof objective[field] !== 'string' || objective[field].trim() === '') {
      addIssue(issues, `objective.${field}`, 'invalid_text', 'must be a non-empty string');
    }
  }
  if (objective.requiresAbility !== 'oathbind' || !level.gameplay?.assumedAbilities?.includes('oathbind')) {
    addIssue(issues, 'objective.requiresAbility', 'invalid_sanctum_ability', 'must bind the lamp with the established Oathbind ability');
  }
  const unlock = level.abilityUnlock;
  if (!unlock || unlock.key !== 'sanctum-recall'
    || ['name', 'input', 'description'].some((field) => typeof unlock[field] !== 'string' || unlock[field].trim() === '')) {
    addIssue(issues, 'abilityUnlock', 'invalid_sanctum_recall', 'must name and explain the Sanctum Recall contract');
  }
  const target = level.targetTime;
  if (!target || !Number.isFinite(target.parSeconds) || !Number.isFinite(target.masterySeconds)
    || target.masterySeconds <= 0 || target.parSeconds <= target.masterySeconds) {
    addIssue(issues, 'targetTime', 'invalid_target_time', 'must define positive mastery and par times with mastery below par');
  }
  if (level.checkpoints?.length) {
    addIssue(issues, 'checkpoints', 'ambiguous_sanctum_checkpoint', 'must use only the authored in-run lamp return, not legacy x-threshold checkpoints');
  }

  const lamp = objective.lamp;
  const checkpoint = lamp?.checkpoint;
  if (!lamp || typeof lamp.id !== 'string' || typeof lamp.label !== 'string'
    || !Number.isFinite(lamp.tx) || lamp.tx < 2 || lamp.tx >= WORLD_COLS - 1
    || !Number.isFinite(lamp.baseTy) || lamp.baseTy < 2 || lamp.baseTy >= WORLD_ROWS
    || !Number.isFinite(lamp.interactRadius) || lamp.interactRadius < TILE || lamp.interactRadius > TILE * 3
    || lamp.bound !== false || lamp.boundAt !== null
    || !checkpoint || typeof checkpoint.id !== 'string' || checkpoint.id.trim() === ''
    || !Number.isFinite(checkpoint.x) || !Number.isFinite(checkpoint.y)
    || checkpoint.x < TILE * 2 || checkpoint.x >= WORLD_W - TILE
    || checkpoint.y < 0 || checkpoint.y >= WORLD_H || ![-1, 1].includes(checkpoint.facing)) {
    addIssue(issues, 'objective.lamp', 'invalid_sanctum_lamp', 'must define one pristine lamp and a named in-bounds return anchor');
  } else {
    const spawnTx = Math.floor((checkpoint.x + 14) / TILE);
    const feetTy = Math.round((checkpoint.y + 44) / TILE);
    if (feetTy !== 26 || ![Tile.STONE, Tile.GLOW].includes(level.map?.[feetTy]?.[spawnTx])
      || level.map?.[feetTy - 1]?.[spawnTx] !== Tile.AIR
      || level.map?.[feetTy - 2]?.[spawnTx] !== Tile.AIR) {
      addIssue(issues, 'objective.lamp.checkpoint', 'unsafe_sanctum_checkpoint', 'must stand on permanent safe floor with two clear headroom cells');
    }
  }

  const arch = objective.arch;
  if (!arch || typeof arch.id !== 'string' || ![-1, 1].includes(arch.requiredWallSide)
    || arch.gripJumpRecorded !== false || arch.open !== false
    || !arch.landing || !Number.isFinite(arch.landing.minTx) || !Number.isFinite(arch.landing.maxTx)
    || !Number.isInteger(arch.landing.feetTy) || arch.landing.minTx >= arch.landing.maxTx
    || !Array.isArray(arch.openCells) || arch.openCells.length !== 2
    || arch.openCells.some((cell) => !cell || cell.tile !== Tile.AIR
      || !Number.isInteger(cell.tx) || !Number.isInteger(cell.ty)
      || level.map?.[cell.ty]?.[cell.tx] !== Tile.STONE)) {
    addIssue(issues, 'objective.arch', 'invalid_sanctum_arch', 'must define one pristine Pilgrim’s Grip arch with a broad landing and two-cell doorway');
  }

  const witness = objective.witness;
  if (!witness || typeof witness.id !== 'string' || typeof witness.label !== 'string'
    || !Number.isFinite(witness.tx) || !Number.isFinite(witness.baseTy)
    || witness.reached !== false || witness.reachedAt !== null
    || !witness.zone || !Number.isFinite(witness.zone.minTx) || !Number.isFinite(witness.zone.maxTx)
    || !Number.isInteger(witness.zone.feetTy) || witness.zone.minTx >= witness.zone.maxTx
    || witness.zone.minTx <= arch?.landing?.maxTx) {
    addIssue(issues, 'objective.witness', 'invalid_sanctum_witness', 'must define one ordered, grounded far witness after the grip arch');
  }

  const fields = objective.returnFields;
  if (!Array.isArray(fields) || fields.length < 2 || fields.length > 5
    || fields.filter((field) => field?.role === 'return').length !== 1) {
    addIssue(issues, 'objective.returnFields', 'invalid_sanctum_returns', 'must define bounded forgetting wells and exactly one deliberate return veil');
  }
  if (Array.isArray(fields)) {
    const ids = new Set();
    const coveredPitCells = new Set();
    fields.forEach((field, index) => {
      const path = `objective.returnFields[${index}]`;
      if (!field || typeof field.id !== 'string' || field.id.trim() === '' || ids.has(field.id)
        || typeof field.label !== 'string' || field.label.trim() === ''
        || !['fall', 'return'].includes(field.role)
        || !Number.isFinite(field.x) || !Number.isFinite(field.y)
        || !Number.isFinite(field.w) || !Number.isFinite(field.h)
        || field.x < 0 || field.y < 0 || field.w <= 0 || field.h <= 0
        || field.x + field.w > WORLD_W || field.y + field.h > WORLD_H) {
        addIssue(issues, path, 'invalid_return_field', 'must be uniquely named, in bounds, and use a supported return role');
        return;
      }
      ids.add(field.id);
      if (field.role === 'fall') {
        const startTx = field.x / TILE;
        const widthTiles = field.w / TILE;
        if (!Number.isInteger(startTx) || !Number.isInteger(widthTiles) || field.y > 26 * TILE + 12) {
          addIssue(issues, path, 'unsafe_return_field', 'must cover whole authored pit columns before world-bottom damage');
          return;
        }
        for (let tx = startTx; tx < startTx + widthTiles; tx += 1) {
          if (level.map?.[26]?.[tx] !== Tile.AIR) {
            addIssue(issues, path, 'mist_over_solid_floor', `covers solid ground at ${tx},26`);
          }
          if (coveredPitCells.has(tx)) addIssue(issues, path, 'overlapping_return_field', `overlaps pit column ${tx}`);
          coveredPitCells.add(tx);
        }
      }
    });
    for (let tx = 2; tx < WORLD_COLS - 1; tx += 1) {
      if (level.map?.[26]?.[tx] === Tile.AIR && !coveredPitCells.has(tx)) {
        addIssue(issues, 'objective.returnFields', 'uncovered_sanctum_pit', `must cover open ground column ${tx}`);
      }
    }
  }

  const finalZone = objective.finalZone;
  const canopy = objective.canopy;
  if (!finalZone || !Number.isFinite(finalZone.minTx) || !Number.isFinite(finalZone.maxTx)
    || !Number.isInteger(finalZone.feetTy) || finalZone.minTx >= finalZone.maxTx
    || finalZone.maxTx >= lamp?.tx
    || !canopy || typeof canopy.id !== 'string' || typeof canopy.label !== 'string'
    || !Number.isFinite(canopy.x) || !Number.isFinite(canopy.y)
    || !Number.isFinite(canopy.w) || !Number.isFinite(canopy.h)
    || canopy.x < 0 || canopy.y < 0 || canopy.w <= 0 || canopy.h <= 0
    || canopy.x + canopy.w > WORLD_W || canopy.y + canopy.h > WORLD_H
    || canopy.restored !== false) {
    addIssue(issues, 'objective.canopy', 'invalid_sanctum_climax', 'must define a safe westward final zone and pristine in-bounds canopy');
  }
  if (!Array.isArray(objective.lightColumns) || objective.lightColumns.length < 2
    || objective.lightColumns.some((column) => !column || typeof column.id !== 'string'
      || !Number.isFinite(column.tx) || !Number.isFinite(column.ty) || column.lit !== false)) {
    addIssue(issues, 'objective.lightColumns', 'invalid_sanctum_restoration', 'must define multiple pristine light columns');
  }
  for (const phase of ['find', 'outward', 'return', 'sanctum', 'complete']) {
    if (typeof objective.phaseHints?.[phase] !== 'string' || objective.phaseHints[phase].trim() === '') {
      addIssue(issues, `objective.phaseHints.${phase}`, 'invalid_phase_hint', 'must be a non-empty string');
    }
  }
  if (!level.block?.disabled || !level.plate?.disabled || level.relics?.length || level.ships?.length
    || level.crushers?.length || level.movers?.length || level.water?.length || level.veilPlatforms?.length
    || level.boss || level.gameplay?.enemyRoster?.length
    || level.map?.flat?.().some((tile) => tile === Tile.SPIKE || tile === Tile.CRUMBLE || tile === Tile.CRYSTAL || tile === Tile.SAND)) {
    addIssue(issues, 'objective', 'sanctum_route_contamination', 'must remain a finite non-combat recall route without other active mechanisms');
  }
}

function validateParachuteChoir(level, issues) {
  const objective = level.objective;
  if (!objective || objective.type !== 'parachute-choir-restoration') return;
  for (const field of ['hudLabel', 'title', 'requiresAbility', 'completionHint']) {
    if (typeof objective[field] !== 'string' || objective[field].trim() === '') {
      addIssue(issues, `objective.${field}`, 'invalid_text', 'must be a non-empty string');
    }
  }
  if (objective.requiresAbility !== 'pilgrims-grip'
    || !level.gameplay?.assumedAbilities?.includes('pilgrims-grip')) {
    addIssue(issues, 'objective.requiresAbility', 'invalid_raid_ability', 'must combine Dawnstroke with the established Pilgrim’s Grip');
  }
  const unlock = level.abilityUnlock;
  if (!unlock || unlock.key !== 'dawnstroke' || unlock.name !== 'Dawnstroke'
    || ['input', 'description'].some((field) => typeof unlock[field] !== 'string' || unlock[field].trim() === '')) {
    addIssue(issues, 'abilityUnlock', 'invalid_dawnstroke', 'must name and explain the Dawnstroke combat contract');
  }
  const target = level.targetTime;
  if (!target || !Number.isFinite(target.parSeconds) || !Number.isFinite(target.masterySeconds)
    || target.masterySeconds <= 0 || target.parSeconds <= target.masterySeconds) {
    addIssue(issues, 'targetTime', 'invalid_target_time', 'must define positive mastery and par times with mastery below par');
  }
  if (level.checkpoints?.length) {
    addIssue(issues, 'checkpoints', 'ambiguous_raid_checkpoint', 'life-over must rebuild the complete finite roster from realm spawn');
  }

  const ships = level.ships;
  const shipIds = new Set();
  if (!Array.isArray(ships) || ships.length !== 3) {
    addIssue(issues, 'ships', 'invalid_raid_ships', 'must define exactly three named formation craft');
  } else {
    ships.forEach((ship, index) => {
      if (!ship || typeof ship.id !== 'string' || ship.id.trim() === '' || shipIds.has(ship.id)
        || !Number.isFinite(ship.x) || !Number.isFinite(ship.y) || !Number.isFinite(ship.phase)
        || ship.x < TILE || ship.x > WORLD_W - TILE || ship.y < TILE || ship.y > WORLD_H - TILE) {
        addIssue(issues, `ships[${index}]`, 'invalid_raid_ship', 'must be uniquely named and begin inside the visible world');
      }
      shipIds.add(ship?.id);
    });
  }

  const stages = objective.stages;
  const stageIds = new Set();
  const listedRosterIds = [];
  if (!Array.isArray(stages) || stages.length !== 3) {
    addIssue(issues, 'objective.stages', 'invalid_raid_stages', 'must define one lesson and two advancing finite formations');
  } else {
    let previousTrigger = -Infinity;
    stages.forEach((stage, index) => {
      const path = `objective.stages[${index}]`;
      if (!stage || typeof stage.id !== 'string' || stage.id.trim() === '' || stageIds.has(stage.id)
        || typeof stage.label !== 'string' || stage.label.trim() === ''
        || !Number.isFinite(stage.triggerTx) || stage.triggerTx <= previousTrigger
        || !Array.isArray(stage.rosterIds) || stage.rosterIds.length < 1 || stage.rosterIds.length > 2
        || stage.active !== false || stage.complete !== false
        || stage.startedAt !== null || stage.completedAt !== null) {
        addIssue(issues, path, 'invalid_raid_stage', 'must be pristine, ordered, broad, and cap authored concurrency at two');
      }
      previousTrigger = stage?.triggerTx;
      stageIds.add(stage?.id);
      listedRosterIds.push(...(stage?.rosterIds || []));
    });
  }

  const roster = objective.roster;
  const rosterIds = new Set();
  if (!Array.isArray(roster) || roster.length !== 5) {
    addIssue(issues, 'objective.roster', 'invalid_raid_roster', 'must contain exactly five finite authored voices');
  } else {
    roster.forEach((entry, index) => {
      const path = `objective.roster[${index}]`;
      if (!entry || typeof entry.id !== 'string' || entry.id.trim() === '' || rosterIds.has(entry.id)
        || typeof entry.label !== 'string' || entry.label.trim() === ''
        || !stageIds.has(entry.stageId) || !shipIds.has(entry.shipId)
        || !['grunt', 'spear', 'shield'].includes(entry.kind)
        || !Number.isInteger(entry.hp) || entry.hp < 2 || entry.hp > 3
        || !Number.isFinite(entry.dropTx) || entry.dropTx < 3 || entry.dropTx > WORLD_COLS - 4
        || !Number.isFinite(entry.delay) || entry.delay < .8
        || !Number.isFinite(entry.telegraphSeconds) || entry.telegraphSeconds < .7
        || !Number.isFinite(entry.recoverySeconds) || entry.recoverySeconds < .78
        || entry.status !== 'queued' || entry.spawnedAt !== null || entry.defeatedAt !== null) {
        addIssue(issues, path, 'invalid_raid_member', 'must be a stable queued melee voice with readable timings and safe authored descent');
      }
      const tx = Math.floor(entry?.dropTx);
      const landingTy = level.map?.findIndex((row) => [Tile.STONE, Tile.GLOW, Tile.ONEWAY].includes(row?.[tx]));
      if (landingTy < 2 || level.map?.[landingTy - 1]?.[tx] !== Tile.AIR
        || level.map?.[landingTy - 2]?.[tx] !== Tile.AIR) {
        addIssue(issues, `${path}.dropTx`, 'unsafe_raid_landing', 'must descend onto permanent support with two clear headroom cells');
      }
      rosterIds.add(entry?.id);
    });
  }
  if (listedRosterIds.length !== rosterIds.size
    || new Set(listedRosterIds).size !== listedRosterIds.length
    || listedRosterIds.some((id) => !rosterIds.has(id))) {
    addIssue(issues, 'objective.stages', 'invalid_raid_membership', 'must partition every stable roster ID exactly once');
  }
  if (objective.defeatedCount !== 0 || objective.spawnedCount !== 0 || objective.encounterClock !== 0) {
    addIssue(issues, 'objective', 'dirty_raid_state', 'must begin with zero encounter time, spawns, and defeats');
  }

  const skycut = objective.skycut;
  const tether = skycut?.tether;
  const seesaw = skycut?.seesaw;
  if (!skycut || ![-1, 1].includes(skycut.requiredWallSide)
    || skycut.gripJumpRecorded !== false || skycut.landed !== false || skycut.completed !== false
    || !skycut.landing || !Number.isFinite(skycut.landing.minTx) || !Number.isFinite(skycut.landing.maxTx)
    || !Number.isInteger(skycut.landing.feetTy) || skycut.landing.minTx >= skycut.landing.maxTx
    || !tether || typeof tether.id !== 'string' || !Number.isFinite(tether.tx)
    || !Number.isFinite(tether.baseTy) || !Number.isFinite(tether.strikeRadius)
    || tether.strikeRadius < TILE || tether.strikeRadius > TILE * 3 || tether.cut !== false) {
    addIssue(issues, 'objective.skycut', 'invalid_raid_skycut', 'must define one pristine, broad Grip landing and strikeable command tether');
  }
  if (!seesaw || seesaw.id !== 'cantor-skyboard'
    || !Number.isFinite(seesaw.x) || !Number.isFinite(seesaw.y)
    || !Number.isFinite(seesaw.w) || !Number.isFinite(seesaw.h)
    || seesaw.w !== 6 * TILE || seesaw.h < 10 || seesaw.h > 20
    || seesaw.pivotX !== seesaw.x + seesaw.w / 2 || seesaw.pivotY !== seesaw.y
    || seesaw.angle !== 0 || !Number.isFinite(seesaw.maxAngle)
    || seesaw.maxAngle < .16 || seesaw.maxAngle > .26
    || !Number.isFinite(seesaw.windAmplitude) || seesaw.windAmplitude < .02 || seesaw.windAmplitude > .06
    || !Number.isFinite(seesaw.windSpeed) || seesaw.windSpeed < 1.5 || seesaw.windSpeed > 3.5
    || !Number.isFinite(seesaw.stabilityAngle)
    || seesaw.stabilityAngle < .015 || seesaw.stabilityAngle > .04
    || seesaw.balanceSeconds !== 0 || seesaw.balanced !== false
    || !Number.isFinite(seesaw.requiredBalanceSeconds)
    || seesaw.requiredBalanceSeconds < .8 || seesaw.requiredBalanceSeconds > 1.5
    || !Number.isFinite(seesaw.centerTolerance)
    || seesaw.centerTolerance < TILE * .4 || seesaw.centerTolerance > TILE
    || level.map?.[24]?.slice(30, 36).some((tile) => tile !== Tile.AIR)) {
    addIssue(issues, 'objective.skycut.seesaw', 'invalid_raid_seesaw', 'must define one pristine six-tile walkable balance board over clear authored cells');
  }

  const formationKeys = ['lesson', 'flank', 'chorus', 'finale', 'updraft', 'complete'];
  for (const phase of formationKeys) {
    const formation = objective.formations?.[phase];
    if (!Array.isArray(formation) || formation.length !== shipIds.size
      || new Set(formation.map((item) => item?.shipId)).size !== shipIds.size
      || formation.some((item) => !shipIds.has(item?.shipId)
        || !Number.isFinite(item?.tx) || !Number.isFinite(item?.ty))) {
      addIssue(issues, `objective.formations.${phase}`, 'invalid_raid_formation', 'must place every named craft exactly once in each formation');
    }
  }
  const sails = objective.windSails;
  if (!Array.isArray(sails) || sails.length !== rosterIds.size
    || new Set(sails.map((sail) => sail?.rosterId)).size !== rosterIds.size
    || sails.some((sail) => !sail || typeof sail.id !== 'string' || !rosterIds.has(sail.rosterId)
      || !Number.isFinite(sail.tx) || !Number.isFinite(sail.ty) || sail.unfurled !== false)
    || objective.skyRestored !== false) {
    addIssue(issues, 'objective.windSails', 'invalid_raid_restoration', 'must define one pristine wind-sail for each finite voice');
  }
  const loom = objective.windLoom;
  const launch = loom?.launch;
  const ring = loom?.ring;
  if (!loom || loom.id !== 'living-updraft' || loom.clock !== 0 || loom.state !== 'warning'
    || loom.launched !== false || loom.crossed !== false || loom.attempts !== 0
    || !Number.isFinite(loom.cycleSeconds) || loom.cycleSeconds < 3 || loom.cycleSeconds > 5
    || !Number.isFinite(loom.warningSeconds) || loom.warningSeconds < 1.1
    || !Number.isFinite(loom.liftSeconds) || loom.liftSeconds < .9
    || loom.warningSeconds + loom.liftSeconds >= loom.cycleSeconds - .6
    || !launch || !Number.isFinite(launch.minTx) || !Number.isFinite(launch.maxTx)
    || !Number.isInteger(launch.feetTy) || launch.minTx >= launch.maxTx
    || !ring || !Number.isFinite(ring.tx) || !Number.isFinite(ring.ty)
    || !Number.isFinite(ring.radius) || ring.radius < TILE || ring.radius > TILE * 2
    || ring.tx < launch.minTx || ring.tx > launch.maxTx || ring.ty >= launch.feetTy - 2
    || Math.ceil(launch.minTx) < 1 || Math.floor(launch.maxTx) >= WORLD_COLS - 1
    || Array.from(
      { length: Math.floor(launch.maxTx) - Math.ceil(launch.minTx) + 1 },
      (_item, index) => level.map?.[launch.feetTy]?.[Math.ceil(launch.minTx) + index],
    ).some((tile) => tile !== Tile.ONEWAY)) {
    addIssue(issues, 'objective.windLoom', 'invalid_raid_updraft', 'must define one pristine, harmless, supported cyan updraft and broad in-bounds sky-ring');
  }
  for (const phase of ['lesson', 'flank', 'chorus', 'finale', 'updraft', 'complete']) {
    if (typeof objective.phaseHints?.[phase] !== 'string' || objective.phaseHints[phase].trim() === '') {
      addIssue(issues, `objective.phaseHints.${phase}`, 'invalid_phase_hint', 'must be a non-empty string');
    }
  }
  if (level.arenaStart !== 90 || level.spawnEvery !== undefined || level.maxEnemies !== undefined
    || !level.block?.disabled || !level.plate?.disabled || level.relics?.length || level.boss
    || level.crushers?.length || level.movers?.length || level.water?.length || level.veilPlatforms?.length
    || level.gameplay?.enemyRoster?.some((kind) => !['grunt', 'spear', 'shield'].includes(kind))
    || level.map?.flat?.().some((tile) => tile === Tile.SPIKE || tile === Tile.CRUMBLE || tile === Tile.CRYSTAL || tile === Tile.SAND)) {
    addIssue(issues, 'objective', 'raid_route_contamination', 'must use only the finite authored melee raid on a permanent safe route');
  }
  for (let tx = 2; tx < WORLD_COLS - 1; tx += 1) {
    if (level.map?.[26]?.[tx] !== Tile.STONE && level.map?.[26]?.[tx] !== Tile.GLOW) {
      addIssue(issues, 'map[26]', 'unsafe_raid_floor', `must retain permanent recovery floor at column ${tx}`);
      break;
    }
  }
}

function validateVeilGate(level, issues) {
  const objective = level.objective;
  if (!objective || objective.type !== 'veil-gate-restoration') return;
  for (const field of ['hudLabel', 'title', 'completionHint']) {
    if (typeof objective[field] !== 'string' || objective[field].trim() === '') {
      addIssue(issues, `objective.${field}`, 'invalid_text', 'must be a non-empty string');
    }
  }

  const requiredAbilities = ['memory-carve', 'oathbind', 'pilgrims-grip', 'dawnstroke'];
  if (JSON.stringify(objective.requiresAbilities) !== JSON.stringify(requiredAbilities)
    || JSON.stringify(level.gameplay?.assumedAbilities) !== JSON.stringify(requiredAbilities)
    || level.abilityUnlock !== undefined) {
    addIssue(issues, 'objective.requiresAbilities', 'invalid_veil_gate_abilities', 'must combine exactly the four established abilities without awarding another unlock');
  }
  const target = level.targetTime;
  if (!target || !Number.isFinite(target.parSeconds) || !Number.isFinite(target.masterySeconds)
    || target.masterySeconds <= 0 || target.parSeconds <= target.masterySeconds) {
    addIssue(issues, 'targetTime', 'invalid_target_time', 'must define positive mastery and par times with mastery below par');
  }

  const mark = objective.memoryMark;
  if (!mark || typeof mark.id !== 'string' || mark.role !== 'gate-memory'
    || !Number.isInteger(mark.tx) || !Number.isInteger(mark.ty) || mark.revealed !== false
    || level.map?.[mark.ty]?.[mark.tx] !== Tile.SAND) {
    addIssue(issues, 'objective.memoryMark', 'invalid_veil_memory_mark', 'must begin as one stable buried gate-memory seal');
  }
  if (level.map?.flat?.().filter((tile) => tile === Tile.SAND).length !== 1) {
    addIssue(issues, 'map', 'ambiguous_veil_memory', 'must contain exactly one authored sand seal');
  }

  const counterweight = objective.counterweight;
  if (!counterweight || counterweight.blockId !== level.block?.id
    || counterweight.bound !== false || counterweight.locked !== false
    || !level.block || level.block.disabled || level.block.bound !== false
    || !counterweight.zone || !Number.isFinite(counterweight.zone.x)
    || !Number.isFinite(counterweight.zone.y) || !Number.isFinite(counterweight.zone.w)
    || !Number.isFinite(counterweight.zone.h) || counterweight.zone.w < level.block.w) {
    addIssue(issues, 'objective.counterweight', 'invalid_veil_counterweight', 'must define one movable pristine block and a broad in-bounds oath seat');
  } else {
    validateRect(counterweight.zone, 'objective.counterweight.zone', issues);
  }

  const latch = objective.upperLatch;
  if (!latch || ![-1, 1].includes(latch.requiredWallSide)
    || latch.gripJumpRecorded !== false || latch.reached !== false || latch.retryHintShown !== false
    || !latch.landing || !Number.isFinite(latch.landing.minTx)
    || !Number.isFinite(latch.landing.maxTx) || !Number.isInteger(latch.landing.feetTy)
    || latch.landing.minTx >= latch.landing.maxTx) {
    addIssue(issues, 'objective.upperLatch', 'invalid_veil_latch', 'must define one pristine genuine Grip proof and broad safe landing');
  } else {
    for (let tx = Math.ceil(latch.landing.minTx); tx <= Math.floor(latch.landing.maxTx); tx += 1) {
      const tile = level.map?.[latch.landing.feetTy]?.[tx];
      if (![Tile.ONEWAY, Tile.GATE, Tile.STONE].includes(tile)) {
        addIssue(issues, 'objective.upperLatch.landing', 'unsafe_veil_landing', `must retain permanent support at ${tx},${latch.landing.feetTy}`);
        break;
      }
    }
  }

  const encounter = objective.encounter;
  const stage = encounter?.stages?.[0];
  const member = encounter?.roster?.[0];
  if (!encounter || encounter.clock !== 0 || encounter.spawnedCount !== 0
    || encounter.defeatedCount !== 0 || encounter.maxActive !== 1
    || encounter.stages?.length !== 1 || encounter.roster?.length !== 1
    || !stage || stage.id !== 'crown-watch' || stage.active !== false || stage.complete !== false
    || stage.startedAt !== null || stage.completedAt !== null
    || JSON.stringify(stage.rosterIds) !== JSON.stringify([member?.id])) {
    addIssue(issues, 'objective.encounter', 'invalid_veil_encounter', 'must begin as one pristine finite one-keeper watch');
  }
  if (!member || member.id !== 'keeper-of-the-first-seal' || member.kind !== 'shield'
    || member.hp !== 3 || member.status !== 'queued' || member.spawnedAt !== null || member.defeatedAt !== null
    || !Number.isFinite(member.spawnTx) || !Number.isInteger(member.feetTy)
    || !Number.isFinite(member.minTx) || !Number.isFinite(member.maxTx)
    || member.minTx >= member.spawnTx || member.spawnTx >= member.maxTx
    || member.telegraphSeconds < 1 || member.recoverySeconds < 1) {
    addIssue(issues, 'objective.encounter.roster[0]', 'invalid_veil_keeper', 'must be the stable queued shield keeper with readable one-second tells and recovery');
  } else if (![Tile.ONEWAY, Tile.GATE].includes(level.map?.[member.feetTy]?.[Math.floor(member.spawnTx)])) {
    addIssue(issues, 'objective.encounter.roster[0].spawnTx', 'unsafe_veil_keeper_spawn', 'must begin on the permanent upper lintel');
  }

  const sunstone = objective.sunstone;
  if (!sunstone || sunstone.id !== 'first-seal-sunstone'
    || !Number.isFinite(sunstone.tx) || !Number.isFinite(sunstone.baseTy)
    || !Number.isFinite(sunstone.strikeRadius) || sunstone.strikeRadius < TILE
    || sunstone.strikeRadius > TILE * 3 || sunstone.exposed !== false || sunstone.struck !== false) {
    addIssue(issues, 'objective.sunstone', 'invalid_veil_sunstone', 'must define one pristine nearby Dawnstroke keystone');
  }
  if (!objective.cartographersTurn || objective.cartographersTurn.label !== "The Cartographer's Turn"
    || objective.cartographersTurn.restored !== false || objective.gateRestored !== false) {
    addIssue(issues, 'objective.cartographersTurn', 'invalid_veil_mastery', 'must begin with the named mastery turn and gate unrestored');
  }
  if (!Array.isArray(objective.relayBanners) || objective.relayBanners.length !== 2
    || objective.relayBanners.some((banner) => !banner || typeof banner.id !== 'string'
      || !Number.isFinite(banner.tx) || !Number.isFinite(banner.baseTy) || banner.restored !== false)) {
    addIssue(issues, 'objective.relayBanners', 'invalid_veil_restoration', 'must define two pristine large-scale restoration beacons');
  }
  const restorationKeys = new Set((objective.restorationTiles || []).map(({ tx, ty }) => `${tx}:${ty}`));
  if (objective.restorationTiles?.length !== 18 || restorationKeys.size !== 18
    || objective.restorationTiles.some(({ tx, ty, tile }) => ty !== 20 || tx < 29 || tx > 46 || tile !== Tile.GLOW)) {
    addIssue(issues, 'objective.restorationTiles', 'unsafe_veil_restoration', 'must restore the complete eighteen-cell crown walk exactly once');
  }
  for (const phase of ['carve', 'counterweight', 'ascent', 'relay', 'keystone', 'complete']) {
    if (typeof objective.phaseHints?.[phase] !== 'string' || objective.phaseHints[phase].trim() === '') {
      addIssue(issues, `objective.phaseHints.${phase}`, 'invalid_phase_hint', 'must be a non-empty string');
    }
  }
  if (objective.phase !== 'carve' || objective.complete !== false || objective.restored !== false
    || level.checkpoints?.length || level.relics?.length || level.ships?.length || level.boss
    || level.crushers?.length || level.movers?.length || level.water?.length || level.veilPlatforms?.length
    || JSON.stringify(level.gameplay?.enemyRoster) !== JSON.stringify(['shield'])) {
    addIssue(issues, 'objective', 'veil_gate_route_contamination', 'must remain a pristine finite synthesis route with one shield keeper and no competing mechanisms');
  }
  for (let tx = 2; tx < WORLD_COLS - 1; tx += 1) {
    if (![Tile.STONE, Tile.GLOW].includes(level.map?.[26]?.[tx])) {
      addIssue(issues, 'map[26]', 'unsafe_veil_floor', `must retain permanent recovery floor at column ${tx}`);
      break;
    }
  }
}

function validateWarden(level, issues) {
  const objective = level.objective;
  if (!objective || objective.type !== 'warden-restoration') return;
  for (const field of ['hudLabel', 'title', 'completionHint']) {
    if (typeof objective[field] !== 'string' || objective[field].trim() === '') {
      addIssue(issues, `objective.${field}`, 'invalid_text', 'must be a non-empty string');
    }
  }

  const requiredAbilities = ['memory-carve', 'oathbind', 'pilgrims-grip', 'dawnstroke'];
  if (JSON.stringify(objective.requiresAbilities) !== JSON.stringify(requiredAbilities)
    || JSON.stringify(level.gameplay?.assumedAbilities) !== JSON.stringify(requiredAbilities)
    || level.abilityUnlock !== undefined) {
    addIssue(issues, 'objective.requiresAbilities', 'invalid_warden_abilities', 'must combine exactly the four established abilities without awarding another unlock');
  }
  const target = level.targetTime;
  if (!target || !Number.isFinite(target.parSeconds) || !Number.isFinite(target.masterySeconds)
    || target.masterySeconds <= 0 || target.parSeconds <= target.masterySeconds) {
    addIssue(issues, 'targetTime', 'invalid_target_time', 'must define positive mastery and par times with mastery below par');
  }

  const breath = objective.breath;
  if (!breath || breath.clock !== 0 || breath.firstBreathComplete !== false || breath.strikeCount !== 0
    || !Number.isFinite(breath.cycleSeconds) || breath.cycleSeconds < 3
    || !Number.isFinite(breath.warningSeconds) || breath.warningSeconds < 1.1
    || !Number.isFinite(breath.activeSeconds) || breath.activeSeconds <= 0 || breath.activeSeconds > .6
    || breath.warningSeconds + breath.activeSeconds >= breath.cycleSeconds) {
    addIssue(issues, 'objective.breath', 'invalid_warden_breath', 'must begin with one harmless, readable breath and a finite warned active edge');
  }

  const seam = objective.memorySeam;
  if (!seam || seam.id !== 'warden-original-vow' || seam.role !== 'warden-memory'
    || !Number.isInteger(seam.tx) || !Number.isInteger(seam.ty) || seam.revealed !== false
    || typeof seam.revealText !== 'string' || seam.revealText.trim() === ''
    || level.map?.[seam.ty]?.[seam.tx] !== Tile.SAND) {
    addIssue(issues, 'objective.memorySeam', 'invalid_warden_memory', 'must begin as one stable buried original vow');
  }
  if (level.map?.flat?.().filter((tile) => tile === Tile.SAND).length !== 1) {
    addIssue(issues, 'map', 'ambiguous_warden_memory', 'must contain exactly one authored sand vow before the Warden reshapes the arena');
  }

  const heartstone = objective.heartstone;
  if (!heartstone || heartstone.blockId !== level.block?.id
    || heartstone.bound !== false || heartstone.locked !== false
    || !level.block || level.block.disabled || level.block.bound !== false
    || !heartstone.zone || !Number.isFinite(heartstone.zone.x)
    || !Number.isFinite(heartstone.zone.y) || !Number.isFinite(heartstone.zone.w)
    || !Number.isFinite(heartstone.zone.h) || heartstone.zone.w < level.block.w) {
    addIssue(issues, 'objective.heartstone', 'invalid_warden_heartstone', 'must define one movable pristine heartstone and a broad reversible oath seat');
  } else {
    validateRect(heartstone.zone, 'objective.heartstone.zone', issues);
  }

  const hand = objective.rememberedHand;
  const rib = hand?.rib;
  const landing = hand?.landing;
  if (!hand || ![-1, 1].includes(hand.requiredWallSide)
    || hand.gripJumpRecorded !== false || hand.reached !== false || hand.retryHintShown !== false
    || hand.raised !== false || hand.restored !== false
    || !rib || !Number.isInteger(rib.tx) || !Number.isInteger(rib.topTy) || !Number.isInteger(rib.bottomTy)
    || rib.topTy >= rib.bottomTy || rib.tx <= 1 || rib.tx >= WORLD_COLS - 1
    || !landing || !Number.isFinite(landing.minTx) || !Number.isFinite(landing.maxTx)
    || !Number.isInteger(landing.feetTy) || landing.minTx >= landing.maxTx) {
    addIssue(issues, 'objective.rememberedHand', 'invalid_warden_hand', 'must define one pristine genuine Grip wall, broad permanent catch, and finite transformation');
  } else {
    for (let tx = Math.ceil(landing.minTx); tx <= Math.floor(landing.maxTx); tx += 1) {
      if (level.map?.[landing.feetTy]?.[tx] !== Tile.ONEWAY) {
        addIssue(issues, 'objective.rememberedHand.landing', 'unsafe_warden_landing', `must retain permanent broad support at ${tx},${landing.feetTy}`);
        break;
      }
    }
  }

  const bridle = objective.bridle;
  if (!bridle || bridle.id !== 'crown-inversion-bridle'
    || !Number.isFinite(bridle.tx) || !Number.isFinite(bridle.baseTy)
    || !Number.isFinite(bridle.strikeRadius) || bridle.strikeRadius < TILE * 2
    || bridle.strikeRadius > TILE * 3 || bridle.exposed !== false || bridle.struck !== false
    || bridle.clock !== 0 || bridle.guardSeconds < 1.1 || bridle.recoverySeconds < 1) {
    addIssue(issues, 'objective.bridle', 'invalid_warden_bridle', 'must define one large pristine bridle with readable amber guard and cyan recovery');
  }

  const warden = objective.warden;
  if (!warden || warden.id !== 'warden-of-dust' || warden.state !== 'sleeping'
    || warden.kneeling !== false || warden.commandBroken !== false
    || !Number.isFinite(warden.x) || !Number.isFinite(warden.feetY)
    || !Number.isFinite(warden.w) || !Number.isFinite(warden.h)
    || warden.w < TILE * 6 || warden.h < TILE * 8) {
    addIssue(issues, 'objective.warden', 'invalid_warden_identity', 'must begin as one large living guardian with stable identity and no health state');
  }

  const duel = objective.duel;
  const arena = duel?.arena;
  const checkpoint = arena?.checkpoint;
  const seal = arena?.seal;
  const duelBoss = duel?.boss;
  const duelPlayer = duel?.player;
  const timing = duel?.timing;
  const thresholds = duel?.thresholds;
  const attempt = duel?.attempt;
  const totals = duel?.totals;
  const fighter = duel?.fighter;
  if (!duel || duel.phase !== 'sealed' || duel.active !== false || duel.complete !== false
    || !arena || arena.minTx !== 46 || arena.maxTx !== 67 || arena.feetTy !== 20
    || !checkpoint || checkpoint.tx !== 48 || checkpoint.tx <= arena.minTx
    || checkpoint.tx >= arena.maxTx || checkpoint.feetTy !== arena.feetTy
    || ![-1, 1].includes(checkpoint.facing)
    || !seal || seal.leftTx !== arena.minTx - 1 || seal.topTy !== 12 || seal.bottomTy !== arena.feetTy - 1
    || !level.map.slice(seal.topTy, seal.bottomTy + 1).every((row) => row[seal.leftTx] === Tile.AIR)
    || !duelBoss || duelBoss.maxHp !== 60 || duelBoss.hp !== duelBoss.maxHp
    || duelBoss.phase !== 'guardian' || duelBoss.action !== 'idle' || duelBoss.attackKind !== 'sun-blade'
    || duelBoss.actionClock !== 0 || duelBoss.sequenceIndex !== 0 || duelBoss.hitstun !== 0
    || duelBoss.invulnerable !== false || duelBoss.attackConsumed !== true
    || duelBoss.openingEarned !== false || duelBoss.recoveryHits !== 0
    || duelBoss.armored !== false || duelBoss.armorBreakReady !== false
    || duelBoss.facing !== -1 || duelBoss.velocityX !== 0 || duelBoss.guarding !== false
    || duelBoss.guardMeter !== 6 || duelBoss.guardMax !== 6 || duelBoss.comboTaken !== 0
    || duelBoss.decisionClock !== 0 || duelBoss.hitFlash !== 0 || duelBoss.nextGuard !== false
    || !duelBoss.target || duelBoss.target.x !== 58.5 * TILE || duelBoss.target.y !== 20 * TILE - 72
    || duelBoss.target.spawnX !== 58.5 * TILE || duelBoss.target.radius !== 3 * TILE
    || !duelPlayer || duelPlayer.comboStep !== 0 || duelPlayer.comboClock !== 0
    || duelPlayer.guarding !== false || duelPlayer.parryClock !== 0
    || duelPlayer.guardLessonComplete !== false || duelPlayer.guardMeter !== 4
    || duelPlayer.guardMax !== 4 || duelPlayer.guardBrokenClock !== 0
    || duelPlayer.lastAttackLabel !== ''
    || !timing || !Number.isFinite(timing.introSeconds) || timing.introSeconds < 1
    || !Number.isFinite(timing.phaseShiftSeconds) || timing.phaseShiftSeconds < 1.5
    || !Number.isFinite(timing.regroupSeconds) || timing.regroupSeconds < 3
    || !Number.isFinite(timing.comboWindow) || timing.comboWindow < .7
    || !Number.isFinite(timing.parryWindow) || timing.parryWindow < .1
    || !Number.isFinite(timing.guardianTelegraph) || timing.guardianTelegraph < .9
    || !Number.isFinite(timing.commandTelegraph) || timing.commandTelegraph < .75
    || !Number.isFinite(timing.eclipseTelegraph) || timing.eclipseTelegraph < .6
    || timing.guardianTelegraph < timing.commandTelegraph
    || timing.commandTelegraph < timing.eclipseTelegraph
    || !Number.isFinite(timing.activeSeconds) || timing.activeSeconds < .18 || timing.activeSeconds > .32
    || !Number.isFinite(timing.guardianRecovery) || !Number.isFinite(timing.commandRecovery)
    || !Number.isFinite(timing.eclipseRecovery)
    || timing.guardianRecovery < timing.commandRecovery
    || timing.commandRecovery < timing.eclipseRecovery || timing.eclipseRecovery < 1
    || !thresholds || !Number.isInteger(thresholds.commandHp) || !Number.isInteger(thresholds.eclipseHp)
    || thresholds.commandHp !== 40 || thresholds.eclipseHp !== 20
    || thresholds.commandHp >= duelBoss.maxHp
    || thresholds.commandHp <= thresholds.eclipseHp || thresholds.eclipseHp <= 0
    || !attempt || attempt.count !== 0 || attempt.elapsed !== 0 || attempt.damageTaken !== 0
    || !totals || totals.elapsed !== 0 || totals.damageTaken !== 0
    || !fighter || fighter.arenaName !== 'THE SEVERED COURT'
    || fighter.style !== 'real-time-arcade-duel'
    || typeof fighter.controls !== 'string' || !fighter.controls.includes('STRIKE chains three blows')
    || typeof fighter.mercyRule !== 'string' || !fighter.mercyRule.includes('restores the Warden')
    || !duel.finale || duel.finale.ready !== false || duel.finale.struck !== false) {
    addIssue(issues, 'objective.duel', 'invalid_warden_duel', 'must define one pristine three-round real-time fight, fair arena checkpoint, deterministic controls, and resettable attempt statistics');
  }
  if (!objective.crownPath || objective.crownPath.id !== 'outer-veil-crown-path'
    || objective.crownPath.restored !== false) {
    addIssue(issues, 'objective.crownPath', 'invalid_warden_restoration', 'must begin with the first Crown Path unrestored');
  }

  const restorationKeys = new Set((objective.restorationTiles || []).map(({ tx, ty }) => `${tx}:${ty}`));
  if (objective.restorationTiles?.length !== 28 || restorationKeys.size !== 28
    || objective.restorationTiles.some(({ tx, ty, tile }) => ty !== 20 || tx < 46 || tx > 73 || tile !== Tile.GLOW)) {
    addIssue(issues, 'objective.restorationTiles', 'unsafe_warden_restoration', 'must restore the complete twenty-eight-cell first Crown Path exactly once');
  }
  for (const phase of ['listen', 'carve', 'anchor', 'ascend', 'unbind', 'duel', 'finale', 'first-path']) {
    if (typeof objective.phaseHints?.[phase] !== 'string' || objective.phaseHints[phase].trim() === '') {
      addIssue(issues, `objective.phaseHints.${phase}`, 'invalid_phase_hint', 'must be a non-empty string');
    }
  }

  if (objective.phase !== 'listen' || objective.complete !== false || objective.restored !== false
    || level.checkpoints?.length || level.relics?.length || level.ships?.length || level.boss
    || level.crushers?.length || level.movers?.length || level.water?.length || level.veilPlatforms?.length
    || JSON.stringify(level.gameplay?.enemyRoster) !== JSON.stringify([])) {
    addIssue(issues, 'objective', 'warden_route_contamination', 'must remain one pristine continuous guardian transformation without adds, collectibles, legacy boss state, or competing mechanisms');
  }
  if (level.map?.slice(12, 20).some((row) => row?.[level.gateColumn] !== Tile.GATE)) {
    addIssue(issues, 'gateColumn', 'invalid_warden_gate', 'must keep the Inner Kingdom path sealed until the command breaks');
  }
  for (let tx = 2; tx < WORLD_COLS - 1; tx += 1) {
    if (![Tile.STONE, Tile.GLOW].includes(level.map?.[26]?.[tx])) {
      addIssue(issues, 'map[26]', 'unsafe_warden_floor', `must retain permanent recovery floor at column ${tx}`);
      break;
    }
  }
}

function validateObjective(level, issues) {
  if (level.objective === undefined || level.objective === null) return;
  if (!level.objective || typeof level.objective !== 'object') {
    addIssue(issues, 'objective', 'invalid_objective', 'must be an object');
    return;
  }
  if (level.objective.type === 'memory-carve') validateMemoryCarve(level, issues);
  else if (level.objective.type === 'procession-restoration') validateBrokenProcession(level, issues);
  else if (level.objective.type === 'oathbind-restoration') validateOathbind(level, issues);
  else if (level.objective.type === 'timed-teeth-restoration') validateTimedTeeth(level, issues);
  else if (level.objective.type === 'bell-tower-restoration') validateBellTower(level, issues);
  else if (level.objective.type === 'sanctum-lamp-restoration') validateSanctumLamp(level, issues);
  else if (level.objective.type === 'parachute-choir-restoration') validateParachuteChoir(level, issues);
  else if (level.objective.type === 'veil-gate-restoration') validateVeilGate(level, issues);
  else if (level.objective.type === 'warden-restoration') validateWarden(level, issues);
  else addIssue(issues, 'objective.type', 'invalid_objective', 'uses an unsupported objective type');
}

/**
 * Validates an authored level without mutating it. The returned value is a clone
 * with stable campaign identity and all optional collection fields normalized.
 */
export function validateAuthoredLevel(level, identity) {
  const issues = [];
  const normalized = normalizeLevel(level, identity);

  validateIdentity(identity || {}, issues);

  if (!level || typeof level !== 'object') {
    addIssue(issues, 'level', 'invalid_level', 'must be an object');
    return { ok: false, issues, value: normalized };
  }

  if (!Number.isInteger(level.id) || level.id < 1) {
    addIssue(issues, 'id', 'invalid_legacy_id', 'must remain a positive integer for engine compatibility');
  }
  const expectedLegacyId = identity?.legacyId ?? identity?.prototypeId;
  if (Number.isInteger(expectedLegacyId) && level.id !== expectedLegacyId) {
    addIssue(issues, 'id', 'legacy_id_mismatch', `must match authored legacy identity ${expectedLegacyId}`);
  }
  if (typeof level.name !== 'string' || level.name.trim() === '') {
    addIssue(issues, 'name', 'invalid_name', 'must be a non-empty string');
  }

  validateMap(level.map, issues);
  validatePoint(level.spawn, 'spawn', [['x', WORLD_W], ['y', WORLD_H]], issues);
  validateRect(level.door, 'door', issues);
  validateCheckpoints(level.checkpoints, issues);
  validateRelics(level.relics, issues);
  validateGate(level.map, level.gateColumn, issues);
  validateObjective(level, issues);

  for (const field of OPTIONAL_LEVEL_ARRAYS) {
    if (level[field] !== undefined && level[field] !== null && !Array.isArray(level[field])) {
      addIssue(issues, field, 'invalid_collection', 'must be an array when supplied');
    }
  }

  return { ok: issues.length === 0, issues, value: normalized };
}

export function assertValidAuthoredLevel(level, identity) {
  const result = validateAuthoredLevel(level, identity);
  if (!result.ok) {
    throw new LevelValidationError(identity?.levelKey || 'unknown-level', result.issues);
  }
  return result.value;
}

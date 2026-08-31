import { cloneLevel } from '../levels/cloneLevel.js';
import { loadPrototypeLevel, PROTOTYPE_CAMPAIGN_CATALOG } from './catalog.js';
import { attachPrototypeGameplay } from './prototypeGameplay.js';

export class AuthoredLevelRepository {
  constructor({
    catalog = PROTOTYPE_CAMPAIGN_CATALOG,
    loadLevel = loadPrototypeLevel,
    decorate = attachPrototypeGameplay,
    campaignId = 'legacy-prototype-10',
    sessionKind = 'prototype-campaign',
  } = {}) {
    this.catalog = catalog;
    this.loadLevel = loadLevel;
    this.decorate = decorate;
    this.campaignId = campaignId;
    this.sessionKind = sessionKind;
    this.templates = new Map();
    this.inflight = new Map();
    this.retainedKeys = null;
  }

  get length() {
    return this.catalog.length;
  }

  entryAt(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.length) {
      throw new RangeError('Level index is outside the campaign.');
    }
    return this.catalog[index];
  }

  keyAt(index) {
    return this.entryAt(index).levelKey;
  }

  windowKeys(index) {
    this.entryAt(index);
    return this.catalog
      .slice(Math.max(0, index - 1), index + 2)
      .map((entry) => entry.levelKey);
  }

  has(index) {
    return this.templates.has(this.keyAt(index));
  }

  peekTemplate(index) {
    return this.templates.get(this.keyAt(index));
  }

  async loadTemplate(index) {
    const key = this.keyAt(index);
    if (this.templates.has(key)) return this.templates.get(key);
    if (this.inflight.has(key)) return this.inflight.get(key);

    const pending = Promise.resolve(this.loadLevel(key))
      .then((level) => {
        const template = this.decorate(level);
        if (!this.retainedKeys || this.retainedKeys.has(key)) this.templates.set(key, template);
        this.inflight.delete(key);
        return template;
      })
      .catch((error) => {
        this.inflight.delete(key);
        throw error;
      });
    this.inflight.set(key, pending);
    return pending;
  }

  createRuntime(index) {
    const template = this.peekTemplate(index);
    if (!template) throw new Error(`Level ${this.keyAt(index)} has not been loaded.`);
    return cloneLevel(template);
  }

  retainAround(index) {
    const retained = new Set([this.keyAt(0), this.keyAt(index)]);
    if (index + 1 < this.length) retained.add(this.keyAt(index + 1));
    return this.retainKeys(retained);
  }

  retainForTransition(currentIndex, targetIndex) {
    this.entryAt(currentIndex);
    this.entryAt(targetIndex);
    return this.retainKeys([
      this.keyAt(0),
      this.keyAt(currentIndex),
      this.keyAt(targetIndex),
    ]);
  }

  retainKeys(keys) {
    const retained = new Set(keys);
    this.retainedKeys = retained;
    for (const key of this.templates.keys()) {
      if (!retained.has(key)) this.templates.delete(key);
    }
    return this;
  }
}

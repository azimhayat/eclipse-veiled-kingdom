function releaseResource(resource, seen) {
  if (resource == null || (typeof resource !== 'object' && typeof resource !== 'function')) return;
  if (seen.has(resource)) return;
  seen.add(resource);

  if (Array.isArray(resource)) {
    for (const item of resource) releaseResource(item, seen);
    return;
  }

  if (typeof resource.close === 'function') {
    try {
      resource.close();
    } catch {
      // A resource that was already closed is still safe to evict.
    }
    return;
  }

  if (typeof resource.getContext === 'function' && 'width' in resource && 'height' in resource) {
    try {
      resource.width = 0;
      resource.height = 0;
    } catch {
      // Some canvas-like implementations expose read-only dimensions.
    }
  }
}

/** Releases the backing memory held by the current array-of-canvas render format. */
export function releaseRenderedLevel(renderedLevel) {
  releaseResource(renderedLevel, new Set());
}

/**
 * A Map-compatible LRU cache for expensive baked level resources.
 *
 * The default capacity is the previous/current/next gameplay window. Call
 * `retain()` during a level transition to discard levels outside that window.
 */
export class RenderedLevelCache extends Map {
  #maxEntries;
  #recency;
  #release;

  constructor({ maxEntries = 3, release = releaseRenderedLevel, entries = [] } = {}) {
    super();
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new RangeError('maxEntries must be a positive integer');
    }
    if (typeof release !== 'function') throw new TypeError('release must be a function');

    this.#maxEntries = maxEntries;
    this.#recency = new Map();
    this.#release = release;
    for (const [key, value] of entries) this.set(key, value);
  }

  get maxEntries() {
    return this.#maxEntries;
  }

  get(key) {
    if (!super.has(key)) return undefined;
    this.#touch(key);
    return super.get(key);
  }

  /** Reads without changing eviction priority. */
  peek(key) {
    return super.get(key);
  }

  set(key, value) {
    if (super.has(key)) {
      const previous = super.get(key);
      super.set(key, value);
      this.#touch(key);
      if (previous !== value) this.#release(previous);
      return this;
    }

    super.set(key, value);
    this.#touch(key);
    this.#evictOverflow();
    return this;
  }

  delete(key) {
    if (!super.has(key)) return false;
    const value = super.get(key);
    const deleted = super.delete(key);
    this.#recency.delete(key);
    this.#release(value);
    return deleted;
  }

  clear() {
    const values = [...super.values()];
    super.clear();
    this.#recency.clear();
    for (const value of values) this.#release(value);
  }

  /** Keeps only the requested level IDs and releases every other entry. */
  retain(keys) {
    const retainedKeys = [...new Set(keys)];
    if (retainedKeys.length > this.#maxEntries) {
      throw new RangeError(`Cannot retain more than ${this.#maxEntries} rendered levels`);
    }

    const retained = new Set(retainedKeys);
    for (const key of [...super.keys()]) {
      if (!retained.has(key)) this.delete(key);
    }
    for (const key of retainedKeys) {
      if (super.has(key)) this.#touch(key);
    }
    return this;
  }

  dispose() {
    this.clear();
  }

  #touch(key) {
    this.#recency.delete(key);
    this.#recency.set(key, true);
  }

  #evictOverflow() {
    while (super.size > this.#maxEntries) {
      const oldestKey = this.#recency.keys().next().value;
      this.delete(oldestKey);
    }
  }
}

/** Returns the previous/current/next authored levels at a campaign position. */
export function getLevelWindow(levels, currentIndex) {
  if (!Array.isArray(levels)) throw new TypeError('levels must be an array');
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= levels.length) {
    throw new RangeError('currentIndex must identify a level');
  }
  return levels.slice(Math.max(0, currentIndex - 1), currentIndex + 2);
}

/** Bakes any missing entries, while retaining only the three-level campaign window. */
export function ensureRenderedLevelWindow(cache, levels, currentIndex, renderLevel) {
  if (!(cache instanceof RenderedLevelCache)) {
    throw new TypeError('cache must be a RenderedLevelCache');
  }
  if (typeof renderLevel !== 'function') throw new TypeError('renderLevel must be a function');

  const window = getLevelWindow(levels, currentIndex);
  const ids = window.map((level) => level.id);
  cache.retain(ids);
  for (const level of window) {
    if (!cache.has(level.id)) cache.set(level.id, renderLevel(level));
  }
  return cache;
}

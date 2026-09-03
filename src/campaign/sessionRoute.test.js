import { describe, expect, it } from 'vitest';
import {
  resolveDevelopmentSession,
  sessionUsesPersistentSave,
  shouldPersistCampaignCompletion,
  shouldPersistProductionProgress,
  shouldPersistV4Progress,
} from './sessionRoute.js';
import { PRODUCTION_PREVIEW_KEYS } from './productionPreview.js';

const options = { dev: true, previewKeys: PRODUCTION_PREVIEW_KEYS };

describe('development session routing', () => {
  it('keeps normal and prototype demo routes on the preserved campaign', () => {
    expect(resolveDevelopmentSession('', options)).toEqual({ kind: 'prototype-campaign' });
    expect(resolveDevelopmentSession('?demoLevel=2', options)).toEqual({ kind: 'prototype-campaign' });
  });

  it('opens the integrated twenty-level V4 campaign in published V4 builds', () => {
    const published = { ...options, dev: false };
    expect(resolveDevelopmentSession('', published)).toEqual({
      kind: 'v4-campaign', campaignKey: 'v4',
    });
    expect(resolveDevelopmentSession('?campaign=outer-veil', published)).toEqual({
      kind: 'production-campaign', campaignKey: 'outer-veil',
    });
    expect(resolveDevelopmentSession('?previewLevel=pilgrims-climb', published)).toEqual({
      kind: 'production-preview', previewLevel: 'pilgrims-climb',
    });
  });

  it('selects the named production preview without numeric-level ambiguity', () => {
    expect(resolveDevelopmentSession('?previewLevel=sand-that-remembers', options)).toEqual({
      kind: 'production-preview',
      previewLevel: 'sand-that-remembers',
    });
    expect(resolveDevelopmentSession('?previewLevel=broken-procession', options)).toEqual({
      kind: 'production-preview',
      previewLevel: 'broken-procession',
    });
    expect(resolveDevelopmentSession('?previewLevel=teeth-beneath-dust', options)).toEqual({
      kind: 'production-preview',
      previewLevel: 'teeth-beneath-dust',
    });
    expect(resolveDevelopmentSession('?previewLevel=first-sanctum', options)).toEqual({
      kind: 'production-preview',
      previewLevel: 'first-sanctum',
    });
    expect(resolveDevelopmentSession('?previewLevel=parachute-choir', options)).toEqual({
      kind: 'production-preview',
      previewLevel: 'parachute-choir',
    });
    expect(resolveDevelopmentSession('?previewLevel=gate-of-the-veil', options)).toEqual({
      kind: 'production-preview',
      previewLevel: 'gate-of-the-veil',
    });
    expect(resolveDevelopmentSession('?previewLevel=warden-of-dust', options)).toEqual({
      kind: 'production-preview',
      previewLevel: 'warden-of-dust',
    });
  });

  it('selects the integrated Outer Veil through its explicit named route', () => {
    expect(resolveDevelopmentSession('?campaign=outer-veil', options)).toEqual({
      kind: 'production-campaign', campaignKey: 'outer-veil',
    });
    expect(resolveDevelopmentSession('?campaign=outer-veil', { ...options, dev: false }))
      .toEqual({ kind: 'production-campaign', campaignKey: 'outer-veil' });
    expect(resolveDevelopmentSession('?campaign=unknown', options).kind).toBe('error');
    expect(resolveDevelopmentSession('?campaign=', options).kind).toBe('error');
    expect(resolveDevelopmentSession('?campaign=outer-veil&campaign=outer-veil', options).kind).toBe('error');
    expect(resolveDevelopmentSession('?campaign=outer-veil&previewLevel=warden-of-dust', options).kind).toBe('error');
    expect(resolveDevelopmentSession('?campaign=outer-veil&demoLevel=7', options).kind).toBe('error');
  });

  it('selects V4 explicitly without changing the preserved V3 route', () => {
    expect(resolveDevelopmentSession('?campaign=v4', options)).toEqual({
      kind: 'v4-campaign', campaignKey: 'v4',
    });
    expect(resolveDevelopmentSession('?campaign=outer-veil', options)).toEqual({
      kind: 'production-campaign', campaignKey: 'outer-veil',
    });
  });

  it('allows a local-only V4 level demo without weakening production routing', () => {
    expect(resolveDevelopmentSession('?campaign=v4&demoLevel=19', options)).toEqual({
      kind: 'v4-campaign', campaignKey: 'v4',
    });
    expect(resolveDevelopmentSession('?campaign=v4&demoLevel=19', { ...options, dev: false }).kind).toBe('error');
  });

  it('fails closed for unknown and conflicting preview routes', () => {
    expect(resolveDevelopmentSession('?previewLevel=unknown', options).kind).toBe('error');
    expect(resolveDevelopmentSession('?previewLevel=sand-that-remembers&demoLevel=2', options).kind).toBe('error');
    expect(resolveDevelopmentSession('?previewLevel=sand-that-remembers&demoBoss=1', options).kind).toBe('error');
    expect(resolveDevelopmentSession('?previewLevel=', options).kind).toBe('error');
    expect(resolveDevelopmentSession('?previewLevel=sand-that-remembers&previewLevel=broken-procession', options).kind).toBe('error');
  });

  it('keeps production previews out of campaign save storage', () => {
    expect(sessionUsesPersistentSave('prototype-campaign')).toBe(true);
    expect(sessionUsesPersistentSave('production-campaign')).toBe(true);
    expect(sessionUsesPersistentSave('v4-campaign')).toBe(true);
    expect(sessionUsesPersistentSave('production-preview')).toBe(false);
    expect(sessionUsesPersistentSave('error')).toBe(false);
    expect(shouldPersistCampaignCompletion({
      sessionKind: 'production-preview',
      campaignId: 'production-preview-gate-of-the-veil',
      completedLevels: 1,
    })).toBe(false);
    expect(shouldPersistCampaignCompletion({
      sessionKind: 'prototype-campaign',
      campaignId: 'legacy-prototype-10',
      completedLevels: 10,
    })).toBe(true);
    expect(shouldPersistProductionProgress({
      sessionKind: 'production-campaign',
      campaignId: 'outer-veil-production-v1',
    })).toBe(true);
    expect(shouldPersistProductionProgress({
      sessionKind: 'production-preview',
      campaignId: 'outer-veil-production-v1',
    })).toBe(false);
    expect(shouldPersistV4Progress({
      sessionKind: 'v4-campaign', campaignId: 'veiled-kingdom-v4-20',
    })).toBe(true);
    expect(shouldPersistV4Progress({
      sessionKind: 'production-campaign', campaignId: 'veiled-kingdom-v4-20',
    })).toBe(false);
  });
});

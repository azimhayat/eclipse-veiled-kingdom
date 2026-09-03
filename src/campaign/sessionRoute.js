export function resolveDevelopmentSession(search, { dev = false, previewKeys = [] } = {}) {
  const params = new URLSearchParams(search || '');
  const hasPrototypeDemo = params.has('demoLevel') || params.get('demoBoss') === '1';
  if (params.has('campaign')) {
    const campaigns = params.getAll('campaign');
    const campaign = campaigns[0]?.trim();
    if (campaigns.length !== 1 || !campaign) {
      return { kind: 'error', message: 'Choose exactly one named campaign.' };
    }
    if (params.has('previewLevel') || hasPrototypeDemo) {
      return { kind: 'error', message: 'Choose the Outer Veil campaign without preview or prototype demo options.' };
    }
    if (campaign !== 'outer-veil' && campaign !== 'v4') {
      return { kind: 'error', message: `Unknown campaign: ${campaign}` };
    }
    return campaign === 'v4'
      ? { kind: 'v4-campaign', campaignKey: campaign }
      : { kind: 'production-campaign', campaignKey: campaign };
  }
  if (!params.has('previewLevel')) {
    return dev
      ? { kind: 'prototype-campaign' }
      : { kind: 'v4-campaign', campaignKey: 'v4' };
  }
  const previewLevels = params.getAll('previewLevel');
  const previewLevel = previewLevels[0]?.trim();
  if (previewLevels.length !== 1 || !previewLevel) {
    return { kind: 'error', message: 'Choose exactly one named production preview.' };
  }

  if (hasPrototypeDemo) {
    return { kind: 'error', message: 'Choose either a production preview or a prototype demo, not both.' };
  }
  if (!previewKeys.includes(previewLevel)) {
    return { kind: 'error', message: `Unknown production preview: ${previewLevel}` };
  }
  return { kind: 'production-preview', previewLevel };
}

export function sessionUsesPersistentSave(sessionKind) {
  return sessionKind === 'prototype-campaign'
    || sessionKind === 'production-campaign'
    || sessionKind === 'v4-campaign';
}

export function shouldPersistProductionProgress({ sessionKind, campaignId }) {
  return sessionKind === 'production-campaign' && campaignId === 'outer-veil-production-v1';
}

export function shouldPersistV4Progress({ sessionKind, campaignId }) {
  return sessionKind === 'v4-campaign' && campaignId === 'veiled-kingdom-v4-20';
}

export function shouldPersistCampaignCompletion({ sessionKind, campaignId, completedLevels }) {
  return sessionUsesPersistentSave(sessionKind)
    && campaignId === 'legacy-prototype-10'
    && completedLevels === 10;
}

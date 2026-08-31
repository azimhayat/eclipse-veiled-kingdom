export function resolveDevelopmentSession(search, { dev = false, previewKeys = [] } = {}) {
  if (!dev) return { kind: 'prototype-campaign' };
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
    if (campaign !== 'outer-veil') {
      return { kind: 'error', message: `Unknown campaign: ${campaign}` };
    }
    return { kind: 'production-campaign', campaignKey: campaign };
  }
  if (!params.has('previewLevel')) return { kind: 'prototype-campaign' };
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
  return sessionKind === 'prototype-campaign' || sessionKind === 'production-campaign';
}

export function shouldPersistProductionProgress({ sessionKind, campaignId }) {
  return sessionKind === 'production-campaign' && campaignId === 'outer-veil-production-v1';
}

export function shouldPersistCampaignCompletion({ sessionKind, campaignId, completedLevels }) {
  return sessionUsesPersistentSave(sessionKind)
    && campaignId === 'legacy-prototype-10'
    && completedLevels === 10;
}

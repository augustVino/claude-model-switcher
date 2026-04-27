#!/usr/bin/env node
'use strict';

const TAG_COL = 18;

module.exports = function listProviders(providers) {
  console.log('Providers:');
  console.log('');

  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    console.log(`  ${p.name}`);

    const models = resolveModels(p);
    for (let j = 0; j < models.length; j++) {
      const isLast = j === models.length - 1;
      const prefix = isLast ? '└─' : '├─';
      const tag = buildTag(models[j], p);
      console.log(`    ${prefix} ${models[j]}${tag}`);
    }

    if (i < providers.length - 1) console.log('');
  }
};

function resolveModels(provider) {
  if (Array.isArray(provider.models) && provider.models.length > 0) {
    return provider.models;
  }
  const set = new Set();
  if (provider.default_model) set.add(provider.default_model);
  if (provider.default_small_model && provider.default_small_model !== provider.default_model) {
    set.add(provider.default_small_model);
  }
  return Array.from(set);
}

function buildTag(model, provider) {
  const tags = [];
  if (model === provider.default_model) tags.push('[default]');
  if (model === provider.default_small_model && model !== provider.default_model) {
    tags.push('[small]');
  }
  if (tags.length === 0) return '';
  const pad = ' '.repeat(Math.max(0, TAG_COL - model.length));
  return pad + tags.join(' ');
}

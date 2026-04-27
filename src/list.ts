import type { Provider } from './types';
import { resolveProviderModels } from './types';

const TAG_COL = 18;

export function listProviders(providers: Provider[]): void {
  console.log('Providers:');
  console.log('');

  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    console.log(`  ${p.name}`);

    const models = resolveProviderModels(p);
    for (let j = 0; j < models.length; j++) {
      const isLast = j === models.length - 1;
      const prefix = isLast ? '└─' : '├─';
      const tag = buildTag(models[j], p);
      console.log(`    ${prefix} ${models[j]}${tag}`);
    }

    if (i < providers.length - 1) console.log('');
  }
}

function buildTag(model: string, provider: Provider): string {
  const tags: string[] = [];
  if (model === provider.default_model) tags.push('[default]');
  if (
    model === provider.default_small_model &&
    model !== provider.default_model
  ) {
    tags.push('[small]');
  }
  if (tags.length === 0) return '';
  const pad = ' '.repeat(Math.max(0, TAG_COL - model.length));
  return pad + tags.join(' ');
}

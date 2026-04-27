export interface Provider {
  name: string;
  base_url: string;
  api_key_env: string;
  default_model?: string;
  default_small_model?: string;
  models?: string[];
}

export interface ParsedArgs {
  provider: string;
  model: string;
  rest: string[];
  isListCommand: boolean;
}

export interface ResolvedConfig {
  base_url: string;
  apiKey: string;
  model: string;
  smallModel: string;
}

/** Resolve the set of available models for a provider. */
export function resolveProviderModels(provider: Provider): string[] {
  if (Array.isArray(provider.models) && provider.models.length > 0) {
    return provider.models;
  }
  const set = new Set<string>();
  if (provider.default_model) set.add(provider.default_model);
  if (
    provider.default_small_model &&
    provider.default_small_model !== provider.default_model
  ) {
    set.add(provider.default_small_model);
  }
  return Array.from(set);
}

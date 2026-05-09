import type { Provider, ParsedArgs, ResolvedConfig } from './types';

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderError';
  }
}

const VALID_NAME_RE = /^[a-zA-Z0-9_-]+$/;

export function resolveProvider(
  providers: Provider[],
  args: ParsedArgs
): ResolvedConfig {
  const name = args.provider || providers[0]?.name;

  if (!name) {
    throw new ProviderError('No providers available');
  }

  if (!VALID_NAME_RE.test(name)) {
    throw new ProviderError(
      `Invalid provider name '${name}'. Only [a-zA-Z0-9_-] allowed.`
    );
  }

  const pc = providers.find(p => p.name === name);
  if (!pc) {
    const available = providers.map(p => `  @${p.name}`).join('\n');
    throw new ProviderError(`Unknown provider '@${name}'\nAvailable:\n${available}`);
  }

  const apiKey = process.env[pc.api_key_env] || '';
  if (!apiKey) {
    throw new ProviderError(
      `API key not set. Export ${pc.api_key_env} in your shell config.`
    );
  }

  let model: string;
  let smallModel: string;

  if (args.model) {
    model = args.model;
    smallModel = args.model;
  } else if (pc.default_model) {
    model = pc.default_model;
    smallModel = pc.default_small_model || pc.default_model;
  } else {
    throw new ProviderError(
      `Provider '@${name}' has no default model. Specify one: ccs @${name}:<model>`
    );
  }

  return {
    base_url: pc.base_url,
    apiKey,
    model,
    smallModel,
    agent_cli: pc.agent_cli || 'cc',
    wireApi: pc.wire_api || '',
    apiKeyEnv: pc.api_key_env,
  };
}

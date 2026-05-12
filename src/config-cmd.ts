import { existsSync } from 'node:fs';
import { spawnSync, type SpawnSyncOptions } from 'node:child_process';

export function openConfig(configPath: string): void {
  if (!existsSync(configPath)) {
    process.stderr.write(`Config not found: ${configPath}\nRun ccs @init first.\n`);
    process.exit(1);
  }

  const editor = process.env.EDITOR || 'vim';
  const options: SpawnSyncOptions = { stdio: 'inherit' };
  if (process.platform === 'win32') {
    options.shell = true;
  }

  const result = spawnSync(editor, [configPath], options);
  if (result.error) {
    process.stderr.write(`Error: Failed to launch editor '${editor}': ${result.error.message}\n`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

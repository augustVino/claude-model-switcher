import { existsSync } from 'node:fs';
import { openInEditor } from './editor';

export function openConfig(configPath: string): void {
  if (!existsSync(configPath)) {
    process.stderr.write(`Config not found: ${configPath}\nRun ccs @init first.\n`);
    process.exit(1);
  }
  openInEditor(configPath);
}

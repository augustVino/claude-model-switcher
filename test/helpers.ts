import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let tmpDir: string;

export async function setupTmpDir(): Promise<string> {
  tmpDir = await mkdtemp(join(tmpdir(), 'cms-test-'));
  return tmpDir;
}

export function getTmpDir(): string {
  return tmpDir;
}

export async function writeConfig(content: string): Promise<string> {
  const dir = join(tmpDir, 'claude-model-switcher');
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'providers.json');
  await writeFile(path, content);
  return path;
}

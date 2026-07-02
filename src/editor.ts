import { spawnSync, type SpawnSyncOptions } from 'node:child_process';

export interface OpenEditorOptions {
  exitImpl?: (code?: number) => never;
}

/** 用 $EDITOR 打开目标（文件或目录）。与原 @config 逻辑一致。 */
export function openInEditor(target: string, opts: OpenEditorOptions = {}): void {
  const exitFn = opts.exitImpl ?? ((code?: number) => process.exit(code ?? 1));
  const editor = process.env.EDITOR || 'vim';
  const options: SpawnSyncOptions = { stdio: 'inherit' };
  if (process.platform === 'win32') options.shell = true;
  const result = spawnSync(editor, [target], options);
  if (result.error) {
    process.stderr.write(`Error: Failed to launch editor '${editor}': ${(result.error as Error).message}\n`);
    exitFn(1);
  }
  exitFn(result.status ?? 1);
}

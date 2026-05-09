import { describe, expect, it, beforeEach, afterEach, spyOn } from 'bun:test';
import { getCachePath, readCache, writeCache, checkUpdateNotification, CHECK_INTERVAL_MS, semverGt } from '../src/update-checker';
import { setupTmpDir, getTmpDir } from './helpers';
import { dirname } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import * as child_process from 'node:child_process';

describe('update-checker', () => {
  beforeEach(async () => {
    await setupTmpDir();
    process.env.XDG_CONFIG_HOME = getTmpDir();
  });

  describe('getCachePath', () => {
    it('returns path in claude-model-switcher config dir', () => {
      const path = getCachePath();
      expect(path).toContain('claude-model-switcher');
      expect(path).toMatch(/\.update-cache\.json$/);
    });
  });

  describe('readCache / writeCache', () => {
    it('reads back what was written', () => {
      writeCache({ lastCheck: 1000, latestVersion: '2.0.0' });
      const cache = readCache();
      expect(cache).toEqual({ lastCheck: 1000, latestVersion: '2.0.0' });
    });

    it('returns null when cache file does not exist', () => {
      const cache = readCache();
      expect(cache).toBeNull();
    });

    it('returns null when cache file contains invalid JSON', async () => {
      const cachePath = getCachePath();
      await mkdir(dirname(cachePath), { recursive: true });
      await writeFile(cachePath, 'not valid json');
      const cache = readCache();
      expect(cache).toBeNull();
    });
  });

  describe('semverGt', () => {
    it('2.0.0 > 1.0.0', () => {
      expect(semverGt('2.0.0', '1.0.0')).toBe(true);
    });

    it('1.1.0 > 1.0.0', () => {
      expect(semverGt('1.1.0', '1.0.0')).toBe(true);
    });

    it('1.0.1 > 1.0.0', () => {
      expect(semverGt('1.0.1', '1.0.0')).toBe(true);
    });

    it('1.0.0 == 1.0.0 returns false', () => {
      expect(semverGt('1.0.0', '1.0.0')).toBe(false);
    });

    it('0.9.9 > 1.0.0 returns false', () => {
      expect(semverGt('0.9.9', '1.0.0')).toBe(false);
    });

    it('handles pre-release versions by returning false', () => {
      expect(semverGt('1.0.0-beta.1', '1.0.0')).toBe(false);
    });
  });

  describe('checkUpdateNotification', () => {
    let logSpy: ReturnType<typeof spyOn>;
    let spawnSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
      logSpy = spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      logSpy.mockRestore();
      spawnSpy?.mockRestore();
    });

    it('prints notification when latestVersion > currentVersion', () => {
      writeCache({ lastCheck: Date.now(), latestVersion: '99.0.0' });
      checkUpdateNotification('1.0.0');
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('99.0.0')
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('@update')
      );
    });

    it('does not print when latestVersion <= currentVersion', () => {
      writeCache({ lastCheck: Date.now(), latestVersion: '1.0.0' });
      checkUpdateNotification('1.0.0');
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('does not print when cache is null', () => {
      checkUpdateNotification('1.0.0');
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('triggers background check when cache is null', () => {
      spawnSpy = spyOn(child_process, 'spawn').mockImplementation(() => ({ unref: () => {} }) as any);
      checkUpdateNotification('1.0.0');
      expect(spawnSpy).toHaveBeenCalledWith(
        'sh',
        expect.arrayContaining([expect.stringContaining('npm view')]),
        expect.objectContaining({ detached: true, stdio: 'ignore' })
      );
    });

    it('triggers background check when lastCheck is older than 24h', () => {
      writeCache({ lastCheck: Date.now() - CHECK_INTERVAL_MS - 1, latestVersion: '1.0.0' });
      spawnSpy = spyOn(child_process, 'spawn').mockImplementation(() => ({ unref: () => {} }) as any);
      checkUpdateNotification('1.0.0');
      expect(spawnSpy).toHaveBeenCalled();
    });

    it('does not trigger background check when lastCheck is within 24h', () => {
      writeCache({ lastCheck: Date.now(), latestVersion: '1.0.0' });
      spawnSpy = spyOn(child_process, 'spawn').mockImplementation(() => ({ unref: () => {} }) as any);
      checkUpdateNotification('1.0.0');
      expect(spawnSpy).not.toHaveBeenCalled();
    });
  });
});

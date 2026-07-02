import { describe, expect, it, beforeEach } from 'bun:test';
import { setupTmpDir } from './helpers';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { Recorder, redactHeaders } from '../src/trace-recorder';

let tmpDir: string;
beforeEach(async () => { tmpDir = await setupTmpDir(); });

describe('redactHeaders', () => {
  it('masks sensitive header values, keeps others', () => {
    const out = redactHeaders({
      'content-type': 'application/json',
      'x-api-key': 'secret',
      'authorization': 'Bearer abc',
      'anthropic-auth-token': 'tok',
      'set-cookie': 'session=xyz',
      'anthropic-organization-id': 'org-1',
    });
    expect(out['content-type']).toBe('application/json');
    expect(out['x-api-key']).toBe('***');
    expect(out['authorization']).toBe('***');
    expect(out['anthropic-auth-token']).toBe('***');
    expect(out['set-cookie']).toBe('***');
    expect(out['anthropic-organization-id']).toBe('***');
  });

  it('matches header names case-insensitively', () => {
    expect(redactHeaders({ 'X-Api-Key': 's' })['X-Api-Key']).toBe('***');
  });
});

describe('Recorder', () => {
  it('writes session_meta first, then request lines with increasing turn', () => {
    const path = join(tmpDir, 'sub', 'test.jsonl');
    const rec = new Recorder(path, {
      sessionId: '20260630091224-zhipu-deadbeef', provider: 'zhipu',
      model: 'glm-4.6', startTime: '2026-06-30T09:12:24+08:00', cwd: '/proj',
    });
    rec.writeRequest({
      timestamp: 't1', durationMs: 10,
      request: { method: 'POST', path: '/v1/messages', headers: { 'x-api-key': 'k' }, body: { hi: 1 } },
      response: { status: 200, headers: { 'set-cookie': 'c' }, body: 'ok', sse: false },
    });
    rec.writeRequest({
      timestamp: 't2', durationMs: 20,
      request: { method: 'POST', path: '/v1/messages', headers: {}, body: { hi: 2 } },
      response: { status: 200, headers: {}, body: 'ok2', sse: true },
    });
    rec.close();

    const lines = readFileSync(path, 'utf8').trim().split('\n').map(JSON.parse);
    expect(lines).toHaveLength(3);
    expect(lines[0].type).toBe('session_meta');
    expect(lines[0].provider).toBe('zhipu');
    expect(lines[1].type).toBe('request');
    expect(lines[1].turn).toBe(1);
    expect(lines[1].request.headers['x-api-key']).toBe('***');   // request 打码
    expect(lines[1].response.headers['set-cookie']).toBe('***'); // response 也打码
    expect(lines[2].turn).toBe(2);
    expect(lines[2].response.sse).toBe(true);
  });

  it('ignores writeRequest after close', () => {
    const path = join(tmpDir, 't.jsonl');
    const rec = new Recorder(path, { sessionId: 's', provider: 'p', model: 'm', startTime: 't', cwd: '/' });
    rec.close();
    rec.writeRequest({
      timestamp: 't', durationMs: 0,
      request: { method: 'GET', path: '/', headers: {}, body: null },
      response: { status: 200, headers: {}, body: '', sse: false },
    });
    expect(readFileSync(path, 'utf8').trim().split('\n')).toHaveLength(1);
  });
});

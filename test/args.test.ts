import { describe, expect, it } from 'bun:test';
import { parseArgs } from '../src/args';

describe('parseArgs', () => {
  it('parses @provider without model', () => {
    const result = parseArgs(['@zhipu']);
    expect(result.provider).toBe('zhipu');
    expect(result.model).toBe('');
    expect(result.rest).toEqual([]);
    expect(result.isListCommand).toBe(false);
  });

  it('parses @provider:model with colon separator', () => {
    const result = parseArgs(['@zhipu:glm-5x1']);
    expect(result.provider).toBe('zhipu');
    expect(result.model).toBe('glm-5x1');
    expect(result.rest).toEqual([]);
  });

  it('parses no @provider -> empty provider (use default)', () => {
    const result = parseArgs(['-p', 'hello']);
    expect(result.provider).toBe('');
    expect(result.model).toBe('');
    expect(result.rest).toEqual(['-p', 'hello']);
  });

  it('detects @list command', () => {
    const result = parseArgs(['@list']);
    expect(result.isListCommand).toBe(true);
    expect(result.provider).toBe('');
  });

  it('strips @arg from rest, keeps other args', () => {
    const result = parseArgs(['@zhipu', '-p', 'hello', '-r', 'abc123']);
    expect(result.rest).toEqual(['-p', 'hello', '-r', 'abc123']);
  });

  it('uses first @arg when multiple given', () => {
    const result = parseArgs(['@zhipu', '@lp']);
    expect(result.provider).toBe('zhipu');
    expect(result.rest).toEqual(['@lp']);
  });

  it('handles empty argv', () => {
    const result = parseArgs([]);
    expect(result.provider).toBe('');
    expect(result.model).toBe('');
    expect(result.rest).toEqual([]);
  });

  it('detects @help command', () => {
    const result = parseArgs(['@help']);
    expect(result.isHelpCommand).toBe(true);
    expect(result.provider).toBe('');
    expect(result.model).toBe('');
    expect(result.rest).toEqual([]);
    expect(result.isListCommand).toBe(false);
  });
});

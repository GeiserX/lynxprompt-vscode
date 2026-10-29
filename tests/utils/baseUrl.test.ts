import { describe, it, expect } from 'vitest';
import { resolveBaseUrl, DEFAULT_BASE_URL } from '../../src/utils/baseUrl';

describe('resolveBaseUrl', () => {
  it('uses the official instance when nothing is set', () => {
    expect(resolveBaseUrl(undefined)).toBe(DEFAULT_BASE_URL);
    expect(resolveBaseUrl('')).toBe(DEFAULT_BASE_URL);
    expect(DEFAULT_BASE_URL).toBe('https://lynxprompt.geiser.cloud');
  });

  it('moves a saved legacy official URL to the new host', () => {
    expect(resolveBaseUrl('https://lynxprompt.com')).toBe('https://lynxprompt.geiser.cloud');
    expect(resolveBaseUrl('https://lynxprompt.com/')).toBe('https://lynxprompt.geiser.cloud');
    expect(resolveBaseUrl('https://lynxprompt.com///')).toBe('https://lynxprompt.geiser.cloud');
  });

  it('leaves any other custom URL alone', () => {
    expect(resolveBaseUrl('https://lp.example.com/')).toBe('https://lp.example.com');
    expect(resolveBaseUrl('http://lynxprompt.com')).toBe('http://lynxprompt.com');
    expect(resolveBaseUrl('https://www.lynxprompt.com')).toBe('https://www.lynxprompt.com');
    expect(resolveBaseUrl('https://lynxprompt.com/sub')).toBe('https://lynxprompt.com/sub');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { describeAuthError, withTimeout } from './authErrors';

describe('authErrors', () => {
  it('withTimeout נדחה עם code=timeout כשההבטחה תקועה', async () => {
    vi.useFakeTimers();
    const p = withTimeout(new Promise(() => {}), 15_000);
    const assertion = expect(p).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(15_001);
    await assertion;
    vi.useRealTimers();
  });

  it('withTimeout מחזיר את התוצאה כשההבטחה מסתיימת', async () => {
    await expect(withTimeout(Promise.resolve(5), 1000)).resolves.toBe(5);
  });

  it('describeAuthError כולל את הקוד ורמז', () => {
    expect(describeAuthError({ code: 'auth/unauthorized-domain' })).toContain('(auth/unauthorized-domain)');
    expect(describeAuthError({ code: 'auth/unauthorized-domain' })).toContain('Authorized domains');
    expect(describeAuthError({ code: 'timeout' })).toContain('15 שניות');
    expect(describeAuthError(new Error('boom'))).toContain('(boom)');
  });
});

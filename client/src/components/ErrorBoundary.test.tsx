import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CrashScreen, ErrorBoundary } from './ErrorBoundary';
import { Waiting } from './Waiting';

describe('Error Boundary', () => {
  it('getDerivedStateFromError שומר את השגיאה', () => {
    const e = new Error('boom');
    expect(ErrorBoundary.getDerivedStateFromError(e).error).toBe(e);
  });

  it('מסך ההתרסקות מציג פרטים וכפתור "חזרה למסך הכניסה"', () => {
    const err = new TypeError('Cannot read properties of null');
    const html = renderToStaticMarkup(<CrashScreen error={err} componentStack={'\n at Room\n at App'} guest={false} onReload={() => {}} onLogin={() => {}} />);
    expect(html).toContain('משהו השתבש');
    expect(html).toContain('TypeError: Cannot read properties of null');
    expect(html).toContain('at Room');
    expect(html).toContain('חזרה למסך הכניסה');
    expect(html).toContain('נסה שוב');
    expect(html).not.toContain('חשבון האורח');
  });

  it('לאורח מוצגת אזהרה שהתנתקות מוחקת את חשבון האורח', () => {
    const html = renderToStaticMarkup(<CrashScreen error={new Error('x')} guest onReload={() => {}} onLogin={() => {}} />);
    expect(html).toContain('חשבון האורח');
  });
});

describe('Waiting', () => {
  it('בהמתנה: מציג את התווית, בלי שגיאה', () => {
    const html = renderToStaticMarkup(<Waiting label="מתחבר לשרת…" timeoutCode="connect-timeout" />);
    expect(html).toContain('מתחבר לשרת…');
    expect(html).not.toContain('connect-timeout');
  });

  it('שגיאה מיידית: כותרת, קוד, רמז וכפתורים', () => {
    const html = renderToStaticMarkup(
      <Waiting label="" timeoutCode="" onRetry={() => {}} onBack={() => {}} backLabel="התנתק"
        error={{ title: 'המשחק כבר התחיל', code: 'join_failed/started', hint: 'נסה שוב' }} />,
    );
    expect(html).toContain('המשחק כבר התחיל');
    expect(html).toContain('join_failed/started');
    expect(html).toContain('נסה שוב');
    expect(html).toContain('התנתק');
  });
});

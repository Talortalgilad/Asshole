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

import { DecksPanel } from './DecksPanel';

describe('DecksPanel', () => {
  it('נעילה לפי נקודות: פתוחות בלי מנעול, נעולות עם סף, והנבחרת מסומנת', () => {
    const html = renderToStaticMarkup(<DecksPanel points={35} current="classic" onPick={() => {}} />);
    expect(html).toContain('✓ נבחרה');
    expect(html).toContain('🔒 60 נק'); // קריסטל
    expect(html).toContain('🔒 100 נק');
    expect(html).not.toContain('🔒 10 נק');
    expect(html).not.toContain('🔒 30 נק');
    expect(html).toContain('החבילה הבאה');
  });
  it('בדרגה הגבוהה ביותר אין מנעולים ואין "החבילה הבאה"', () => {
    const html = renderToStaticMarkup(<DecksPanel points={500} current="royal" onPick={() => {}} />);
    expect(html).not.toContain('🔒');
    expect(html).not.toContain('החבילה הבאה');
  });
});

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isGuestSession, logout } from '../lib/firebase';

/** מסך התרסקות: מציג את הפרטים במקום מסך ריק. עצמאי, בלי תלות ב-theme או בשרת. */
export function CrashScreen({ error, componentStack, guest, onReload, onLogin }: {
  error: Error; componentStack?: string; guest: boolean; onReload(): void; onLogin(): void;
}) {
  const details = [`${error.name}: ${error.message}`, ...(error.stack ?? '').split('\n').slice(1, 7), componentStack ? `\ncomponents:${componentStack.split('\n').slice(0, 6).join('\n')}` : '']
    .filter(Boolean).join('\n');
  return (
    <div role="alert" className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 px-5 py-8 text-center" style={{ color: '#f0fdf4' }}>
      <h1 className="text-2xl font-extrabold">משהו השתבש</h1>
      <p className="text-sm opacity-80">האפליקציה נתקלה בשגיאה. אפשר לנסות שוב, או לחזור למסך הכניסה.</p>
      <pre dir="ltr" className="max-h-56 w-full overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-left text-xs">{details}</pre>
      <div className="flex w-full gap-3">
        <button onClick={onReload} className="h-12 flex-1 rounded-xl bg-yellow-400 font-extrabold text-black">נסה שוב</button>
        <button onClick={onLogin} className="h-12 flex-1 rounded-xl bg-white/20 font-bold">חזרה למסך הכניסה</button>
      </div>
      {guest && <p className="text-xs text-yellow-200">שים לב: אתה מחובר כאורח. חזרה למסך הכניסה מתנתקת, וחשבון האורח הנוכחי ייעלם. עדיף קודם "נסה שוב".</p>}
    </div>
  );
}

type State = { error: Error | null; componentStack?: string };

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ui] render crashed:', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? undefined });
  }

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;
    return (
      <CrashScreen
        error={error} componentStack={componentStack} guest={isGuestSession()}
        onReload={() => location.reload()}
        onLogin={async () => {
          try { await logout(); } catch { /* ממשיכים בכל מקרה */ }
          location.href = location.pathname; // בלי ?name= וכו'
        }}
      />
    );
  }
}

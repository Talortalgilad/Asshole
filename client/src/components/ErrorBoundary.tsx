import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isGuestSession, logout } from '../lib/firebase';
import { NeonButton } from './NeonButton';
import { NeonScreen } from './NeonBackground';
import { Panel } from './ui';

/** מסך התרסקות: מציג את הפרטים במקום מסך ריק. */
export function CrashScreen({ error, componentStack, guest, onReload, onLogin }: {
  error: Error; componentStack?: string; guest: boolean; onReload(): void; onLogin(): void;
}) {
  const details = [`${error.name}: ${error.message}`, ...(error.stack ?? '').split('\n').slice(1, 7), componentStack ? `\ncomponents:${componentStack.split('\n').slice(0, 6).join('\n')}` : '']
    .filter(Boolean).join('\n');
  return (
    <NeonScreen>
      <div role="alert" className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 px-5 py-8 text-center">
        <Panel tone="magenta">
          <div className="flex flex-col gap-4">
            <h1 className="h-neon text-2xl">משהו השתבש</h1>
            <p className="label-dim">האפליקציה נתקלה בשגיאה. אפשר לנסות שוב, או לחזור למסך הכניסה.</p>
            <pre dir="ltr" className="max-h-56 w-full overflow-auto whitespace-pre-wrap rounded p-3 text-left text-xs" style={{ background: 'var(--bg-0)', border: '1px solid color-mix(in srgb, var(--magenta) 50%, transparent)' }}>{details}</pre>
            <NeonButton small onClick={onReload}>נסה שוב</NeonButton>
            <NeonButton small tone="dim" onClick={onLogin}>חזרה למסך הכניסה</NeonButton>
            {guest && <p className="label-dim text-xs">שים לב: אתה מחובר כאורח. חזרה למסך הכניסה מתנתקת, וחשבון האורח הנוכחי ייעלם. עדיף קודם "נסה שוב".</p>}
          </div>
        </Panel>
      </div>
    </NeonScreen>
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

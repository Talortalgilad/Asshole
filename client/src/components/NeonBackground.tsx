import type { ReactNode } from 'react';

/** שכבת הרקע של ערכת הנושא (גריד סינת'ווייב). עוטף מסך שלם. */
export function NeonScreen({ children }: { children: ReactNode }) {
  return (
    <div className="neon-root">
      <div className="neon-bg" aria-hidden="true" />
      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-md flex-col">{children}</div>
    </div>
  );
}

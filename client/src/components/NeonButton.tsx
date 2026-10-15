import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  tone?: 'cyan' | 'magenta' | 'dim';
  small?: boolean;
  children: ReactNode;
};

/** כפתור ניאון עם פינות חתוכות. ה-wrapper נושא את ה-glow (filter), כי clip-path היה חותך אותו. */
export function NeonButton({ tone = 'cyan', small, children, disabled, ...rest }: Props) {
  return (
    <span className={`neon-btn-wrap tone-${tone} ${small ? 'small' : ''} ${disabled ? 'disabled' : ''}`}>
      <button type="button" className="neon-btn" disabled={disabled} {...rest}>
        <span className="neon-btn-label">{children}</span>
      </button>
    </span>
  );
}

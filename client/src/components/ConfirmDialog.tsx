import { Panel } from './ui';
import { NeonButton } from './NeonButton';

type Props = { message: string; confirmLabel: string; cancelLabel: string; onConfirm(): void; onCancel(): void };

export function ConfirmDialog({ message, confirmLabel, cancelLabel, onConfirm, onCancel }: Props) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <Panel tone="dim">
          <p className="mb-5 text-center text-lg font-bold" style={{ fontFamily: 'var(--font-he)' }}>{message}</p>
          <div className="flex flex-col gap-3">
            <NeonButton tone="magenta" small onClick={onConfirm}>{confirmLabel}</NeonButton>
            <NeonButton tone="cyan" small onClick={onCancel}>{cancelLabel}</NeonButton>
          </div>
        </Panel>
      </div>
    </div>
  );
}

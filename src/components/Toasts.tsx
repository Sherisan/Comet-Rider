import { useEffect } from 'react';
import type { GameActions, Toast } from '../game/useGameState';

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div className={`toast toast-${toast.kind}`} onClick={() => onDismiss(toast.id)}>
      {toast.text}
    </div>
  );
}

export function Toasts({ toasts, actions }: { toasts: Toast[]; actions: GameActions }) {
  return (
    <div className="toasts">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={actions.dismissToast} />
      ))}
    </div>
  );
}

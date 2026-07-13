import { useEffect, useState } from 'react';
import { subscribeToasts } from '../../lib/explorerToast.js';

/**
 * Global toast stack for explorer pages. Mount once inside ExplorerApp.
 */
export default function ExplorerToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return subscribeToasts((toast) => {
      setToasts((prev) => [...prev.slice(-4), toast]);
      const duration = toast.duration ?? 2200;
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, duration);
    });
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="explorer-toast-host" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`explorer-toast explorer-toast--${toast.type || 'success'}`}
          role="status"
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}

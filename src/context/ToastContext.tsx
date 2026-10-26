import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextData {
  showToast: (title: string, message?: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextData | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((title: string, message?: string, type: ToastType = 'success', duration = 3500) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type, duration }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      {/* Toast Container rendered globally */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-full px-4 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl p-4 shadow-2xl backdrop-blur-xl border transition-all duration-300 animate-in fade-in slide-in-from-top-3 ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100 shadow-emerald-950/60'
                : toast.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/40 text-amber-100 shadow-amber-950/60'
                : toast.type === 'error'
                ? 'bg-red-950/90 border-red-500/40 text-red-100 shadow-red-950/60'
                : 'bg-slate-900/90 border-slate-700/60 text-slate-100 shadow-slate-950/60'
            }`}
          >
            <div className="shrink-0 pt-0.5">
              {toast.type === 'success' && (
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40 text-emerald-400 font-bold text-xs">✓</div>
              )}
              {toast.type === 'warning' && (
                <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/40 text-amber-400 font-bold text-xs">!</div>
              )}
              {toast.type === 'error' && (
                <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/40 text-red-400 font-bold text-xs">✕</div>
              )}
              {toast.type === 'info' && (
                <div className="w-6 h-6 rounded-full bg-sky-500/20 flex items-center justify-center border border-sky-500/40 text-sky-400 font-bold text-xs">i</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold tracking-wide">{toast.title}</h4>
              {toast.message && <p className="text-xs mt-0.5 opacity-90 leading-relaxed break-words">{toast.message}</p>}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 opacity-60 hover:opacity-150 transition-opacity p-1 -mr-1 -mt-1 text-current"
              aria-label="Cerrar notificación"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

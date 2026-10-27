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
      {/* Ultra-Slim Toast Container rendered globally (Zero cut-off text) */}
      <div className="fixed top-2.5 right-2.5 z-[9999] flex flex-col gap-1 max-w-[260px] sm:max-w-[290px] w-full px-1.5 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 shadow-lg border transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${
              toast.type === 'success'
                ? 'bg-[#06241b]/95 border-emerald-500/45 text-emerald-100'
                : toast.type === 'warning'
                ? 'bg-[#271a05]/95 border-amber-500/45 text-amber-100'
                : toast.type === 'error'
                ? 'bg-[#280a0e]/95 border-red-500/45 text-red-100'
                : 'bg-[#0A0E17]/95 border-slate-700/70 text-slate-100'
            }`}
          >
            <div className="shrink-0">
              {toast.type === 'success' && (
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40 text-emerald-400 font-bold text-[8.5px]">✓</div>
              )}
              {toast.type === 'warning' && (
                <div className="w-3.5 h-3.5 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/40 text-amber-400 font-bold text-[8.5px]">!</div>
              )}
              {toast.type === 'error' && (
                <div className="w-3.5 h-3.5 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/40 text-red-400 font-bold text-[8.5px]">✕</div>
              )}
              {toast.type === 'info' && (
                <div className="w-3.5 h-3.5 rounded-full bg-sky-500/20 flex items-center justify-center border border-sky-500/40 text-sky-400 font-bold text-[8.5px]">i</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[10px] font-bold tracking-tight leading-tight">{toast.title}</h4>
              {toast.message && <p className="text-[9px] opacity-90 leading-tight mt-0.5">{toast.message}</p>}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity p-0.5 text-[10px] text-current cursor-pointer"
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

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Trash2, Star } from 'lucide-react';

export interface AdminFeedbackRecord {
  id: string;
  u: string;
  n: string;
  r: number;
  c: string;
  m: string;
  t: number;
}

export const AdminFeedbackTab: React.FC = () => {
  const [items, setItems] = useState<AdminFeedbackRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedStarFilter, setSelectedStarFilter] = useState<'ALL' | number>('ALL');
  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);

  const getAdminAuthHeaders = useCallback((withJson = false): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (withJson) headers['Content-Type'] = 'application/json';
    const pin =
      sessionStorage.getItem('futbolstats_admin_pin') ||
      localStorage.getItem('sportstats_admin_saved_pin') ||
      '';
    if (pin.trim()) headers['x-admin-pin'] = pin.trim();
    const jwt = sessionStorage.getItem('sportstats_session_jwt');
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
    return headers;
  }, []);

  const loadFeedback = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/feedback', {
        headers: getAdminAuthHeaders(false)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          setItems(data.items);
        }
      }
    } catch {
      // ignore offline
    } finally {
      setIsLoading(false);
    }
  }, [getAdminAuthHeaders]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const handleDeleteItem = async (id: string) => {
    try {
      const pin =
        sessionStorage.getItem('futbolstats_admin_pin') ||
        localStorage.getItem('sportstats_admin_saved_pin') ||
        '';
      const res = await fetch('/api/admin/feedback', {
        method: 'DELETE',
        headers: getAdminAuthHeaders(true),
        body: JSON.stringify({ pin, id })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          setItems(data.items);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleClearAll = async () => {
    setConfirmClearAll(false);
    try {
      const pin =
        sessionStorage.getItem('futbolstats_admin_pin') ||
        localStorage.getItem('sportstats_admin_saved_pin') ||
        '';
      const res = await fetch('/api/admin/feedback', {
        method: 'DELETE',
        headers: getAdminAuthHeaders(true),
        body: JSON.stringify({ pin, clearAll: true })
      });
      if (res.ok) {
        setItems([]);
      }
    } catch {
      // ignore
    }
  };

  const stats = useMemo(() => {
    const total = items.length;
    if (total === 0) {
      return { total: 0, avg: '0.0', fiveStars: 0, fiveStarPct: 0 };
    }
    const sum = items.reduce((acc, it) => acc + (Number(it.r) || 5), 0);
    const fiveStars = items.filter((it) => Number(it.r) === 5).length;
    return {
      total,
      avg: (sum / total).toFixed(1),
      fiveStars,
      fiveStarPct: Math.round((fiveStars / total) * 100)
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (selectedStarFilter === 'ALL') return items;
    return items.filter((it) => Number(it.r) === selectedStarFilter);
  }, [items, selectedStarFilter]);

  return (
    <div className="space-y-3 font-sans text-slate-800">
      {/* 1. Resumen KPI del Buzón Privado de Calificaciones */}
      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                ⭐ Exclusivo Administrador
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white text-slate-600 border border-slate-200">
                ⚡ Persistente en BD (&lt;10 KB)
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
              Calificaciones y Buzón de Usuarios · G METRICS
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={loadFeedback}
              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>

            {items.length > 0 && (
              confirmClearAll ? (
                <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-xl px-2 py-1">
                  <span className="text-[11px] text-rose-800 font-bold">¿Vaciar buzón?</span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="px-2 py-0.5 rounded bg-rose-600 text-white text-xs font-bold cursor-pointer"
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(false)}
                    className="px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 text-xs font-medium transition cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpiar</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* 3 Tarjetas de Resumen */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs">
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Promedio Global</span>
            <span className="text-base font-bold font-mono text-amber-700 flex items-center gap-1 mt-0.5">
              <span>{stats.avg}</span>
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs">
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Total Reseñas</span>
            <span className="text-base font-bold font-mono text-slate-900 mt-0.5 block">
              {stats.total}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs">
            <span className="text-emerald-800 block text-[10px] uppercase font-semibold">5 Estrellas</span>
            <span className="text-base font-bold font-mono text-emerald-700 mt-0.5 block">
              {stats.fiveStarPct}% ({stats.fiveStars})
            </span>
          </div>
        </div>
      </div>

      {/* 2. Filtro por Estrellas */}
      <div className="flex items-center gap-1 flex-wrap bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
        <button
          type="button"
          onClick={() => setSelectedStarFilter('ALL')}
          className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
            selectedStarFilter === 'ALL'
              ? 'bg-white text-slate-900 border border-slate-300 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Todas ({items.length})
        </button>
        {[5, 4, 3, 2, 1].map((st) => {
          const count = items.filter((i) => Number(i.r) === st).length;
          return (
            <button
              key={st}
              type="button"
              onClick={() => setSelectedStarFilter(st)}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                selectedStarFilter === st
                  ? 'bg-white text-amber-900 border border-amber-300 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st} ⭐ ({count})
            </button>
          );
        })}
      </div>

      {/* 3. Lista de Comentarios y Calificaciones */}
      {isLoading ? (
        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
          Cargando comentarios de usuarios...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
          <Star className="w-6 h-6 text-slate-400 mx-auto" />
          <p className="text-xs font-bold text-slate-700">
            Aún no hay calificaciones registradas en esta vista.
          </p>
          <p className="text-[11px] text-slate-500">
            Cuando un usuario envíe su calificación desde la notificación o el botón &quot;⭐ Calificar&quot; del pie de página, aparecerá aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-start justify-between gap-3 text-xs"
            >
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-[11px]">
                    @{item.u}
                  </span>
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-bold text-[11px]">
                    {'⭐'.repeat(Math.min(5, Math.max(1, Number(item.r) || 5)))} ({item.r}/5)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-[10px]">
                    {item.c}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {new Date(item.t).toLocaleString('es-CO', {
                      dateStyle: 'short',
                      timeStyle: 'short'
                    })}
                  </span>
                </div>

                {item.m ? (
                  <p className="text-xs text-slate-700 leading-relaxed pt-0.5 break-words">
                    &ldquo;{item.m}&rdquo;
                  </p>
                ) : (
                  <p className="text-[11px] italic text-slate-400 pt-0.5">
                    Calificación enviada sin comentario escrito.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleDeleteItem(item.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0"
                title="Eliminar comentario"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

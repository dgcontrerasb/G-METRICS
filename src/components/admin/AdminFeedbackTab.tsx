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

function formatFeedbackIdentity(u: string, n?: string): { name: string; username: string | null } {
  let cleanUser = String(u || '').trim();
  let cleanName = String(n || '').trim();

  // Si vino con JSON stringified o fragmento JSON tipo '{"id":"1cd1da59...'
  if (cleanUser.startsWith('{') || cleanUser.includes('"id":')) {
    try {
      const parsed = JSON.parse(cleanUser);
      cleanUser = parsed.username || parsed.email || 'usuario';
      if (!cleanName || cleanName.startsWith('{')) {
        cleanName = parsed.displayName || parsed.name || cleanUser;
      }
    } catch {
      cleanUser = 'usuario';
    }
  }

  if (cleanName.startsWith('{') || cleanName.includes('"id":')) {
    try {
      const parsed = JSON.parse(cleanName);
      cleanName = parsed.displayName || parsed.name || parsed.username || 'Usuario';
    } catch {
      cleanName = cleanUser !== 'usuario' ? cleanUser : 'Usuario Registrado';
    }
  }

  if (!cleanName || cleanName === 'usuario') {
    cleanName = cleanUser && cleanUser !== 'usuario' ? cleanUser : 'Usuario Registrado';
  }

  const showUsername =
    cleanUser &&
    cleanUser !== 'usuario' &&
    cleanUser.toLowerCase() !== cleanName.toLowerCase()
      ? cleanUser
      : null;

  return { name: cleanName, username: showUsername };
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
    <div className="space-y-3 font-sans text-white">
      {/* 1. Resumen KPI del Buzón Privado de Calificaciones */}
      <div className="p-3.5 rounded-2xl bg-[#0b0e14] border border-[#30363d] space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-[#d9b114] border border-amber-500/30">
                ⭐ Exclusivo Administrador
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#161b22] text-[#8b949e] border border-[#30363d]">
                ⚡ Persistente en BD (&lt;10 KB)
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mt-1">
              Calificaciones y Buzón de Usuarios · G METRICS
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={loadFeedback}
              className="px-2.5 py-1.5 rounded-xl bg-[#161b22] hover:bg-[#21262d] text-[#8b949e] hover:text-white border border-[#30363d] text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>

            {items.length > 0 && (
              confirmClearAll ? (
                <div className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/30 rounded-xl px-2 py-1">
                  <span className="text-[11px] text-rose-400 font-bold">¿Vaciar buzón?</span>
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
                    className="px-2 py-0.5 rounded bg-[#161b22] text-[#8b949e] hover:text-white border border-[#30363d] text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-[#161b22] hover:bg-rose-500/20 text-[#8b949e] hover:text-rose-400 border border-[#30363d] text-xs font-medium transition cursor-pointer flex items-center gap-1"
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
          <div className="p-2.5 rounded-xl bg-[#161b22] border border-[#30363d] text-xs">
            <span className="text-[#8b949e] block text-[10px] uppercase font-semibold">Promedio Global</span>
            <span className="text-base font-bold font-mono text-[#d9b114] flex items-center gap-1 mt-0.5">
              <span>{stats.avg}</span>
              <Star className="w-3.5 h-3.5 text-[#d9b114] fill-[#d9b114]" />
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-[#161b22] border border-[#30363d] text-xs">
            <span className="text-[#8b949e] block text-[10px] uppercase font-semibold">Total Reseñas</span>
            <span className="text-base font-bold font-mono text-white mt-0.5 block">
              {stats.total}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-[#161b22] border border-[#30363d] text-xs">
            <span className="text-[#00ff66] block text-[10px] uppercase font-semibold">5 Estrellas</span>
            <span className="text-base font-bold font-mono text-[#00ff66] mt-0.5 block">
              {stats.fiveStarPct}% ({stats.fiveStars})
            </span>
          </div>
        </div>
      </div>

      {/* 2. Filtro por Estrellas */}
      <div className="flex items-center gap-1 flex-wrap bg-[#0b0e14] p-1 rounded-xl border border-[#30363d] text-xs">
        <button
          type="button"
          onClick={() => setSelectedStarFilter('ALL')}
          className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
            selectedStarFilter === 'ALL'
              ? 'bg-[#161b22] text-white border border-[#d9b114]/50 shadow-2xs'
              : 'text-[#8b949e] hover:text-white'
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
                  ? 'bg-[#161b22] text-[#d9b114] border border-[#d9b114]/50 shadow-2xs'
                  : 'text-[#8b949e] hover:text-white'
              }`}
            >
              {st} ⭐ ({count})
            </button>
          );
        })}
      </div>

      {/* 3. Lista de Comentarios y Calificaciones */}
      {isLoading ? (
        <div className="p-6 rounded-2xl bg-[#0b0e14] border border-[#30363d] text-center text-xs text-[#8b949e]">
          Cargando comentarios de usuarios...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-6 rounded-2xl bg-[#0b0e14] border border-[#30363d] text-center space-y-1">
          <Star className="w-6 h-6 text-[#8b949e] mx-auto" />
          <p className="text-xs font-bold text-white">
            Aún no hay calificaciones registradas en esta vista.
          </p>
          <p className="text-[11px] text-[#8b949e]">
            Cuando un usuario envíe su calificación desde la notificación o el botón &quot;⭐ Calificar&quot; del pie de página, aparecerá aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-2xs flex items-start justify-between gap-3 text-xs"
            >
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {(() => {
                    const identity = formatFeedbackIdentity(item.u, item.n);
                    return (
                      <>
                        <span className="font-bold text-white text-xs flex items-center gap-1">
                          👤 {identity.name}
                        </span>
                        {identity.username && (
                          <span className="font-mono text-[#d9b114] bg-[#0b0e14] border border-[#30363d] px-1.5 py-0.5 rounded-md text-[10px]">
                            @{identity.username}
                          </span>
                        )}
                      </>
                    );
                  })()}
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[#d9b114] font-bold text-[11px]">
                    {'⭐'.repeat(Math.min(5, Math.max(1, Number(item.r) || 5)))} ({item.r}/5)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#0b0e14] border border-[#30363d] text-[#8b949e] font-semibold text-[10px]">
                    {item.c}
                  </span>
                  <span className="text-[10px] font-mono text-[#8b949e]">
                    {new Date(item.t).toLocaleString('es-CO', {
                      dateStyle: 'short',
                      timeStyle: 'short'
                    })}
                  </span>
                </div>

                {item.m ? (
                  <p className="text-xs text-white/90 leading-relaxed pt-0.5 break-words">
                    &ldquo;{item.m}&rdquo;
                  </p>
                ) : (
                  <p className="text-[11px] italic text-[#8b949e] pt-0.5">
                    Calificación enviada sin comentario escrito.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleDeleteItem(item.id)}
                className="p-1.5 rounded-lg text-[#8b949e] hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer shrink-0"
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

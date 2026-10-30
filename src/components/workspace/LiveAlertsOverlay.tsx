import React from 'react';
import { Bell, X } from 'lucide-react';
import { LiveGoalAlertItem } from '../../services/favoritesService';

interface LiveAlertsOverlayProps {
  liveGoalAlerts: LiveGoalAlertItem[];
  onAlertClick: (alert: LiveGoalAlertItem) => void;
  onDismissAlert: (alertId: string) => void;
}

export const LiveAlertsOverlay: React.FC<LiveAlertsOverlayProps> = ({
  liveGoalAlerts,
  onAlertClick,
  onDismissAlert
}) => {
  if (liveGoalAlerts.length === 0) return null;

  return (
    <div className="fixed top-2.5 left-1/2 -translate-x-1/2 z-[120] w-[88%] max-w-[300px] space-y-1.5 pointer-events-none">
      {liveGoalAlerts.map((alert) => {
        const isSoccer = alert.sport === 'SOCCER';
        const scorerName =
          alert.scoringTeam === 'HOME'
            ? alert.homeTeam
            : alert.scoringTeam === 'AWAY'
            ? alert.awayTeam
            : `${alert.homeTeam} vs ${alert.awayTeam}`;
        const badgeLabel =
          alert.badgeText ||
          (isSoccer ? '¡GOL EN VIVO!' : `¡CANASTA ${alert.detailText || ''}!`);
        const subLabel =
          alert.subtitleText || `Anotó: ${scorerName} · Toca para cancha 2D`;
        const emoji = alert.iconEmoji || (isSoccer ? '⚽' : '🏀');

        return (
          <div
            key={alert.id}
            className={`pointer-events-auto rounded-xl px-2.5 py-2 shadow-xl border backdrop-blur-md flex items-center justify-between gap-2 transition-all ${
              isSoccer
                ? 'bg-gradient-to-r from-emerald-950/95 via-emerald-900/95 to-slate-950/95 border-amber-400 text-white'
                : 'bg-gradient-to-r from-amber-950/95 via-slate-900/95 to-slate-950/95 border-amber-400 text-white'
            }`}
          >
            <div
              onClick={() => onAlertClick(alert)}
              className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-400/20 border border-amber-400/60 flex items-center justify-center text-sm shrink-0">
                {emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-[8.5px] font-mono font-extrabold uppercase tracking-tight px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 truncate">
                    {badgeLabel}
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-[8.5px] font-bold text-amber-300 shrink-0">
                    <Bell className="w-2.5 h-2.5 fill-amber-300" /> Fav
                  </span>
                  <span className="text-[9px] font-mono text-emerald-300 font-bold ml-auto shrink-0">
                    {alert.minuteOrQuarter}
                  </span>
                </div>
                <p className="text-[10.5px] font-extrabold text-white truncate mt-0.5 leading-tight">
                  {alert.homeTeam}{' '}
                  <span className="font-mono text-amber-300 px-0.5">
                    {alert.homeScore} - {alert.awayScore}
                  </span>{' '}
                  {alert.awayTeam}
                </p>
                <p className="text-[8.5px] text-slate-300 truncate leading-tight">
                  {subLabel}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onDismissAlert(alert.id)}
              className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              aria-label="Cerrar alerta"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

import { ParlayPick } from '../types';

export type SlipStatus = 'PENDING' | 'WON' | 'LOST';
export type SlipSportCategory = 'SOCCER' | 'NBA' | 'MIXED';

export interface SavedSlip {
  id: string;
  createdAt: number;
  title: string;
  picks: ParlayPick[];
  stake: number;
  totalOdds: number;
  jointProbability: number;
  potentialPayout: number;
  potentialProfit: number;
  status: SlipStatus;
  sportCategory: SlipSportCategory;
  notes?: string;
}

const STORAGE_KEY_SAVED_SLIPS = 'sportstats_saved_parlay_slips_v1';

export const SavedSlipsService = {
  getSavedSlips(): SavedSlip[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SAVED_SLIPS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => b.createdAt - a.createdAt);
      }
    } catch {
      // ignore
    }
    return [];
  },

  saveSlip(
    picks: ParlayPick[],
    stake: number,
    totalOdds: number,
    jointProbability: number,
    potentialPayout: number,
    potentialProfit: number,
    customNotes?: string
  ): SavedSlip {
    const existingSlips = this.getSavedSlips();
    const now = Date.now();

    const hasSoccer = picks.some((p) => p.sport !== 'NBA');
    const hasNBA = picks.some((p) => p.sport === 'NBA');
    const sportCategory: SlipSportCategory =
      hasSoccer && hasNBA ? 'MIXED' : hasNBA ? 'NBA' : 'SOCCER';

    const slipTitle = `${picks.length} ${
      picks.length === 1 ? 'Partido' : 'Partidos'
    } (@${totalOdds.toFixed(2)}x)`;

    const newSlip: SavedSlip = {
      id: `SLIP-${now.toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      createdAt: now,
      title: slipTitle,
      picks: [...picks],
      stake,
      totalOdds,
      jointProbability,
      potentialPayout,
      potentialProfit,
      status: 'PENDING',
      sportCategory,
      notes: customNotes
    };

    const updated = [newSlip, ...existingSlips];
    try {
      localStorage.setItem(STORAGE_KEY_SAVED_SLIPS, JSON.stringify(updated));
    } catch {
      // ignore
    }

    return newSlip;
  },

  updateSlipStatus(slipId: string, newStatus: SlipStatus): boolean {
    const slips = this.getSavedSlips();
    const idx = slips.findIndex((s) => s.id === slipId);
    if (idx < 0) return false;

    slips[idx].status = newStatus;
    try {
      localStorage.setItem(STORAGE_KEY_SAVED_SLIPS, JSON.stringify(slips));
      return true;
    } catch {
      return false;
    }
  },

  deleteSlip(slipId: string): boolean {
    const slips = this.getSavedSlips();
    const filtered = slips.filter((s) => s.id !== slipId);
    try {
      localStorage.setItem(STORAGE_KEY_SAVED_SLIPS, JSON.stringify(filtered));
      return true;
    } catch {
      return false;
    }
  },

  generateWhatsAppTextForSlip(slip: SavedSlip): string {
    const formattedStake = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(slip.stake);
    const formattedPayout = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(slip.potentialPayout);
    const formattedProfit = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(slip.potentialProfit);

    const statusEmoji =
      slip.status === 'WON' ? '🟢 GANADO' : slip.status === 'LOST' ? '🔴 PERDIDO' : '⏳ PENDIENTE';

    let text = `🎫 *BOLETO GUARDADO G METRICS*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📌 *Estado:* ${statusEmoji}\n`;
    text += `🗓️ *Fecha:* ${new Date(slip.createdAt).toLocaleString('es-CO')}\n\n`;

    slip.picks.forEach((p, idx) => {
      const sportEmoji = p.sport === 'NBA' ? '🏀' : '⚽';
      text += `${idx + 1}. ${sportEmoji} *${p.matchTitle}*\n`;
      text += `   ▪️ Selección: *${p.selectionLabel}*\n`;
      text += `   ▪️ Cuota: *${p.userOdd.toFixed(2)}x* (Prob: ${p.probability}%)\n\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📊 *Cuota Combinada:* ${slip.totalOdds.toFixed(2)}x\n`;
    text += `🎯 *Probabilidad Conjunta:* ${slip.jointProbability}%\n`;
    text += `💰 *Stake:* ${formattedStake}\n`;
    text += `🏆 *Retorno Potencial:* ${formattedPayout}\n`;
    text += `📈 *Ganancia Neta:* +${formattedProfit}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💡 _Análisis estadístico generado en G METRICS._`;

    return text;
  }
};

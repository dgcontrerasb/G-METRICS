import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { ParlayPick } from '../types';

interface RiskLevelInfo {
  label: string;
  badgeClass: string;
  dotColor: string;
  description: string;
}

interface ParlayContextType {
  picks: ParlayPick[];
  stake: number;
  isOpen: boolean;
  toastMessage: string | null;
  setIsOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setStake: (val: number) => void;
  addPick: (pick: ParlayPick) => { success: boolean; replacedPrevious?: boolean; message: string };
  togglePick: (pick: ParlayPick) => void;
  removePick: (pickId: string) => void;
  updatePickOdd: (pickId: string, newOdd: number) => void;
  clearParlay: () => void;
  isPickInParlay: (fixtureId: string, marketKey?: string) => boolean;
  getPickForFixture: (fixtureId: string) => ParlayPick | undefined;
  // Computed values
  totalOdds: number;
  totalReferenceOdds: number;
  jointProbability: number;
  potentialPayout: number;
  potentialProfit: number;
  riskLevel: RiskLevelInfo;
}

const STORAGE_KEY_PICKS = 'sportstats_parlay_slip';
const STORAGE_KEY_STAKE = 'sportstats_parlay_stake';
const DEFAULT_STAKE = 20000; // $20,000 COP

const ParlayContext = createContext<ParlayContextType | undefined>(undefined);

export const ParlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [picks, setPicks] = useState<ParlayPick[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PICKS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Error loading parlay picks from storage', e);
    }
    return [];
  });

  const [stake, setStakeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STAKE);
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val > 0) return val;
      }
    } catch {
      // ignore
    }
    return DEFAULT_STAKE;
  });

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync picks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PICKS, JSON.stringify(picks));
    } catch (e) {
      console.warn('Error saving parlay picks', e);
    }
  }, [picks]);

  // Sync stake to localStorage
  const setStake = useCallback((val: number) => {
    const cleanVal = Math.max(1000, isNaN(val) ? DEFAULT_STAKE : val);
    setStakeState(cleanVal);
    try {
      localStorage.setItem(STORAGE_KEY_STAKE, String(cleanVal));
    } catch {
      // ignore
    }
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3200);
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Add pick with anti-conflict guard
  const addPick = useCallback((newPick: ParlayPick): { success: boolean; replacedPrevious?: boolean; message: string } => {
    let replaced = false;
    let msg = '';

    setPicks((prev) => {
      // Check if this fixture already has a pick in the slip
      const existingIndex = prev.findIndex((p) => p.fixtureId === newPick.fixtureId);

      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        // If same market, return as already added
        if (existing.marketKey === newPick.marketKey) {
          msg = `Esta selección ya está en tu boleto combinada.`;
          return prev;
        }

        // Replaced different market for same fixture to prevent correlated / impossible contradictory bets
        replaced = true;
        const updated = [...prev];
        updated[existingIndex] = newPick;
        msg = `Selección actualizada en ${newPick.matchTitle}: "${newPick.selectionLabel}".`;
        return updated;
      }

      // Max 15 picks in slip for stability
      if (prev.length >= 15) {
        msg = 'Límite de 15 selecciones por boleto alcanzado.';
        return prev;
      }

      msg = `Añadido al boleto: "${newPick.selectionLabel}" (${newPick.matchTitle}).`;
      return [...prev, newPick];
    });

    showToast(msg);
    return { success: true, replacedPrevious: replaced, message: msg };
  }, [showToast]);

  const removePick = useCallback((pickId: string) => {
    setPicks((prev) => {
      const removed = prev.find((p) => p.id === pickId);
      const next = prev.filter((p) => p.id !== pickId);
      if (removed) {
        showToast(`Eliminado del boleto: "${removed.selectionLabel}".`);
      }
      return next;
    });
  }, [showToast]);

  const togglePick = useCallback((pick: ParlayPick) => {
    setPicks((prev) => {
      const existing = prev.find((p) => p.fixtureId === pick.fixtureId && p.marketKey === pick.marketKey);
      if (existing) {
        showToast(`Eliminado del boleto: "${pick.selectionLabel}".`);
        return prev.filter((p) => p.id !== existing.id);
      } else {
        return [...prev.filter((p) => p.fixtureId !== pick.fixtureId), pick];
      }
    });
  }, [showToast]);

  const updatePickOdd = useCallback((pickId: string, newOdd: number) => {
    if (isNaN(newOdd) || newOdd < 1.01) return;
    const cleanOdd = Math.min(100, Math.max(1.01, Number(newOdd.toFixed(2))));
    setPicks((prev) =>
      prev.map((p) => (p.id === pickId ? { ...p, userOdd: cleanOdd } : p))
    );
  }, []);

  const clearParlay = useCallback(() => {
    setPicks([]);
    showToast('Boleto de combinadas vaciado.');
  }, [showToast]);

  const isPickInParlay = useCallback(
    (fixtureId: string, marketKey?: string) => {
      if (marketKey) {
        return picks.some((p) => p.fixtureId === fixtureId && p.marketKey === marketKey);
      }
      return picks.some((p) => p.fixtureId === fixtureId);
    },
    [picks]
  );

  const getPickForFixture = useCallback(
    (fixtureId: string) => {
      return picks.find((p) => p.fixtureId === fixtureId);
    },
    [picks]
  );

  // Computations
  const totalOdds = useMemo(() => {
    if (picks.length === 0) return 1.0;
    const raw = picks.reduce((acc, p) => acc * (p.userOdd || p.referenceOdd || 1.0), 1.0);
    return Number(raw.toFixed(2));
  }, [picks]);

  const totalReferenceOdds = useMemo(() => {
    if (picks.length === 0) return 1.0;
    const raw = picks.reduce((acc, p) => acc * (p.referenceOdd || 1.0), 1.0);
    return Number(raw.toFixed(2));
  }, [picks]);

  const jointProbability = useMemo(() => {
    if (picks.length === 0) return 0;
    // Product of independent probabilities: P_joint = Product( P_i / 100 ) * 100
    const rawProduct = picks.reduce((acc, p) => acc * (Math.max(1, Math.min(99, p.probability)) / 100), 1.0);
    return Number((rawProduct * 100).toFixed(1));
  }, [picks]);

  const potentialPayout = useMemo(() => {
    return Math.round(stake * totalOdds);
  }, [stake, totalOdds]);

  const potentialProfit = useMemo(() => {
    return Math.max(0, potentialPayout - stake);
  }, [potentialPayout, stake]);

  const riskLevel = useMemo<RiskLevelInfo>(() => {
    if (picks.length === 0) {
      return {
        label: 'Sin selecciones',
        badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
        dotColor: '#94a3b8',
        description: 'Agrega partidos para calcular probabilidad conjunta.'
      };
    }
    if (jointProbability >= 50) {
      return {
        label: 'Probabilidad Alta (Bajo Riesgo)',
        badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        dotColor: '#10b981',
        description: 'Excelente solidez estadística basada en los modelos Poisson.'
      };
    }
    if (jointProbability >= 30) {
      return {
        label: 'Probabilidad Moderada (Riesgo Equilibrado)',
        badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
        dotColor: '#06b6d4',
        description: 'Combinación balanceada entre cuota atractiva y probabilidad sólida.'
      };
    }
    if (jointProbability >= 15) {
      return {
        label: 'Riesgo Moderado-Alto',
        badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        dotColor: '#f59e0b',
        description: 'A mayor cantidad de eventos, la probabilidad conjunta decrece exponencialmente.'
      };
    }
    return {
      label: 'Alto Riesgo (Cuota Elevada)',
      badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      dotColor: '#f43f5e',
      description: 'Combinada de cuota alta o múltiples eventos. Se sugiere stake conservador.'
    };
  }, [jointProbability, picks.length]);

  return (
    <ParlayContext.Provider
      value={{
        picks,
        stake,
        isOpen,
        toastMessage,
        setIsOpen,
        toggleOpen,
        setStake,
        addPick,
        togglePick,
        removePick,
        updatePickOdd,
        clearParlay,
        isPickInParlay,
        getPickForFixture,
        totalOdds,
        totalReferenceOdds,
        jointProbability,
        potentialPayout,
        potentialProfit,
        riskLevel
      }}
    >
      {children}
    </ParlayContext.Provider>
  );
};

export const useParlay = (): ParlayContextType => {
  const context = useContext(ParlayContext);
  if (!context) {
    throw new Error('useParlay must be used within a ParlayProvider');
  }
  return context;
};

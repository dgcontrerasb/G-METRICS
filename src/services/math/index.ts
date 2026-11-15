/**
 * G METRICS Quantitative Math Architecture (Layers 1-6)
 * Exporta de forma modular los 7 modelos matemáticos:
 * 1. Poisson (PMF / CDF)
 * 2. Dixon-Coles (tau bivariado)
 * 3. Elo Dinámico & Bradley-Terry (con extensión de Davidson para empates)
 * 4. Regresión Lineal Múltiple (Córners, Tarjetas, Puntos NBA/FIBA)
 * 5. Regresión Logística Sigmoide (BTTS, Over/Under Goles, Totales NBA y Player Props)
 * 6. Incertidumbre Bayesiana (Bühlmann-Straub y Lower Credible Bound - LCB)
 * 7. Árboles de Decisión Multicriterio (Selección jerárquica de Picks)
 */

export * from './coreProbabilities';
export * from './eloBradleyTerryModel';
export * from './regressionModels';
export * from './bayesianUncertaintyModel';
export * from './decisionTreePickSelector';
export * from './parlayAndSinglesEngine';

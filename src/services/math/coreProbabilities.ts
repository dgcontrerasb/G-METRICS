/**
 * Capa 1: Probabilidades Base y Modelos Estocásticos (Poisson y Dixon-Coles)
 * Proporciona funciones atómicas para cálculo de PMF, CDF y ajuste bivariado de correlación de goles bajos.
 */

// Cache de factoriales para acelerar el cálculo de Poisson
const factorials: number[] = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];

export function factorial(n: number): number {
  if (n <= 0) return 1;
  if (n < factorials.length) return factorials[n];
  let res = factorials[factorials.length - 1];
  for (let i = factorials.length; i <= n; i++) {
    res *= i;
  }
  return res;
}

/**
 * Función de Masa de Probabilidad de Poisson (PMF): P(X = k) = (lambda^k * e^-lambda) / k!
 */
export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  if (k < 0) return 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

/**
 * Probabilidad Acumulada de Poisson (CDF): P(X <= kMax)
 */
export function poissonCdf(kMax: number, lambda: number): number {
  if (lambda <= 0) return 1;
  if (kMax < 0) return 0;
  let sum = 0;
  const maxK = Math.floor(kMax);
  for (let k = 0; k <= maxK; k++) {
    sum += poissonPmf(k, lambda);
  }
  return Math.min(1, Math.max(0, sum));
}

/**
 * Función de ajuste de correlación de Dixon-Coles tau(x, y, lambdaX, lambdaY, rho)
 * Corrige la interdependencia estocástica en marcadores bajos (0-0, 1-0, 0-1, 1-1).
 */
export function dixonColesTau(
  x: number,
  y: number,
  lambdaX: number,
  lambdaY: number,
  rho: number = -0.11
): number {
  if (x === 0 && y === 0) {
    return Math.max(0.01, 1 - lambdaX * lambdaY * rho);
  }
  if (x === 1 && y === 0) {
    return Math.max(0.01, 1 + lambdaY * rho);
  }
  if (x === 0 && y === 1) {
    return Math.max(0.01, 1 + lambdaX * rho);
  }
  if (x === 1 && y === 1) {
    return Math.max(0.01, 1 - rho);
  }
  return 1.0;
}

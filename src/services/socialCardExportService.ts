import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { SmartParlaySlip, GMetricsSingleBetSuggestion } from '../types';
import { GMETRICS_GOLD_LOGO_DATA_URI } from './gmetricsLogoB64';

export type ExportMediaFormat = 'PNG' | 'PDF';

/**
 * Servicio de Exportación Visual de Alto Impacto para Redes Sociales (Facebook / IG)
 * Estilo Editorial White Luxury (Sin cápsulas innecesarias, tipografía pura y números limpios sin círculos)
 */
export class SocialCardExportService {
  /**
   * Exporta un Parlay a Imagen PNG o PDF (Fondo Blanco Limpio, Sin Cápsulas)
   */
  public static async exportParlay(slip: SmartParlaySlip, format: ExportMediaFormat = 'PNG'): Promise<void> {
    const profileTitle =
      slip.profile === 'BALANCED'
        ? 'PARLAY DEL DÍA · EQUILIBRADO'
        : slip.profile === 'HIGH_ODDS'
        ? 'PARLAY DEL DÍA · CUOTA ALTA'
        : 'PARLAY DEL DÍA · CONSERVADOR';

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '640px';
    container.style.backgroundColor = '#FFFFFF';
    container.style.color = '#0F172A';
    container.style.fontFamily = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";
    container.style.padding = '36px 32px';
    container.style.borderRadius = '24px';
    container.style.border = '1.5px solid rgba(212, 175, 55, 0.45)';
    container.style.boxShadow = '0 20px 45px rgba(15, 23, 42, 0.1)';
    container.style.overflow = 'hidden';
    container.style.boxSizing = 'border-box';

    const legsHtml = slip.legs
      .map(
        (leg, idx) => `
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; padding: 16px 20px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; gap: 16px; box-shadow: 0 2px 5px rgba(0,0,0,0.02);">
          <div style="min-width: 0; flex: 1; display: flex; align-items: flex-start; gap: 12px;">
            <span style="font-family: monospace; font-size: 18px; font-weight: 900; color: #B45309; min-width: 22px; text-align: center; line-height: 1.25; flex-shrink: 0;">${idx + 1}</span>
            <div style="min-width: 0; flex: 1;">
              <div style="color: #0F172A; font-size: 15.5px; font-weight: 800; line-height: 1.3; word-break: break-word;">
                ${leg.matchName}
              </div>
              <div style="font-size: 14.5px; font-weight: 700; color: #B45309; margin-top: 3px;">
                ${leg.label}
              </div>
              <div style="font-size: 11.5px; color: #64748B; margin-top: 2px;">
                ${leg.leagueName} · ${leg.category}
              </div>
            </div>
          </div>
          <div style="text-align: right; flex-shrink: 0;">
            <div style="font-family: monospace; font-size: 20px; font-weight: 900; color: #0F172A;">@${leg.odds.toFixed(2)}</div>
            <div style="font-family: monospace; font-size: 11px; font-weight: 700; color: #059669; margin-top: 3px;">${Math.round(leg.impliedProb * 100)}% Prob.</div>
          </div>
        </div>
      `
      )
      .join('');

    container.innerHTML = `
      <div style="position: relative; z-index: 1;">
        <!-- Marca de agua de fondo sobre blanco -->
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 440px; height: 220px; background-image: url('${GMETRICS_GOLD_LOGO_DATA_URI}'); background-repeat: no-repeat; background-position: center; background-size: contain; opacity: 0.045; pointer-events: none; z-index: 0;"></div>

        <div style="position: relative; z-index: 2;">
          <!-- Cabecera Oficial (Sin Cápsulas, Texto Puro y Centrado) -->
          <div style="text-align: center; border-bottom: 1px solid #E2E8F0; padding-bottom: 16px; margin-bottom: 18px;">
            <img src="${GMETRICS_GOLD_LOGO_DATA_URI}" alt="G METRICS" style="height: 58px; margin: 0 auto 8px auto; display: block;" />
            <div style="font-size: 16px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #B45309; text-align: center; margin-top: 6px;">
              ${profileTitle}
            </div>
          </div>

          <!-- Metadata (Texto Limpio, Sin Cápsula) -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; font-size: 12px; font-family: monospace; padding: 0 4px;">
            <span style="font-weight: 700; color: #0F172A;">📅 FECHA: ${slip.date}</span>
            <span style="font-weight: 800; color: #059669; letter-spacing: 0.5px;">SELECCIÓN EXCLUSIVA</span>
          </div>

          <!-- Lista de Selecciones -->
          <div style="margin-bottom: 20px;">
            ${legsHtml}
          </div>

          <!-- Caja de Cuota Total Combinada (Líneas Editoriales Limpias) -->
          <div style="border-top: 1.5px solid #E2E8F0; border-bottom: 1.5px solid #E2E8F0; padding: 20px 0; text-align: center; margin: 20px 0;">
            <div style="font-size: 11px; font-weight: 800; letter-spacing: 2.5px; text-transform: uppercase; color: #64748B; margin-bottom: 4px;">
              CUOTA TOTAL COMBINADA
            </div>
            <div style="font-family: monospace; font-size: 46px; font-weight: 900; color: #B45309; line-height: 1;">
              @${slip.totalOdds.toFixed(2)}
            </div>
            <div style="font-size: 12px; color: #64748B; margin-top: 8px;">
              Gestión de Banca Sugerida: <strong style="color: #0F172A;">1 Unidad (Stake Plano)</strong>
            </div>
          </div>

          <!-- Footer Legal y Marca -->
          <div style="padding-top: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748B; font-family: monospace;">
            <span>G METRICS · PRONÓSTICOS VIP</span>
            <span style="color: #B45309; font-weight: 800;">@GMETRICS_OFICIAL</span>
            <span>+18 AÑOS · JUEGA CON RESPONSABILIDAD</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#FFFFFF',
        logging: false
      });

      const fileName = `G_METRICS_PARLAY_${slip.date}_${slip.profile}`;

      if (format === 'PNG') {
        const image = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.download = `${fileName}.png`;
        link.href = image;
        link.click();
      } else {
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF({
          orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [canvas.width, canvas.height]
        });
        pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
        pdf.save(`${fileName}.pdf`);
      }
    } finally {
      document.body.removeChild(container);
    }
  }

  /**
   * Exporta la Lámina Consolidada de Apuestas Individuales del Día en UNA SOLA Imagen o PDF (Fondo Blanco Limpio)
   * - Todas acomodadas perfectamente sin sobremontar
   * - Sin cápsulas ni píldoras en textos
   * - Números limpios y bien centrados en columna sin círculos
   * - Sin textos cortados ni abreviaciones ilegibles
   * - Sin mencionar casas de apuestas ni fórmulas
   */
  public static async exportSinglesSheet(
    singles: GMetricsSingleBetSuggestion[],
    format: ExportMediaFormat = 'PNG',
    dateStr: string = new Date().toISOString().split('T')[0]
  ): Promise<void> {
    if (!singles || singles.length === 0) return;

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '780px';
    container.style.backgroundColor = '#FFFFFF';
    container.style.color = '#0F172A';
    container.style.fontFamily = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";
    container.style.padding = '36px 32px';
    container.style.borderRadius = '24px';
    container.style.border = '1.5px solid rgba(212, 175, 55, 0.45)';
    container.style.boxShadow = '0 20px 45px rgba(15, 23, 42, 0.1)';
    container.style.overflow = 'hidden';
    container.style.boxSizing = 'border-box';

    const singlesHtml = singles
      .map(
        (item, idx) => `
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; padding: 16px 20px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; gap: 16px; box-shadow: 0 2px 5px rgba(0,0,0,0.02);">
          <div style="min-width: 0; flex: 1; display: flex; align-items: flex-start; gap: 12px;">
            <span style="font-family: monospace; font-size: 18px; font-weight: 900; color: #B45309; min-width: 22px; text-align: center; line-height: 1.25; flex-shrink: 0;">${idx + 1}</span>
            <div style="min-width: 0; flex: 1;">
              <div style="color: #0F172A; font-size: 15.5px; font-weight: 800; line-height: 1.3; word-break: break-word;">
                ${item.matchTitle} <span style="font-size: 11.5px; color: #64748B; font-weight: 600;">(${item.leagueName})</span>
              </div>
              <div style="font-size: 14.5px; font-weight: 700; color: #B45309; margin-top: 3px;">
                ${item.selectionLabel}
              </div>
              <div style="font-size: 11.5px; color: #64748B; margin-top: 2px;">
                Mercado: <span style="color: #334155; font-weight: 600;">${item.categoryLabel}</span>
              </div>
            </div>
          </div>
          <div style="text-align: right; flex-shrink: 0;">
            <div style="font-family: monospace; font-size: 21px; font-weight: 900; color: #0F172A;">@${item.estimatedBookieOdd.toFixed(2)}</div>
            <div style="font-family: monospace; font-size: 11px; font-weight: 700; color: #059669; margin-top: 3px;">${item.probability}% Probabilidad</div>
            <div style="font-size: 10.5px; color: #64748B; margin-top: 2px;">Stake: ${item.recommendedKellyStakePct}%</div>
          </div>
        </div>
      `
      )
      .join('');

    container.innerHTML = `
      <div style="position: relative; z-index: 1;">
        <!-- Marca de agua de fondo sobre blanco -->
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 500px; height: 260px; background-image: url('${GMETRICS_GOLD_LOGO_DATA_URI}'); background-repeat: no-repeat; background-position: center; background-size: contain; opacity: 0.045; pointer-events: none; z-index: 0;"></div>

        <div style="position: relative; z-index: 2;">
          <!-- Cabecera Oficial (Sin Cápsulas, Texto Puro Centrado) -->
          <div style="text-align: center; border-bottom: 1px solid #E2E8F0; padding-bottom: 16px; margin-bottom: 18px;">
            <img src="${GMETRICS_GOLD_LOGO_DATA_URI}" alt="G METRICS" style="height: 58px; margin: 0 auto 8px auto; display: block;" />
            <div style="font-size: 16px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #B45309; text-align: center; margin-top: 6px;">
              SELECCIONES INDIVIDUALES DEL DÍA
            </div>
          </div>

          <!-- Metadata (Texto Limpio, Sin Cápsulas) -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; font-size: 12px; font-family: monospace; padding: 0 4px;">
            <span style="font-weight: 700; color: #0F172A;">📅 JORNADA: ${dateStr}</span>
            <span style="font-weight: 800; color: #64748B; letter-spacing: 0.5px;">TOP ${singles.length} PRONÓSTICOS</span>
          </div>

          <!-- Lista de Apuestas Sencillas Consolidada -->
          <div style="margin-bottom: 22px;">
            ${singlesHtml}
          </div>

          <!-- Footer Legal y Marca -->
          <div style="border-top: 1px solid #E2E8F0; padding-top: 14px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748B; font-family: monospace;">
            <span>G METRICS · PRONÓSTICOS VIP</span>
            <span style="color: #B45309; font-weight: 800;">@GMETRICS_OFICIAL</span>
            <span>+18 AÑOS · JUEGA CON RESPONSABILIDAD</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#FFFFFF',
        logging: false
      });

      const fileName = `G_METRICS_APUESTAS_INDIVIDUALES_${dateStr}`;

      if (format === 'PNG') {
        const image = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.download = `${fileName}.png`;
        link.href = image;
        link.click();
      } else {
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF({
          orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [canvas.width, canvas.height]
        });
        pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
        pdf.save(`${fileName}.pdf`);
      }
    } finally {
      document.body.removeChild(container);
    }
  }
}

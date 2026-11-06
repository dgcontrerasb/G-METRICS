import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { SmartParlaySlip, GMetricsSingleBetSuggestion } from '../types';
import { GMETRICS_GOLD_LOGO_DATA_URI } from './gmetricsLogoB64';

export type ExportMediaFormat = 'PNG' | 'PDF';

/**
 * Servicio de Exportación Visual de Alto Impacto para Redes Sociales (Facebook / IG)
 * Estilo Opción 1: Black & Gold Luxury Terminal
 * - Con logotipo oficial y marca de agua antirrobo
 * - Sin mención a casas de apuestas ni fórmulas matemáticas
 * - Parlays individuales y lámina consolidada para apuestas sencillas
 */
export class SocialCardExportService {
  /**
   * Exporta un Parlay a Imagen PNG o PDF
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
    container.style.backgroundColor = '#0B0E14';
    container.style.color = '#F1F5F9';
    container.style.fontFamily = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";
    container.style.padding = '36px 32px';
    container.style.borderRadius = '24px';
    container.style.border = '1.5px solid rgba(212, 175, 55, 0.45)';
    container.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.8)';
    container.style.overflow = 'hidden';
    container.style.boxSizing = 'border-box';

    // Generar HTML interno
    const legsHtml = slip.legs
      .map(
        (leg, idx) => `
        <div style="background-color: #121824; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 14px 18px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; gap: 14px;">
          <div style="min-width: 0; flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background-color: rgba(212, 175, 55, 0.2); color: #F59E0B; font-size: 11px; font-weight: 800; font-family: monospace;">${idx + 1}</span>
              <span style="color: #FFFFFF; font-size: 15px; font-weight: 700; word-break: break-word;">${leg.matchName}</span>
            </div>
            <div style="padding-left: 30px; font-size: 13.5px; font-weight: 600; color: #FBBF24;">
              ${leg.label}
            </div>
            <div style="padding-left: 30px; font-size: 11px; color: #94A3B8; margin-top: 2px;">
              ${leg.leagueName}
            </div>
          </div>
          <div style="text-align: right; flex-shrink: 0;">
            <div style="font-family: monospace; font-size: 18px; font-weight: 800; color: #FCD34D;">@${leg.odds.toFixed(2)}</div>
            <div style="font-family: monospace; font-size: 10.5px; font-weight: 700; color: #34D399; margin-top: 2px;">${Math.round(leg.impliedProb * 100)}% Prob.</div>
          </div>
        </div>
      `
      )
      .join('');

    container.innerHTML = `
      <div style="position: relative; z-index: 1;">
        <!-- Marca de agua de fondo -->
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 440px; height: 220px; background-image: url('${GMETRICS_GOLD_LOGO_DATA_URI}'); background-repeat: no-repeat; background-position: center; background-size: contain; opacity: 0.07; pointer-events: none; z-index: 0;"></div>

        <div style="position: relative; z-index: 2;">
          <!-- Cabecera Oficial -->
          <div style="text-align: center; border-bottom: 1px solid rgba(212, 175, 55, 0.25); padding-bottom: 18px; margin-bottom: 20px;">
            <img src="${GMETRICS_GOLD_LOGO_DATA_URI}" alt="G METRICS" style="height: 58px; margin: 0 auto 10px auto; display: block;" />
            <div style="display: inline-block; padding: 4px 14px; border-radius: 9999px; background: rgba(212, 175, 55, 0.15); border: 1px solid rgba(212, 175, 55, 0.35); color: #FDE68A; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">
              ★ ${profileTitle} ★
            </div>
          </div>

          <!-- Metadata -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; font-size: 12px; color: #CBD5E1; font-family: monospace; padding: 0 4px;">
            <span style="font-weight: 700; color: #FDE68A;">📅 FECHA: ${slip.date}</span>
            <span style="background-color: rgba(16, 185, 129, 0.15); color: #6EE7B7; border: 1px solid rgba(16, 185, 129, 0.35); padding: 2px 10px; border-radius: 6px; font-weight: 700; font-size: 10px;">SELECCIÓN EXCLUSIVA</span>
          </div>

          <!-- Lista de Selecciones -->
          <div style="margin-bottom: 20px;">
            ${legsHtml}
          </div>

          <!-- Caja de Cuota Total Gigante -->
          <div style="background: linear-gradient(135deg, rgba(212, 175, 55, 0.18) 0%, rgba(212, 175, 55, 0.08) 100%); border: 1.5px solid rgba(212, 175, 55, 0.45); border-radius: 18px; padding: 18px; text-align: center; margin-bottom: 20px;">
            <div style="font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #FDE68A; margin-bottom: 4px;">
              CUOTA TOTAL COMBINADA
            </div>
            <div style="font-family: monospace; font-size: 42px; font-weight: 900; color: #FCD34D; line-height: 1;">
              @${slip.totalOdds.toFixed(2)}
            </div>
            <div style="font-size: 11.5px; color: #CBD5E1; margin-top: 8px;">
              Gestión de Banca Sugerida: <strong style="color: #FFFFFF;">1 Unidad (Stake Plano)</strong>
            </div>
          </div>

          <!-- Footer Legal y Marca -->
          <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 14px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748B; font-family: monospace;">
            <span>G METRICS · PRONÓSTICOS VIP</span>
            <span style="color: #D4AF37; font-weight: 700;">@GMETRICS_OFICIAL</span>
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
        backgroundColor: '#07090D',
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
   * Exporta la Lámina Consolidada de Apuestas Individuales del Día en UNA SOLA Imagen o PDF
   * - Todas acomodadas perfectamente sin sobremontar
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
    container.style.backgroundColor = '#0B0E14';
    container.style.color = '#F1F5F9';
    container.style.fontFamily = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";
    container.style.padding = '36px 32px';
    container.style.borderRadius = '24px';
    container.style.border = '1.5px solid rgba(212, 175, 55, 0.45)';
    container.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.8)';
    container.style.overflow = 'hidden';
    container.style.boxSizing = 'border-box';

    const singlesHtml = singles
      .map(
        (item, idx) => `
        <div style="background-color: #121824; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 14px 18px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; gap: 16px;">
          <div style="min-width: 0; flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background-color: rgba(212, 175, 55, 0.2); color: #F59E0B; font-size: 11px; font-weight: 800; font-family: monospace;">${idx + 1}</span>
              <span style="color: #FFFFFF; font-size: 15px; font-weight: 700; word-break: break-word;">${item.matchTitle}</span>
              <span style="font-size: 11px; color: #94A3B8;">(${item.leagueName})</span>
            </div>
            <div style="padding-left: 30px; font-size: 14px; font-weight: 700; color: #FBBF24;">
              ${item.selectionLabel}
            </div>
            <div style="padding-left: 30px; font-size: 11.5px; color: #94A3B8; margin-top: 2px;">
              Mercado: <span style="color: #E2E8F0;">${item.categoryLabel}</span>
            </div>
          </div>
          <div style="text-align: right; flex-shrink: 0;">
            <div style="font-family: monospace; font-size: 20px; font-weight: 900; color: #FCD34D;">@${item.estimatedBookieOdd.toFixed(2)}</div>
            <div style="font-family: monospace; font-size: 11px; font-weight: 700; color: #34D399; margin-top: 2px;">${item.probability}% Probabilidad</div>
            <div style="font-size: 10px; color: #94A3B8; margin-top: 2px;">Stake: ${item.recommendedKellyStakePct}%</div>
          </div>
        </div>
      `
      )
      .join('');

    container.innerHTML = `
      <div style="position: relative; z-index: 1;">
        <!-- Marca de agua de fondo -->
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 500px; height: 260px; background-image: url('${GMETRICS_GOLD_LOGO_DATA_URI}'); background-repeat: no-repeat; background-position: center; background-size: contain; opacity: 0.06; pointer-events: none; z-index: 0;"></div>

        <div style="position: relative; z-index: 2;">
          <!-- Cabecera Oficial -->
          <div style="text-align: center; border-bottom: 1px solid rgba(212, 175, 55, 0.25); padding-bottom: 18px; margin-bottom: 20px;">
            <img src="${GMETRICS_GOLD_LOGO_DATA_URI}" alt="G METRICS" style="height: 58px; margin: 0 auto 10px auto; display: block;" />
            <div style="display: inline-block; padding: 4px 16px; border-radius: 9999px; background: rgba(212, 175, 55, 0.15); border: 1px solid rgba(212, 175, 55, 0.35); color: #FDE68A; font-size: 11.5px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">
              ★ SELECCIONES INDIVIDUALES DEL DÍA ★
            </div>
          </div>

          <!-- Metadata -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; font-size: 12px; color: #CBD5E1; font-family: monospace; padding: 0 4px;">
            <span style="font-weight: 700; color: #FDE68A;">📅 JORNADA: ${dateStr}</span>
            <span style="background-color: rgba(212, 175, 55, 0.15); color: #FCD34D; border: 1px solid rgba(212, 175, 55, 0.35); padding: 2px 10px; border-radius: 6px; font-weight: 700; font-size: 10px;">TOP ${singles.length} PRONÓSTICOS</span>
          </div>

          <!-- Lista de Apuestas Sencillas Consolidada -->
          <div style="margin-bottom: 22px;">
            ${singlesHtml}
          </div>

          <!-- Footer Legal y Marca -->
          <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 14px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748B; font-family: monospace;">
            <span>G METRICS · PRONÓSTICOS VIP</span>
            <span style="color: #D4AF37; font-weight: 700;">@GMETRICS_OFICIAL</span>
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
        backgroundColor: '#07090D',
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

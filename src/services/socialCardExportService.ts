import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { SmartParlaySlip, GMetricsSingleBetSuggestion } from '../types';
import { GMETRICS_GOLD_LOGO_DATA_URI } from './gmetricsLogoB64';

export type ExportMediaFormat = 'PNG' | 'PDF';

/**
 * Servicio de Exportación Visual de Alto Impacto para Redes Sociales (Facebook / IG)
 * Estilo White Luxury High-End
 * - Fondo blanco limpio con detalles dorados y esmeralda
 * - Cápsula y números 100% centrados vertical y horizontalmente
 * - Con logotipo oficial y marca de agua antirrobo
 * - Sin mención a casas de apuestas ni fórmulas matemáticas
 */
export class SocialCardExportService {
  /**
   * Exporta un Parlay a Imagen PNG o PDF (Fondo Blanco Limpio)
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
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; padding: 14px 18px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; gap: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.02);">
          <div style="min-width: 0; flex: 1;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
              <div style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background-color: #FEF3C7; border: 1.2px solid #F59E0B; color: #B45309; font-size: 12px; font-weight: 800; font-family: monospace; line-height: 1; text-align: center; flex-shrink: 0;">${idx + 1}</div>
              <span style="color: #0F172A; font-size: 15px; font-weight: 800; word-break: break-word;">${leg.matchName}</span>
            </div>
            <div style="padding-left: 34px; font-size: 14px; font-weight: 700; color: #B45309;">
              ${leg.label}
            </div>
            <div style="padding-left: 34px; font-size: 11px; color: #64748B; margin-top: 2px;">
              ${leg.leagueName}
            </div>
          </div>
          <div style="text-align: right; flex-shrink: 0;">
            <div style="font-family: monospace; font-size: 19px; font-weight: 900; color: #0F172A;">@${leg.odds.toFixed(2)}</div>
            <div style="font-family: monospace; font-size: 11px; font-weight: 700; color: #059669; margin-top: 2px;">${Math.round(leg.impliedProb * 100)}% Prob.</div>
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
          <!-- Cabecera Oficial -->
          <div style="text-align: center; border-bottom: 1px solid #E2E8F0; padding-bottom: 18px; margin-bottom: 20px;">
            <img src="${GMETRICS_GOLD_LOGO_DATA_URI}" alt="G METRICS" style="height: 58px; margin: 0 auto 12px auto; display: block;" />
            <div style="display: inline-flex; align-items: center; justify-content: center; text-align: center; padding: 6px 22px; border-radius: 9999px; background: #FEF3C7; border: 1.5px solid #F59E0B; color: #92400E; font-size: 11.5px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; line-height: 1;">
              ★ ${profileTitle} ★
            </div>
          </div>

          <!-- Metadata -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; font-size: 12px; color: #475569; font-family: monospace; padding: 0 4px;">
            <span style="font-weight: 700; color: #0F172A;">📅 FECHA: ${slip.date}</span>
            <span style="background-color: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; padding: 3px 12px; border-radius: 6px; font-weight: 800; font-size: 10.5px;">SELECCIÓN EXCLUSIVA</span>
          </div>

          <!-- Lista de Selecciones -->
          <div style="margin-bottom: 20px;">
            ${legsHtml}
          </div>

          <!-- Caja de Cuota Total Gigante -->
          <div style="background: linear-gradient(135deg, #FEF3C7 0%, #FFFBEB 100%); border: 1.8px solid #F59E0B; border-radius: 18px; padding: 18px; text-align: center; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.08);">
            <div style="font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #92400E; margin-bottom: 4px;">
              CUOTA TOTAL COMBINADA
            </div>
            <div style="font-family: monospace; font-size: 42px; font-weight: 900; color: #B45309; line-height: 1;">
              @${slip.totalOdds.toFixed(2)}
            </div>
            <div style="font-size: 12px; color: #475569; margin-top: 8px;">
              Gestión de Banca Sugerida: <strong style="color: #0F172A;">1 Unidad (Stake Plano)</strong>
            </div>
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
   * - Cápsula y números 100% centrados
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
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; padding: 14px 18px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; gap: 16px; box-shadow: 0 2px 5px rgba(0,0,0,0.02);">
          <div style="min-width: 0; flex: 1;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
              <div style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background-color: #FEF3C7; border: 1.2px solid #F59E0B; color: #B45309; font-size: 12px; font-weight: 800; font-family: monospace; line-height: 1; text-align: center; flex-shrink: 0;">${idx + 1}</div>
              <span style="color: #0F172A; font-size: 15.5px; font-weight: 800; word-break: break-word;">${item.matchTitle}</span>
              <span style="font-size: 11.5px; color: #64748B;">(${item.leagueName})</span>
            </div>
            <div style="padding-left: 34px; font-size: 14.5px; font-weight: 700; color: #B45309;">
              ${item.selectionLabel}
            </div>
            <div style="padding-left: 34px; font-size: 11.5px; color: #64748B; margin-top: 2px;">
              Mercado: <span style="color: #334155; font-weight: 600;">${item.categoryLabel}</span>
            </div>
          </div>
          <div style="text-align: right; flex-shrink: 0;">
            <div style="font-family: monospace; font-size: 21px; font-weight: 900; color: #0F172A;">@${item.estimatedBookieOdd.toFixed(2)}</div>
            <div style="font-family: monospace; font-size: 11px; font-weight: 700; color: #059669; margin-top: 2px;">${item.probability}% Probabilidad</div>
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
          <!-- Cabecera Oficial -->
          <div style="text-align: center; border-bottom: 1px solid #E2E8F0; padding-bottom: 18px; margin-bottom: 20px;">
            <img src="${GMETRICS_GOLD_LOGO_DATA_URI}" alt="G METRICS" style="height: 58px; margin: 0 auto 12px auto; display: block;" />
            <div style="display: inline-flex; align-items: center; justify-content: center; text-align: center; padding: 6px 24px; border-radius: 9999px; background: #FEF3C7; border: 1.5px solid #F59E0B; color: #92400E; font-size: 12px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; line-height: 1;">
              ★ SELECCIONES INDIVIDUALES DEL DÍA ★
            </div>
          </div>

          <!-- Metadata -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; font-size: 12px; color: #475569; font-family: monospace; padding: 0 4px;">
            <span style="font-weight: 700; color: #0F172A;">📅 JORNADA: ${dateStr}</span>
            <span style="background-color: #FEF3C7; color: #92400E; border: 1px solid #F59E0B; padding: 3px 12px; border-radius: 6px; font-weight: 800; font-size: 10.5px;">TOP ${singles.length} PRONÓSTICOS</span>
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

import React, { useRef } from 'react';
import { X, Check, Image as ImageIcon, Upload, Sparkles } from 'lucide-react';

export interface WallpaperOption {
  id: string;
  name: string;
  subtitle: string;
  url: string;
}

export const WALLPAPER_LIST: WallpaperOption[] = [
  {
    id: 'cr7-wallpaper',
    name: 'Cristiano Ronaldo',
    subtitle: 'Real Madrid #7',
    url: '/CR7wallpaper.jpg'
  },
  {
    id: 'cr7-alt',
    name: 'CR7 Clásico',
    subtitle: 'Acción y Potencia',
    url: '/CR7.jpg'
  },
  {
    id: 'messi',
    name: 'Lionel Messi',
    subtitle: '10 Legendario',
    url: '/Messi.jpg'
  },
  {
    id: 'real-madrid',
    name: 'Real Madrid',
    subtitle: 'Mística Merengue',
    url: '/Real madrid.jpg'
  },
  {
    id: 'barcelona',
    name: 'FC Barcelona',
    subtitle: 'Orgullo Blaugrana',
    url: '/Barcelona.jpg'
  },
  {
    id: 'ronaldinho',
    name: 'Ronaldinho Gaúcho',
    subtitle: 'Joga Bonito & Sonrisa',
    url: '/Ronaldinho.jpg'
  },
  {
    id: 'ronaldo-r9',
    name: 'Ronaldo Nazário (R9)',
    subtitle: 'El Fenómeno',
    url: '/Ronaldo R9.jpg'
  }
];

interface WallpaperSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWallpaperUrl: string;
  onSelectWallpaper: (url: string) => void;
  opacity?: number;
  onChangeOpacity?: (opacity: number) => void;
  blur?: number;
  onChangeBlur?: (blur: number) => void;
}

export const WallpaperSelectorModal: React.FC<WallpaperSelectorModalProps> = ({
  isOpen,
  onClose,
  currentWallpaperUrl,
  onSelectWallpaper,
  opacity = 0.65,
  onChangeOpacity,
  blur = 0,
  onChangeBlur
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        onSelectWallpaper(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // Check if current is one of the predefined or custom
  const isPredefined = WALLPAPER_LIST.some((w) => w.url === currentWallpaperUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/45 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl max-h-[90vh] bg-white border border-slate-200 rounded-3xl shadow-[0_24px_60px_rgba(15,23,42,0.18)] flex flex-col overflow-hidden text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <ImageIcon className="w-4.5 h-4.5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 flex items-center gap-2">
                Galería de Fondos de Pantalla
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                  {WALLPAPER_LIST.length} Fondos Oficiales
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Selecciona la imagen y personaliza la opacidad y nitidez de fondo
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controles de Opacidad y Desenfoque */}
        {onChangeOpacity && (
          <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
            {/* Opacidad */}
            <div className="flex items-center gap-3 flex-1 min-w-[220px]">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Opacidad: <span className="font-mono text-emerald-700">{Math.round(opacity * 100)}%</span>
              </span>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={opacity}
                onChange={(e) => onChangeOpacity(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
            </div>

            {/* Desenfoque / Blur */}
            {onChangeBlur && (
              <div className="flex items-center gap-3 flex-1 min-w-[220px]">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider shrink-0">
                  Difuminado: <span className="font-mono text-emerald-700">{blur}px</span>
                </span>
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="1"
                  value={blur}
                  onChange={(e) => onChangeBlur(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
              </div>
            )}

            {/* Presets rápidos */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onChangeOpacity(0.35);
                  if (onChangeBlur) onChangeBlur(0);
                }}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-[10px] font-semibold text-slate-700 border border-slate-200 cursor-pointer"
              >
                Alto Contraste
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeOpacity(0.65);
                  if (onChangeBlur) onChangeBlur(0);
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[10px] font-semibold text-emerald-800 border border-emerald-200 cursor-pointer"
              >
                Clásico
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeOpacity(0.85);
                  if (onChangeBlur) onChangeBlur(4);
                }}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-[10px] font-semibold text-slate-700 border border-slate-200 cursor-pointer"
              >
                Suave
              </button>
            </div>
          </div>
        )}

        {/* Content - Wallpaper Grid */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 bg-slate-50/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {WALLPAPER_LIST.map((wallpaper) => {
              const isSelected = currentWallpaperUrl === wallpaper.url;

              return (
                <div
                  key={wallpaper.id}
                  onClick={() => onSelectWallpaper(wallpaper.url)}
                  className={`group relative rounded-2xl overflow-hidden border transition-all cursor-pointer flex flex-col justify-end h-56 sm:h-60 ${
                    isSelected
                      ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-md scale-[1.01]'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-900'
                  }`}
                >
                  {/* Thumbnail Image */}
                  {wallpaper.url?.trim() ? (
                    <img
                      src={wallpaper.url}
                      alt={wallpaper.name}
                      className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : null}

                  {/* Gradient Overlay for Readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent pointer-events-none" />

                  {/* Top-Right Badge: Active Checkmark */}
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Activo</span>
                    </div>
                  )}

                  {/* Bottom Info Bar */}
                  <div className="relative z-10 p-3">
                    <h3 className="text-sm font-black text-white leading-tight">
                      {wallpaper.name}
                    </h3>
                    <p className="text-[11px] text-slate-200 font-medium mt-0.5">
                      {wallpaper.subtitle}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Custom Upload Tile */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`group relative rounded-2xl border border-dashed transition-all cursor-pointer flex flex-col items-center justify-center p-5 text-center h-56 sm:h-60 ${
                !isPredefined && currentWallpaperUrl
                  ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                  : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/30 bg-white'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleCustomUpload}
                accept="image/*"
                className="hidden"
              />
              <div className="w-11 h-11 rounded-2xl bg-slate-100 group-hover:bg-emerald-100 text-slate-600 group-hover:text-emerald-700 flex items-center justify-center transition-colors mb-2.5">
                <Upload className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-900 block">
                Subir Imagen Personalizada
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">
                Sube cualquier foto desde tu teléfono o computador
              </span>
              {!isPredefined && currentWallpaperUrl && (
                <span className="mt-2 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                  ✓ Foto Propia Activa
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-between text-xs">
          <span className="text-slate-500 text-[11px]">
            El fondo seleccionado se recordará en este navegador automáticamente.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-2xs cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};

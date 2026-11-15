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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      {/* Backdrop blur independiente (fondo visible y difuminado) */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
      />

      <div
        className="relative z-10 w-full max-w-4xl max-h-[90vh] bg-[#161b22] border border-[#30363d] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#30363d] flex items-center justify-between bg-[#0b0e14]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#161b22] border border-[#30363d] flex items-center justify-center">
              <ImageIcon className="w-4.5 h-4.5 text-[#d9b114]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-2">
                Galería de Fondos de Pantalla
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#161b22] text-[#8b949e] font-bold border border-[#30363d]">
                  {WALLPAPER_LIST.length} Fondos Oficiales
                </span>
              </h2>
              <p className="text-xs text-[#8b949e]">
                Selecciona la imagen y personaliza la opacidad y nitidez de fondo
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#8b949e] hover:text-white hover:bg-[#161b22] transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controles de Opacidad y Desenfoque */}
        {onChangeOpacity && (
          <div className="px-5 py-2.5 bg-[#0b0e14] border-b border-[#30363d] flex flex-wrap items-center justify-between gap-4 text-xs">
            {/* Opacidad */}
            <div className="flex items-center gap-3 flex-1 min-w-[220px]">
              <span className="text-[11px] font-bold text-[#8b949e] uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-[#d9b114]" />
                Opacidad: <span className="font-mono tabular-nums text-white">{Math.round(opacity * 100)}%</span>
              </span>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={opacity}
                onChange={(e) => onChangeOpacity(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#161b22] rounded-lg appearance-none cursor-pointer accent-[#d9b114]"
              />
            </div>

            {/* Desenfoque / Blur */}
            {onChangeBlur && (
              <div className="flex items-center gap-3 flex-1 min-w-[220px]">
                <span className="text-[11px] font-bold text-[#8b949e] uppercase tracking-wider shrink-0">
                  Difuminado: <span className="font-mono tabular-nums text-white">{blur}px</span>
                </span>
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="1"
                  value={blur}
                  onChange={(e) => onChangeBlur(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-[#161b22] rounded-lg appearance-none cursor-pointer accent-[#d9b114]"
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
                className="px-2.5 py-1 rounded-lg bg-[#161b22] hover:bg-[#21262d] text-[10px] font-semibold text-[#8b949e] hover:text-white border border-[#30363d] cursor-pointer"
              >
                Alto Contraste
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeOpacity(0.65);
                  if (onChangeBlur) onChangeBlur(0);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#161b22] hover:bg-[#21262d] text-[10px] font-semibold text-[#d9b114] border border-[#d9b114]/50 cursor-pointer"
              >
                Clásico
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeOpacity(0.85);
                  if (onChangeBlur) onChangeBlur(4);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#161b22] hover:bg-[#21262d] text-[10px] font-semibold text-[#8b949e] hover:text-white border border-[#30363d] cursor-pointer"
              >
                Suave
              </button>
            </div>
          </div>
        )}

        {/* Content - Wallpaper Grid */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 bg-[#0b0e14]/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {WALLPAPER_LIST.map((wallpaper) => {
              const isSelected = currentWallpaperUrl === wallpaper.url;

              return (
                <div
                  key={wallpaper.id}
                  onClick={() => onSelectWallpaper(wallpaper.url)}
                  className={`group relative rounded-2xl overflow-hidden border transition-all cursor-pointer flex flex-col justify-end h-56 sm:h-60 ${
                    isSelected
                      ? 'border-[#d9b114] ring-2 ring-[#d9b114]/30 shadow-md scale-[1.01]'
                      : 'border-[#30363d] hover:border-[#d9b114]/60 bg-[#0b0e14]'
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
                    <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-[#d9b114] text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Activo</span>
                    </div>
                  )}

                  {/* Bottom Info Bar */}
                  <div className="relative z-10 p-3">
                    <h3 className="text-sm font-black text-white leading-tight">
                      {wallpaper.name}
                    </h3>
                    <p className="text-[11px] text-[#8b949e] font-medium mt-0.5">
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
                  ? 'border-[#d9b114] bg-[#161b22] ring-2 ring-[#d9b114]/20'
                  : 'border-[#30363d] hover:border-[#d9b114]/50 hover:bg-[#161b22]/50 bg-[#0b0e14]'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleCustomUpload}
                accept="image/*"
                className="hidden"
              />
              <div className="w-11 h-11 rounded-2xl bg-[#161b22] group-hover:bg-[#21262d] text-[#8b949e] group-hover:text-[#d9b114] flex items-center justify-center transition-colors mb-2.5 border border-[#30363d]">
                <Upload className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-white block">
                Subir Imagen Personalizada
              </span>
              <span className="text-[11px] text-[#8b949e] block mt-1">
                Sube cualquier foto desde tu teléfono o computador
              </span>
              {!isPredefined && currentWallpaperUrl && (
                <span className="mt-2 px-2 py-0.5 rounded-full bg-[#161b22] text-[#d9b114] text-[10px] font-bold border border-[#d9b114]/40">
                  ✓ Foto Propia Activa
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#30363d] bg-[#0b0e14] flex items-center justify-between text-xs">
          <span className="text-[#8b949e] text-[11px]">
            El fondo seleccionado se recordará en este navegador automáticamente.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#161b22] hover:bg-[#21262d] text-white border border-[#30363d] hover:border-[#d9b114]/50 font-bold transition-all shadow-2xs cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};

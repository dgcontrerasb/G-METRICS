import React, { useRef, useState, useMemo } from 'react';
import { X, Check, Image as ImageIcon, Upload, Sparkles, Search, Link2, ShieldOff } from 'lucide-react';
import { WallpaperOption, WALLPAPER_LIST, findWallpaperOptionByUrl } from '../services/wallpaperConfig';
export type { WallpaperOption };
export { WALLPAPER_LIST, findWallpaperOptionByUrl };

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
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'SOCCER' | 'NBA' | 'CUSTOM'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [customLinkInput, setCustomLinkInput] = useState('');

  const filteredWallpapers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return WALLPAPER_LIST.filter((w) => {
      if (activeCategory === 'SOCCER' && w.sport !== 'SOCCER') return false;
      if (activeCategory === 'NBA' && w.sport !== 'NBA') return false;
      if (activeCategory === 'CUSTOM' && w.sport !== 'MINIMAL') return false;
      if (!q) return true;
      return (
        w.name.toLowerCase().includes(q) ||
        w.subtitle.toLowerCase().includes(q) ||
        w.league.toLowerCase().includes(q)
      );
    });
  }, [activeCategory, searchTerm]);

  if (!isOpen) return null;

  // Compresión ligera en Canvas (WebP 1600px) para evitar llenar localStorage al subir fotos locales
  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) return;

      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1600;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const compressed = canvas.toDataURL('image/webp', 0.78);
            onSelectWallpaper(compressed);
            return;
          }
        } catch {
          // fallback
        }
        onSelectWallpaper(rawDataUrl);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustomLink = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customLinkInput.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) return;
    onSelectWallpaper(clean);
    setCustomLinkInput('');
  };

  const isPredefined = WALLPAPER_LIST.some((w) => w.url === currentWallpaperUrl);
  const soccerCount = WALLPAPER_LIST.filter((w) => w.sport === 'SOCCER').length;
  const nbaCount = WALLPAPER_LIST.filter((w) => w.sport === 'NBA').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/55 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
      />

      <div
        className="relative z-10 w-full max-w-5xl max-h-[90vh] bg-[#161b22] border border-[#30363d] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#30363d] flex items-center justify-between bg-[#0b0e14]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#161b22] border border-[#30363d] flex items-center justify-center">
              <ImageIcon className="w-4.5 h-4.5 text-[#d9b114]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-2 flex-wrap">
                <span>Galería Cloud de Clubes, Selecciones y Arenas</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-[#00ff66] font-bold border border-emerald-500/30">
                  {WALLPAPER_LIST.length} Fondos HD · 0 KB Locales
                </span>
              </h2>
              <p className="text-xs text-[#8b949e]">
                Elige tu equipo favorito de Fútbol o franquicia NBA; solo el fondo activo se guarda en caché
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
            <div className="flex items-center gap-3 flex-1 min-w-[200px]">
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

            {onChangeBlur && (
              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
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

        {/* Pestañas de Categoría + Buscador Rápido de Equipos */}
        <div className="px-5 py-2.5 bg-[#161b22] border-b border-[#30363d] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveCategory('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                activeCategory === 'ALL'
                  ? 'bg-[#d9b114] text-slate-950 border-[#d9b114]'
                  : 'bg-[#0b0e14] text-[#8b949e] border-[#30363d] hover:text-white'
              }`}
            >
              Todos ({WALLPAPER_LIST.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('SOCCER')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border flex items-center gap-1.5 ${
                activeCategory === 'SOCCER'
                  ? 'bg-emerald-500/20 text-[#00ff66] border-emerald-400'
                  : 'bg-[#0b0e14] text-[#8b949e] border-[#30363d] hover:text-white'
              }`}
            >
              <span>⚽ Clubes & Selecciones ({soccerCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('NBA')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border flex items-center gap-1.5 ${
                activeCategory === 'NBA'
                  ? 'bg-amber-500/20 text-[#d9b114] border-amber-400'
                  : 'bg-[#0b0e14] text-[#8b949e] border-[#30363d] hover:text-white'
              }`}
            >
              <span>🏀 Franquicias NBA ({nbaCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('CUSTOM')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border flex items-center gap-1.5 ${
                activeCategory === 'CUSTOM'
                  ? 'bg-[#0b0e14] text-white border-white/50'
                  : 'bg-[#0b0e14] text-[#8b949e] border-[#30363d] hover:text-white'
              }`}
            >
              <span>🔗 Link / Propio</span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#8b949e] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar club o franquicia (ej: Liverpool, Lakers, Colombia)..."
              className="w-full bg-[#0b0e14] border border-[#30363d] rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-[#8b949e] focus:outline-none focus:border-[#d9b114]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Barra para pegar Link Directo de Internet */}
        <form
          onSubmit={handleApplyCustomLink}
          className="px-5 py-2 bg-[#0b0e14]/90 border-b border-[#30363d] flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
        >
          <div className="flex items-center gap-2 flex-1">
            <Link2 className="w-4 h-4 text-[#d9b114] shrink-0" />
            <input
              type="url"
              value={customLinkInput}
              onChange={(e) => setCustomLinkInput(e.target.value)}
              placeholder="O pega aquí el link directo (https://...) de cualquier wallpaper de Fútbol o NBA..."
              className="w-full bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-1.5 text-xs text-white placeholder-[#8b949e] focus:outline-none focus:border-emerald-400"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="submit"
              disabled={!customLinkInput.trim()}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-[#00ff66] text-xs font-bold transition disabled:opacity-40 cursor-pointer"
            >
              Aplicar Link HD
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-xl bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[#d9b114]" />
              <span>Subir Archivo</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleCustomUpload}
              accept="image/*"
              className="hidden"
            />
          </div>
        </form>

        {/* Grid de Equipos y Arenas */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 bg-[#0b0e14]/70 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredWallpapers.map((wallpaper) => {
              const isSelected = currentWallpaperUrl === wallpaper.url;
              const isMinimal = wallpaper.url === 'none';

              return (
                <div
                  key={wallpaper.id}
                  onClick={() => onSelectWallpaper(wallpaper.url)}
                  className={`group relative rounded-2xl overflow-hidden border transition-all cursor-pointer flex flex-col justify-between h-48 sm:h-52 p-3 ${
                    isSelected
                      ? 'border-[#d9b114] ring-2 ring-[#d9b114]/35 shadow-lg scale-[1.01]'
                      : 'border-[#30363d] hover:border-[#d9b114]/60 bg-[#0b0e14]'
                  }`}
                >
                  {/* Imagen de estadio / arena en segundo plano */}
                  {!isMinimal && wallpaper.url ? (
                    <img
                      src={wallpaper.url}
                      alt={wallpaper.name}
                      className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105 opacity-65"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[#0b0e14] flex items-center justify-center">
                      <ShieldOff className="w-12 h-12 text-[#30363d]" />
                    </div>
                  )}

                  {/* Resplandor cromático del equipo */}
                  {wallpaper.accentColor && (
                    <div
                      className="absolute inset-0 opacity-30 pointer-events-none"
                      style={{
                        background: `radial-gradient(circle at 50% 35%, ${wallpaper.accentColor}, transparent 72%)`
                      }}
                    />
                  )}

                  {/* Gradiente oscuro de lectura */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e14] via-[#0b0e14]/55 to-black/30 pointer-events-none" />

                  {/* Fila superior: Liga + Badge Activo */}
                  <div className="relative z-10 flex items-center justify-between gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-[#0b0e14]/85 border border-[#30363d] text-[9.5px] font-mono font-bold text-slate-300 truncate">
                      {wallpaper.sport === 'NBA' ? '🏀' : wallpaper.sport === 'SOCCER' ? '⚽' : '🌌'} {wallpaper.league}
                    </span>
                    {isSelected && (
                      <div className="px-2 py-0.5 rounded-full bg-[#d9b114] text-slate-950 text-[9.5px] font-black uppercase tracking-wider flex items-center gap-0.5 shadow-md shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>Activo</span>
                      </div>
                    )}
                  </div>

                  {/* Escudo Oficial HD en el centro de la tarjeta */}
                  {wallpaper.crestUrl && (
                    <div className="relative z-10 flex items-center justify-center my-auto">
                      <img
                        src={wallpaper.crestUrl}
                        alt={wallpaper.name}
                        className="w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow-[0_4px_14px_rgba(0,0,0,0.85)] transition-transform duration-300 group-hover:scale-110"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Info inferior del equipo */}
                  <div className="relative z-10">
                    <h3 className="text-xs sm:text-sm font-black text-white leading-tight truncate">
                      {wallpaper.name}
                    </h3>
                    <p className="text-[10.5px] text-[#8b949e] font-medium truncate mt-0.5">
                      {wallpaper.subtitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#30363d] bg-[#0b0e14] flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-[#8b949e] text-[11px]">
            {!isPredefined && currentWallpaperUrl && currentWallpaperUrl !== 'none'
              ? '✓ Fondo personalizado por Link / Archivo activo en este dispositivo.'
              : 'El estadio y escudo del equipo elegido se reflejarán en el fondo de tu PWA.'}
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

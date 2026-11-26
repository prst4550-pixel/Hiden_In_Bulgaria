import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, type LucideIcon } from 'lucide-react';

export interface LiquidGlassDropdownOption {
  id: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
  badge?: string;
  subtitle?: string;
}

interface LiquidGlassDropdownProps {
  label: string;
  value: string;
  options: LiquidGlassDropdownOption[];
  onChange: (id: string) => void;
  icon: LucideIcon;
  orbVariant?: 'neutral' | 'amber' | 'emerald' | 'blue';
  className?: string;
  menuWidth?: string;
  align?: 'left' | 'right';
}

export const LiquidGlassDropdown: React.FC<LiquidGlassDropdownProps> = ({
  label,
  value,
  options,
  onChange,
  icon: Icon,
  orbVariant = 'neutral',
  className = '',
  menuWidth = 'w-64 sm:w-72',
  align = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.id === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const getOrbGradient = () => {
    switch (orbVariant) {
      case 'amber':
        return 'text-amber-700 bg-gradient-to-br from-amber-100/90 via-amber-200/50 to-amber-300/40 border-amber-300/70 shadow-amber-900/10';
      case 'emerald':
        return 'text-emerald-700 bg-gradient-to-br from-emerald-100/90 via-emerald-200/50 to-emerald-300/40 border-emerald-300/70 shadow-emerald-900/10';
      case 'blue':
        return 'text-sky-700 bg-gradient-to-br from-sky-100/90 via-sky-200/50 to-sky-300/40 border-sky-300/70 shadow-sky-900/10';
      default:
        return 'text-stone-800 bg-gradient-to-br from-white/95 via-stone-100/60 to-stone-200/40 border-white/90 shadow-stone-900/10';
    }
  };

  return (
    <div className={`relative ${isOpen ? 'z-50' : 'z-20'} ${className}`} ref={containerRef}>
      {/* Trigger: Apple VisionOS / iOS Liquid Glass Focus Pill */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={`${label}: ${selectedOption?.label || value}`}
        className="w-full liquid-glass-focus-pill liquid-iridescent-rim rounded-full p-1.5 sm:p-2 pr-3.5 flex items-center justify-between gap-2.5 text-left cursor-pointer group focus:outline-none focus:ring-2 focus:ring-amber-700/30"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Inner Frosted Glass Orb (like the moon in the Focus pill) */}
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 border shadow-inner transition-transform duration-300 group-hover:scale-105 ${getOrbGradient()}`}
          >
            <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform duration-300 group-hover:rotate-6 drop-shadow-xs" />
          </div>

          {/* Label & Active Value */}
          <div className="flex flex-col min-w-0 leading-tight">
            <span className="text-[9.5px] font-bold uppercase tracking-widest text-stone-500 truncate group-hover:text-stone-700 transition-colors">
              {label}
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-stone-900 truncate">
              {selectedOption?.label || value}
            </span>
          </div>
        </div>

        {/* Right Chevron / Selector indicator */}
        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-stone-900/5 group-hover:bg-stone-900/10 transition-colors shrink-0">
          <ChevronDown
            className={`w-3.5 h-3.5 text-stone-600 group-hover:text-stone-900 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isOpen ? 'rotate-180 text-amber-800' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu - Floating Liquid Glass Card */}
      {isOpen && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 w-full sm:${menuWidth} max-w-[calc(100vw-2rem)] max-h-72 overflow-y-auto liquid-water-card rounded-2xl shadow-2xl p-1.5 z-50 border border-white/90 bg-[#FBF9F5]/95 backdrop-blur-3xl transition-all duration-200 animate-in fade-in zoom-in-95`}
        >
          <div className="px-3 py-1.5 mb-1 border-b border-stone-200/50 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              {label}
            </span>
            <span className="text-[10px] text-stone-400 font-mono">
              {options.length} опции
            </span>
          </div>

          <div className="space-y-0.5">
            {options.map((opt) => {
              const isSelected = opt.id === value;
              const OptionIcon = opt.icon;

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-800 text-white shadow-xs'
                      : 'text-stone-800 hover:bg-white/80 hover:text-stone-950'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {OptionIcon && (
                      <OptionIcon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? 'text-amber-200' : 'text-stone-500'
                        }`}
                      />
                    )}
                    <span className="truncate">{opt.label}</span>
                    {opt.badge && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          isSelected
                            ? 'bg-amber-900 text-amber-100'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {opt.badge}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {opt.count !== undefined && (
                      <span
                        className={`text-[11px] font-mono ${
                          isSelected ? 'text-amber-200' : 'text-stone-400'
                        }`}
                      >
                        ({opt.count})
                      </span>
                    )}
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

'use client';

import React, { useState, useTransition, useEffect } from 'react';

/**
 * @typedef {'origen' | 'estudio/trabajo' | 'viaje'} LocationType
 * 
 * @typedef {Object} QuickLocationSelectorProps
 * @property {string} userId - UUID del usuario autenticado en Supabase auth.users
 * @property {LocationType} [initialLocation='origen'] - Ubicación inicial cargada desde public.perfiles
 * @property {any} supabaseClient - Instancia del cliente de Supabase (@supabase/supabase-js o createClientComponentClient)
 * @property {(newLocation: LocationType) => void} [onLocationChange] - Callback opcional al cambiar de estado
 * @property {string} [className] - Clases CSS adicionales (ej. Tailwind)
 */

const LOCATION_OPTIONS = [
  {
    id: 'origen',
    label: 'En Origen',
    icon: '🏠',
    description: 'En mi pueblo o ciudad natal',
    pillClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700',
    activeBg: 'bg-white text-emerald-800 border-emerald-400 shadow-sm dark:bg-slate-800 dark:text-emerald-300 dark:border-emerald-500',
    pulseColor: 'bg-emerald-500'
  },
  {
    id: 'estudio/trabajo',
    label: 'Estudio / Trabajo',
    icon: '🎒',
    secondaryIcon: '💼',
    description: 'Desplazado en el campus universitario o trabajo',
    pillClass: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-700',
    activeBg: 'bg-white text-indigo-800 border-indigo-400 shadow-sm dark:bg-slate-800 dark:text-indigo-300 dark:border-indigo-500',
    pulseColor: 'bg-indigo-500'
  },
  {
    id: 'viaje',
    label: 'De Viaje',
    icon: '✈️',
    description: 'Fuera por viaje, vacaciones o escapada',
    pillClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700',
    activeBg: 'bg-white text-amber-800 border-amber-400 shadow-sm dark:bg-slate-800 dark:text-amber-300 dark:border-amber-500',
    pulseColor: 'bg-amber-500'
  }
];

export default function QuickLocationSelector({
  userId,
  initialLocation = 'origen',
  supabaseClient,
  onLocationChange,
  className = ''
}) {
  const [currentLocation, setCurrentLocation] = useState(initialLocation);
  const [isPending, startTransition] = useTransition();
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (initialLocation) {
      setCurrentLocation(initialLocation);
    }
  }, [initialLocation]);

  const activeOption = LOCATION_OPTIONS.find(opt => opt.id === currentLocation) || LOCATION_OPTIONS[0];

  const handleSelectLocation = async (newLocation) => {
    if (newLocation === currentLocation || isPending) return;

    const previousLocation = currentLocation;
    
    // 1. ACTUALIZACIÓN OPTIMISTA INMEDIATA (0 ms de latencia en la UI)
    setCurrentLocation(newLocation);
    setSyncStatus('saving');
    setErrorMessage('');

    if (onLocationChange) {
      onLocationChange(newLocation);
    }

    // 2. SINCRONIZACIÓN ASÍNCRONA EN SUPABASE
    startTransition(async () => {
      try {
        if (!supabaseClient) {
          console.warn('[QuickLocationSelector] supabaseClient no provisto; modo offline.');
          setSyncStatus('saved');
          setTimeout(() => setSyncStatus('idle'), 2000);
          return;
        }

        const nowUtc = new Date().toISOString();
        const { error } = await supabaseClient
          .from('perfiles')
          .update({
            current_location: newLocation,
            ubicacion_actual: newLocation, // Mantenemos retrocompatibilidad
            updated_at: nowUtc
          })
          .eq('user_id', userId);

        if (error) {
          throw error;
        }

        setSyncStatus('saved');
        setTimeout(() => setSyncStatus('idle'), 2500);
      } catch (err) {
        console.error('[QuickLocationSelector] Error al guardar en Supabase:', err);
        // ROLLBACK en caso de fallo
        setCurrentLocation(previousLocation);
        setSyncStatus('error');
        setErrorMessage('No se pudo guardar la ubicación en Supabase.');
        if (onLocationChange) {
          onLocationChange(previousLocation);
        }
      }
    });
  };

  return (
    <div className={`w-full max-w-xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-3.5 shadow-sm transition-all ${className}`}>
      {/* Encabezado: Título y Estado en Vivo */}
      <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeOption.pulseColor}`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${activeOption.pulseColor}`} />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Mi Ubicación Actual
          </span>
        </div>

        {/* Badge de estado actual */}
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${activeOption.pillClass}`}>
            <span>{activeOption.icon}</span>
            <span>{activeOption.label}</span>
          </span>

          {syncStatus === 'saving' && (
            <span className="text-[11px] font-medium text-slate-400 animate-pulse">
              Guardando...
            </span>
          )}
          {syncStatus === 'saved' && (
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              ✓ Guardado
            </span>
          )}
          {syncStatus === 'error' && (
            <span className="text-[11px] font-medium text-rose-500">
              ⚠️ Error de red
            </span>
          )}
        </div>
      </div>

      {/* Control Segmentado de 1 Toque */}
      <div 
        role="radiogroup" 
        aria-label="Selecciona tu ubicación actual"
        className="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl"
      >
        {LOCATION_OPTIONS.map((opt) => {
          const isSelected = currentLocation === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              title={opt.description}
              onClick={() => handleSelectLocation(opt.id)}
              className={`
                group relative flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all duration-200 select-none
                ${isSelected 
                  ? `${opt.activeBg} border shadow-xs scale-[1.01]` 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
                }
              `}
            >
              <span className="text-base transition-transform group-hover:scale-110">
                {opt.icon}
              </span>
              <span className="truncate">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {errorMessage && (
        <p className="mt-2 text-xs text-rose-500 dark:text-rose-400 text-center">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

/**
 * Subcomponente de Avatar con Insignia de Ubicación en la esquina
 * Cumple con el consejo de UX: 🏠 casa en origen y 🎒 mochila en estudio/trabajo
 */
export function MemberAvatarWithLocation({
  src,
  name,
  location = 'origen',
  size = 40,
  className = ''
}) {
  const getBadgeIcon = (loc) => {
    switch (loc) {
      case 'estudio/trabajo':
      case 'universidad':
        return '🎒';
      case 'viaje':
        return '✈️';
      case 'origen':
      default:
        return '🏠';
    }
  };

  const badgeIcon = getBadgeIcon(location);
  const initials = (name || 'U').substring(0, 2).toUpperCase();

  return (
    <div className={`relative inline-block ${className}`} style={{ width: size, height: size }}>
      {src ? (
        <img
          src={src}
          alt={name}
          className="rounded-full object-cover w-full h-full border border-slate-200 dark:border-slate-700"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-linear-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-xs shadow-inner">
          {initials}
        </div>
      )}

      {/* Mini insignia en la esquina inferior derecha */}
      <span
        title={`Ubicación actual: ${location}`}
        className="absolute -bottom-1 -right-1 w-4.5 h-4.5 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-[10px] shadow-sm border border-slate-200 dark:border-slate-700 select-none pointer-events-none"
      >
        {badgeIcon}
      </span>
    </div>
  );
}

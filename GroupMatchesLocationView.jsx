'use client';

import React from 'react';
import { MemberAvatarWithLocation } from './QuickLocationSelector';

/**
 * @typedef {Object} MemberLocationInfo
 * @property {string} name - Nombre del usuario
 * @property {string} [avatarUrl] - URL del avatar
 * @property {'origen' | 'estudio/trabajo' | 'viaje'} location - Ubicación actual
 * @property {string} [ciudad_origen] - Ciudad natal
 * @property {string} [ciudad_destino] - Ciudad de campus o trabajo
 */

/**
 * @typedef {Object} MatchDay
 * @property {string} date - Fecha en formato 'YYYY-MM-DD'
 * @property {number} dayNumber - Número de día en el mes (1-31)
 * @property {string[]} freeMembers - Nombres de miembros libres
 * @property {boolean} [isNationalHoliday] - Indica si es festivo nacional
 * @property {string} [holidayName] - Nombre del festivo
 */

/**
 * Componente que renderiza el resultado de las coincidencias de días libres del grupo,
 * incorporando el detector inteligente de discrepancia de ubicaciones geográficas.
 */
export default function GroupMatchesLocationView({
  groupName,
  selectedMembers = [],
  membersLocation = [], // Array de MemberLocationInfo
  matchDays = [], // Array de MatchDay
  onProposePlan
}) {
  if (selectedMembers.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        Selecciona al menos 2 miembros del grupo para calcular los días libres comunes.
      </div>
    );
  }

  // Filtrar miembros seleccionados con su ubicación actual
  const activeMembers = selectedMembers.map((name) => {
    const found = membersLocation.find((m) => m.name.toLowerCase() === name.toLowerCase());
    return {
      name,
      avatarUrl: found?.avatarUrl,
      location: found?.location || 'origen',
      ciudad_origen: found?.ciudad_origen || 'Plasencia',
      ciudad_destino: found?.ciudad_destino || ''
    };
  });

  // Comprobar si hay discrepancia geográfica entre miembros seleccionados
  const uniqueLocations = new Set(activeMembers.map((m) => m.location));
  const hasGeographicDiscrepancy = uniqueLocations.size > 1;

  const getLocationLabel = (loc) => {
    switch (loc) {
      case 'estudio/trabajo':
        return { text: 'En Estudio / Trabajo', icon: '🎒', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'viaje':
        return { text: 'De Viaje', icon: '✈️', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'origen':
      default:
        return { text: 'En Origen', icon: '🏠', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {/* 1. Resumen de miembros seleccionados con sus avatares e insignia en la esquina */}
      <div className="flex items-center gap-3 overflow-x-auto py-2 px-1">
        {activeMembers.map((m) => {
          const locMeta = getLocationLabel(m.location);
          return (
            <div key={m.name} className="flex flex-col items-center shrink-0 space-y-1">
              <MemberAvatarWithLocation
                src={m.avatarUrl}
                name={m.name}
                location={m.location}
                size={44}
              />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 max-w-[68px] truncate text-center">
                {m.name}
              </span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-medium border ${locMeta.badgeClass}`}>
                {locMeta.icon}
              </span>
            </div>
          );
        })}
      </div>

      {/* 2. Días comunes o estado sin coincidencia */}
      {matchDays.length === 0 ? (
        <div className="p-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 text-sm">
          😅 <strong>No hay coincidencias de días libres este mes</strong> para{' '}
          {selectedMembers.join(', ')} en el grupo <em>{groupName}</em>.
        </div>
      ) : (
        <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-base mb-1">
            <span>🎉</span>
            <span>¡Días libres en común en {groupName}!</span>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Coincidís libres todos los días:{' '}
            <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
              {matchDays.map((d) => (
                <span key={d.date} className="inline-block mr-1.5">
                  {d.dayNumber}
                  {d.isNationalHoliday && (
                    <span className="ml-1 text-[11px] bg-red-100 text-red-700 px-1 rounded-sm font-semibold">
                      🎉 {d.holidayName || 'Festivo'}
                    </span>
                  )}
                </span>
              ))}
            </span>
          </p>
        </div>
      )}

      {/* 3. ALERTA INTELIGENTE DE UBICACIÓN (Regla de Negocio 3 y Opcional) */}
      {hasGeographicDiscrepancy ? (
        <div className="p-4 rounded-2xl border border-amber-300 bg-linear-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 text-amber-900 dark:text-amber-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-800 dark:text-amber-300">
            <span className="text-lg">⚠️</span>
            <span>¡Atención! Estáis en ciudades distintas</span>
          </div>
          <p className="text-xs text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
            Tenéis el día libre en común, pero <strong>no todos os encontráis en la misma ciudad</strong> actualmente:
          </p>
          <ul className="text-xs space-y-1 pl-4 list-disc">
            {activeMembers.map((m) => {
              const meta = getLocationLabel(m.location);
              return (
                <li key={m.name}>
                  <strong>{m.name}:</strong>{' '}
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold border ${meta.badgeClass}`}>
                    {meta.icon} {meta.text}
                    {m.location === 'estudio/trabajo' && m.ciudad_destino ? ` (${m.ciudad_destino})` : ''}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="text-[11px] bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-lg border-l-4 border-amber-500 font-medium text-amber-950 dark:text-amber-200">
            💡 <strong>Consejo para la Kedada:</strong> Coordinad si los desplazados bajan a la ciudad de origen ({activeMembers[0]?.ciudad_origen || 'Plasencia'}) o si el resto organiza una visita a su ciudad de estudio/trabajo.
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5 text-xs">
          <span className="text-base">✅</span>
          <div>
            <strong className="block font-bold">¡Ubicaciones 100% alineadas!</strong>
            <span>
              Todos los miembros seleccionados os encontráis actualmente en su{' '}
              {getLocationLabel(activeMembers[0]?.location || 'origen').text.toLowerCase()}. ¡No hay barreras de distancia para quedar!
            </span>
          </div>
        </div>
      )}

      {/* 4. Botón de acción para crear la votación o plan de kedada */}
      {matchDays.length > 0 && onProposePlan && (
        <button
          type="button"
          onClick={() => onProposePlan(matchDays[0])}
          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <span>🎯</span>
          <span>Proponer quedada en Votaciones del Grupo</span>
        </button>
      )}
    </div>
  );
}

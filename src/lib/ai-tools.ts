import toolsConfig from './ai-tools.json';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateQuote, analyzeTattooHealingVision, PricingRules, HealingTemplates } from '@/lib/edenai';

export const AI_TOOLS = toolsConfig.tools;

export const OPENAI_TOOLS = AI_TOOLS.map(t => ({
  type: 'function',
  function: {
    name: t.name,
    description: t.description,
    parameters: t.parameters
  }
}));

export interface ToolExecutionContext {
  studioId: string;
  artistId: string;
  clientId?: string | null;
  clientProfileId?: string | null;
  chatId?: string | null;
  artistPricingRules?: PricingRules;
  artistHealingTemplates?: HealingTemplates;
  artistName?: string;
  lang?: 'es' | 'en';
  userMessage?: string;
}

export interface ToolCallDecision {
  tool: string;
  arguments: any;
}

export interface ToolExecutionResult {
  success: boolean;
  tool: string;
  result: any;
  displayText?: string;
  createdAppointment?: any;
  rescheduledAppointment?: any;
  cancelledAppointmentId?: string;
  availableSlots?: Array<{
    datetime: string;
    date: string;
    time: string;
    label: string;
    appointment_type: string;
  }>;
  clientAppointments?: any[];
  quoteData?: any;
  healingData?: any;
  faqTopic?: string;
}

/**
 * Format date in local YYYY-MM-DD avoiding UTC off-by-one shifts
 */
export function toLocalIsoDate(d: Date, timeZone = 'Europe/Madrid'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(d);
    let y = '', m = '', day = '';
    for (const p of parts) {
      if (p.type === 'year') y = p.value;
      if (p.type === 'month') m = p.value;
      if (p.type === 'day') day = p.value;
    }
    if (y && m && day) return `${y}-${m}-${day}`;
  } catch (err) {
    // Fallback if Intl fails
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts a date string (YYYY-MM-DD) and time string (HH:MM) in Europe/Madrid timezone
 * to a standard UTC Date object.
 * Perfectly handles Daylight Saving Time (DST / CEST vs CET) and works identically
 * on UTC cloud servers, Windows, Linux, and client browsers.
 */
export function createDateInTimezone(
  dateStr: string,
  timeStr: string,
  timeZone = 'Europe/Madrid'
): Date {
  const [yearStr, monthStr, dayStr] = (dateStr || '').split('-');
  const [hourStr, minStr] = (timeStr || '11:00').split(':');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr || '11', 10);
  const minute = parseInt(minStr || '00', 10);

  // 1. Initial guess in UTC:
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  // 2. Find what time that UTC instant is in the target timezone:
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });

  const parts = formatter.formatToParts(utcGuess);
  const partMap: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      partMap[p.type] = parseInt(p.value, 10);
    }
  }

  let tzHour = partMap.hour === 24 ? 0 : partMap.hour;

  const tzDateAsUtc = new Date(Date.UTC(
    partMap.year,
    partMap.month - 1,
    partMap.day,
    tzHour,
    partMap.minute,
    partMap.second || 0
  ));

  // Difference in milliseconds: offset of target timezone relative to UTC
  const offsetMs = tzDateAsUtc.getTime() - utcGuess.getTime();

  // If Madrid is UTC+2 (+7200000ms), to make 11:00 in Madrid, UTC must be 11:00 - 2h = 09:00 UTC
  return new Date(utcGuess.getTime() - offsetMs);
}

/**
 * Format a Date or ISO string to HH:MM in Europe/Madrid timezone
 */
export function formatMadridTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('es-ES', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format a Date or ISO string to long human date in Europe/Madrid timezone
 */
export function formatMadridDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-ES', {
    timeZone: 'Europe/Madrid',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Busca una palabra COMPLETA (no trozos de otras palabras). Acepta tildes y ñ.
 * Ej: hasWord('¿sabes si hay hueco?', 'sab') -> false ; hasWord('el jueves', 'jueves') -> true
 */
export function hasWord(text: string, word: string): boolean {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z0-9áéíóúüñ])${esc}(?![a-z0-9áéíóúüñ])`, 'i').test(text || '');
}

/** "mañana" como día (tomorrow), no "por la mañana" */
function mentionsTomorrow(text: string): boolean {
  const t = (text || '').toLowerCase();
  if (hasWord(t, 'tomorrow')) return true;
  return /(?<!\bla\s)(?<![a-z0-9áéíóúüñ])ma(?:ñ|n)ana(?![a-z0-9áéíóúüñ])/i.test(t)
    && !/pasado\s+ma(?:ñ|n)ana/i.test(t);
}

/** "la semana que viene", "la próxima semana", "next week" */
function mentionsNextWeek(text: string): boolean {
  return /semana\s+que\s+viene|pr[oó]xima\s+semana|siguiente\s+semana|next\s+week/i.test(text || '');
}

/**
 * Intelligent relative date parser for natural conversational queries
 */
export function parseRelativeDate(dateInput: string, baseDate = new Date()): string {
  const lower = (dateInput || '').toLowerCase().trim();
  const currentYear = baseDate.getFullYear();
  const todayIso = toLocalIsoDate(baseDate);

  // 1. First check explicit ISO YYYY-MM-DD
  const isoMatch = lower.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    if (year < currentYear) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + 1);
      return toLocalIsoDate(d);
    }
    return isoMatch[0];
  }

  // 2. Check weekdays FIRST (e.g. "este viernes", "el próximo lunes", "viernes por la mañana")
  // Weekday names MUST take precedence over "mañana" (morning vs tomorrow)
  // Solo nombres completos: las abreviaturas (mar, sab, vie...) se confundían con
  // palabras normales ("tomar", "sabes", "viene").
  const daysOfWeek = [
    { names: ['domingo', 'sunday'], dayIdx: 0 },
    { names: ['lunes', 'monday'], dayIdx: 1 },
    { names: ['martes', 'tuesday'], dayIdx: 2 },
    { names: ['miercoles', 'miércoles', 'wednesday'], dayIdx: 3 },
    { names: ['jueves', 'thursday'], dayIdx: 4 },
    { names: ['viernes', 'friday'], dayIdx: 5 },
    { names: ['sabado', 'sábado', 'saturday'], dayIdx: 6 }
  ];

  for (const item of daysOfWeek) {
    const matched = item.names.some(n => hasWord(lower, n));
    if (matched) {
      const currentDay = baseDate.getDay();
      let diff = item.dayIdx - currentDay;
      const isNextWeek = lower.includes('próximo') || lower.includes('proximo') || lower.includes('que viene');
      if (diff === 0) {
        if (isNextWeek) diff = 7;
      } else if (diff < 0) {
        diff += 7;
      } else {
        if (isNextWeek && diff <= 2) diff += 7;
      }
      const target = new Date(baseDate);
      target.setDate(target.getDate() + diff);
      return toLocalIsoDate(target);
    }
  }

  // 3. Spanish full date with month name (e.g. "9 de septiembre", "el 16 de octubre", "11 sept")
  const monthNames: Record<string, number> = {
    enero: 0, ene: 0, febrero: 1, feb: 1, marzo: 2, mar: 2, abril: 3, abr: 3,
    mayo: 4, may: 4, junio: 5, jun: 5, julio: 6, jul: 6, agosto: 7, ago: 7,
    septiembre: 8, setiembre: 8, sept: 8, sep: 8, octubre: 9, oct: 9,
    noviembre: 10, nov: 10, diciembre: 11, dic: 11
  };
  const spanishMonthMatch = lower.match(/(?:el\s+)?(\d{1,2})\s*(?:de\s+)?([a-záéíóúñ]+)/i);
  if (spanishMonthMatch && monthNames[spanishMonthMatch[2].toLowerCase()] !== undefined) {
    const day = parseInt(spanishMonthMatch[1], 10);
    const month = monthNames[spanishMonthMatch[2].toLowerCase()];
    const target = new Date(currentYear, month, day);
    if (toLocalIsoDate(target) < todayIso) {
      target.setFullYear(currentYear + 1);
    }
    return toLocalIsoDate(target);
  }

  // 4. DD/MM/YYYY or DD-MM-YYYY (e.g. 09-09, 09/09, 09/09/2026)
  const euMatch = lower.match(/\b(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{4}))?\b/);
  if (euMatch) {
    const day = parseInt(euMatch[1], 10);
    const month = parseInt(euMatch[2], 10) - 1;
    const year = euMatch[3] ? parseInt(euMatch[3], 10) : currentYear;
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      if (toLocalIsoDate(d) < todayIso && !euMatch[3]) {
        d.setFullYear(currentYear + 1);
      }
      return toLocalIsoDate(d);
    }
  }

  // 5. Relative conversational keywords (pasado mañana, hoy, standalone mañana)
  if (lower.includes('pasado mañana') || lower.includes('pasado manana')) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 2);
    return toLocalIsoDate(d);
  }
  if (lower.includes('hoy') || lower.includes('today')) {
    return todayIso;
  }
  // Standalone mañana (NOT "por la mañana" or "en la mañana")
  if (mentionsTomorrow(lower)) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 1);
    return toLocalIsoDate(d);
  }

  // 6. Day number mentioned (e.g. "el 18", "el día 22")
  const dayNumMatch = lower.match(/(?:el|dia|día)\s*(\d{1,2})\b/i);
  if (dayNumMatch) {
    const dayNum = parseInt(dayNumMatch[1], 10);
    if (dayNum >= 1 && dayNum <= 31) {
      const target = new Date(baseDate);
      if (dayNum < baseDate.getDate()) {
        target.setMonth(target.getMonth() + 1);
      }
      target.setDate(dayNum);
      return toLocalIsoDate(target);
    }
  }

  // Default fallback: tomorrow
  const fallback = new Date(baseDate);
  fallback.setDate(fallback.getDate() + 1);
  return toLocalIsoDate(fallback);
}

/**
 * Extracts requested date by inspecting both tool args and raw user message.
 * Gives deterministic priority to the day requested by the user, guarding against LLM day-shift hallucinations.
 */
export function extractRequestedDate(
  preferredDate?: string,
  userMessage?: string,
  baseDate = new Date()
): { targetDate: string; isSpecificDay: boolean; requestedDayName?: string } {
  const userText = (userMessage || '').toLowerCase();
  const prefText = (preferredDate || '').toLowerCase();
  const combined = `${userText} ${prefText}`;

  // 0. Fecha exacta YYYY-MM-DD escrita en el mensaje (p. ej. al pulsar un botón de hueco)
  const userIso = userText.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (userIso && parseInt(userIso[1], 10) >= baseDate.getFullYear()) {
    return { targetDate: userIso[0], isSpecificDay: true };
  }

  // 1. Check if user specified a day of the week in userMessage or preferredDate
  // Solo nombres completos (antes "tomar" -> martes, "sabes" -> sábado, "viene" -> viernes)
  const daysOfWeek = [
    { name: 'domingo', aliases: ['domingo', 'sunday'], dayIdx: 0 },
    { name: 'lunes', aliases: ['lunes', 'monday'], dayIdx: 1 },
    { name: 'martes', aliases: ['martes', 'tuesday'], dayIdx: 2 },
    { name: 'miércoles', aliases: ['miercoles', 'miércoles', 'wednesday'], dayIdx: 3 },
    { name: 'jueves', aliases: ['jueves', 'thursday'], dayIdx: 4 },
    { name: 'viernes', aliases: ['viernes', 'friday'], dayIdx: 5 },
    { name: 'sábado', aliases: ['sabado', 'sábado', 'saturday'], dayIdx: 6 }
  ];

  // El día que dice el cliente manda sobre el que deduzca el modelo
  const dayInUser = daysOfWeek.find(item => item.aliases.some(a => hasWord(userText, a)));
  const dayInPref = dayInUser ? undefined : daysOfWeek.find(item => item.aliases.some(a => hasWord(prefText, a)));

  for (const item of daysOfWeek) {
    const foundInUser = dayInUser === item;
    const foundInPref = dayInPref === item;

    if (foundInUser || foundInPref) {
      const currentDay = baseDate.getDay();
      let diff = item.dayIdx - currentDay;
      const isNextWeek = combined.includes('próximo') || combined.includes('proximo') || combined.includes('que viene');

      if (diff === 0) {
        if (isNextWeek) diff = 7;
      } else if (diff < 0) {
        diff += 7;
      } else {
        if (isNextWeek && diff <= 2) diff += 7;
      }

      const target = new Date(baseDate);
      target.setDate(target.getDate() + diff);
      return {
        targetDate: toLocalIsoDate(target),
        isSpecificDay: true,
        requestedDayName: item.name
      };
    }
  }

  // 2. Check if user specified "hoy", "mañana", "pasado mañana"
  if (hasWord(userText, 'hoy') || hasWord(userText, 'today') || hasWord(prefText, 'hoy')) {
    return { targetDate: toLocalIsoDate(baseDate), isSpecificDay: true, requestedDayName: 'hoy' };
  }
  if (userText.includes('pasado mañana') || userText.includes('pasado manana') || prefText.includes('pasado mañana') || prefText.includes('pasado manana')) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 2);
    return { targetDate: toLocalIsoDate(d), isSpecificDay: true, requestedDayName: 'pasado mañana' };
  }
  if (mentionsTomorrow(userText) || mentionsTomorrow(prefText)) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 1);
    return { targetDate: toLocalIsoDate(d), isSpecificDay: true, requestedDayName: 'mañana' };
  }

  // 2b. "La semana que viene" / "la próxima semana" -> desde el lunes siguiente
  if (mentionsNextWeek(userText) || mentionsNextWeek(prefText)) {
    const d = new Date(baseDate);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? 1 : 8 - day));
    return { targetDate: toLocalIsoDate(d), isSpecificDay: false };
  }

  // 2b2. Fecha con mes escrita por el cliente ("el 15 de octubre", "3 nov")
  if (/\b\d{1,2}\s*(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|abr|jun|jul|ago|sept?|oct|nov|dic)\b/i.test(userText)) {
    return { targetDate: parseRelativeDate(userText, baseDate), isSpecificDay: true };
  }

  // 2c. "Esta semana" / pregunta general -> a partir de mañana, varios días
  if (/esta\s+semana|this\s+week/i.test(userText)) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 1);
    return { targetDate: toLocalIsoDate(d), isSpecificDay: false };
  }

  // 3. Check ISO date YYYY-MM-DD
  const isoMatch = prefText.match(/\b(\d{4})-(\d{2})-(\d{2})\b/) || userText.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    if (year >= baseDate.getFullYear()) {
      return { targetDate: isoMatch[0], isSpecificDay: true };
    }
  }

  // 4. Check Spanish month or DD/MM from preferredDate
  if (preferredDate) {
    const dateFromPref = parseRelativeDate(preferredDate, baseDate);
    if (dateFromPref) {
      return { targetDate: dateFromPref, isSpecificDay: true };
    }
  }

  // 5. Default generic query
  const defaultTarget = new Date(baseDate);
  defaultTarget.setDate(defaultTarget.getDate() + 1);
  return { targetDate: toLocalIsoDate(defaultTarget), isSpecificDay: false };
}

export interface ParsedTimeInfo {
  startTime: string; // "HH:MM"
  durationHours?: number; // e.g. 2
  endTime?: string; // "HH:MM"
}

/**
 * Intelligent parser that extracts explicit time information, including ranges like
 * "de 11 a 13", "de 11:00 a 13:00", "de 11h a 13h", "a las 11", etc.
 */
export function parseExplicitTimeDetails(text: string): ParsedTimeInfo | null {
  const lower = (text || '').toLowerCase().trim();

  // Range pattern: "de 11 a 13", "de 11:00 a 13:00", "de 11h a 13h", "11 a 13", "11:00 a 13:00"
  const rangeMatch = lower.match(/(?:de\s+)?\b([01]?\d|2[0-3])(?::([0-5]\d))?\s*(?:h|horas)?\s*(?:a|hasta|-)\s*([01]?\d|2[0-3])(?::([0-5]\d))?\s*(?:h|horas)?\b/i);
  if (rangeMatch) {
    let startH = parseInt(rangeMatch[1], 10);
    const startM = rangeMatch[2] || '00';
    let endH = parseInt(rangeMatch[3], 10);
    const endM = rangeMatch[4] || '00';

    // Afternoon adjustment if mentioned: e.g. "de 4 a 6 de la tarde"
    if ((lower.includes('tarde') || lower.includes('pm')) && startH < 12) {
      startH += 12;
      if (endH < 12) endH += 12;
    }

    if (endH > startH || (endH === startH && parseInt(endM, 10) > parseInt(startM, 10))) {
      const startMinTotal = startH * 60 + parseInt(startM, 10);
      const endMinTotal = endH * 60 + parseInt(endM, 10);
      const diffHours = (endMinTotal - startMinTotal) / 60;

      return {
        startTime: `${String(startH).padStart(2, '0')}:${startM}`,
        endTime: `${String(endH).padStart(2, '0')}:${endM}`,
        durationHours: Math.round(diffHours * 100) / 100
      };
    }
  }

  // Single time with colon: "11:30", "09:00", "16:00"
  const colMatch = lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (colMatch) {
    const h = parseInt(colMatch[1], 10);
    const m = colMatch[2];
    return {
      startTime: `${String(h).padStart(2, '0')}:${m}`
    };
  }

  // Single hour pattern: "a las 11", "a las 5 de la tarde", "17h", "16 horas", "a las 11:00"
  const hMatch = lower.match(/(?:a\s+las|a\s+la|alas|de|desde)?\s*(\d{1,2})\s*(?:h|horas|pm|am|de\s+la\s+tarde|de\s+la\s+mañana)?/i);
  if (hMatch) {
    let hour = parseInt(hMatch[1], 10);
    if (hour >= 0 && hour <= 24) {
      if ((lower.includes('tarde') || lower.includes('pm')) && hour < 12) {
        hour += 12;
      }
      if (!lower.includes(hour + ' cm') && !lower.includes(hour + 'cm')) {
        if (
          lower.includes('a las ' + hour) ||
          lower.includes('alas ' + hour) ||
          lower.includes(hour + 'h') ||
          lower.includes(hour + ' horas') ||
          lower.includes(hour + ':00') ||
          lower.includes('de ' + hour)
        ) {
          return {
            startTime: `${String(hour).padStart(2, '0')}:00`
          };
        }
      }
    }
  }

  return null;
}

/**
 * Parses an explicit time (e.g. "11:00", "16:30", "a las 5 de la tarde", "de 11 a 13")
 * Returns null if no explicit time is specified in the text.
 */
export function parseExplicitTime(text: string): string | null {
  const details = parseExplicitTimeDetails(text);
  if (details?.startTime) return details.startTime;

  const lower = (text || '').toLowerCase();

  // Pattern 1: HH:MM or H:MM (e.g. 11:30, 9:00, 16:00)
  const colMatch = lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (colMatch) {
    const h = parseInt(colMatch[1], 10);
    const m = colMatch[2];
    return `${String(h).padStart(2, '0')}:${m}`;
  }

  // Pattern 2: "a las 11", "a las 5 de la tarde", "17h", "16 horas"
  const hMatch = lower.match(/(?:a\s+las|a\s+la|alas)?\s*(\d{1,2})\s*(?:h|horas|pm|am|de\s+la\s+tarde|de\s+la\s+mañana)?/i);
  if (hMatch) {
    let hour = parseInt(hMatch[1], 10);
    if (hour >= 0 && hour <= 24) {
      if ((lower.includes('tarde') || lower.includes('pm')) && hour < 12) {
        hour += 12;
      }
      // If user typed something like "15 cm", ignore it
      if (lower.includes(hour + ' cm') || lower.includes(hour + 'cm')) {
        return null;
      }
      if (lower.includes('a las ' + hour) || lower.includes('alas ' + hour) || lower.includes(hour + 'h') || lower.includes(hour + ' horas') || lower.includes(hour + ':00')) {
        return `${String(hour).padStart(2, '0')}:00`;
      }
    }
  }

  return null;
}

/**
 * Deterministic intent detector to quickly pick the appropriate tool if LLM is unavailable or for instant routing
 */
export function detectToolIntent(content: string, imageUrl?: string): ToolCallDecision | null {
  if (imageUrl) {
    return { tool: 'analyze_healing', arguments: { image_url: imageUrl } };
  }

  const text = (content || '').toLowerCase();

  // 1. Takeover intent
  if (/hablar con el tatuador|persona real|humano|hablar con alguien|tatuador real|hablar con marco|hablar con el artista|quiero hablar con/i.test(text)) {
    return {
      tool: 'request_human_takeover',
      arguments: { reason: content }
    };
  }

  // 2. Reschedule intent (e.g. "cambiar mi cita", "modificar cita", "pasar mi cita para el lunes")
  const isReschedule = /(?:cambiar|modificar|reprogramar|posponer|mover|pasar)\s+(?:la\s+|mi\s+)?(?:cita|sesion|sesión)/i.test(text)
    || /(?:cambia|modifica|reprograma|pospón|pasa)\s+(?:mi\s+|la\s+)?cita/i.test(text)
    || /no\s+puedo\s+ir\s+(?:el|este|mañana)/i.test(text);

  if (isReschedule) {
    const hasSpecificTarget = /mañana|hoy|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|día|\d{1,2}|a\s+las/i.test(text);
    if (hasSpecificTarget) {
      const explicitTime = parseExplicitTime(text) || '11:00';
      return {
        tool: 'reschedule_appointment',
        arguments: {
          new_date: parseRelativeDate(text),
          new_time: explicitTime,
          reason: content
        }
      };
    } else {
      return {
        tool: 'get_client_appointments',
        arguments: { filter: 'upcoming', promptReason: 'reschedule' }
      };
    }
  }

  // 3. Cancel intent (e.g. "cancelar mi cita", "anular mi cita", "no voy a poder ir, cancélala")
  const isCancel = /(?:cancelar|anular|borrar|eliminar)\s+(?:mi\s+|la\s+)?(?:cita|sesion|sesión)/i.test(text)
    || /(?:cancela|anula|borra)\s+(?:mi\s+|la\s+)?cita/i.test(text)
    || /(?:anúlame|cancélame)\s+la\s+cita/i.test(text);

  if (isCancel) {
    return {
      tool: 'cancel_appointment',
      arguments: { reason: content }
    };
  }

  // 4. Client Appointments Query intent (e.g. "¿cuándo es mi cita?", "¿cuándo tengo mi próxima cita?", "¿qué citas tengo agendadas?")
  const isCheckMyApps = /(?:cuándo|cuando)\s+(?:es|tengo)\s+(?:mi\s+|alguna\s+)?(?:próxima\s+|proxima\s+)?(?:cita|sesion|sesión)/i.test(text)
    || /(?:qué|que)\s+citas\s+tengo/i.test(text)
    || /mis\s+citas/i.test(text)
    || /tengo\s+(?:alguna\s+)?cita/i.test(text);

  if (isCheckMyApps) {
    return {
      tool: 'get_client_appointments',
      arguments: { filter: 'upcoming' }
    };
  }

  // 5. Studio Opening Schedule intent (e.g. "¿qué horario tenéis en el estudio los sábados?", "horario de apertura")
  const isScheduleQuery = /(?:horario\s+(?:del\s+estudio|de\s+apertura|habitual)|a\s+qu[eé]\s+hora\s+abr[ií]s|qu[eé]\s+horario\s+ten[eé]is|cu[aá]ndo\s+abr[ií]s|horario\s+de\s+atenci[oó]n|est[aá]is\s+abiertos?)/i.test(text);
  if (isScheduleQuery) {
    return {
      tool: 'get_artist_schedule',
      arguments: {}
    };
  }

  // 6. Booking vs Availability Check intent:
  // Catches queries with typos like "que huecs tiene para este viernes", "que horarios tienes", etc.
  const hasAvailabilityQuery = /(?:huec[a-z]*|horari[a-z]*|disponib[a-z]*|libr[a-z]*|turn[a-z]*|sitio[a-z]*|fechas?|dias?|días?|citas?)/i.test(text)
    && /(?:tienes?|teneis|hay|tenga|tengas|cuándo|cuando|qué|que|cuál|cual|ver|para|este|esta|próximo|proximo|mañana|manana|miercoles|miércoles|lunes|martes|jueves|viernes|sabado|sábado|domingo)/i.test(text);

  const hasAppointmentIntent = hasAvailabilityQuery
    || /(?:quiero|puedo|deseo|pedir|solicitar|agendar|reservar|reservame|resérvame|poner|dame|darme|sacar)\s+(?:una\s+)?(?:cita|sesion|sesión|consulta|hueco|turno)/i.test(text)
    || /(?:quiero|deseo|me\s+gustaría|me\s+gustaria)?\s*(?:reservar|agendar|resérvame|reservame|agéndame|agendame)\s+(?:para|el|este|un|una)/i.test(text)
    || /(?:cita|sesion|sesión)\s+(?:para\s+el|el\s+próximo|el\s+proximo|este|mañana|hoy)/i.test(text)
    || /(?:tienes\s+hueco|tienes\s+huecos|hay\s+hueco|hay\s+huecos|disponibilidad)/i.test(text)
    || /(?:que|qué)\s+(?:huec[a-z]*|horari[a-z]*|dias|días)\s+(?:tienes|hay)/i.test(text);

  if (hasAppointmentIntent) {
    const explicitTime = parseExplicitTime(text);
    const isConsultation = /consulta|diseño|diseno|boceto|asesor/i.test(text);
    const appointmentType = isConsultation ? 'design_consultation' : 'tattoo_session';
    const { targetDate } = extractRequestedDate(undefined, text);

    // Dynamic duration based on tattoo size or description
    let customDuration: number | undefined;
    if (isConsultation) {
      customDuration = 0.75;
    } else if (/manga completa|espalda completa|brazo entero/i.test(text)) {
      customDuration = 5;
    } else if (/media manga|pieza grande|espalda|pecho completo/i.test(text)) {
      customDuration = 4;
    } else if (/pequeño|pequeno|mini|lettering|flash/i.test(text)) {
      customDuration = 1.5;
    } else if (/(\d+(?:\.\d+)?)\s*horas?/i.test(text)) {
      const match = text.match(/(\d+(?:\.\d+)?)\s*horas?/i);
      if (match) customDuration = parseFloat(match[1]);
    }

    // If explicit time is given AND user explicitly says "resérvame" or "confirma"
    if (explicitTime && /(?:resérvame|reservame|agéndame|agendame|confírmame|confirmame|ponme|quiero reservar)/i.test(text)) {
      return {
        tool: 'book_appointment',
        arguments: {
          appointment_type: appointmentType,
          duration_hours: customDuration,
          date: targetDate,
          time: explicitTime,
          description: content
        }
      };
    }

    // Otherwise, check availability and offer choices!
    return {
      tool: 'check_availability',
      arguments: {
        preferred_date: targetDate,
        appointment_type: appointmentType,
        duration_hours: customDuration,
        preferred_time_of_day: /(?:por\s+la\s+|en\s+la\s+)?tarde|pm/i.test(text) ? 'afternoon' : (/(?:por\s+la\s+|en\s+la\s+)?mañana|am/i.test(text) ? 'morning' : 'any')
      }
    };
  }

  // 6. Quote intent (e.g. "15 cm", "presupuesto", "precio para tatuaje de...")
  const sizeMatch = text.match(/(\d{1,3})\s*(?:cm|centimetros|centímetros)/i);
  if (sizeMatch || /cuanto cuesta|cuánto cuesta|precio|presupuesto|tarifa/i.test(text)) {
    const parsedCm = sizeMatch ? parseInt(sizeMatch[1], 10) : 10;
    const isColor = /color|rojo|azul|verde|acuarela|amarillo/i.test(text);
    const placementMatch = text.match(/en (el|la|los|las)?\s*([a-záéíóúñ]+)/i);
    const placement = placementMatch ? placementMatch[2] : '';

    return {
      tool: 'estimate_quote',
      arguments: {
        size_cm: parsedCm,
        is_color: isColor,
        placement
      }
    };
  }

  // 7. Schedule/Hours intent
  if (/horario|abierto|cuando abre|días abre|dias abre/i.test(text)) {
    return {
      tool: 'get_artist_schedule',
      arguments: {}
    };
  }

  // 8. App Usage & FAQ Intent (How to use app, appointments, consent PDF, map, aftercare hygiene without sales, Stripe 50€/mo)
  const isAppFaqIntent = /(?:c[oó]mo funciona|c[oó]mo usar|c[oó]mo firmo|c[oó]mo reservar|c[oó]mo cancelo|d[oó]nde est[aá] el mapa|c[oó]mo descargar el pdf|qu[eé] es tatoo|ayuda con la app|suscripci[oó]n|50€|50 euros|stripe|pasarela|crema|pomada|b[aá]lsamo|jab[oó]n|aftercare|cuidados?|qu[eé] me pongo|c[oó]mo curar|segunda piel|consentimiento|descargar pdf|imprimir)/i.test(text);
  if (isAppFaqIntent) {
    let topic = 'general_help';
    if (/consentimiento|firm|pdf|imprimir|descargar|validez legal/i.test(text)) topic = 'consent_pdf';
    else if (/mapa|direcci[oó]n|ubicaci[oó]n|estudios? en el mapa|carto/i.test(text)) topic = 'map_studios';
    else if (/crema|pomada|b[aá]lsamo|jab[oó]n|aftercare|cuidados?|curar|segunda piel/i.test(text)) topic = 'aftercare_rules';
    else if (/suscripci[oó]n|50€|50 euros|stripe|pasarela|pago mensual|cuota/i.test(text)) topic = 'stripe_subscription';
    else if (/cita|reservar|reprogramar|cancelar|agenda/i.test(text)) topic = 'appointments';

    return {
      tool: 'get_app_faq',
      arguments: { topic, query: text }
    };
  }

  return null;
}

/**
 * Helper to resolve clientId from context
 */
async function resolveClientId(supabase: any, context: ToolExecutionContext): Promise<string | null> {
  if (context.clientId) return context.clientId;
  if (!context.clientProfileId) return null;

  const { data: clientRec } = await supabase
    .from('clients')
    .select('id')
    .eq('profile_id', context.clientProfileId)
    .maybeSingle();

  if (clientRec) return clientRec.id;

  const { data: newClient } = await supabase
    .from('clients')
    .insert({ profile_id: context.clientProfileId })
    .select('id')
    .maybeSingle();

  return newClient?.id || null;
}

/**
 * Execute a chosen tool and return its structured output
 */
export async function executeAiTool(
  toolName: string,
  toolArgs: any,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const supabase = createAdminClient();

  switch (toolName) {
    case 'check_availability': {
      try {
        const appointmentType = toolArgs.appointment_type || 'tattoo_session';
        const { targetDate, isSpecificDay, requestedDayName } = extractRequestedDate(
          toolArgs.preferred_date,
          context.userMessage
        );
        const parsedDateStr = targetDate;
        const durationHours = toolArgs.duration_hours ? Number(toolArgs.duration_hours) : (appointmentType === 'design_consultation' ? 0.75 : 2.5);

        // Fetch existing appointments for this artist starting from target date
        const startDateObj = createDateInTimezone(parsedDateStr, '00:00', 'Europe/Madrid');
        const endDateObj = new Date(startDateObj.getTime() + (isSpecificDay ? 1 : 7) * 24 * 60 * 60 * 1000);

        const { data: existingApps } = await supabase
          .from('appointments')
          .select('id, start_time, end_time, status')
          .eq('artist_id', context.artistId)
          .neq('status', 'cancelled')
          .gte('start_time', startDateObj.toISOString())
          .lte('start_time', endDateObj.toISOString());

        const busyList = (existingApps || []).map((a: any) => ({
          start: new Date(a.start_time).getTime(),
          end: new Date(a.end_time).getTime()
        }));

        // Candidate slot hours
        let slotCandidates = appointmentType === 'design_consultation'
          ? ['10:30', '11:30', '12:30', '16:30', '17:30', '18:30']
          : ['10:00', '11:00', '16:00', '17:00'];

        const preferredTime = toolArgs.preferred_time_of_day || 'any';
        if (preferredTime === 'morning') {
          slotCandidates = slotCandidates.filter(t => parseInt(t.split(':')[0], 10) < 14);
        } else if (preferredTime === 'afternoon') {
          slotCandidates = slotCandidates.filter(t => parseInt(t.split(':')[0], 10) >= 15);
        }

        const availableSlots: Array<{
          datetime: string;
          date: string;
          time: string;
          label: string;
          appointment_type: string;
        }> = [];

        const nowMs = Date.now();

        // If user asked for a specific day (e.g. "este viernes"), only check that single day!
        // Si pregunta en general ("esta semana"), repartimos los huecos entre varios días.
        const maxDaysToCheck = isSpecificDay ? 1 : 7;
        const maxSlots = isSpecificDay ? 4 : 6;
        const maxPerDay = isSpecificDay ? 4 : 2;

        for (let dayOffset = 0; dayOffset < maxDaysToCheck && availableSlots.length < maxSlots; dayOffset++) {
          const curDay = new Date(startDateObj.getTime() + dayOffset * 24 * 60 * 60 * 1000);

          // Skip Sundays (day 0)
          if (curDay.getUTCDay() === 0) continue;

          const dateIso = toLocalIsoDate(curDay);
          let slotsThisDay = 0;

          for (const timeStr of slotCandidates) {
            if (availableSlots.length >= maxSlots || slotsThisDay >= maxPerDay) break;

            const slotStartDt = createDateInTimezone(dateIso, timeStr, 'Europe/Madrid');
            const slotStart = slotStartDt.getTime();
            const slotEnd = slotStart + durationHours * 60 * 60 * 1000;

            // Don't offer past slots
            if (slotStart <= nowMs + 30 * 60 * 1000) continue;

            // Check collision with busy list
            const hasOverlap = busyList.some((b: any) => slotStart < b.end && slotEnd > b.start);
            if (!hasOverlap) {
              const dayShort = curDay.toLocaleDateString('es-ES', {
                timeZone: 'Europe/Madrid',
                weekday: 'short',
                day: 'numeric',
                month: 'short'
              });

              slotsThisDay++;
              availableSlots.push({
                datetime: slotStartDt.toISOString(),
                date: dateIso,
                time: timeStr,
                label: `${dayShort} ${timeStr}h`,
                appointment_type: appointmentType
              });
            }
          }
        }

        const typeLabel = appointmentType === 'design_consultation' ? 'Consulta de Diseño' : 'Sesión de Tatuaje';
        const targetDayFormatted = startDateObj.toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long'
        });

        let displayText = '';
        if (availableSlots.length > 0) {
          displayText = `🗓️ He consultado la agenda de **${context.artistName || 'el tatuador'}** para **${typeLabel}** para el **${targetDayFormatted}** y tengo estos huecos libres disponibles:\n\n` +
            availableSlots.map(s => `- **${s.label}**`).join('\n') +
            '\n\n¿Cuál de estas opciones prefieres? Haz clic en uno de los botones para confirmarlo al instante o indícame si buscas otra hora.';
        } else if (isSpecificDay) {
          displayText = `Actualmente no quedan huecos libres para **${typeLabel}** el **${targetDayFormatted}**. ¿Te gustaría consultar para el día siguiente o la próxima semana?`;
        } else {
          displayText = `Actualmente no encuentro huecos libres inmediatos en las fechas solicitadas para ${typeLabel}. ¿Te gustaría que busquemos la semana que viene o prefieres consultar otro día?`;
        }

        return {
          success: true,
          tool: 'check_availability',
          result: { available_slots: availableSlots, date: parsedDateStr },
          availableSlots,
          displayText
        };
      } catch (err: any) {
        console.error('[AI Tool check_availability Error]:', err);
        return {
          success: false,
          tool: 'check_availability',
          result: { error: err.message },
          displayText: 'Hubo un inconveniente al consultar la disponibilidad de la agenda.'
        };
      }
    }

    case 'book_appointment': {
      try {
        const appointmentType = toolArgs.appointment_type || 'tattoo_session';
        const { targetDate } = extractRequestedDate(toolArgs.date, context.userMessage);
        const parsedDateStr = targetDate;
        const timeDetails = parseExplicitTimeDetails(context.userMessage || '');
        const timeStr = timeDetails?.startTime || parseExplicitTime(context.userMessage || '') || toolArgs.time || '11:00';
        const description = toolArgs.description || 'Cita confirmada a través del Asistente IA';

        const startDateTime = createDateInTimezone(parsedDateStr, timeStr, 'Europe/Madrid');
        if (isNaN(startDateTime.getTime())) {
          return {
            success: false,
            tool: 'book_appointment',
            result: { error: 'Fecha u hora no válida' },
            displayText: 'La fecha u hora indicada no es válida. Por favor, indícame un día y hora concretos.'
          };
        }

        const durationHours = timeDetails?.durationHours
          ? timeDetails.durationHours
          : (toolArgs.duration_hours ? Number(toolArgs.duration_hours) : (appointmentType === 'design_consultation' ? 0.75 : 2.5));
        const endDateTime = new Date(startDateTime.getTime() + durationHours * 60 * 60 * 1000);

        // Collision check
        const { data: conflicts } = await supabase
          .from('appointments')
          .select('id, start_time, end_time, title')
          .eq('artist_id', context.artistId)
          .neq('status', 'cancelled')
          .lt('start_time', endDateTime.toISOString())
          .gt('end_time', startDateTime.toISOString());

        if (conflicts && conflicts.length > 0) {
          const confStart = formatMadridTime(conflicts[0].start_time);
          const confEnd = formatMadridTime(conflicts[0].end_time);
          return {
            success: false,
            tool: 'book_appointment',
            result: { error: 'Horario ocupado', conflict: true, conflictingRange: `${confStart} - ${confEnd}` },
            displayText: `⚠️ Lo siento, el horario solicitado (${timeStr}h del ${parsedDateStr}) entra en conflicto con otra cita ya agendada (${confStart} - ${confEnd}) en la agenda de ${context.artistName || 'el artista'}. ¿Te gustaría que revisemos otros huecos libres?`
          };
        }

        // Resolve client_id
        const resolvedClientId = await resolveClientId(supabase, context);

        const newRecord: any = {
          studio_id: context.studioId,
          artist_id: context.artistId,
          client_id: resolvedClientId,
          appointment_type: appointmentType,
          title: appointmentType === 'design_consultation' ? 'Consulta de Diseño (Agendada por IA)' : 'Sesión de Tatuaje (Agendada por IA)',
          description,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: 'confirmed'
        };

        const { data: createdApp, error: appErr } = await supabase
          .from('appointments')
          .insert(newRecord)
          .select(`
            *,
            studios (id, name, address),
            artists (id, display_name)
          `)
          .single();

        if (appErr) {
          console.error('[AI Tool book_appointment Error]:', appErr);
          return {
            success: false,
            tool: 'book_appointment',
            result: { error: appErr.message },
            displayText: 'Hubo un error al registrar la cita en la base de datos.'
          };
        }

        const formattedDate = formatMadridDate(startDateTime);
        const formattedStartTime = formatMadridTime(startDateTime);
        const formattedEndTime = formatMadridTime(endDateTime);

        return {
          success: true,
          tool: 'book_appointment',
          result: createdApp,
          createdAppointment: createdApp,
          displayText: `📅 ¡Cita confirmada con éxito! He agendado tu **${appointmentType === 'design_consultation' ? 'Consulta de Diseño' : 'Sesión de Tatuaje'}** para el **${formattedDate} de ${formattedStartTime} a ${formattedEndTime}** con **${context.artistName || 'el tatuador'}**. Ya está reflejada en tu panel de citas.`
        };
      } catch (err: any) {
        console.error('[AI Tool book_appointment Fatal]:', err);
        return {
          success: false,
          tool: 'book_appointment',
          result: { error: err.message },
          displayText: 'No se pudo procesar la reserva de cita automáticamente.'
        };
      }
    }

    case 'get_client_appointments': {
      try {
        const resolvedClientId = await resolveClientId(supabase, context);
        if (!resolvedClientId) {
          return {
            success: false,
            tool: 'get_client_appointments',
            result: { appointments: [] },
            displayText: 'No encontré tu ficha de cliente registrada para consultar citas.'
          };
        }

        const query = supabase
          .from('appointments')
          .select(`
            *,
            studios (id, name, address),
            artists (id, display_name)
          `)
          .eq('client_id', resolvedClientId)
          .neq('status', 'cancelled')
          .order('start_time', { ascending: true });

        if (toolArgs.filter !== 'all') {
          query.gte('end_time', new Date().toISOString());
        }

        const { data: apps, error: fetchErr } = await query;
        if (fetchErr) throw fetchErr;

        if (!apps || apps.length === 0) {
          return {
            success: true,
            tool: 'get_client_appointments',
            result: { appointments: [] },
            clientAppointments: [],
            displayText: 'Actualmente no tienes ninguna cita futura agendada. Si quieres, dime qué día te gustaría venir y te muestro huecos libres.'
          };
        }

        const listText = apps.map((a: any) => {
          const s = new Date(a.start_time);
          const dStr = s.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
          const tStr = s.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
          const typeStr = a.appointment_type === 'design_consultation' ? 'Consulta de Diseño' : 'Sesión de Tatuaje';
          return `- **${typeStr}**: ${dStr} a las ${tStr}h con ${a.artists?.display_name || 'el artista'} (${a.status === 'confirmed' ? 'Confirmada' : 'Pendiente'})`;
        }).join('\n');

        const isForReschedule = toolArgs.promptReason === 'reschedule';
        const promptQuestion = isForReschedule
          ? '¿Para qué día y hora te vendría bien reprogramarla? O si prefieres, dime qué día tienes pensado y te muestro los huecos libres disponibles.'
          : '¿Deseas modificar, reprogramar o cancelar alguna de ellas?';

        return {
          success: true,
          tool: 'get_client_appointments',
          result: { appointments: apps },
          clientAppointments: apps,
          displayText: `📅 Tienes agendadas las siguientes citas:\n\n${listText}\n\n${promptQuestion}`
        };
      } catch (err: any) {
        console.error('[AI Tool get_client_appointments Error]:', err);
        return {
          success: false,
          tool: 'get_client_appointments',
          result: { error: err.message },
          displayText: 'No se pudieron consultar tus citas en este momento.'
        };
      }
    }

    case 'reschedule_appointment': {
      try {
        const resolvedClientId = await resolveClientId(supabase, context);
        const { targetDate } = extractRequestedDate(toolArgs.new_date, context.userMessage);
        const parsedDateStr = targetDate;

        // 1. Locate appointment to reschedule
        let targetApp: any = null;

        if (toolArgs.appointment_id) {
          const { data: found } = await supabase
            .from('appointments')
            .select('*, artists(display_name)')
            .eq('id', toolArgs.appointment_id)
            .maybeSingle();
          targetApp = found;
        } else if (resolvedClientId) {
          // Fetch upcoming active appointment for this client
          const { data: upcoming } = await supabase
            .from('appointments')
            .select('*, artists(display_name)')
            .eq('client_id', resolvedClientId)
            .neq('status', 'cancelled')
            .gte('start_time', new Date().toISOString())
            .order('start_time', { ascending: true });

          if (!upcoming || upcoming.length === 0) {
            return {
              success: false,
              tool: 'reschedule_appointment',
              result: { error: 'No active upcoming appointment found' },
              displayText: 'No he encontrado ninguna cita próxima activa en tu cuenta para poder reprogramar.'
            };
          }

          if (upcoming.length === 1) {
            targetApp = upcoming[0];
          } else {
            // If multiple, pick the one matching artist or the earliest
            const forThisArtist = upcoming.find((u: any) => u.artist_id === context.artistId);
            targetApp = forThisArtist || upcoming[0];
          }
        }

        if (!targetApp) {
          return {
            success: false,
            tool: 'reschedule_appointment',
            result: { error: 'Cita no encontrada' },
            displayText: 'No pude identificar la cita que deseas modificar. ¿Podrías indicarme qué cita o fecha tienes agendada?'
          };
        }

        // 2. Compute new start & end time
        const timeDetails = parseExplicitTimeDetails(context.userMessage || '');
        const timeStr = timeDetails?.startTime || parseExplicitTime(context.userMessage || '') || toolArgs.new_time || '11:00';
        const newStart = createDateInTimezone(parsedDateStr, timeStr, 'Europe/Madrid');
        if (isNaN(newStart.getTime())) {
          return {
            success: false,
            tool: 'reschedule_appointment',
            result: { error: 'Nueva fecha/hora inválida' },
            displayText: 'La nueva fecha u hora indicada no es válida.'
          };
        }

        const origDurationMs = new Date(targetApp.end_time).getTime() - new Date(targetApp.start_time).getTime();
        const durationMs = timeDetails?.durationHours
          ? timeDetails.durationHours * 3600000
          : (origDurationMs > 0 ? origDurationMs : (targetApp.appointment_type === 'design_consultation' ? 45 * 60 * 1000 : 150 * 60 * 1000));
        const newEnd = new Date(newStart.getTime() + durationMs);

        // 3. Collision check (excluding current appointment)
        const { data: conflicts } = await supabase
          .from('appointments')
          .select('id, start_time, end_time')
          .eq('artist_id', targetApp.artist_id)
          .neq('id', targetApp.id)
          .neq('status', 'cancelled')
          .lt('start_time', newEnd.toISOString())
          .gt('end_time', newStart.toISOString());

        if (conflicts && conflicts.length > 0) {
          const confStart = formatMadridTime(conflicts[0].start_time);
          const confEnd = formatMadridTime(conflicts[0].end_time);
          return {
            success: false,
            tool: 'reschedule_appointment',
            result: { error: 'Horario ocupado', conflict: true, conflictingRange: `${confStart} - ${confEnd}` },
            displayText: `⚠️ Lo siento, el horario solicitado (${timeStr}h del ${parsedDateStr}) coincide con otra cita ya reservada (${confStart} - ${confEnd}) en la agenda del artista. Por favor, indícame otra hora o fecha para reprogramarla.`
          };
        }

        // 4. Update appointment
        const reasonText = toolArgs.reason ? ` (Reprogramada: ${toolArgs.reason})` : ' (Reprogramada por cliente vía IA)';
        const { data: updatedApp, error: updateErr } = await supabase
          .from('appointments')
          .update({
            start_time: newStart.toISOString(),
            end_time: newEnd.toISOString(),
            status: 'confirmed',
            description: (targetApp.description || '') + reasonText,
            updated_at: new Date().toISOString()
          })
          .eq('id', targetApp.id)
          .select(`
            *,
            studios (id, name, address),
            artists (id, display_name)
          `)
          .single();

        if (updateErr) throw updateErr;

        const formattedDate = formatMadridDate(newStart);
        const formattedStartTime = formatMadridTime(newStart);
        const formattedEndTime = formatMadridTime(newEnd);

        return {
          success: true,
          tool: 'reschedule_appointment',
          result: updatedApp,
          rescheduledAppointment: updatedApp,
          displayText: `🔄 ¡Cita reprogramada con éxito! Tu cita con **${targetApp.artists?.display_name || context.artistName}** ha sido cambiada al **${formattedDate} de ${formattedStartTime} a ${formattedEndTime}**. El calendario del artista ya está actualizado.`
        };
      } catch (err: any) {
        console.error('[AI Tool reschedule_appointment Error]:', err);
        return {
          success: false,
          tool: 'reschedule_appointment',
          result: { error: err.message },
          displayText: 'Hubo un inconveniente al reprogramar tu cita.'
        };
      }
    }

    case 'cancel_appointment': {
      try {
        const resolvedClientId = await resolveClientId(supabase, context);
        let targetAppId = toolArgs.appointment_id;

        if (!targetAppId && resolvedClientId) {
          const { data: upcoming } = await supabase
            .from('appointments')
            .select('id, start_time, artists(display_name)')
            .eq('client_id', resolvedClientId)
            .neq('status', 'cancelled')
            .gte('start_time', new Date().toISOString())
            .order('start_time', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (upcoming) targetAppId = upcoming.id;
        }

        if (!targetAppId) {
          return {
            success: false,
            tool: 'cancel_appointment',
            result: { error: 'No upcoming appointment found' },
            displayText: 'No encontré ninguna cita activa próxima para cancelar.'
          };
        }

        const { data: cancelledApp, error: cancelErr } = await supabase
          .from('appointments')
          .update({
            status: 'cancelled',
            description: (toolArgs.reason ? `Cancelada por cliente: ${toolArgs.reason}` : 'Cancelada por cliente a través del chat'),
            updated_at: new Date().toISOString()
          })
          .eq('id', targetAppId)
          .select('id, start_time, artists(display_name)')
          .single();

        if (cancelErr) throw cancelErr;

        return {
          success: true,
          tool: 'cancel_appointment',
          result: { cancelled_id: targetAppId },
          cancelledAppointmentId: targetAppId,
          displayText: '❌ Tu cita ha sido cancelada correctamente en el sistema y el hueco ha quedado liberado en la agenda del tatuador. Cuando quieras volver a agendar, no dudes en escribirme.'
        };
      } catch (err: any) {
        console.error('[AI Tool cancel_appointment Error]:', err);
        return {
          success: false,
          tool: 'cancel_appointment',
          result: { error: err.message },
          displayText: 'Hubo un error al cancelar la cita.'
        };
      }
    }

    case 'estimate_quote': {
      try {
        const sizeCm = Number(toolArgs.size_cm) || 10;
        const isColor = Boolean(toolArgs.is_color);
        const placement = toolArgs.placement || '';
        const isComplex = /costilla|cuello|mano|dedo|pecho|clavicula|pie|tobillo|rodilla/i.test(placement);

        const pricingRules = context.artistPricingRules || {
          minimum_fee: 60,
          hourly_rate: 80,
          size_rates: {
            small: { max_cm: 5, base_price: 60 },
            medium: { max_cm: 15, base_price: 140 },
            large: { max_cm: 25, base_price: 260 },
            xlarge: { max_cm: 999, base_price: 450 }
          },
          color_multiplier: 1.25,
          complex_placement_multiplier: 1.15
        };

        // Si el tatuador cobra POR SESIÓN, la IA da el precio de la sesión
        if ((pricingRules as any).pricing_mode === 'session' && Number((pricingRules as any).session_price) > 0) {
          const sessionPrice = Number((pricingRules as any).session_price);
          const sessionQuote = {
            pricing_mode: 'session',
            session_price: sessionPrice,
            estimated_min: sessionPrice,
            estimated_max: sessionPrice,
            size_cm: sizeCm,
            is_color: isColor,
            is_complex_placement: isComplex,
            disclaimer: 'Precio por sesión. El número de sesiones lo decide el tatuador al ver el diseño.'
          };
          return {
            success: true,
            tool: 'estimate_quote',
            result: sessionQuote,
            quoteData: sessionQuote,
            displayText: `${context.artistName || 'El tatuador'} trabaja por sesión: **${sessionPrice}€ cada sesión**. Cuántas sesiones necesita tu pieza de ${sizeCm} cm lo valora él al ver el diseño.`
          };
        }

        const quoteResult = calculateQuote(pricingRules, {
          size_cm: sizeCm,
          is_color: isColor,
          is_complex_placement: isComplex,
          lang: context.lang || 'es'
        });

        return {
          success: true,
          tool: 'estimate_quote',
          result: quoteResult,
          quoteData: quoteResult,
          displayText: `💰 Presupuesto estimado para una pieza de ${sizeCm} cm${isColor ? ' a color' : ' en negro/grises'}${placement ? ` en ${placement}` : ''}: **${quoteResult.estimated_min}€ a ${quoteResult.estimated_max}€**.\n\n*${quoteResult.disclaimer}*`
        };
      } catch (err: any) {
        return {
          success: false,
          tool: 'estimate_quote',
          result: { error: err.message },
          displayText: 'No se pudo calcular el presupuesto.'
        };
      }
    }

    case 'analyze_healing': {
      try {
        const imageUrl = toolArgs.image_url;
        if (!imageUrl) return { success: false, tool: 'analyze_healing', result: { error: 'No image provided' } };

        const defaultTemplates = {
          normal: {
            es: "El tatuaje muestra una evolución normal de cicatrización. Sigue lavándolo 2-3 veces al día con jabón neutro y aplicando una fina capa de crema.",
            en: "The tattoo shows normal healthy healing. Keep washing it 2-3 times daily with mild soap and applying a thin ointment layer."
          },
          redness_mild: {
            es: "Se aprecia un enrojecimiento moderado habitual durante los primeros días. Evita el roce con ropa ajustada y no tomes el sol ni te bañes en piscinas.",
            en: "Mild redness is common in the first few days. Avoid tight clothing friction, direct sun, and swimming pools."
          },
          alert_infection: {
            es: "⚠️ ¡Atención! La imagen muestra posibles indicios de supuración o inflamación excesiva. Lava suavemente con jabón neutro y contacta urgentemente con el estudio o acude a un centro médico.",
            en: "⚠️ Healing Alert! The image shows possible signs of abnormal discharge or excessive inflammation. Wash gently and contact the studio or a healthcare center immediately."
          }
        };

        const healing = await analyzeTattooHealingVision({
          imageUrl,
          artistTemplates: context.artistHealingTemplates || defaultTemplates,
          lang: context.lang || 'es'
        });

        if (context.chatId) {
          const newBadge = healing.healing_status === 'alert_infection' ? 'takeover' : 'healing_check';
          await supabase
            .from('chats')
            .update({
              status_badge: newBadge,
              ai_summary: `[Curación] ${healing.healing_status}: ${healing.analysis_text.slice(0, 60)}...`,
              updated_at: new Date().toISOString()
            })
            .eq('id', context.chatId);
        }

        return {
          success: true,
          tool: 'analyze_healing',
          result: healing,
          healingData: healing,
          displayText: `🔍 Diagnóstico visual de curación: **${healing.analysis_text}**\n\n${healing.suggested_action}`
        };
      } catch (err: any) {
        return {
          success: false,
          tool: 'analyze_healing',
          result: { error: err.message },
          displayText: 'No se pudo procesar la imagen de cicatrización.'
        };
      }
    }

    case 'request_human_takeover': {
      if (context.chatId) {
        await supabase
          .from('chats')
          .update({
            ai_enabled: false,
            status_badge: 'takeover',
            updated_at: new Date().toISOString()
          })
          .eq('id', context.chatId);
      }

      return {
        success: true,
        tool: 'request_human_takeover',
        result: { takeover: true },
        displayText: `⚡ He avisado directamente a **${context.artistName || 'tu tatuador'}** para que revise este chat y te responda personalmente en cuanto quede libre de cabina. He puesto la IA en pausa temporal.`
      };
    }

    case 'get_artist_schedule': {
      return {
        success: true,
        tool: 'get_artist_schedule',
        result: { available: true },
        displayText: `🗓️ El estudio y ${context.artistName || 'el artista'} atienden de Lunes a Viernes de 10:00 a 20:00 y Sábados de 11:00 a 19:00. ¿Qué día te gustaría venir para consultar disponibilidad?`
      };
    }

    case 'get_app_faq': {
      const askedText = (context.userMessage || '').toLowerCase();
      let topic = toolArgs.topic || 'general_help';
      if (/consentimiento|firmar|firmo|firma/i.test(askedText)) topic = 'consent_pdf';
      else if (/crema|pomada|b[aá]lsamo|jab[oó]n|cuidados?|curar|curaci[oó]n|segunda piel/i.test(askedText)) topic = 'aftercare_rules';
      else if (/suscripci[oó]n|stripe|cuota|50\s?€|50 euros/i.test(askedText)) topic = 'stripe_subscription';
      else if (/mapa|direcci[oó]n|ubicaci[oó]n/i.test(askedText)) topic = 'map_studios';
      let faqText = '';

      switch (topic) {
        case 'consent_pdf':
          faqText = `📜 **Consentimiento Informado Legal & Descarga en PDF:**\n\n` +
            `• **¿Cómo se firma?** Desde tu panel de cliente, pulsa en *Firmar Consentimiento* en tu cita. Podrás responder el cuestionario sanitario y estampar tu firma digital directa con el dedo o ratón.\n` +
            `• **Tinta oscura de alta visibilidad:** El sistema procesa la firma convirtiendo los trazos en tinta oscura oficial (#0f172a) para máxima nitidez en pantalla e impresión.\n` +
            `• **Descarga / Impresión en PDF:** Al pulsar *Imprimir / Descargar PDF*, el documento se genera de forma aislada en 1 sola página A4 oficial (sin páginas en blanco previas) listo para guardar o imprimir con plena validez jurídica.`;
          break;

        case 'appointments':
          faqText = `🗓️ **Gestión de Citas y Agenda:**\n\n` +
            `• **Reservar Cita:** Puedes pedirme directamente huecos ("¿qué horarios tienes este viernes?") y te mostraré opciones libres en tiempo real para reservar con un solo clic.\n` +
            `• **Tipos de Cita:** Disponemos de *Consulta de Diseño* (45 min para definir boceto) y *Sesión de Tatuaje* (con aguja y tinta).\n` +
            `• **Reprogramar o Cancelar:** Pídemelo directamente en este chat (ej: "mueve mi cita al lunes a las 16:00" o "cancela mi cita") y actualizaré tu agenda al instante.`;
          break;

        case 'map_studios':
          faqText = `🗺️ **Mapa Interactivo de Estudios (CARTO Basemaps):**\n\n` +
            `• En la sección de búsqueda de estudios puedes ver un mapa geográfico real con todas las ubicaciones de los estudios asociados.\n` +
            `• Cada estudio cuenta con su dirección física, coordenadas GPS exactas y listado de tatuadores residentes para que encuentres tu estudio más cercano.`;
          break;

        case 'stripe_subscription':
          faqText = `💳 **Suscripción para Estudios (50 € / mes con Stripe):**\n\n` +
            `• **Tarifa plana:** Los estudios de tatuaje pueden registrarse y acceder a todas las funcionalidades profesionales por **50,00 € al mes**.\n` +
            `• **Qué incluye:** Tatuadores residentes ilimitados, asistente virtual con IA para citas y presupuestos, gestión de consentimientos informados con firma digital, mapa interactivo y plantillas de recordatorio por email.\n` +
            `• **Gestión con Stripe:** La suscripción se tramita mediante la pasarela segura de Stripe. Desde el panel del estudio puedes descargar facturas oficiales, cambiar el método de pago o gestionar la renovación en cualquier momento.`;
          break;

        case 'aftercare_rules':
          faqText = `🩹 **Pautas Sanitarias de Cicatrización del Tatuaje:**\n\n` +
            `⚠️ *Nota: En el estudio no vendemos ni comercializamos productos. Todos los materiales higiénicos recomendados se adquieren en farmacias o supermercados habituales.*\n\n` +
            `1. **Lavado:** Lava el tatuaje 2-3 veces al día con agua tibia y jabón neutro sin perfume (pH neutro de farmacia). Seca a toques suaves con papel de cocina desechable, nunca con toalla.\n` +
            `2. **Hidratación:** Aplica una capa muy fina y transparente de pomada cicatrizante específica (como pomada con dexpantenol de farmacia). No satures la piel.\n` +
            `3. **Protección:** No te rasques las costras ni arranques pieles. Evita inmersión en agua (bañeras, piscinas, mar o saunas) durante los primeros 20-30 días.\n` +
            `4. **Revisión por foto:** Si tienes dudas sobre cómo evoluciona tu piel, pulsa el icono de la cámara 📷 en este chat y analizaré la foto para darte tranquilidad.`;
          break;

        default:
          faqText = `ℹ️ **Guía y Soporte de Tatoo:**\n\n` +
            `• **Para Clientes:** Consulta disponibilidad, calcula presupuestos en base a medidas en cm, reserva citas, firma consentimientos legales y revisa la curación por foto.\n` +
            `• **Para Tatuadores:** Dispones de tu propio asistente virtual para consultar tu agenda diaria, bloquear horas de descanso, revisar consentimientos de clientes y configurar tus tarifas.\n` +
            `• **Para Estudios:** Suscripción mensual de 50€/mes con Stripe para gestión integral de artistas, clientes y presencia en el mapa interactivo.\n\n` +
            `¿Tienes alguna duda concreta sobre alguna de estas funciones?`;
          break;
      }

      return {
        success: true,
        tool: 'get_app_faq',
        result: { topic, status: 'answered', respuesta_oficial: faqText },
        faqTopic: topic,
        displayText: faqText
      };
    }

    default:
      return {
        success: false,
        tool: toolName,
        result: { error: 'Unknown tool' }
      };
  }
}

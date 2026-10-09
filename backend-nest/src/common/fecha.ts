/**
 * Paraguay usa UTC-3 fijo desde 2024 (sin horario de verano). El backend corre
 * en UTC (Vercel), asi que calcular "hoy" con `new Date().setHours(0,0,0,0)`
 * partia el dia a las 21:00 hora local: las ventas de la tarde/noche caian en
 * el dia siguiente. Estas funciones trabajan siempre con el dia calendario de
 * Paraguay y devuelven instantes UTC, que es como se guardan las fechas.
 */
const OFFSET_PARAGUAY_MS = 3 * 60 * 60 * 1000;

/** 00:00 hora Paraguay del dia de `ref`, expresado como instante UTC. */
export function inicioDiaParaguay(ref: Date = new Date()): Date {
  const local = new Date(ref.getTime() - OFFSET_PARAGUAY_MS);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 3, 0, 0, 0),
  );
}

/** Inicio del dia siguiente (00:00 hora Paraguay). */
export function finDiaParaguay(ref: Date = new Date()): Date {
  return new Date(inicioDiaParaguay(ref).getTime() + 24 * 60 * 60 * 1000);
}

/** Rango `[hoy, manana)` del dia Paraguay de `ref`. */
export function rangoDiaParaguay(ref: Date = new Date()): { hoy: Date; manana: Date } {
  const hoy = inicioDiaParaguay(ref);
  return { hoy, manana: new Date(hoy.getTime() + 24 * 60 * 60 * 1000) };
}

/** Clave `YYYY-MM-DD` del dia Paraguay al que pertenece el instante `d`. */
export function claveDiaParaguay(d: Date): string {
  const local = new Date(d.getTime() - OFFSET_PARAGUAY_MS);
  return local.toISOString().slice(0, 10);
}

/** Clave `YYYY-MM-DD` del dia Paraguay de hoy menos `diasAtras`. */
export function fechaParaguayISO(diasAtras = 0, ref: Date = new Date()): string {
  const base = new Date(inicioDiaParaguay(ref).getTime() - diasAtras * 24 * 60 * 60 * 1000);
  return claveDiaParaguay(base);
}

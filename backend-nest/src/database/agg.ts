import { sql } from 'kysely';

/**
 * COUNT(*) devuelve bigint y node-postgres lo entrega como string, lo que
 * rompe comparaciones estrictas (`Number("0") === 0`). Castear a int hace que
 * el driver lo entregue como number en todos los puntos de lectura.
 */
export const countInt = (alias = 'c') => sql<number>`count(*)::int`.as(alias);

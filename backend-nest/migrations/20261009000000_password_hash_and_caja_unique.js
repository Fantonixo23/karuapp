/* Fase 3 + robustez de negocio.
 *
 * 1) Separa la contrasena (`password_hash`) del PIN (`pin`). Hasta ahora
 *    `registerSaas` guardaba el hash de la contrasena en `usuarios.pin`, asi que
 *    el login por PIN aceptaba la contrasena del dueño como PIN. Se mueve el
 *    hash bcrypt de los roles con login por email (`administrador`,
 *    `superadmin`) a `password_hash` y se deja `pin` en NULL: esos roles pasan a
 *    entrar solo con email + contrasena.
 * 2) Quita el indice unico `(restaurante_id, pin)`: con bcrypt nunca coincide y
 *    no aportaba nada.
 * 3) Garantiza una sola sesion de caja abierta por restaurante con un indice
 *    unico parcial. Antes de crearlo cierra cualquier duplicado (deja la mas
 *    reciente abierta) para no romper la migracion sobre datos existentes.
 */

exports.up = async (pgm) => {
  pgm.addColumn('usuarios', { password_hash: { type: 'text' } });

  pgm.sql(`
    UPDATE usuarios
       SET password_hash = pin,
           pin = NULL
     WHERE rol IN ('administrador', 'superadmin')
       AND pin IS NOT NULL
       AND pin ~ '^\\$2[aby]?\\$[0-9]{2}\\$';
  `);

  pgm.sql(`DROP INDEX IF EXISTS usuarios_restaurante_id_pin_key;`);

  pgm.sql(`
    UPDATE caja_sesiones s
       SET estado = 'cerrada',
           cierre_en = COALESCE(s.cierre_en, now()),
           notas_cierre = CASE
             WHEN s.notas_cierre = '' THEN 'Cerrada automaticamente por migracion'
             ELSE s.notas_cierre
           END
     WHERE s.estado = 'abierta'
       AND s.id NOT IN (
         SELECT DISTINCT ON (restaurante_id) id
           FROM caja_sesiones
          WHERE estado = 'abierta'
          ORDER BY restaurante_id, apertura_en DESC, id DESC
       );
  `);

  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS caja_sesiones_una_abierta
      ON caja_sesiones (restaurante_id)
      WHERE estado = 'abierta';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS caja_sesiones_una_abierta;`);
  pgm.sql(`
    UPDATE usuarios
       SET pin = password_hash
     WHERE password_hash IS NOT NULL
       AND pin IS NULL;
  `);
  pgm.dropColumn('usuarios', 'password_hash');
};

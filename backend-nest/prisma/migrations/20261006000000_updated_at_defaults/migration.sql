-- Prisma gestionaba @updatedAt desde el cliente, por lo que estas columnas
-- quedaron NOT NULL sin DEFAULT. Al eliminar Prisma, los inserts dejan de
-- mandar el valor y violarian la restriccion. El default pasa a la base,
-- igual que created_at.
--
-- En los UPDATE el servicio sigue fijando updated_at explicitamente.

ALTER TABLE "configuracion" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "mesas"         ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "pedidos"       ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "productos"     ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "restaurantes"  ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "usuarios"      ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

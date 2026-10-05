-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "restaurantes" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "fecha_alta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_expiracion" TIMESTAMP(3),
    "estado_licencia" TEXT NOT NULL DEFAULT 'activo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "motivo_bloqueo" TEXT,

    CONSTRAINT "restaurantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "restaurante_id" INTEGER,
    "nombre" TEXT NOT NULL,
    "pin" TEXT,
    "rol" TEXT NOT NULL DEFAULT 'mesero',
    "telefono" TEXT,
    "email" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "creado_por_id" INTEGER,
    "ultimo_acceso" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "blocked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" SERIAL NOT NULL,
    "restaurante_id" INTEGER,
    "nombre" TEXT NOT NULL,
    "icono" TEXT NOT NULL DEFAULT 'category',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" SERIAL NOT NULL,
    "restaurante_id" INTEGER,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio" INTEGER NOT NULL,
    "categoria_id" INTEGER,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "imagen" TEXT,
    "imagen_archivo" TEXT,
    "variantes" JSONB,
    "iva" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesas" (
    "id" SERIAL NOT NULL,
    "restaurante_id" INTEGER,
    "numero" INTEGER NOT NULL,
    "nombre" TEXT,
    "capacidad" INTEGER NOT NULL DEFAULT 4,
    "area" TEXT NOT NULL DEFAULT 'principal',
    "estado" TEXT NOT NULL DEFAULT 'disponible',
    "comensales" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mesas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" SERIAL NOT NULL,
    "restaurante_id" INTEGER,
    "mesa_id" INTEGER,
    "mesero_id" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "delivery" BOOLEAN NOT NULL DEFAULT false,
    "nombre_cliente" TEXT,
    "telefono_cliente" TEXT,
    "direccion" TEXT,
    "tipo_pedido" TEXT NOT NULL DEFAULT 'mesa',
    "notas" TEXT,
    "items" JSONB NOT NULL DEFAULT '[]',
    "total" INTEGER NOT NULL DEFAULT 0,
    "metodo_pago" TEXT NOT NULL DEFAULT 'efectivo',
    "sincronizado" BOOLEAN NOT NULL DEFAULT true,
    "numero_orden" TEXT,
    "propina" INTEGER NOT NULL DEFAULT 0,
    "comprobante_nro" TEXT,
    "marca_tarjeta" TEXT,
    "marca_qr" TEXT,
    "cuotas" INTEGER NOT NULL DEFAULT 1,
    "ultimos_4" TEXT,
    "detalle_pagos" JSONB,
    "cliente_tipo" TEXT NOT NULL DEFAULT 'consumidor',
    "cliente_ruc" TEXT NOT NULL DEFAULT '44444444-7',
    "cliente_nombre" TEXT NOT NULL DEFAULT 'Consumidor Final',
    "generar_comanda" BOOLEAN NOT NULL DEFAULT false,
    "generar_factura" BOOLEAN NOT NULL DEFAULT false,
    "tipo_iva" INTEGER NOT NULL DEFAULT 10,
    "motivo_cancelacion" TEXT,
    "cancelado_en_estado" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impresiones" (
    "id" SERIAL NOT NULL,
    "pedido_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "numero_impresion" INTEGER NOT NULL DEFAULT 1,
    "restaurante_id" INTEGER,
    "impresion_id" TEXT NOT NULL,
    "usuario_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impresiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion" (
    "id" SERIAL NOT NULL,
    "restaurante_id" INTEGER,
    "nombre_empresa" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "direccion" TEXT,
    "telefono" TEXT,
    "tasa_iva" INTEGER NOT NULL DEFAULT 10,
    "timbrado_numero" TEXT NOT NULL DEFAULT '001-001-0000001',
    "establecimiento" TEXT NOT NULL DEFAULT '001',
    "punto_expedicion" TEXT NOT NULL DEFAULT '001',
    "estado" TEXT NOT NULL DEFAULT 'demo',
    "fecha_inicio" TIMESTAMP(3),
    "fecha_vencimiento" TIMESTAMP(3),
    "tamano_papel" TEXT NOT NULL DEFAULT '58mm',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timbrados" (
    "id" SERIAL NOT NULL,
    "restaurante_id" INTEGER,
    "establecimiento" TEXT NOT NULL DEFAULT '001',
    "punto_expedicion" TEXT NOT NULL DEFAULT '001',
    "numero_inicio" INTEGER NOT NULL,
    "numero_fin" INTEGER NOT NULL,
    "numero_actual" INTEGER NOT NULL DEFAULT 0,
    "fecha_vencimiento" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timbrados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas" (
    "id" SERIAL NOT NULL,
    "restaurante_id" INTEGER,
    "numero" TEXT NOT NULL,
    "pedido_id" INTEGER,
    "ruc_cliente" TEXT NOT NULL,
    "nombre_cliente" TEXT NOT NULL,
    "xml" TEXT NOT NULL DEFAULT '',
    "cdc" TEXT NOT NULL DEFAULT '',
    "kude" TEXT NOT NULL DEFAULT '',
    "qr_base64" TEXT NOT NULL DEFAULT '',
    "sifen_estado" TEXT NOT NULL DEFAULT 'pendiente',
    "sifen_mensaje" TEXT NOT NULL DEFAULT '',
    "protocolo" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "total" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metodos_pago" (
    "id" SERIAL NOT NULL,
    "restaurante_id" INTEGER,
    "nombre" TEXT NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "icono" TEXT NOT NULL DEFAULT 'payments',
    "color" TEXT NOT NULL DEFAULT '#4CAF50',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "metodos_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caja_sesiones" (
    "id" SERIAL NOT NULL,
    "restaurante_id" INTEGER NOT NULL,
    "usuario_id" INTEGER,
    "fondo_inicial" INTEGER NOT NULL DEFAULT 0,
    "apertura_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cierre_en" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'abierta',
    "notas_apertura" TEXT NOT NULL DEFAULT '',
    "notas_cierre" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caja_sesiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caja_movimientos" (
    "id" SERIAL NOT NULL,
    "restaurante_id" INTEGER NOT NULL,
    "session_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'venta',
    "metodo_pago" TEXT NOT NULL DEFAULT 'efectivo',
    "monto" INTEGER NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PYG',
    "monto_pyg" INTEGER NOT NULL,
    "pedido_id" INTEGER,
    "detalle_pagos" JSONB,
    "motivo" TEXT NOT NULL DEFAULT '',
    "usuario_id" INTEGER,
    "propina" INTEGER NOT NULL DEFAULT 0,
    "vuelto" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caja_movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caja_cortes" (
    "id" SERIAL NOT NULL,
    "restaurante_id" INTEGER NOT NULL,
    "session_id" INTEGER NOT NULL,
    "usuario_cierre_id" INTEGER,
    "fondo_inicial" INTEGER NOT NULL,
    "total_ventas_efectivo" INTEGER NOT NULL DEFAULT 0,
    "total_ventas_tarjeta" INTEGER NOT NULL DEFAULT 0,
    "total_ventas_transferencia" INTEGER NOT NULL DEFAULT 0,
    "total_ventas_qr" INTEGER NOT NULL DEFAULT 0,
    "total_ingresos_extra" INTEGER NOT NULL DEFAULT 0,
    "total_retiros" INTEGER NOT NULL DEFAULT 0,
    "total_propinas" INTEGER NOT NULL DEFAULT 0,
    "total_ventas" INTEGER NOT NULL DEFAULT 0,
    "denominaciones" JSONB,
    "total_contado_efectivo" INTEGER NOT NULL DEFAULT 0,
    "total_esperado" INTEGER NOT NULL DEFAULT 0,
    "diferencia" INTEGER NOT NULL DEFAULT 0,
    "tipo_diferencia" TEXT NOT NULL DEFAULT '',
    "observaciones" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caja_cortes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventario" (
    "id" SERIAL NOT NULL,
    "restaurante_id" INTEGER,
    "producto_id" INTEGER NOT NULL,
    "stock_actual" INTEGER NOT NULL DEFAULT 0,
    "stock_minimo" INTEGER NOT NULL DEFAULT 5,
    "unidad_medida" TEXT NOT NULL DEFAULT 'und',
    "precio_costo" INTEGER NOT NULL DEFAULT 0,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_inventario" (
    "id" SERIAL NOT NULL,
    "restaurante_id" INTEGER,
    "inventario_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "motivo" TEXT,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_licencia" (
    "id" SERIAL NOT NULL,
    "restaurante_id" INTEGER NOT NULL,
    "monto" DECIMAL(12,0) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PYG',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nota" TEXT,
    "registrado_por" INTEGER,

    CONSTRAINT "pagos_licencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "restaurantes_slug_key" ON "restaurantes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_restaurante_id_pin_key" ON "usuarios"("restaurante_id", "pin");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "mesas_restaurante_id_numero_key" ON "mesas"("restaurante_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "impresiones_restaurante_id_impresion_id_key" ON "impresiones"("restaurante_id", "impresion_id");

-- CreateIndex
CREATE UNIQUE INDEX "metodos_pago_restaurante_id_nombre_key" ON "metodos_pago"("restaurante_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "inventario_producto_id_key" ON "inventario"("producto_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "restaurantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "restaurantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "restaurantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesas" ADD CONSTRAINT "mesas_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "restaurantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "restaurantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_mesa_id_fkey" FOREIGN KEY ("mesa_id") REFERENCES "mesas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_mesero_id_fkey" FOREIGN KEY ("mesero_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impresiones" ADD CONSTRAINT "impresiones_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impresiones" ADD CONSTRAINT "impresiones_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "restaurantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impresiones" ADD CONSTRAINT "impresiones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracion" ADD CONSTRAINT "configuracion_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "restaurantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timbrados" ADD CONSTRAINT "timbrados_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "restaurantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "restaurantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metodos_pago" ADD CONSTRAINT "metodos_pago_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "restaurantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_sesiones" ADD CONSTRAINT "caja_sesiones_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "restaurantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_sesiones" ADD CONSTRAINT "caja_sesiones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_movimientos" ADD CONSTRAINT "caja_movimientos_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "restaurantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_movimientos" ADD CONSTRAINT "caja_movimientos_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "caja_sesiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_movimientos" ADD CONSTRAINT "caja_movimientos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_movimientos" ADD CONSTRAINT "caja_movimientos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_cortes" ADD CONSTRAINT "caja_cortes_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "restaurantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_cortes" ADD CONSTRAINT "caja_cortes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "caja_sesiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_cortes" ADD CONSTRAINT "caja_cortes_usuario_cierre_id_fkey" FOREIGN KEY ("usuario_cierre_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "restaurantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "restaurantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_inventario_id_fkey" FOREIGN KEY ("inventario_id") REFERENCES "inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_licencia" ADD CONSTRAINT "pagos_licencia_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "restaurantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


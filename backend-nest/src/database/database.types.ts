import { ColumnType, Insertable, Selectable, Updateable } from 'kysely';

export type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
export type NullableTimestamp = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
export type Json = ColumnType<JsonValue, JsonValue, JsonValue>;

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** numeric(12,0): pg lo devuelve como string. */
export type Decimal = ColumnType<string, string | number, string | number>;

export interface DB {
  restaurantes: {
    id: ColumnType<number, number | undefined, number>;
    nombre: string;
    slug: string;
    activo: ColumnType<boolean, boolean | undefined, boolean>;
    plan: ColumnType<string, string | undefined, string>;
    fecha_alta: Timestamp;
    fecha_expiracion: NullableTimestamp;
    estado_licencia: ColumnType<string, string | undefined, string>;
    created_at: Timestamp;
    updated_at: Timestamp;
    motivo_bloqueo: string | null;
  };

  usuarios: {
    id: ColumnType<number, number | undefined, number>;
    restaurante_id: number | null;
    nombre: string;
    pin: string | null;
    rol: ColumnType<string, string | undefined, string>;
    telefono: string | null;
    email: string | null;
    activo: ColumnType<boolean, boolean | undefined, boolean>;
    verificado: ColumnType<boolean, boolean | undefined, boolean>;
    creado_por_id: number | null;
    ultimo_acceso: NullableTimestamp;
    created_at: Timestamp;
    updated_at: Timestamp;
  };

  verification_codes: {
    id: ColumnType<number, number | undefined, number>;
    email: string;
    code: string;
    purpose: string;
    expires_at: Timestamp;
    used: ColumnType<boolean, boolean | undefined, boolean>;
    attempts: ColumnType<number, number | undefined, number>;
    blocked_until: NullableTimestamp;
    created_at: Timestamp;
  };

  categorias: {
    id: ColumnType<number, number | undefined, number>;
    restaurante_id: number | null;
    nombre: string;
    icono: ColumnType<string, string | undefined, string>;
    orden: ColumnType<number, number | undefined, number>;
    created_at: Timestamp;
  };

  productos: {
    id: ColumnType<number, number | undefined, number>;
    restaurante_id: number | null;
    nombre: string;
    descripcion: string | null;
    precio: number;
    categoria_id: number | null;
    disponible: ColumnType<boolean, boolean | undefined, boolean>;
    imagen: string | null;
    imagen_archivo: string | null;
    variantes: Json | null;
    iva: ColumnType<number, number | undefined, number>;
    created_at: Timestamp;
    updated_at: Timestamp;
  };

  mesas: {
    id: ColumnType<number, number | undefined, number>;
    restaurante_id: number | null;
    numero: number;
    nombre: string | null;
    capacidad: ColumnType<number, number | undefined, number>;
    area: ColumnType<string, string | undefined, string>;
    estado: ColumnType<string, string | undefined, string>;
    comensales: ColumnType<number, number | undefined, number>;
    created_at: Timestamp;
    updated_at: Timestamp;
  };

  pedidos: {
    id: ColumnType<number, number | undefined, number>;
    restaurante_id: number | null;
    mesa_id: number | null;
    mesero_id: number | null;
    estado: ColumnType<string, string | undefined, string>;
    delivery: ColumnType<boolean, boolean | undefined, boolean>;
    nombre_cliente: string | null;
    telefono_cliente: string | null;
    direccion: string | null;
    tipo_pedido: ColumnType<string, string | undefined, string>;
    notas: string | null;
    items: Json;
    total: ColumnType<number, number | undefined, number>;
    metodo_pago: ColumnType<string, string | undefined, string>;
    sincronizado: ColumnType<boolean, boolean | undefined, boolean>;
    numero_orden: string | null;
    propina: ColumnType<number, number | undefined, number>;
    comprobante_nro: string | null;
    marca_tarjeta: string | null;
    marca_qr: string | null;
    cuotas: ColumnType<number, number | undefined, number>;
    ultimos_4: string | null;
    detalle_pagos: Json | null;
    cliente_tipo: ColumnType<string, string | undefined, string>;
    cliente_ruc: ColumnType<string, string | undefined, string>;
    cliente_nombre: ColumnType<string, string | undefined, string>;
    generar_comanda: ColumnType<boolean, boolean | undefined, boolean>;
    generar_factura: ColumnType<boolean, boolean | undefined, boolean>;
    tipo_iva: ColumnType<number, number | undefined, number>;
    motivo_cancelacion: string | null;
    cancelado_en_estado: string | null;
    created_at: Timestamp;
    updated_at: Timestamp;
  };

  impresiones: {
    id: ColumnType<number, number | undefined, number>;
    pedido_id: number;
    tipo: string;
    numero_impresion: ColumnType<number, number | undefined, number>;
    restaurante_id: number | null;
    impresion_id: string;
    usuario_id: number | null;
    created_at: Timestamp;
  };

  configuracion: {
    id: ColumnType<number, number | undefined, number>;
    restaurante_id: number | null;
    nombre_empresa: string;
    ruc: string;
    direccion: string | null;
    telefono: string | null;
    tasa_iva: ColumnType<number, number | undefined, number>;
    timbrado_numero: ColumnType<string, string | undefined, string>;
    establecimiento: ColumnType<string, string | undefined, string>;
    punto_expedicion: ColumnType<string, string | undefined, string>;
    estado: ColumnType<string, string | undefined, string>;
    fecha_inicio: NullableTimestamp;
    fecha_vencimiento: NullableTimestamp;
    tamano_papel: ColumnType<string, string | undefined, string>;
    created_at: Timestamp;
    updated_at: Timestamp;
  };

  timbrados: {
    id: ColumnType<number, number | undefined, number>;
    restaurante_id: number | null;
    establecimiento: ColumnType<string, string | undefined, string>;
    punto_expedicion: ColumnType<string, string | undefined, string>;
    numero_inicio: ColumnType<number, number | undefined, number>;
    numero_fin: ColumnType<number, number | undefined, number>;
    numero_actual: ColumnType<number, number | undefined, number>;
    fecha_vencimiento: Timestamp;
    activo: ColumnType<boolean, boolean | undefined, boolean>;
    created_at: Timestamp;
    updated_at: Timestamp;
  };

  facturas: {
    id: ColumnType<number, number | undefined, number>;
    restaurante_id: number | null;
    numero: string;
    pedido_id: number | null;
    ruc_cliente: string;
    nombre_cliente: string;
    xml: ColumnType<string, string | undefined, string>;
    cdc: ColumnType<string, string | undefined, string>;
    kude: ColumnType<string, string | undefined, string>;
    qr_base64: ColumnType<string, string | undefined, string>;
    sifen_estado: ColumnType<string, string | undefined, string>;
    sifen_mensaje: ColumnType<string, string | undefined, string>;
    protocolo: ColumnType<string, string | undefined, string>;
    estado: ColumnType<string, string | undefined, string>;
    total: number;
    created_at: Timestamp;
    updated_at: Timestamp;
  };

  metodos_pago: {
    id: ColumnType<number, number | undefined, number>;
    restaurante_id: number | null;
    nombre: string;
    etiqueta: string;
    icono: ColumnType<string, string | undefined, string>;
    color: ColumnType<string, string | undefined, string>;
    activo: ColumnType<boolean, boolean | undefined, boolean>;
    orden: ColumnType<number, number | undefined, number>;
  };

  caja_sesiones: {
    id: ColumnType<number, number | undefined, number>;
    restaurante_id: number;
    usuario_id: number | null;
    fondo_inicial: ColumnType<number, number | undefined, number>;
    apertura_en: Timestamp;
    cierre_en: NullableTimestamp;
    estado: ColumnType<string, string | undefined, string>;
    notas_apertura: ColumnType<string, string | undefined, string>;
    notas_cierre: ColumnType<string, string | undefined, string>;
    created_at: Timestamp;
    updated_at: Timestamp;
  };

  caja_movimientos: {
    id: ColumnType<number, number | undefined, number>;
    restaurante_id: number;
    session_id: number;
    tipo: ColumnType<string, string | undefined, string>;
    metodo_pago: ColumnType<string, string | undefined, string>;
    monto: number;
    moneda: ColumnType<string, string | undefined, string>;
    monto_pyg: number;
    pedido_id: number | null;
    detalle_pagos: Json | null;
    motivo: ColumnType<string, string | undefined, string>;
    usuario_id: number | null;
    propina: ColumnType<number, number | undefined, number>;
    vuelto: ColumnType<number, number | undefined, number>;
    created_at: Timestamp;
  };

  caja_cortes: {
    id: ColumnType<number, number | undefined, number>;
    restaurante_id: number;
    session_id: number;
    usuario_cierre_id: number | null;
    fondo_inicial: ColumnType<number, number | undefined, number>;
    total_ventas_efectivo: ColumnType<number, number | undefined, number>;
    total_ventas_tarjeta: ColumnType<number, number | undefined, number>;
    total_ventas_transferencia: ColumnType<number, number | undefined, number>;
    total_ventas_qr: ColumnType<number, number | undefined, number>;
    total_ingresos_extra: ColumnType<number, number | undefined, number>;
    total_retiros: ColumnType<number, number | undefined, number>;
    total_propinas: ColumnType<number, number | undefined, number>;
    total_ventas: ColumnType<number, number | undefined, number>;
    denominaciones: Json | null;
    total_contado_efectivo: ColumnType<number, number | undefined, number>;
    total_esperado: ColumnType<number, number | undefined, number>;
    diferencia: ColumnType<number, number | undefined, number>;
    tipo_diferencia: ColumnType<string, string | undefined, string>;
    observaciones: ColumnType<string, string | undefined, string>;
    created_at: Timestamp;
  };

  inventario: {
    id: ColumnType<number, number | undefined, number>;
    restaurante_id: number | null;
    producto_id: number;
    stock_actual: ColumnType<number, number | undefined, number>;
    stock_minimo: ColumnType<number, number | undefined, number>;
    unidad_medida: ColumnType<string, string | undefined, string>;
    precio_costo: ColumnType<number, number | undefined, number>;
    fecha_actualizacion: Timestamp;
    created_at: Timestamp;
  };

  movimientos_inventario: {
    id: ColumnType<number, number | undefined, number>;
    restaurante_id: number | null;
    inventario_id: number;
    tipo: string;
    cantidad: number;
    motivo: string | null;
    notas: string | null;
    created_at: Timestamp;
  };

  pagos_licencia: {
    id: ColumnType<number, number | undefined, number>;
    restaurante_id: number;
    monto: Decimal;
    moneda: ColumnType<string, string | undefined, string>;
    fecha: Timestamp;
    nota: string | null;
    registrado_por: number | null;
  };
}

type Tablas = keyof DB;

export type Fila<T extends Tablas> = Selectable<DB[T]>;
export type Nuevo<T extends Tablas> = Insertable<DB[T]>;
export type Actualizar<T extends Tablas> = Updateable<DB[T]>;

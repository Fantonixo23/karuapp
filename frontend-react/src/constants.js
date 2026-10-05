export const ALL_AREAS = [
  { path: '/app/mesas', icon: 'table_restaurant', label: 'Mesas', desc: 'Gestionar mesas', modulo: 'mesas' },
  { path: '/app/cocina', icon: 'restaurant', label: 'Cocina', desc: 'Pedidos en cocina', modulo: 'cocina' },
  { path: '/app/caja', icon: 'point_of_sale', label: 'Caja', desc: 'Cobros y facturas', modulo: 'caja' },
  { path: '/app/delivery', icon: 'delivery_dining', label: 'Delivery', desc: 'Pedidos a domicilio', modulo: 'delivery' },
  { path: '/app/informes', icon: 'analytics', label: 'Informes', desc: 'Reportes y ventas', modulo: 'informes' },
  { path: '/app/productos', icon: 'inventory_2', label: 'Productos', desc: 'Catalogo y stock', modulo: 'productos' },
  { path: '/app/inventario', icon: 'warehouse', label: 'Inventario', desc: 'Control de stock', modulo: 'inventario' },
  { path: '/app/funcionarios', icon: 'badge', label: 'Funcionarios', desc: 'Gestionar empleados', modulo: 'funcionarios' },
  { path: '/app/configuracion', icon: 'settings', label: 'Configuración', desc: 'Datos del negocio', modulo: 'configuracion' },
]

export const ROL_INFO = {
  administrador: { label: 'Administrador', color: '#F44336' },
  cajero: { label: 'Cajero', color: '#1976D2' },
  mesero: { label: 'Mesero', color: '#4CAF50' },
  cocina: { label: 'Cocina', color: '#FF9800' },
}

export const MODULOS_POR_ROL = {
  administrador: ['inicio', 'mesas', 'cocina', 'caja', 'delivery', 'informes', 'productos', 'inventario', 'funcionarios', 'configuracion'],
  cajero:        ['inicio', 'mesas', 'caja', 'delivery', 'cocina'],
  mesero:        ['inicio', 'mesas', 'cocina'],
  cocina:        ['inicio', 'cocina'],
}

export const MOBILE_HIDDEN_MODULES = ['caja', 'informes', 'configuracion', 'funcionarios']

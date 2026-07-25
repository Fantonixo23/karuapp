MODULOS_DISPONIBLES = [
    'mesas', 'cocina', 'caja', 'delivery',
    'informes', 'productos', 'inventario',
    'funcionarios', 'configuracion',
]

PERMISOS_POR_ROL = {
    'administrador': MODULOS_DISPONIBLES,
    'cajero': ['mesas', 'caja', 'delivery', 'cocina'],
    'mesero': ['mesas', 'cocina'],
    'cocina': ['cocina'],
}

ROLES_DISPONIBLES = [
    ('administrador', 'Administrador'),
    ('cajero', 'Cajero'),
    ('mesero', 'Mesero'),
    ('cocina', 'Cocina'),
]

ROLES_POR_MODULO = {}
for rol, modulos in PERMISOS_POR_ROL.items():
    for modulo in modulos:
        ROLES_POR_MODULO.setdefault(modulo, []).append(rol)

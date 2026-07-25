from django.urls import path
from .views import (
    lista_categorias,
    crear_categoria,
    modificar_categoria,
    eliminar_categoria,
    lista_productos,
    crear_producto,
    modificar_producto,
    eliminar_producto,
    toggle_producto,
    subir_imagen,
    limpiar_productos
)

urlpatterns = [
    # Categorías
    path('categorias', lista_categorias, name='lista_categorias'),
    path('categorias/crear', crear_categoria, name='crear_categoria'),
    path('categorias/<int:pk>/editar', modificar_categoria, name='modificar_categoria'),
    path('categorias/<int:pk>/eliminar', eliminar_categoria, name='eliminar_categoria'),
    
    # Productos
    path('productos', lista_productos, name='lista_productos'),
    path('productos/crear', crear_producto, name='crear_producto'),
    path('productos/limpiar', limpiar_productos, name='limpiar_productos'),
    path('productos/subir-imagen', subir_imagen, name='subir_imagen'),
    path('productos/<int:pk>/editar', modificar_producto, name='modificar_producto'),
    path('productos/<int:pk>/eliminar', eliminar_producto, name='eliminar_producto'),
    path('productos/<int:pk>/toggle', toggle_producto, name='toggle_producto'),
]
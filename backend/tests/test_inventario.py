import pytest
from decimal import Decimal
from apps.productos.models import Producto
from apps.inventario.models import Inventario, MovimientoInventario
from apps.pedidos.views import verificar_inventario, descontar_inventario


@pytest.mark.django_db
class TestVerificarInventario:
    def test_stock_suficiente(self):
        prod = Producto.objects.create(nombre='Test', precio=Decimal('10000'))
        Inventario.objects.create(producto=prod, stock_actual=10, stock_minimo=1)
        items = [{'producto_id': prod.id, 'cantidad': 5, 'precio': 10000}]
        verificar_inventario(items)

    def test_stock_exacto(self):
        prod = Producto.objects.create(nombre='Test', precio=Decimal('10000'))
        Inventario.objects.create(producto=prod, stock_actual=5, stock_minimo=1)
        items = [{'producto_id': prod.id, 'cantidad': 5, 'precio': 10000}]
        verificar_inventario(items)

    def test_stock_insuficiente(self):
        prod = Producto.objects.create(nombre='Pizza', precio=Decimal('35000'))
        Inventario.objects.create(producto=prod, stock_actual=2, stock_minimo=1)
        items = [{'producto_id': prod.id, 'cantidad': 5, 'precio': 35000}]
        with pytest.raises(Exception, match='Stock insuficiente para Pizza'):
            verificar_inventario(items)

    def test_sin_inventario_no_raise(self):
        prod = Producto.objects.create(nombre='Sin Inv', precio=Decimal('5000'))
        items = [{'producto_id': prod.id, 'cantidad': 5, 'precio': 5000}]
        verificar_inventario(items)

    def test_sin_producto_id_skip(self):
        items = [{'cantidad': 5, 'precio': 10000}]
        verificar_inventario(items)

    def test_stock_cero_raise(self):
        prod = Producto.objects.create(nombre='Coca', precio=Decimal('5000'))
        Inventario.objects.create(producto=prod, stock_actual=0, stock_minimo=1)
        items = [{'producto_id': prod.id, 'cantidad': 1, 'precio': 5000}]
        with pytest.raises(Exception, match='Stock insuficiente para Coca'):
            verificar_inventario(items)


@pytest.mark.django_db
class TestDescontarInventario:
    def test_descuento_basico(self):
        prod = Producto.objects.create(nombre='Test', precio=Decimal('10000'))
        inv = Inventario.objects.create(producto=prod, stock_actual=10, stock_minimo=1)
        items = [{'producto_id': prod.id, 'cantidad': 3, 'precio': 10000}]
        descontar_inventario(items)
        inv.refresh_from_db()
        assert inv.stock_actual == 7
        assert MovimientoInventario.objects.filter(inventario=inv, tipo='salida').count() == 1

    def test_descuento_multiple_items(self):
        p1 = Producto.objects.create(nombre='P1', precio=Decimal('10000'))
        p2 = Producto.objects.create(nombre='P2', precio=Decimal('5000'))
        i1 = Inventario.objects.create(producto=p1, stock_actual=10, stock_minimo=1)
        i2 = Inventario.objects.create(producto=p2, stock_actual=20, stock_minimo=1)
        items = [
            {'producto_id': p1.id, 'cantidad': 2, 'precio': 10000},
            {'producto_id': p2.id, 'cantidad': 5, 'precio': 5000},
        ]
        descontar_inventario(items)
        i1.refresh_from_db()
        i2.refresh_from_db()
        assert i1.stock_actual == 8
        assert i2.stock_actual == 15

    def test_stock_insuficiente_raise(self):
        prod = Producto.objects.create(nombre='Test', precio=Decimal('10000'))
        Inventario.objects.create(producto=prod, stock_actual=2, stock_minimo=1)
        items = [{'producto_id': prod.id, 'cantidad': 5, 'precio': 10000}]
        with pytest.raises(Exception, match='Stock insuficiente'):
            descontar_inventario(items)

    def test_sin_inventario_no_error(self):
        prod = Producto.objects.create(nombre='Sin Inv', precio=Decimal('5000'))
        items = [{'producto_id': prod.id, 'cantidad': 5, 'precio': 5000}]
        descontar_inventario(items)

    def test_sin_producto_id_skip(self):
        items = [{'cantidad': 5, 'precio': 10000}]
        descontar_inventario(items)

    def test_crea_movimiento_inventario(self):
        prod = Producto.objects.create(nombre='Test', precio=Decimal('10000'))
        inv = Inventario.objects.create(producto=prod, stock_actual=10, stock_minimo=1)
        items = [{'producto_id': prod.id, 'cantidad': 3, 'precio': 10000}]
        descontar_inventario(items)
        mov = MovimientoInventario.objects.filter(inventario=inv).first()
        assert mov is not None
        assert mov.tipo == 'salida'
        assert mov.cantidad == 3
        assert mov.motivo == 'venta'

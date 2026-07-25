import pytest
from apps.pedidos.models import transicion_valida, TRANSICIONES_VALIDAS


@pytest.mark.django_db
class TestTransicionValida:
    def test_transiciones_validas(self):
        casos = [
            ('pendiente', 'cocinando', True),
            ('pendiente', 'cancelado', True),
            ('cocinando', 'pendiente', True),
            ('cocinando', 'listo', True),
            ('cocinando', 'cancelado', True),
            ('listo', 'entregado', True),
            ('listo', 'cancelado', True),
            ('en_camino', 'entregado', True),
            ('en_camino', 'cancelado', True),
            ('entregado', 'pagado', True),
        ]
        for actual, nuevo, esperado in casos:
            assert transicion_valida(actual, nuevo) == esperado, f'{actual} -> {nuevo}'

    def test_transiciones_invalidas(self):
        casos = [
            ('pendiente', 'pagado', False),
            ('pendiente', 'listo', False),
            ('pendiente', 'entregado', False),
            ('cocinando', 'pagado', False),
            ('cocinando', 'entregado', False),
            ('listo', 'cocinando', False),
            ('listo', 'pagado', False),
            ('entregado', 'cancelado', False),
            ('entregado', 'listo', False),
            ('pagado', 'pendiente', False),
            ('pagado', 'cancelado', False),
            ('cancelado', 'pendiente', False),
            ('cancelado', 'cocinando', False),
        ]
        for actual, nuevo, esperado in casos:
            assert transicion_valida(actual, nuevo) == esperado, f'{actual} -> {nuevo}'

    def test_estado_inexistente(self):
        assert transicion_valida('inexistente', 'pendiente') is False
        assert transicion_valida('pendiente', 'inexistente') is False

    def test_todos_estados_definidos_en_transiciones(self):
        from apps.pedidos.models import ESTADOS_PEDIDO
        for estado, _ in ESTADOS_PEDIDO:
            assert estado in TRANSICIONES_VALIDAS, f'Estado {estado} falta en TRANSICIONES_VALIDAS'

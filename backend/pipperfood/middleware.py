import re
import logging
from django.http import JsonResponse
from django.db import connection, transaction

logger = logging.getLogger(__name__)


def _get_restaurante(request):
    if hasattr(request, 'restaurante') and request.restaurante:
        return request.restaurante
    if hasattr(request, 'restaurante_id') and request.restaurante_id:
        from apps.tenants.models import Restaurante
        try:
            request.restaurante = Restaurante.objects.get(id=request.restaurante_id, activo=True)
            return request.restaurante
        except Restaurante.DoesNotExist:
            pass
    return None


def _scope(request, qs, field='restaurante'):
    rest = _get_restaurante(request)
    if rest:
        return qs.filter(**{field: rest})
    return qs.none()


def _scope_get(request, model, pk, field='restaurante'):
    rest = _get_restaurante(request)
    if rest:
        return model.objects.filter(**{field: rest}).get(pk=pk)
    raise model.DoesNotExist(f'{model.__name__} no encontrado')


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _set_tenant_from_request(request)

        if connection.vendor == 'postgresql':
            restaurante_id = getattr(request, 'restaurante_id', None) or ''
            es_superadmin = bool(getattr(request, 'usuario_rol', None) == 'superadmin')

            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(
                        "SELECT set_config('app.current_restaurante_id', %s, true)",
                        [str(restaurante_id)],
                    )
                    cursor.execute(
                        "SELECT set_config('app.is_superadmin', %s, true)",
                        ['true' if es_superadmin else 'false'],
                    )
                return self.get_response(request)
        else:
            return self.get_response(request)


def _set_tenant_from_request(request):
    if hasattr(request, 'restaurante_id') and request.restaurante_id:
        from apps.tenants.models import Restaurante
        try:
            request.restaurante = Restaurante.objects.get(id=request.restaurante_id, activo=True)
        except Restaurante.DoesNotExist:
            pass
        return

    host = request.META.get('HTTP_HOST', '')
    slug = _resolver_slug(host, request)
    if slug:
        from apps.tenants.models import Restaurante
        try:
            rest = Restaurante.objects.get(slug=slug, activo=True)
            request.restaurante = rest
            request.restaurante_id = rest.id
        except Restaurante.DoesNotExist:
            logger.warning(f'Restaurante con slug "{slug}" no encontrado o inactivo')


def _resolver_slug(host, request):
    host = host.split(':')[0].lower().strip()

    if host in ('localhost', '127.0.0.1', '0.0.0.0'):
        slug = (request.GET.get('restaurante') or
                request.POST.get('restaurante') or
                request.COOKIES.get('restaurante'))
        if slug:
            return slug
        from apps.tenants.models import Restaurante
        primero = Restaurante.objects.filter(activo=True).first()
        if primero:
            return primero.slug
        return None

    partes = host.split('.')
    if len(partes) >= 3:
        return partes[0]

    return None

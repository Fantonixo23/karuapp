from django.urls import path
from .views import pedidos_cocina, tickets, cambiar_estado_cocina


urlpatterns = [
    path('cocina/pedidos/', pedidos_cocina, name='pedidos_cocina'),
    path('cocina/tickets/', tickets, name='tickets'),
    path('cocina/pedidos/<int:pk>/estado/', cambiar_estado_cocina, name='cambiar_estado_cocina'),
]
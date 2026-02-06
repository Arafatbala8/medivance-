from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.generics import RetrieveAPIView

from .models import Order
from .order_serializers import OrderCreateSerializer, OrderDetailSerializer, build_whatsapp_url


class CreateOrderView(APIView):
    def post(self, request):
        serializer = OrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()

        wa = build_whatsapp_url(order, getattr(settings, "WHATSAPP_NUMBER", "2348074000598"))

        return Response(
            {"order_id": order.id, "whatsapp_url": wa},
            status=status.HTTP_201_CREATED,
        )


class OrderDetailView(RetrieveAPIView):
    queryset = Order.objects.prefetch_related("items__product").all()
    serializer_class = OrderDetailSerializer
    lookup_field = "id"

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

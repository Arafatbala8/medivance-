from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from .models import Order


class UpdateOrderStatusView(APIView):
    def patch(self, request, id):
        order = get_object_or_404(Order, id=id)
        new_status = request.data.get("status")

        allowed = {
            Order.STATUS_UNPAID,
            Order.STATUS_PROOF_SENT,
            Order.STATUS_PAID,
            Order.STATUS_DELIVERED,
        }

        if new_status not in allowed:
            return Response(
                {"detail": f"Invalid status. Allowed: {sorted(list(allowed))}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order.status = new_status
        order.save(update_fields=["status"])
        return Response({"id": order.id, "status": order.status})

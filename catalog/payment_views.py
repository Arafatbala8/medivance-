from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404

from .models import Order, PaymentProof
from .payment_serializers import PaymentProofSerializer


class UploadPaymentProofView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, id):
        order = get_object_or_404(Order, id=id)

        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response({"detail": "file is required"}, status=status.HTTP_400_BAD_REQUEST)

        note = request.data.get("note", "")

        proof = PaymentProof.objects.create(order=order, file=uploaded, note=note)

        # update order status
        order.status = Order.STATUS_PROOF_SENT
        order.save(update_fields=["status"])

        ser = PaymentProofSerializer(proof, context={"request": request})
        return Response(ser.data, status=status.HTTP_201_CREATED)

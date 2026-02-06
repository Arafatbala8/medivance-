from rest_framework import serializers
from .models import PaymentProof


class PaymentProofSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = PaymentProof
        fields = ["id", "order", "note", "created_at", "file_url"]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if not obj.file:
            return None
        return request.build_absolute_uri(obj.file.url) if request else obj.file.url

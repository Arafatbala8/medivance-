from urllib.parse import quote
from rest_framework import serializers
from .models import Order, OrderItem, Product


def build_whatsapp_url(order: Order, whatsapp_number: str) -> str:
    lines = []
    lines.append("Hello, I want to place an order.")
    lines.append(f"Order ID: {order.id}")
    lines.append("")
    lines.append("Items:")

    for item in order.items.select_related("product").all():
        p = item.product
        lines.append(f"- {p.name} x{item.quantity} = ₦{p.price} each")

    lines.append("")
    lines.append(f"Name: {order.customer_name}")
    lines.append(f"Phone: {order.phone}")

    addr = (order.address or "").strip()
    if addr:
        lines.append(f"Address: {addr}")

    lines.append("")
    lines.append("Payment: Bank transfer (I will send proof here).")

    text = "\n".join(lines)
    return f"https://wa.me/{whatsapp_number}?text={quote(text)}"


class OrderItemSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(source="product.id", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = OrderItem
        fields = ["id", "product_id", "product_name", "quantity", "price_at_time"]


class OrderDetailSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    whatsapp_url = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "customer_name",
            "phone",
            "address",
            "status",
            "created_at",
            "items",
            "total_amount",
            "whatsapp_url",
        ]

    def get_whatsapp_url(self, obj):
        request = self.context.get("request")
        whatsapp_number = getattr(request, "WHATSAPP_NUMBER", None) if request else None
        # fallback if not present on request
        if not whatsapp_number:
            whatsapp_number = "2348074000598"
        return build_whatsapp_url(obj, whatsapp_number)

    def get_total_amount(self, obj):
        total = 0
        for item in obj.items.all():
            total += float(item.price_at_time) * int(item.quantity)
        return round(total, 2)


class OrderCreateItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class OrderCreateSerializer(serializers.Serializer):
    customer_name = serializers.CharField()
    phone = serializers.CharField()
    address = serializers.CharField(required=False, allow_blank=True)
    items = OrderCreateItemSerializer(many=True)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("Order must have at least 1 item.")
        return items

    def create(self, validated_data):
        items = validated_data.pop("items")

        order = Order.objects.create(
            customer_name=validated_data["customer_name"],
            phone=validated_data["phone"],
            address=validated_data.get("address", ""),
        )

        for it in items:
            product = Product.objects.get(id=it["product_id"])
            qty = int(it["quantity"])
            unit_price = product.price

            OrderItem.objects.create(
                order=order,
                product=product,
                quantity=qty,
                price_at_time=unit_price,
            )

        return order

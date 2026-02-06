from django.db import models


class Category(models.Model):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Product(models.Model):
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=240, unique=True)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    stock = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    image = models.ImageField(upload_to="products/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class Order(models.Model):
    STATUS_UNPAID = "UNPAID"
    STATUS_PROOF_SENT = "PROOF_SENT"
    STATUS_PAID = "PAID"
    STATUS_DELIVERED = "DELIVERED"

    STATUS_CHOICES = [
        (STATUS_UNPAID, "Unpaid"),
        (STATUS_PROOF_SENT, "Proof Sent"),
        (STATUS_PAID, "Paid"),
        (STATUS_DELIVERED, "Delivered"),
    ]

    customer_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=50)
    address = models.TextField(blank=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_UNPAID,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Order #{self.id} - {self.customer_name}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(default=1)

    # REQUIRED
    price_at_time = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"{self.product.name} x{self.quantity}"


class PaymentProof(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="payment_proofs",
    )
    file = models.FileField(upload_to="payment_proofs/")
    note = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Proof #{self.id} for Order {self.order.id}"

from django.contrib import admin
from .models import Order, OrderItem, PaymentProof, Product, Category


# -------- Order actions --------
@admin.action(description="Mark selected orders as PAID")
def mark_paid(modeladmin, request, queryset):
    queryset.update(status=Order.STATUS_PAID)


@admin.action(description="Mark selected orders as DELIVERED")
def mark_delivered(modeladmin, request, queryset):
    queryset.update(status=Order.STATUS_DELIVERED)


# ✅ Register Order ONLY ONCE (using decorator)
@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "customer_name", "phone", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("id", "customer_name", "phone")
    actions = [mark_paid, mark_delivered]


# Optional: show order items in admin
@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "product", "quantity", "price_at_time")
    search_fields = ("order__id", "product__name")


@admin.register(PaymentProof)
class PaymentProofAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "created_at")
    search_fields = ("order__id", "order__customer_name", "order__phone")


# If these are not registered yet, keep them. If already registered elsewhere, remove duplicates.
@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "price", "stock", "is_active")
    search_fields = ("name",)
    list_filter = ("is_active",)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug")
    search_fields = ("name", "slug")

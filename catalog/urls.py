from django.urls import path
from .views import ProductListView, CategoryListView
from .order_views import CreateOrderView, OrderDetailView
from .payment_views import UploadPaymentProofView
from .status_views import UpdateOrderStatusView

urlpatterns = [
    path("products/", ProductListView.as_view(), name="product-list"),
    path("categories/", CategoryListView.as_view(), name="category-list"),

    path("orders/", CreateOrderView.as_view(), name="order-create"),
    path("orders/<int:id>/", OrderDetailView.as_view(), name="order-detail"),
    path("orders/<int:id>/payment-proof/", UploadPaymentProofView.as_view(), name="upload-payment-proof"),
    path("orders/<int:id>/status/", UpdateOrderStatusView.as_view(), name="order-status"),
]

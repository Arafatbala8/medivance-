from rest_framework.generics import ListAPIView
from .models import Product, Category
from .serializers import ProductSerializer, CategorySerializer


class ProductListView(ListAPIView):
    queryset = Product.objects.select_related("category").filter(is_active=True)
    serializer_class = ProductSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx


class CategoryListView(ListAPIView):
    queryset = Category.objects.all().order_by("name")
    serializer_class = CategorySerializer

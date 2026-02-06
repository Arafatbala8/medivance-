from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.conf import settings
from django.conf.urls.static import static

from django.views.static import serve as static_serve

def home(request):
    return JsonResponse({
        "message": "MedStore backend is running ✅",
        "admin": "/admin/",
        "products_api": "/api/products/"
    })


urlpatterns = [
    path("", home, name="home"),
    path("admin/", admin.site.urls),
    path("api/", include("catalog.urls")),
]

urlpatterns += [
    path("media/<path:path>", static_serve, {"document_root": settings.MEDIA_ROOT}),
]


from django.http import JsonResponse

def home(request):
    return JsonResponse({
        "message": "MedStore backend is running ✅",
        "admin": "/admin/",
        "products_api": "/api/products/"
    })


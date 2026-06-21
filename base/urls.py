from django.urls import path

from .views import home, nearby_places, place_detail, search_places, submit_place

urlpatterns = [
    path('', home, name='home'),
    path('places/submit/', submit_place, name='submit_place'),
    path('places/<int:place_id>-<slug:slug>/', place_detail, name='place_detail'),
    path('api/places/search/', search_places, name='search_places'),
    path('api/places/nearby/', nearby_places, name='nearby_places'),
]

import math

from django.db.utils import OperationalError, ProgrammingError
from django.urls import reverse
from django.utils.text import slugify

from .models import Place


DEFAULT_CENTER_LAT = 12.37179580987164
DEFAULT_CENTER_LNG = 123.62357122296626
MIN_RADIUS_KM = 0.1
MAX_RADIUS_KM = 10
DEFAULT_RADIUS_KM = 1
DEFAULT_LIMIT = 10
MAX_LIMIT = 50
EARTH_RADIUS_KM = 6371


def public_places_queryset():
    return Place.objects.filter(is_public=True)


def place_slug(place):
    return slugify(f'{place.name} {place.category} masbate') or 'lugar-sa-masbate'


def place_detail_path(place):
    return reverse('place_detail', kwargs={'place_id': place.id, 'slug': place_slug(place)})


def serialize_place(place, *, distance_km=None):
    payload = {
        'name': place.name,
        'category': place.category,
        'rating': f'{place.rating:.1f} stars',
        'rating_value': f'{place.rating:.1f}',
        'lat': place.lat,
        'lng': place.lng,
        'address': place.address,
        'profile_url': place.profile.url if place.profile else '',
    }

    if distance_km is not None:
        payload['distance_km'] = round(distance_km, 3)

    return payload


def clamp_int(value, *, default, minimum, maximum):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default

    return max(minimum, min(parsed, maximum))


def clamp_float(value, *, default, minimum, maximum):
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default

    return max(minimum, min(parsed, maximum))


def parse_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def haversine_km(origin_lat, origin_lng, target_lat, target_lng):
    origin_lat_rad = math.radians(origin_lat)
    target_lat_rad = math.radians(target_lat)
    delta_lat_rad = math.radians(target_lat - origin_lat)
    delta_lng_rad = math.radians(target_lng - origin_lng)

    a = (
        math.sin(delta_lat_rad / 2) ** 2
        + math.cos(origin_lat_rad) * math.cos(target_lat_rad) * math.sin(delta_lng_rad / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_KM * c


def build_bounding_box(lat, lng, radius_km):
    lat_delta = radius_km / 111.32
    lng_scale = max(math.cos(math.radians(lat)), 0.01)
    lng_delta = radius_km / (111.32 * lng_scale)

    return {
        'min_lat': lat - lat_delta,
        'max_lat': lat + lat_delta,
        'min_lng': lng - lng_delta,
        'max_lng': lng + lng_delta,
    }


def get_default_center():
    try:
        first_place = public_places_queryset().only('lat', 'lng').order_by('id').first()
    except (OperationalError, ProgrammingError):
        first_place = None

    if first_place:
        return first_place.lat, first_place.lng

    return DEFAULT_CENTER_LAT, DEFAULT_CENTER_LNG

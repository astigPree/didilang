from django.db.models import Q
from django.db.utils import OperationalError, ProgrammingError
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .utils import (
    DEFAULT_LIMIT,
    DEFAULT_RADIUS_KM,
    MAX_LIMIT,
    MAX_RADIUS_KM,
    MIN_RADIUS_KM,
    build_bounding_box,
    clamp_float,
    clamp_int,
    get_default_center,
    haversine_km,
    parse_float,
    public_places_queryset,
    serialize_place,
)


def apply_text_search(queryset, query):
    if not query:
        return queryset

    return queryset.filter(
        Q(name__icontains=query) |
        Q(category__icontains=query)
    )


@require_GET
def search_places(request):
    query = (request.GET.get('q') or '').strip()
    limit = clamp_int(
        request.GET.get('limit'),
        default=20,
        minimum=1,
        maximum=MAX_LIMIT,
    )

    try:
        qs = apply_text_search(public_places_queryset(), query)
        places = list(qs.order_by('name')[:limit])
    except (OperationalError, ProgrammingError):
        places = []

    payload = [serialize_place(place) for place in places]

    return JsonResponse(
        {
            'query': query,
            'count': len(payload),
            'results': payload,
        }
    )


@require_GET
def nearby_places(request):
    query = (request.GET.get('q') or '').strip()
    limit = clamp_int(
        request.GET.get('limit'),
        default=DEFAULT_LIMIT,
        minimum=1,
        maximum=MAX_LIMIT,
    )
    radius_km = clamp_float(
        request.GET.get('radius'),
        default=DEFAULT_RADIUS_KM,
        minimum=MIN_RADIUS_KM,
        maximum=MAX_RADIUS_KM,
    )

    default_lat, default_lng = get_default_center()
    origin_lat = parse_float(request.GET.get('lat'))
    origin_lng = parse_float(request.GET.get('lng'))

    if origin_lat is None or origin_lng is None:
        origin_lat = default_lat
        origin_lng = default_lng
        using_default_center = True
    else:
        using_default_center = False

    ignore_radius = bool(query)

    try:
        qs = apply_text_search(public_places_queryset(), query)
        if not ignore_radius:
            bounds = build_bounding_box(origin_lat, origin_lng, radius_km)
            qs = qs.filter(
                lat__gte=bounds['min_lat'],
                lat__lte=bounds['max_lat'],
                lng__gte=bounds['min_lng'],
                lng__lte=bounds['max_lng'],
            )
        candidates = list(qs)
    except (OperationalError, ProgrammingError):
        candidates = []

    scored_results = []
    for place in candidates:
        distance_km = haversine_km(origin_lat, origin_lng, place.lat, place.lng)
        if ignore_radius or distance_km <= radius_km:
            scored_results.append((distance_km, place))

    if ignore_radius:
        scored_results.sort(key=lambda item: item[1].name.lower())
    else:
        scored_results.sort(key=lambda item: item[0])

    payload = [
        serialize_place(place, distance_km=distance_km)
        for distance_km, place in scored_results[:limit]
    ]

    return JsonResponse(
        {
            'query': query,
            'count': len(payload),
            'limit': limit,
            'radius_km': radius_km,
            'radius_applied': not ignore_radius,
            'using_default_center': using_default_center,
            'origin': {
                'lat': origin_lat,
                'lng': origin_lng,
            },
            'results': payload,
        }
    )

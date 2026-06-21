import json

from django.contrib import messages
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.templatetags.static import static
from django.urls import reverse

from .forms import PlaceSubmissionForm
from .models import CreatedBy, Place
from .utils import get_default_center, place_detail_path, place_slug, public_places_queryset


SITE_NAME = 'Didilang'
AREA_SERVED = 'Masbate, Philippines'


def build_seo_context(
    request,
    *,
    title,
    description,
    page_name,
    page_type='website',
    image_url=None,
    extra_structured_data=None,
):
    home_url = request.build_absolute_uri(reverse('home'))
    submit_url = request.build_absolute_uri(reverse('submit_place'))
    canonical_url = request.build_absolute_uri(request.path)
    logo_url = request.build_absolute_uri(static('assets/logo-with-text.png'))
    favicon_url = request.build_absolute_uri(static('assets/favicon.ico'))
    seo_image_url = image_url or logo_url

    structured_data = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Organization',
                '@id': f'{home_url}#organization',
                'name': SITE_NAME,
                'url': home_url,
                'logo': logo_url,
            },
            {
                '@type': 'WebSite',
                '@id': f'{home_url}#website',
                'name': SITE_NAME,
                'url': home_url,
                'inLanguage': 'tl-PH',
                'description': 'Community-powered local map para sa mga lugar sa Masbate.',
                'publisher': {'@id': f'{home_url}#organization'},
                'potentialAction': {
                    '@type': 'SearchAction',
                    'target': f'{home_url}?q={{search_term_string}}',
                    'query-input': 'required name=search_term_string',
                },
            },
            {
                '@type': 'WebPage',
                '@id': f'{canonical_url}#webpage',
                'url': canonical_url,
                'name': page_name,
                'description': description,
                'inLanguage': 'tl-PH',
                'isPartOf': {'@id': f'{home_url}#website'},
                'about': {
                    '@type': 'Place',
                    'name': AREA_SERVED,
                },
            },
        ],
    }

    if request.path == reverse('home'):
        structured_data['@graph'].append(
            {
                '@type': 'WebApplication',
                '@id': f'{home_url}#webapp',
                'name': 'Didilang Masbate Local Map',
                'url': home_url,
                'applicationCategory': 'TravelApplication',
                'operatingSystem': 'Any',
                'inLanguage': 'tl-PH',
                'areaServed': {
                    '@type': 'AdministrativeArea',
                    'name': AREA_SERVED,
                },
                'description': description,
            }
        )

    if extra_structured_data:
        if isinstance(extra_structured_data, list):
            structured_data['@graph'].extend(extra_structured_data)
        else:
            structured_data['@graph'].append(extra_structured_data)

    return {
        'seo_title': title,
        'seo_description': description,
        'seo_type': page_type,
        'canonical_url': canonical_url,
        'home_url': home_url,
        'submit_url': submit_url,
        'seo_image_url': seo_image_url,
        'favicon_url': favicon_url,
        'structured_data_json': json.dumps(structured_data, ensure_ascii=False),
    }


def home(request):
    center_lat, center_lng = get_default_center()
    seo_places = list(
        public_places_queryset()
        .filter(is_active=True)
        .only('id', 'name', 'category', 'rating', 'address', 'lat', 'lng', 'profile', 'updated_at')
        .order_by('-updated_at', 'name')[:20]
    )
    item_list = {
        '@type': 'ItemList',
        '@id': f'{request.build_absolute_uri(reverse("home"))}#masbate-places',
        'name': 'Mga lugar sa Masbate sa Didilang',
        'itemListElement': [
            {
                '@type': 'ListItem',
                'position': index,
                'name': place.name,
                'url': request.build_absolute_uri(place_detail_path(place)),
            }
            for index, place in enumerate(seo_places, start=1)
        ],
    }

    context = {
        'center_lat': center_lat,
        'center_lng': center_lng,
        'seo_places': seo_places,
        'seo_place_links': [
            {
                'place': place,
                'path': place_detail_path(place),
            }
            for place in seo_places
        ],
        **build_seo_context(
            request,
            title='Maghanap ng mga Lugar sa Masbate | Didilang Local Map',
            description=(
                'Masbate looking? Gamitin ang Didilang para maghanap ng kainan, barberya, '
                'laundry, tindahan, serbisyo, at iba pang lugar sa Masbate gamit ang local map.'
            ),
            page_name='Didilang Local Map para sa Masbate',
            extra_structured_data=item_list,
        ),
    }
    return render(request, 'public/home.html', context)


def place_detail(request, place_id, slug):
    place = get_object_or_404(
        public_places_queryset().filter(is_active=True),
        id=place_id,
    )
    canonical_path = place_detail_path(place)
    if slug != place_slug(place):
        return redirect(canonical_path, permanent=True)

    place_url = request.build_absolute_uri(canonical_path)
    image_url = request.build_absolute_uri(place.profile.url) if place.profile else None
    description = (
        f'{place.name} sa Masbate: {place.category} na matatagpuan sa {place.address}. '
        f'Tingnan ang rating, lokasyon, at detalye sa Didilang local map.'
    )
    place_structured_data = {
        '@type': 'Place',
        '@id': f'{place_url}#place',
        'name': place.name,
        'url': place_url,
        'description': description,
        'address': {
            '@type': 'PostalAddress',
            'streetAddress': place.address,
            'addressLocality': 'Masbate',
            'addressCountry': 'PH',
        },
        'geo': {
            '@type': 'GeoCoordinates',
            'latitude': place.lat,
            'longitude': place.lng,
        },
    }
    if image_url:
        place_structured_data['image'] = image_url

    context = {
        'place': place,
        'place_url': place_url,
        'map_query': f'{place.lat},{place.lng}',
        **build_seo_context(
            request,
            title=f'{place.name} sa Masbate | {place.category} | Didilang',
            description=description,
            page_name=f'{place.name} sa Masbate',
            image_url=image_url,
            extra_structured_data=place_structured_data,
        ),
    }
    return render(request, 'public/place_detail.html', context)


def submit_place(request):
    center_lat, center_lng = get_default_center()
    is_ajax = request.headers.get('x-requested-with') == 'XMLHttpRequest'

    if request.method == 'POST':
        form = PlaceSubmissionForm(request.POST, request.FILES)
        if form.is_valid():
            submitter = CreatedBy.objects.create(
                name=form.cleaned_data['submitter_name'],
                email=form.cleaned_data.get('submitter_email') or '',
                facebook=form.cleaned_data.get('submitter_facebook') or '',
            )
            Place.objects.create(
                name=form.cleaned_data['name'],
                category=form.cleaned_data['category'],
                rating=form.cleaned_data['rating'],
                lat=form.cleaned_data['lat'],
                lng=form.cleaned_data['lng'],
                address=form.cleaned_data['address'],
                profile=form.cleaned_data['profile'],
                created_by=submitter,
                is_public=False,
                is_active=True,
            )
            success_message = (
                'Na-submit ang lugar. Iche-check muna ito ng owner at kokontakin ka sa email o Facebook na nilagay mo.'
            )

            if is_ajax:
                return JsonResponse(
                    {
                        'ok': True,
                        'message': success_message,
                    }
                )

            messages.success(request, success_message)
            return redirect('submit_place')

        if is_ajax:
            errors = {field: [str(item) for item in items] for field, items in form.errors.items()}
            return JsonResponse(
                {
                    'ok': False,
                    'errors': errors,
                },
                status=400,
            )
    else:
        form = PlaceSubmissionForm()

    context = {
        'center_lat': center_lat,
        'center_lng': center_lng,
        'form': form,
        **build_seo_context(
            request,
            title='Magdagdag ng Lugar sa Masbate | Didilang',
            description=(
                'Magsumite ng bagong lugar sa Masbate sa Didilang. Idagdag ang pangalan, '
                'kategorya, rating, larawan, address, at eksaktong lokasyon sa mapa.'
            ),
            page_name='Magdagdag ng Lugar sa Masbate',
        ),
    }
    return render(request, 'public/submit_place.html', context)

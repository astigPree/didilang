from xml.sax.saxutils import escape

from django.http import HttpResponse
from django.urls import reverse
from django.utils import timezone

from .utils import place_detail_path, public_places_queryset


def robots_txt(request):
    sitemap_url = request.build_absolute_uri(reverse('sitemap_xml'))
    lines = [
        'User-agent: *',
        'Allow: /',
        'Disallow: /4/admin/',
        'Disallow: /api/',
        f'Sitemap: {sitemap_url}',
        '',
    ]
    return HttpResponse('\n'.join(lines), content_type='text/plain; charset=utf-8')


def sitemap_xml(request):
    today = timezone.localdate().isoformat()
    pages = [
        {
            'loc': request.build_absolute_uri(reverse('home')),
            'lastmod': today,
            'changefreq': 'daily',
            'priority': '1.0',
        },
        {
            'loc': request.build_absolute_uri(reverse('submit_place')),
            'lastmod': today,
            'changefreq': 'weekly',
            'priority': '0.7',
        },
    ]
    for place in (
        public_places_queryset()
        .filter(is_active=True)
        .only('id', 'name', 'category', 'updated_at')
        .order_by('-updated_at', 'name')
    ):
        pages.append(
            {
                'loc': request.build_absolute_uri(place_detail_path(place)),
                'lastmod': place.updated_at.date().isoformat(),
                'changefreq': 'weekly',
                'priority': '0.8',
            }
        )

    url_nodes = []
    for page in pages:
        url_nodes.append(
            '  <url>\n'
            f'    <loc>{escape(page["loc"])}</loc>\n'
            f'    <lastmod>{page["lastmod"]}</lastmod>\n'
            f'    <changefreq>{page["changefreq"]}</changefreq>\n'
            f'    <priority>{page["priority"]}</priority>\n'
            '  </url>'
        )

    urlset_body = '\n'.join(url_nodes)
    content = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f'{urlset_body}\n'
        '</urlset>\n'
    )
    return HttpResponse(content, content_type='application/xml; charset=utf-8')

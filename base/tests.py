import shutil
from pathlib import Path

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse

from .models import CreatedBy, Place
from .utils import place_detail_path


TEST_MEDIA_ROOT = Path(__file__).resolve().parent / '_test_media'
TINY_GIF = (
    b'GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00'
    b'\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,'
    b'\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02'
    b'D\x01\x00;'
)


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class NearbyPlacesApiTests(TestCase):
    @classmethod
    def setUpClass(cls):
        TEST_MEDIA_ROOT.mkdir(exist_ok=True)
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)

    @staticmethod
    def make_profile(name):
        return SimpleUploadedFile(name, TINY_GIF, content_type='image/gif')

    def setUp(self):
        Place.objects.create(
            name='Alpha Eatery',
            category='Restaurant',
            rating=4.8,
            lat=12.37180,
            lng=123.62357,
            address='Town Center',
            profile=self.make_profile('alpha.gif'),
            is_public=True,
        )
        Place.objects.create(
            name='Bravo Laundry',
            category='Laundry',
            rating=4.2,
            lat=12.37500,
            lng=123.62357,
            address='North Block',
            profile=self.make_profile('bravo.gif'),
            is_public=True,
        )
        Place.objects.create(
            name='Zulu Barber',
            category='Barbershop',
            rating=4.5,
            lat=12.45000,
            lng=123.62357,
            address='Far District',
            profile=self.make_profile('zulu.gif'),
            is_public=True,
        )
        Place.objects.create(
            name='Hidden Cafe',
            category='Cafe',
            rating=4.9,
            lat=12.37181,
            lng=123.62358,
            address='Private Spot',
            profile=self.make_profile('hidden.gif'),
            is_public=False,
        )

    def test_nearby_places_filters_by_radius_and_distance(self):
        response = self.client.get(
            reverse('nearby_places'),
            {
                'lat': 12.37179580987164,
                'lng': 123.62357122296626,
                'radius': 1,
                'limit': 10,
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()

        self.assertTrue(payload['radius_applied'])
        self.assertEqual(payload['count'], 2)
        self.assertEqual(
            [place['name'] for place in payload['results']],
            ['Alpha Eatery', 'Bravo Laundry'],
        )
        self.assertNotIn('Hidden Cafe', [place['name'] for place in payload['results']])
        self.assertLess(
            payload['results'][0]['distance_km'],
            payload['results'][1]['distance_km'],
        )

    def test_nearby_places_search_mode_ignores_radius_and_sorts_by_name(self):
        response = self.client.get(
            reverse('nearby_places'),
            {
                'lat': 12.37179580987164,
                'lng': 123.62357122296626,
                'radius': 0.1,
                'limit': 10,
                'q': 'a',
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()

        self.assertFalse(payload['radius_applied'])
        self.assertEqual(payload['count'], 3)
        self.assertEqual(
            [place['name'] for place in payload['results']],
            ['Alpha Eatery', 'Bravo Laundry', 'Zulu Barber'],
        )
        self.assertNotIn('Hidden Cafe', [place['name'] for place in payload['results']])

    def test_nearby_places_search_matches_category(self):
        response = self.client.get(
            reverse('nearby_places'),
            {
                'lat': 12.37179580987164,
                'lng': 123.62357122296626,
                'radius': 0.1,
                'limit': 10,
                'q': 'Laundry',
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()

        self.assertFalse(payload['radius_applied'])
        self.assertEqual(payload['count'], 1)
        self.assertEqual(payload['results'][0]['name'], 'Bravo Laundry')

    def test_search_places_excludes_non_public_places(self):
        response = self.client.get(
            reverse('search_places'),
            {
                'q': 'Cafe',
                'limit': 10,
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()

        self.assertEqual(payload['count'], 0)
        self.assertEqual(payload['results'], [])

    def test_search_places_matches_category(self):
        response = self.client.get(
            reverse('search_places'),
            {
                'q': 'Barbershop',
                'limit': 10,
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()

        self.assertEqual(payload['count'], 1)
        self.assertEqual(payload['results'][0]['name'], 'Zulu Barber')

    def test_submit_place_creates_hidden_place_for_owner_review(self):
        response = self.client.post(
            reverse('submit_place'),
            {
                'submitter_name': 'Maria Santos',
                'submitter_email': 'maria@example.com',
                'submitter_facebook': '',
                'name': 'Maria Store',
                'category': 'Sari-sari store',
                'rating': '4.6',
                'address': 'Market Road',
                'lat': '12.380000',
                'lng': '123.630000',
                'profile': self.make_profile('maria-store.gif'),
            },
        )

        self.assertEqual(response.status_code, 302)

        place = Place.objects.get(name='Maria Store')
        self.assertFalse(place.is_public)
        self.assertTrue(place.is_active)
        self.assertEqual(place.rating, 4.6)
        self.assertEqual(place.created_by.name, 'Maria Santos')
        self.assertEqual(place.created_by.email, 'maria@example.com')

    def test_submit_place_requires_email_or_facebook(self):
        response = self.client.post(
            reverse('submit_place'),
            {
                'submitter_name': 'Maria Santos',
                'submitter_email': '',
                'submitter_facebook': '',
                'name': 'No Contact Store',
                'category': 'Store',
                'rating': '4.0',
                'address': 'Market Road',
                'lat': '12.380000',
                'lng': '123.630000',
                'profile': self.make_profile('no-contact.gif'),
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(Place.objects.filter(name='No Contact Store').exists())
        self.assertEqual(CreatedBy.objects.filter(name='Maria Santos').count(), 0)

    def test_submit_place_ajax_success_does_not_redirect(self):
        response = self.client.post(
            reverse('submit_place'),
            {
                'submitter_name': 'Ana Reyes',
                'submitter_email': 'ana@example.com',
                'submitter_facebook': '',
                'name': 'Ana Bakery',
                'category': 'Bakery',
                'rating': '4.7',
                'address': 'Main Road',
                'lat': '12.390000',
                'lng': '123.640000',
                'profile': self.make_profile('ana-bakery.gif'),
            },
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['ok'])
        self.assertTrue(Place.objects.filter(name='Ana Bakery').exists())
        self.assertEqual(Place.objects.get(name='Ana Bakery').rating, 4.7)

    def test_submit_place_rejects_rating_above_five(self):
        response = self.client.post(
            reverse('submit_place'),
            {
                'submitter_name': 'Ana Reyes',
                'submitter_email': 'ana@example.com',
                'submitter_facebook': '',
                'name': 'Overrated Place',
                'category': 'Shop',
                'rating': '6',
                'address': 'Market Road',
                'lat': '12.390000',
                'lng': '123.640000',
                'profile': self.make_profile('overrated.gif'),
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(Place.objects.filter(name='Overrated Place').exists())

    def test_submit_place_ajax_validation_error_returns_json(self):
        response = self.client.post(
            reverse('submit_place'),
            {
                'submitter_name': 'Ana Reyes',
                'submitter_email': '',
                'submitter_facebook': '',
                'name': 'Broken Place',
                'category': 'Shop',
                'rating': '4.1',
                'address': 'Somewhere',
                'lat': '',
                'lng': '',
                'profile': self.make_profile('broken.gif'),
            },
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )

        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertFalse(payload['ok'])
        self.assertIn('errors', payload)
        self.assertIn('__all__', payload['errors'])


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class SeoPageTests(TestCase):
    @classmethod
    def setUpClass(cls):
        TEST_MEDIA_ROOT.mkdir(exist_ok=True)
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)

    @staticmethod
    def make_profile(name):
        return SimpleUploadedFile(name, TINY_GIF, content_type='image/gif')

    def test_home_page_has_masbate_seo_metadata(self):
        response = self.client.get(reverse('home'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Maghanap ng mga Lugar sa Masbate')
        self.assertContains(response, 'Masbate looking?')
        self.assertContains(response, 'application/ld+json')
        self.assertContains(response, 'assets/favicon.ico')
        self.assertContains(response, 'rel="canonical"')

    def test_home_page_links_to_public_places_for_seo_discovery(self):
        place = Place.objects.create(
            name='Masbate Grill',
            category='Restaurant',
            rating=4.8,
            lat=12.37180,
            lng=123.62357,
            address='Quezon Street',
            profile=self.make_profile('masbate-grill.gif'),
            is_public=True,
            is_active=True,
        )

        response = self.client.get(reverse('home'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Mga lugar sa Masbate')
        self.assertContains(response, place.name)
        self.assertContains(response, place_detail_path(place))

    def test_public_place_detail_page_has_seo_metadata(self):
        place = Place.objects.create(
            name='Masbate Grill',
            category='Restaurant',
            rating=4.8,
            lat=12.37180,
            lng=123.62357,
            address='Quezon Street',
            profile=self.make_profile('masbate-grill-detail.gif'),
            is_public=True,
            is_active=True,
        )

        response = self.client.get(place_detail_path(place))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Masbate Grill sa Masbate')
        self.assertContains(response, 'application/ld+json')
        self.assertContains(response, 'GeoCoordinates')
        self.assertContains(response, 'rel="canonical"')

    def test_hidden_place_detail_page_returns_404(self):
        place = Place.objects.create(
            name='Hidden Masbate Cafe',
            category='Cafe',
            rating=4.2,
            lat=12.37180,
            lng=123.62357,
            address='Private Road',
            profile=self.make_profile('hidden-masbate-cafe.gif'),
            is_public=False,
            is_active=True,
        )

        response = self.client.get(place_detail_path(place))

        self.assertEqual(response.status_code, 404)

    def test_robots_txt_points_to_sitemap_and_blocks_private_paths(self):
        response = self.client.get('/robots.txt')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'text/plain; charset=utf-8')
        content = response.content.decode()
        self.assertIn('User-agent: *', content)
        self.assertIn('Disallow: /4/admin/', content)
        self.assertIn('Disallow: /api/', content)
        self.assertIn('Sitemap: http://testserver/sitemap.xml', content)

    def test_sitemap_xml_lists_public_pages(self):
        public_place = Place.objects.create(
            name='Masbate Grill',
            category='Restaurant',
            rating=4.8,
            lat=12.37180,
            lng=123.62357,
            address='Quezon Street',
            profile=self.make_profile('masbate-grill-sitemap.gif'),
            is_public=True,
            is_active=True,
        )
        hidden_place = Place.objects.create(
            name='Hidden Masbate Cafe',
            category='Cafe',
            rating=4.2,
            lat=12.37180,
            lng=123.62357,
            address='Private Road',
            profile=self.make_profile('hidden-sitemap.gif'),
            is_public=False,
            is_active=True,
        )

        response = self.client.get('/sitemap.xml')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/xml; charset=utf-8')
        content = response.content.decode()
        self.assertIn('<loc>http://testserver/</loc>', content)
        self.assertIn('<loc>http://testserver/places/submit/</loc>', content)
        self.assertIn(place_detail_path(public_place), content)
        self.assertNotIn(place_detail_path(hidden_place), content)

    @override_settings(DEBUG=False, ALLOWED_HOSTS=['testserver'])
    def test_custom_404_page_is_rendered_for_missing_paths(self):
        response = self.client.get('/missing-page/')

        self.assertEqual(response.status_code, 404)
        self.assertContains(response, 'Hindi nakita ang pahina', status_code=404)
        self.assertContains(response, 'Bumalik sa mapa', status_code=404)
        self.assertContains(response, 'assets/logo-with-text.png', status_code=404)

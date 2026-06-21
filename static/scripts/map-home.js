(() => {
    const mapElement = document.querySelector('#map');
    const actionButtons = document.querySelectorAll('[data-action]');
    const searchForm = document.querySelector('.search-shell');
    const searchInput = document.querySelector('#place-search');
    const locationButton = document.querySelector('.search-shell__action');
    const mapLayerToggle = document.querySelector('#map-layer-toggle');
    const mapLayerToggleLabel = document.querySelector('#map-layer-toggle-label');
    const bottomSheet = document.querySelector('.bottom-sheet');
    const bottomSheetClose = document.querySelector('.bottom-sheet__close');
    const bottomSheetToggle = document.querySelector('.bottom-sheet-toggle');
    const radiusSelect = document.querySelector('#scope-radius');
    const limitSelect = document.querySelector('#scope-limit');
    const applyScopeButton = document.querySelector('#apply-scope');
    const scopeApplyLabel = document.querySelector('#scope-apply-label');
    const scopeRadiusValue = document.querySelector('#scope-radius-value');
    const scopeLimitValue = document.querySelector('#scope-limit-value');
    const scopeControlsToggle = document.querySelector('#scope-controls-toggle');
    const scopeControlsToggleMeta = document.querySelector('#scope-controls-toggle-meta');
    const scopeControlsPanel = document.querySelector('#scope-controls-panel');
    const scopeButtonGroups = document.querySelectorAll('[data-scope-buttons]');
    const placeListElement = document.querySelector('#place-list');
    const scopeSummaryElement = document.querySelector('#scope-summary');
    const locationModal = document.querySelector('#location-modal');
    const locationModalTitle = document.querySelector('#location-modal-title');
    const locationModalMessage = document.querySelector('#location-modal-message');
    const locationModalNote = document.querySelector('#location-modal-note');
    const locationModalAllowButton = document.querySelector('#location-modal-allow');
    const locationModalDismissButton = document.querySelector('#location-modal-dismiss');
    const shortViewportMedia = window.matchMedia('(max-width: 560px) and (max-height: 760px)');

    const logEvent = (label, payload = {}) => {
        console.log(`[Didilang Map] ${label}`, payload);
    };

    const escapeHtml = (value) => String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

    const toKey = (place) => `${place.name}:${place.lat}:${place.lng}`;

    const formatDistance = (km) => {
        if (km < 1) {
            return `${Math.round(km * 1000)} metro`;
        }

        return `${km.toFixed(km >= 10 ? 0 : 1)} km`;
    };

    const setBottomSheetState = (isOpen) => {
        if (!bottomSheet || !bottomSheetToggle) {
            return;
        }

        bottomSheet.classList.toggle('is-hidden', !isOpen);
        bottomSheet.setAttribute('aria-hidden', String(!isOpen));
        bottomSheetToggle.classList.toggle('is-hidden', isOpen);
        bottomSheetToggle.setAttribute('aria-expanded', String(isOpen));
        bottomSheetToggle.setAttribute('aria-hidden', String(isOpen));

        if (isOpen) {
            bottomSheetClose?.focus({ preventScroll: true });
        } else {
            bottomSheetToggle.focus({ preventScroll: true });
        }

        logEvent('bottom-sheet-toggle', { isOpen });
    };

    const updateScopeSummary = (message) => {
        if (scopeSummaryElement) {
            scopeSummaryElement.textContent = message;
        }
    };

    const setScopeControlsCollapsed = (isCollapsed) => {
        if (!scopeControlsPanel || !scopeControlsToggle) {
            return;
        }

        scopeControlsPanel.classList.toggle('is-collapsed', isCollapsed);
        scopeControlsPanel.setAttribute('aria-hidden', String(isCollapsed));
        scopeControlsToggle.setAttribute('aria-expanded', String(!isCollapsed));
    };

    const isScopeControlsCollapsed = () =>
        scopeControlsPanel?.classList.contains('is-collapsed') ?? false;

    const setLocationModalState = ({ isOpen, title = '', message = '', note = '', actionLabel = 'Payagan ang lokasyon' } = {}) => {
        if (!locationModal) {
            return;
        }

        locationModal.classList.toggle('is-hidden', !isOpen);
        locationModal.setAttribute('aria-hidden', String(!isOpen));

        if (title && locationModalTitle) {
            locationModalTitle.textContent = title;
        }

        if (message && locationModalMessage) {
            locationModalMessage.textContent = message;
        }

        if (note && locationModalNote) {
            locationModalNote.textContent = note;
        }

        if (locationModalAllowButton) {
            locationModalAllowButton.textContent = actionLabel;
        }

        if (isOpen) {
            locationModalAllowButton?.focus({ preventScroll: true });
        }
    };

    const showLocationPrompt = ({ title, message, note, actionLabel } = {}) => {
        setLocationModalState({
            isOpen: true,
            title: title || 'Payagan ang lokasyon',
            message: message || 'Ginagamit ng Didilang ang lokasyon mo para ipakita ang totoong malalapit na lugar, ayusin ang resulta ayon sa tunay na layo, at i-center ang mapa sa puwesto mo.',
            note: note || 'Kapag nanatiling naka-block ang lokasyon, gagamit ang app ng default na area at maaaring hindi eksakto ang mga nearby result.',
            actionLabel: actionLabel || 'Payagan ang lokasyon',
        });
    };

    const formatScopeRadius = (value) => formatDistance(Number(value));

    const formatScopeLimit = (value) => {
        const total = Number(value);
        return `${total} lugar`;
    };

    const syncScopeButtons = (selectElement) => {
        if (!selectElement) {
            return;
        }

        const buttonGroup = document.querySelector(`[data-scope-buttons="${selectElement.id}"]`);
        if (!buttonGroup) {
            return;
        }

        buttonGroup.querySelectorAll('.scope-option').forEach((button) => {
            const isActive = button.dataset.value === selectElement.value;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    };

    const updateScopePickerPreview = () => {
        const radiusLabel = radiusSelect ? formatScopeRadius(radiusSelect.value) : '';
        const limitLabel = limitSelect ? formatScopeLimit(limitSelect.value) : '';

        if (scopeRadiusValue) {
            scopeRadiusValue.textContent = radiusLabel;
        }

        if (scopeLimitValue) {
            scopeLimitValue.textContent = limitLabel;
        }

        if (scopeControlsToggleMeta) {
            scopeControlsToggleMeta.textContent = `${radiusLabel} / ${limitLabel}`;
        }

        if (scopeApplyLabel) {
            scopeApplyLabel.textContent = `Ipakita ang ${limitLabel} sa loob ng ${radiusLabel}`;
        }
    };

    const focusActiveScopeButton = () => {
        setScopeControlsCollapsed(false);
        const activeButton = document.querySelector('[data-scope-buttons="scope-radius"] .scope-option.is-active');
        activeButton?.focus({ preventScroll: true });
    };

    const renderEmptyState = (title, description, badge) => {
        if (!placeListElement) {
            return;
        }

        placeListElement.innerHTML = `
            <article class="place-card place-card--empty">
                <div class="place-card__thumb"></div>
                <div class="place-card__body">
                    <h2>${escapeHtml(title)}</h2>
                    <p>${escapeHtml(description)}</p>
                    <span>${escapeHtml(badge)}</span>
                </div>
            </article>
        `;
    };

    if (!mapElement || typeof L === 'undefined') {
        logEvent('map-init-skipped');
        return;
    }

    const center = [
        Number(mapElement.dataset.centerLat),
        Number(mapElement.dataset.centerLng),
    ];
    const nearbyUrl = mapElement.dataset.nearbyUrl;

    const minZoom = 14;
    const maxZoom = 18;
    const defaultZoom = 18;

    let userCoords = null;
    let userMarker = null;
    let userAccuracyCircle = null;
    let scopeActivated = false;
    let lastLocationRequestOptions = { centerMap: true };
    let activeScopeRequestController = null;
    let activeScopeRequestId = 0;

    const map = L.map('map', {
        zoomControl: false,
        preferCanvas: true,
        minZoom,
        maxZoom,
    }).setView(center, defaultZoom);

    L.control.zoom({ position: 'topright' }).addTo(map);

    const baseLayers = {
        satellite: L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            minZoom,
            maxZoom,
            attribution: '&copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        }),
        streets: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            minZoom,
            maxZoom,
            attribution: '&copy; OpenStreetMap contributors',
        }),
    };

    let activeBaseLayer = 'satellite';

    const syncMapLayerToggle = () => {
        const usingStreets = activeBaseLayer === 'streets';

        if (mapLayerToggle) {
            mapLayerToggle.setAttribute('aria-pressed', String(usingStreets));
            mapLayerToggle.setAttribute(
                'aria-label',
                usingStreets
                    ? 'Palitan sa satellite map'
                    : 'Palitan sa default map na may address labels'
            );
        }

        if (mapLayerToggleLabel) {
            mapLayerToggleLabel.textContent = usingStreets ? 'Default' : 'Satellite';
        }

        if (mapElement) {
            mapElement.setAttribute(
                'aria-label',
                usingStreets
                    ? 'Interactive na default map na may address labels'
                    : 'Interactive na satellite map'
            );
        }
    };

    const setBaseLayer = (layerName) => {
        if (!baseLayers[layerName] || layerName === activeBaseLayer) {
            return;
        }

        map.removeLayer(baseLayers[activeBaseLayer]);
        baseLayers[layerName].addTo(map);
        activeBaseLayer = layerName;
        syncMapLayerToggle();
        logEvent('map-layer-toggle', { activeBaseLayer });
    };

    baseLayers[activeBaseLayer].addTo(map);
    syncMapLayerToggle();

    const fallbackMarker = L.marker(center, {
        icon: L.divIcon({
            className: 'didilang-marker-wrap',
            html: '<div class="didilang-marker is-primary"></div>',
            iconSize: [28, 28],
            iconAnchor: [14, 28],
        }),
    })
        .addTo(map)
        .bindPopup('<div class="marker-popup"><h3>Default na area</h3><p>Pansamantalang sentro ng mapa</p></div>');

    const fallbackFocusRing = L.marker(center, {
        icon: L.divIcon({
            className: 'map-focus-wrap',
            html: '<div class="map-focus-ring"></div>',
            iconSize: [220, 220],
            iconAnchor: [110, 110],
        }),
        interactive: false,
        keyboard: false,
    }).addTo(map);

    const markerByKey = new Map();
    const visibleMarkers = new Map();

    syncScopeButtons(radiusSelect);
    syncScopeButtons(limitSelect);
    updateScopePickerPreview();
    setScopeControlsCollapsed(shortViewportMedia.matches);

    const createPlaceMarker = (place) => {
        const safeName = escapeHtml(place.name);
        const safeCategory = escapeHtml(place.category);
        const safeRating = escapeHtml(place.rating);
        const safeAddress = escapeHtml(place.address);
        const markerKey = toKey(place);

        const marker = L.marker(place.coords, {
            icon: L.divIcon({
                className: 'didilang-marker-wrap',
                html: '<div class="didilang-marker"></div>',
                iconSize: [24, 24],
                iconAnchor: [12, 24],
            }),
        });

        marker.bindPopup(
            `<div class="marker-popup"><h3>${safeName}</h3><p>${safeCategory} | ${safeRating}</p>${safeAddress ? `<p>${safeAddress}</p>` : ''}</div>`
        );

        markerByKey.set(markerKey, marker);

        marker.on('click', () => {
            logEvent('marker-click', { name: place.name, coords: place.coords });
        });

        return marker;
    };

    const getOrCreatePlaceMarker = (place) => {
        const markerKey = toKey(place);
        const existingMarker = markerByKey.get(markerKey);
        if (existingMarker) {
            return existingMarker;
        }

        return createPlaceMarker(place);
    };

    const hideAllPlaceMarkers = () => {
        visibleMarkers.forEach((marker) => {
            if (map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        });
        visibleMarkers.clear();
    };

    const renderUserLocation = (coords, accuracy = 0) => {
        userCoords = coords;

        if (fallbackMarker && map.hasLayer(fallbackMarker)) {
            map.removeLayer(fallbackMarker);
        }

        if (fallbackFocusRing && map.hasLayer(fallbackFocusRing)) {
            map.removeLayer(fallbackFocusRing);
        }

        if (!userMarker) {
            userMarker = L.marker(coords, {
                icon: L.divIcon({
                    className: 'didilang-marker-wrap',
                    html: '<div class="didilang-marker is-user"></div>',
                    iconSize: [28, 28],
                    iconAnchor: [14, 28],
                }),
            }).addTo(map);
        } else {
            userMarker.setLatLng(coords);
        }

        userMarker.bindPopup('<div class="marker-popup"><h3>Lokasyon mo</h3><p>Kasalukuyang puwesto ng device</p></div>');

        if (!userAccuracyCircle) {
            userAccuracyCircle = L.circle(coords, {
                radius: Math.max(accuracy, 25),
                color: '#D97A1E',
                weight: 1.5,
                fillColor: '#D97A1E',
                fillOpacity: 0.12,
            }).addTo(map);
        } else {
            userAccuracyCircle.setLatLng(coords);
            userAccuracyCircle.setRadius(Math.max(accuracy, 25));
        }
    };

    const clampZoom = (zoom) => Math.max(minZoom, Math.min(maxZoom, zoom));

    const flyToCurrentLocation = (zoom = defaultZoom) => {
        if (userCoords) {
            map.flyTo(userCoords, clampZoom(zoom), { duration: 0.8 });
            userMarker?.openPopup();
            return true;
        }

        return false;
    };

    const renderPlaceList = (results) => {
        if (!placeListElement) {
            return;
        }

        if (!results.length) {
            renderEmptyState(
                'Walang tumama sa scope',
                'Subukan ang mas malawak na radius o dagdagan ang dami ng lugar.',
                'Walang tugma'
            );
            return;
        }

        placeListElement.innerHTML = results.map((place) => `
            <article class="place-card" tabindex="0" data-place="${escapeHtml(place.name)}" data-lat="${place.lat}" data-lng="${place.lng}">
                ${place.profile_url
                    ? `<img class="place-card__thumb place-card__image" src="${escapeHtml(place.profile_url)}" alt="${escapeHtml(place.name)}">`
                    : '<div class="place-card__thumb"></div>'}
                <div class="place-card__body">
                    <h2>${escapeHtml(place.name)}</h2>
                    <p>${escapeHtml(place.category)}</p>
                    <span>${escapeHtml(place.rating_value)} &#9733; | ${escapeHtml(formatDistance(place.distanceKm))}</span>
                </div>
            </article>
        `).join('');
    };

    const bindPlaceCardEvents = () => {
        if (!placeListElement) {
            return;
        }

        placeListElement.querySelectorAll('.place-card').forEach((card) => {
            const lat = Number(card.dataset.lat);
            const lng = Number(card.dataset.lng);
            const name = card.dataset.place;

            if (!name || Number.isNaN(lat) || Number.isNaN(lng)) {
                return;
            }

            const focusPlace = () => {
                map.flyTo([lat, lng], maxZoom, { duration: 0.8 });
                const marker = markerByKey.get(`${name}:${lat}:${lng}`);
                marker?.openPopup();
                logEvent('card-focus', { name, coords: [lat, lng] });
            };

            card.addEventListener('click', focusPlace);
            card.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    focusPlace();
                }
            });
        });
    };

    const renderScopedPlaces = (results, radiusKm, limit, usingUserLocation) => {
        hideAllPlaceMarkers();

        results.forEach((place) => {
            const marker = getOrCreatePlaceMarker(place);
            if (marker) {
                marker.addTo(map);
                visibleMarkers.set(toKey(place), marker);
            }
        });

        renderPlaceList(results);
        bindPlaceCardEvents();

        if (!results.length) {
            updateScopeSummary(`Walang lugar sa loob ng ${formatDistance(radiusKm)}.`);
            return;
        }

        updateScopeSummary(
            `${results.length} lugar sa loob ng ${formatDistance(radiusKm)}. ` +
            `Hanggang ${limit} ang ipinapakita. Pinagmulan: ${usingUserLocation ? 'GPS mo' : 'default na sentro'}.`
        );
    };

    const applyScope = async () => {
        const radiusKm = Number(radiusSelect?.value || 1);
        const limit = Number(limitSelect?.value || 10);
        const query = searchInput?.value.trim() || '';
        const origin = userCoords || center;
        const usingUserLocation = Boolean(userCoords);

        scopeActivated = true;

        if (!nearbyUrl) {
            renderEmptyState(
                'Hindi ma-load ang scope',
                'Walang naka-configure na nearby endpoint para sa page na ito.',
                'Config error'
            );
            updateScopeSummary('Walang nearby endpoint na maagamit.');
            return;
        }

        if (activeScopeRequestController) {
            activeScopeRequestController.abort();
        }

        activeScopeRequestController = new AbortController();
        activeScopeRequestId += 1;
        const requestId = activeScopeRequestId;

        const requestUrl = new URL(nearbyUrl, window.location.origin);
        requestUrl.searchParams.set('lat', String(origin[0]));
        requestUrl.searchParams.set('lng', String(origin[1]));
        requestUrl.searchParams.set('radius', String(radiusKm));
        requestUrl.searchParams.set('limit', String(limit));
        if (query) {
            requestUrl.searchParams.set('q', query);
        }

        updateScopeSummary('Hinahanap ang mga lugar...');

        let payload;
        try {
            const response = await fetch(requestUrl, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                },
                signal: activeScopeRequestController.signal,
            });

            if (!response.ok) {
                throw new Error(`Nearby request failed with ${response.status}`);
            }

            payload = await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                return;
            }

            hideAllPlaceMarkers();
            renderEmptyState(
                'Hindi ma-load ang nearby places',
                'Nagkaproblema sa pagkuha ng scoped results. Subukan muli.',
                'Request failed'
            );
            updateScopeSummary('Hindi nakuha ang nearby results.');
            logEvent('scope-error', {
                radiusKm,
                limit,
                query,
                message: error.message,
            });
            return;
        }

        if (requestId !== activeScopeRequestId) {
            return;
        }

        const results = (payload.results || []).map((place) => ({
            ...place,
            coords: [Number(place.lat), Number(place.lng)],
            distanceKm: Number(place.distance_km || 0),
        }));
        const hasQuery = Boolean(query);

        renderScopedPlaces(results, radiusKm, limit, usingUserLocation);

        if (hasQuery) {
            updateScopeSummary(
                `${results.length} tugma para sa "${query}". ` +
                `Hanggang ${limit} ang ipinapakita. Hindi ginagamit ang radius kapag naghahanap.`
            );
        }

        if (results.length === 1) {
            map.flyTo(results[0].coords, maxZoom, { duration: 0.8 });
            return;
        }

        if (results.length > 1) {
            const bounds = L.latLngBounds(results.map((place) => place.coords));
            if (usingUserLocation) {
                bounds.extend(userCoords);
            }
            map.flyToBounds(bounds, {
                padding: [36, 36],
                maxZoom: 17,
                duration: 0.8,
            });
            return;
        }

        if (usingUserLocation) {
            flyToCurrentLocation(defaultZoom);
        }

        logEvent('scope-apply', {
            radiusKm,
            limit,
            query,
            usingUserLocation,
            resultCount: results.length,
        });
    };

    const requestCurrentLocation = ({ centerMap = false, forcePopup = false, rerunScope = false } = {}) => {
        lastLocationRequestOptions = { centerMap, forcePopup, rerunScope };

        if (!navigator.geolocation) {
            logEvent('location-unsupported');
            showLocationPrompt({
                title: 'Buksan ang lokasyon ng device',
                message: 'Hindi maibigay ng device o browser na ito ang kasalukuyan mong lokasyon, kaya hindi makakakuwenta ang Didilang ng tunay na malalapit na lugar.',
                note: 'Mahalaga ang lokasyon dahil ito ang basehan ng mapa para ayusin ang mga lugar ayon sa tunay na layo at ituro kung ano ang talagang malapit sa iyo.',
                actionLabel: 'Subukan muli',
            });
            if (rerunScope && scopeActivated) {
                applyScope();
            }
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coords = [
                    position.coords.latitude,
                    position.coords.longitude,
                ];

                renderUserLocation(coords, position.coords.accuracy);

                if (centerMap) {
                    map.flyTo(coords, defaultZoom, { duration: 0.8 });
                }

                if (forcePopup) {
                    userMarker?.openPopup();
                }

                setLocationModalState({ isOpen: false });

                if (rerunScope && scopeActivated) {
                    applyScope();
                }

                logEvent('location-success', {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                });
            },
            (error) => {
                logEvent('location-error', {
                    code: error.code,
                    message: error.message,
                });

                if (error.code === error.PERMISSION_DENIED) {
                    showLocationPrompt({
                        title: 'Payagan ang lokasyon',
                        message: 'Kailangan ng Didilang ang pahintulot mo para maipakita ang totoong malalapit na lugar, maayos ang resulta ayon sa tunay na layo, at ma-center ang mapa sa aktuwal mong puwesto.',
                        note: 'Kung na-block mo na ito, buksan ang site settings ng browser mo, payagan ang Location para sa page na ito, at pagkatapos ay pindutin ulit ang payagan ang lokasyon.',
                        actionLabel: 'Payagan ang lokasyon',
                    });
                } else if (error.code === error.TIMEOUT) {
                    showLocationPrompt({
                        title: 'Buksan ang GPS para magpatuloy',
                        message: 'Hindi namin nakuha agad ang lokasyon mo. Maaaring naka-off, mahina, o naka-block ang GPS o location services.',
                        note: 'Mahalaga ang lokasyon dahil magiging eksakto lang ang nearby search kapag alam ng app kung nasaan ka ngayon.',
                        actionLabel: 'Subukan ulit ang GPS',
                    });
                } else {
                    showLocationPrompt({
                        title: 'Hindi makuha ang lokasyon',
                        message: 'Hindi mabasa ng Didilang ang kasalukuyan mong lokasyon, kaya maaaring default na area ang gamitin sa halip na ang tunay mong puwesto.',
                        note: 'Kapag pinayagan ang GPS, mas tama ang distansya, mas maganda ang mga suhestiyon, at mas maayos ang pag-center ng mapa sa iyo.',
                        actionLabel: 'Subukan muli',
                    });
                }

                if (rerunScope && scopeActivated) {
                    applyScope();
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000,
            }
        );
    };

    actionButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const action = button.dataset.action;
            logEvent('action-click', { action });

            if (action === 'nearby') {
                if (!userCoords) {
                    scopeActivated = true;
                    requestCurrentLocation({ centerMap: true, forcePopup: true, rerunScope: true });
                } else {
                    flyToCurrentLocation(defaultZoom);
                    applyScope();
                }
            }

            if (action === 'categories' || action === 'filter-nearby') {
                setBottomSheetState(true);
                focusActiveScopeButton();
            }
        });
    });

    if (scopeControlsToggle) {
        scopeControlsToggle.addEventListener('click', () => {
            const nextCollapsedState = !isScopeControlsCollapsed();
            setScopeControlsCollapsed(nextCollapsedState);

            if (!nextCollapsedState) {
                focusActiveScopeButton();
            }
        });
    }

    scopeButtonGroups.forEach((buttonGroup) => {
        buttonGroup.addEventListener('click', (event) => {
            const button = event.target.closest('.scope-option');
            if (!button) {
                return;
            }

            const selectId = buttonGroup.dataset.scopeButtons;
            const selectElement = selectId ? document.querySelector(`#${selectId}`) : null;
            if (!selectElement) {
                return;
            }

            selectElement.value = button.dataset.value;
            syncScopeButtons(selectElement);
            updateScopePickerPreview();
        });
    });

    [radiusSelect, limitSelect].forEach((selectElement) => {
        selectElement?.addEventListener('change', () => {
            syncScopeButtons(selectElement);
            updateScopePickerPreview();
        });
    });

    if (searchInput) {
        let searchDebounce = null;

        const scheduleSearch = () => {
            if (searchDebounce) {
                window.clearTimeout(searchDebounce);
            }

            searchDebounce = window.setTimeout(() => {
                const query = searchInput?.value.trim() || '';
                if (scopeActivated || query) {
                    applyScope();
                }
            }, 220);
        };

        searchInput.addEventListener('input', () => {
            scheduleSearch();
        });
    }

    if (searchForm) {
        searchForm.addEventListener('submit', (event) => {
            event.preventDefault();
            setBottomSheetState(true);
            applyScope();

            if (shortViewportMedia.matches) {
                setScopeControlsCollapsed(true);
            }
        });
    }

    if (locationModalAllowButton) {
        locationModalAllowButton.addEventListener('click', () => {
            setLocationModalState({ isOpen: false });
            requestCurrentLocation({
                centerMap: true,
                forcePopup: true,
                rerunScope: scopeActivated,
                ...lastLocationRequestOptions,
            });
        });
    }

    if (locationModalDismissButton) {
        locationModalDismissButton.addEventListener('click', () => {
            setLocationModalState({ isOpen: false });
        });
    }

    if (locationModal) {
        locationModal.addEventListener('click', (event) => {
            const dismissTrigger = event.target.closest('[data-location-dismiss]');
            if (dismissTrigger) {
                setLocationModalState({ isOpen: false });
            }
        });
    }

    if (locationButton) {
        locationButton.addEventListener('click', () => {
            logEvent('location-request');
            if (!userCoords) {
                requestCurrentLocation({ centerMap: true, forcePopup: true, rerunScope: true });
            } else {
                flyToCurrentLocation(defaultZoom);
                if (scopeActivated) {
                    applyScope();
                }
            }
        });
    }

    if (mapLayerToggle) {
        mapLayerToggle.addEventListener('click', () => {
            setBaseLayer(activeBaseLayer === 'satellite' ? 'streets' : 'satellite');
        });
    }

    if (applyScopeButton) {
        applyScopeButton.addEventListener('click', () => {
            applyScope();

            if (shortViewportMedia.matches) {
                setScopeControlsCollapsed(true);
            }
        });
    }

    if (bottomSheetClose) {
        bottomSheetClose.addEventListener('click', () => {
            setBottomSheetState(false);
        });
    }

    if (bottomSheetToggle) {
        bottomSheetToggle.addEventListener('click', () => {
            setBottomSheetState(true);
            focusActiveScopeButton();
        });
    }

    map.on('click', (event) => {
        logEvent('map-click', {
            lat: event.latlng.lat,
            lng: event.latlng.lng,
        });
    });

    hideAllPlaceMarkers();

    const initialSearchQuery = new URLSearchParams(window.location.search).get('q')?.trim() || '';
    if (initialSearchQuery && searchInput) {
        searchInput.value = initialSearchQuery;
        scopeActivated = true;
        setBottomSheetState(true);
        applyScope();

        if (shortViewportMedia.matches) {
            setScopeControlsCollapsed(true);
        }
    }

    requestCurrentLocation({ centerMap: true, rerunScope: Boolean(initialSearchQuery) });
})();


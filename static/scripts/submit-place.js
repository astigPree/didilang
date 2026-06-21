(() => {
    const mapElement = document.querySelector('#submit-map');
    const latInput = document.querySelector('#id_lat');
    const lngInput = document.querySelector('#id_lng');
    const locationSummary = document.querySelector('#location-summary');
    const useCurrentLocationButton = document.querySelector('#use-current-location');
    const mapLayerToggle = document.querySelector('#submit-map-layer-toggle');
    const mapLayerToggleLabel = document.querySelector('#submit-map-layer-toggle-label');
    const mapStatus = document.querySelector('#map-status');
    const placeForm = document.querySelector('#place-form');
    const submitButton = document.querySelector('#submit-place-button');
    const selectedLocationCard = document.querySelector('#selected-location-card');
    const selectedLocationCoords = document.querySelector('#selected-location-coords');
    const profileInput = document.querySelector('#id_profile');
    const imagePreview = document.querySelector('#image-preview');
    const submitLoader = document.querySelector('#submit-loader');
    const submitLoaderText = document.querySelector('#submit-loader-text');
    const submitPopup = document.querySelector('#submit-popup');
    const submitPopupBadge = document.querySelector('#submit-popup-badge');
    const submitPopupEyebrow = document.querySelector('#submit-popup-eyebrow');
    const submitPopupTitle = document.querySelector('#submit-popup-title');
    const submitPopupMessage = document.querySelector('#submit-popup-message');
    const submitPopupClose = document.querySelector('#submit-popup-close');
    const locationModal = document.querySelector('#submit-location-modal');
    const locationModalTitle = document.querySelector('#submit-location-modal-title');
    const locationModalMessage = document.querySelector('#submit-location-modal-message');
    const locationModalNote = document.querySelector('#submit-location-modal-note');
    const locationModalAllowButton = document.querySelector('#submit-location-modal-allow');
    const locationModalDismissButton = document.querySelector('#submit-location-modal-dismiss');
    const MAX_IMAGE_DIMENSION = 1600;
    const MAX_IMAGE_SIZE_BYTES = 1.5 * 1024 * 1024;
    const OUTPUT_IMAGE_QUALITY = 0.82;
    const COMPRESSIBLE_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

    if (!mapElement || typeof L === 'undefined') {
        return;
    }

    const center = [
        Number(mapElement.dataset.centerLat),
        Number(mapElement.dataset.centerLng),
    ];
    const selectedLatRaw = mapElement.dataset.selectedLat;
    const selectedLngRaw = mapElement.dataset.selectedLng;
    const selectedLat = Number(selectedLatRaw);
    const selectedLng = Number(selectedLngRaw);
    const hasSelectedLocation =
        selectedLatRaw !== '' &&
        selectedLngRaw !== '' &&
        !Number.isNaN(selectedLat) &&
        !Number.isNaN(selectedLng);
    const initialLocation = hasSelectedLocation ? [selectedLat, selectedLng] : center;

    const minZoom = 13;
    const maxZoom = 18;
    const tileMaxZoom = 19;

    const map = L.map('submit-map', {
        zoomControl: false,
        preferCanvas: true,
        minZoom,
        maxZoom,
    }).setView(initialLocation, hasSelectedLocation ? 18 : 16);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const baseLayers = {
        satellite: L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            minZoom,
            maxZoom: tileMaxZoom,
            attribution: '&copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        }),
        streets: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            minZoom,
            maxZoom: tileMaxZoom,
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
            if (mapLayerToggleLabel) {
                mapLayerToggleLabel.textContent = usingStreets ? 'Default' : 'Satellite';
            } else {
                mapLayerToggle.textContent = usingStreets ? 'Default' : 'Satellite';
            }
        }

        if (mapElement) {
            mapElement.setAttribute(
                'aria-label',
                usingStreets
                    ? 'Interactive na default map na may address labels para pumili ng lokasyon'
                    : 'Interactive na satellite map para pumili ng lokasyon'
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
    };

    baseLayers[activeBaseLayer].addTo(map);
    syncMapLayerToggle();

    const markerIcon = L.divIcon({
        className: 'selected-place-marker-wrap',
        html: '<div class="selected-place-marker"></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
    });

    let marker = null;
    let lastLocationRequestMode = 'center';
    let preparedUploadFile = null;
    let previewObjectUrl = null;

    const formatCoord = (value) => Number(value).toFixed(6);
    const formatBytes = (value) => `${(value / (1024 * 1024)).toFixed(value >= 1024 * 1024 ? 1 : 2)} MB`;

    const setSubmitReady = (isReady) => {
        if (!submitButton) {
            return;
        }

        submitButton.disabled = !isReady;
        submitButton.textContent = isReady
            ? 'I-submit para sa review'
            : 'Piliin muna ang lokasyon sa mapa';
    };

    const setLoaderState = (isOpen, message = 'Sinusumite ang lugar...') => {
        if (!submitLoader) {
            return;
        }

        submitLoader.classList.toggle('is-hidden', !isOpen);
        submitLoader.setAttribute('aria-hidden', String(!isOpen));

        if (submitLoaderText) {
            submitLoaderText.textContent = message;
        }
    };

    const setLocationModalState = ({
        isOpen,
        title = 'Payagan ang GPS',
        message = 'Gagamitin ng Didilang ang lokasyon ng phone mo para doon magsimula ang mapa habang pinipili mo ang lugar.',
        note = 'Kapag hindi available ang GPS, default na area muna ang ipapakita bilang fallback.',
        actionLabel = 'Payagan ang GPS',
    } = {}) => {
        if (!locationModal) {
            return;
        }

        locationModal.classList.toggle('is-hidden', !isOpen);
        locationModal.setAttribute('aria-hidden', String(!isOpen));

        if (locationModalTitle) {
            locationModalTitle.textContent = title;
        }

        if (locationModalMessage) {
            locationModalMessage.textContent = message;
        }

        if (locationModalNote) {
            locationModalNote.textContent = note;
        }

        if (locationModalAllowButton) {
            locationModalAllowButton.textContent = actionLabel;
        }

        if (isOpen) {
            locationModalAllowButton?.focus({ preventScroll: true });
        }
    };

    const clearInlineErrors = () => {
        document.querySelectorAll('.field small').forEach((node) => node.remove());
        document.querySelectorAll('.field-error.is-dynamic').forEach((node) => node.remove());
    };

    const revokePreviewUrl = () => {
        if (previewObjectUrl) {
            URL.revokeObjectURL(previewObjectUrl);
            previewObjectUrl = null;
        }
    };

    const setPopupState = ({
        isOpen,
        tone = 'info',
        eyebrow = 'Update',
        title = 'May update sa submission',
        message = 'Tingnan ang detalye ng submission mo.',
    } = {}) => {
        if (!submitPopup) {
            return;
        }

        submitPopup.classList.toggle('is-hidden', !isOpen);
        submitPopup.setAttribute('aria-hidden', String(!isOpen));
        submitPopup.dataset.tone = tone;

        if (submitPopupEyebrow) {
            submitPopupEyebrow.textContent = eyebrow;
        }

        if (submitPopupTitle) {
            submitPopupTitle.textContent = title;
        }

        if (submitPopupMessage) {
            submitPopupMessage.textContent = message;
        }

        if (submitPopupBadge) {
            submitPopupBadge.textContent = tone === 'success' ? 'OK' : tone === 'error' ? '!' : '...';
        }

        if (isOpen) {
            submitPopupClose?.focus({ preventScroll: true });
        }
    };

    const showFieldErrors = (errors) => {
        const entries = Object.entries(errors || {});
        if (!entries.length) {
            return;
        }

        entries.forEach(([field, messages]) => {
            if (field === '__all__') {
                return;
            }

            const input = document.querySelector(`#id_${field}`);
            const host = input?.closest('.field') || null;
            if (!host) {
                return;
            }

            (messages || []).forEach((message) => {
                const small = document.createElement('small');
                small.textContent = message;
                host.appendChild(small);
            });
        });

        if (errors.lat || errors.lng) {
            const message = (errors.lat?.[0] || errors.lng?.[0] || 'Pumili ng lokasyon sa mapa.');
            const p = document.createElement('p');
            p.className = 'field-error is-dynamic';
            p.textContent = message;
            placeForm?.appendChild(p);
        }
    };

    const loadImageElement = (file) => new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Hindi mabasa ang image file.'));
        };
        image.src = objectUrl;
    });

    const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Walang nabuo na compressed image.'));
                return;
            }

            resolve(blob);
        }, type, quality);
    });

    const compressImageFile = async (file) => {
        if (!file || !COMPRESSIBLE_IMAGE_TYPES.has(file.type)) {
            return {
                file,
                compressed: false,
            };
        }

        const image = await loadImageElement(file);
        const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
        const needsResize = largestSide > MAX_IMAGE_DIMENSION;
        const needsCompression = file.size > MAX_IMAGE_SIZE_BYTES;

        if (!needsResize && !needsCompression) {
            return {
                file,
                compressed: false,
            };
        }

        const scale = needsResize ? MAX_IMAGE_DIMENSION / largestSide : 1;
        const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
        const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const context = canvas.getContext('2d');
        if (!context) {
            return {
                file,
                compressed: false,
            };
        }

        context.drawImage(image, 0, 0, targetWidth, targetHeight);

        const compressedBlob = await canvasToBlob(canvas, 'image/jpeg', OUTPUT_IMAGE_QUALITY);
        if (compressedBlob.size >= file.size) {
            return {
                file,
                compressed: false,
            };
        }

        const normalizedName = file.name.replace(/\.[^.]+$/, '') || 'upload';
        const compressedFile = new File([compressedBlob], `${normalizedName}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
        });

        return {
            file: compressedFile,
            compressed: true,
            originalSize: file.size,
            compressedSize: compressedFile.size,
        };
    };

    const renderPreparedImagePreview = (file, compressionSummary = '') => {
        if (!imagePreview) {
            return;
        }

        revokePreviewUrl();
        previewObjectUrl = URL.createObjectURL(file);
        imagePreview.classList.remove('is-empty');
        imagePreview.innerHTML = `
            <img src="${previewObjectUrl}" alt="Preview ng napiling larawan">
            <small>${compressionSummary || `Ready i-upload: ${formatBytes(file.size)}`}</small>
        `;
    };

    const updateStatus = (coords) => {
        const [lat, lng] = coords;
        const formattedLat = formatCoord(lat);
        const formattedLng = formatCoord(lng);

        if (latInput) {
            latInput.value = formattedLat;
        }

        if (lngInput) {
            lngInput.value = formattedLng;
        }

        const message = `Napiling lokasyon: ${formattedLat}, ${formattedLng}`;

        if (locationSummary) {
            locationSummary.textContent = message;
            locationSummary.classList.add('is-selected');
            locationSummary.classList.remove('is-error');
        }

        if (mapStatus) {
            mapStatus.textContent = 'Lokasyon napili. Puwede pang i-drag ang pin.';
        }

        if (selectedLocationCard) {
            selectedLocationCard.classList.add('is-selected');
        }

        if (selectedLocationCoords) {
            selectedLocationCoords.textContent = `${formattedLat}, ${formattedLng}`;
        }

        setSubmitReady(true);
    };

    const centerMapOnCoords = (coords, zoom = 17) => {
        map.flyTo(coords, Math.max(map.getZoom(), zoom), { duration: 0.55 });
    };

    const setSelectedLocation = (coords, { pan = true } = {}) => {
        if (!marker) {
            marker = L.marker(coords, {
                draggable: true,
                icon: markerIcon,
            }).addTo(map);

            marker.on('dragend', () => {
                const nextCoords = marker.getLatLng();
                updateStatus([nextCoords.lat, nextCoords.lng]);
            });
        } else {
            marker.setLatLng(coords);
        }

        updateStatus(coords);

        if (pan) {
            map.flyTo(coords, Math.max(map.getZoom(), 17), { duration: 0.55 });
        }
    };

    map.on('click', (event) => {
        setSelectedLocation([event.latlng.lat, event.latlng.lng]);
    });

    if (hasSelectedLocation) {
        setSelectedLocation(initialLocation, { pan: false });
    } else {
        setSubmitReady(false);
    }

    const handleGpsFallback = (message) => {
        if (mapStatus) {
            mapStatus.textContent = message || 'Default na area muna ang gamit dahil hindi available ang GPS.';
        }
    };

    const requestDeviceLocation = ({ mode = 'center', showPromptOnDeny = true } = {}) => {
        lastLocationRequestMode = mode;

        if (!navigator.geolocation) {
            handleGpsFallback('Hindi mabasa ng browser ang GPS. Default na area muna ang gamit.');
            return;
        }

        if (mapStatus) {
            mapStatus.textContent = mode === 'select'
                ? 'Kinukuha ang lokasyon ng phone mo para gawing pin...'
                : 'Kinukuha ang lokasyon ng phone mo para i-center ang mapa...';
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coords = [
                    position.coords.latitude,
                    position.coords.longitude,
                ];

                if (mode === 'select') {
                    setSelectedLocation(coords);
                    if (mapStatus) {
                        mapStatus.textContent = 'Phone GPS ang ginamit para sa pin ng lokasyon.';
                    }
                } else if (!hasSelectedLocation && !latInput?.value && !lngInput?.value) {
                    centerMapOnCoords(coords, 18);
                    if (mapStatus) {
                        mapStatus.textContent = 'Phone GPS ang base ng mapa. I-tap ang eksaktong puwesto ng lugar.';
                    }
                }

                setLocationModalState({ isOpen: false });
            },
            (error) => {
                if (error.code === error.PERMISSION_DENIED && showPromptOnDeny) {
                    setLocationModalState({
                        isOpen: true,
                        title: 'Payagan ang GPS',
                        message: 'Mas madali piliin ang lugar kung ang mapa ay nakabase muna sa kasalukuyang lokasyon ng phone mo.',
                        note: 'Kapag hindi mo papayagan, default na area muna ang fallback at puwede ka pa ring pumili ng pin nang mano-mano.',
                        actionLabel: mode === 'select' ? 'Subukan ulit ang GPS' : 'Payagan ang GPS',
                    });
                    handleGpsFallback('Default na area muna ang gamit. Payagan ang GPS para mas malapit ang starting map.');
                    return;
                }

                if (error.code === error.TIMEOUT) {
                    handleGpsFallback('Hindi nakuha agad ang GPS. Default na area muna ang gamit.');
                } else {
                    handleGpsFallback('Hindi mabasa ang GPS ng phone. Default na area muna ang gamit.');
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000,
            }
        );
    };

    useCurrentLocationButton?.addEventListener('click', () => {
        requestDeviceLocation({ mode: 'select', showPromptOnDeny: true });
    });

    mapLayerToggle?.addEventListener('click', () => {
        setBaseLayer(activeBaseLayer === 'satellite' ? 'streets' : 'satellite');
    });

    placeForm?.addEventListener('submit', (event) => {
        event.preventDefault();

        clearInlineErrors();

        if (!latInput?.value || !lngInput?.value) {
            if (mapStatus) {
                mapStatus.textContent = 'Kailangan munang pumili ng pin sa mapa.';
            }

            if (locationSummary) {
                locationSummary.textContent = 'Kailangan munang pumili ng eksaktong lokasyon sa mapa.';
                locationSummary.classList.remove('is-selected');
                locationSummary.classList.add('is-error');
            }

            mapElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        const formData = new FormData(placeForm);
        const csrfToken = formData.get('csrfmiddlewaretoken');
        const activeUploadFile = preparedUploadFile || profileInput?.files?.[0] || null;

        if (activeUploadFile) {
            formData.set('profile', activeUploadFile, activeUploadFile.name);
        }

        setLoaderState(true, 'Sinusumite ang lugar...');
        submitButton?.setAttribute('aria-busy', 'true');
        if (submitButton) {
            submitButton.disabled = true;
        }

        fetch(placeForm.action || window.location.href, {
            method: 'POST',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': csrfToken,
                'Accept': 'application/json',
            },
            body: formData,
        })
            .then(async (response) => {
                const payload = await response.json().catch(() => null);
                if (!response.ok) {
                    return Promise.reject(payload || { ok: false });
                }
                return payload;
            })
            .then((payload) => {
                if (!payload?.ok) {
                    setPopupState({
                        isOpen: true,
                        tone: 'error',
                        eyebrow: 'May kailangang ayusin',
                        title: 'Hindi na-submit ang lugar',
                        message: 'Pakisuri ang mga field at subukan ulit.',
                    });
                    return;
                }

                setPopupState({
                    isOpen: true,
                    tone: 'success',
                    eyebrow: 'Naipasa na',
                    title: 'Na-submit ang lugar',
                    message: payload.message || 'Iche-check muna ito ng owner bago lumabas sa public map.',
                });

                // Reset only place details; keep contact for convenience.
                ['name', 'category', 'rating', 'address'].forEach((field) => {
                    const input = document.querySelector(`#id_${field}`);
                    if (input) {
                        input.value = '';
                    }
                });

                if (profileInput) {
                    profileInput.value = '';
                }

                if (imagePreview) {
                    preparedUploadFile = null;
                    revokePreviewUrl();
                    imagePreview.classList.add('is-empty');
                    imagePreview.innerHTML = '<span>Preview ng larawan</span>';
                }

                if (mapStatus) {
                    mapStatus.textContent = 'Salamat! Puwede kang magsumite ulit ng ibang lugar.';
                }
            })
            .catch((payload) => {
                const errors = payload?.errors || payload || {};
                showFieldErrors(errors);
                setPopupState({
                    isOpen: true,
                    tone: 'error',
                    eyebrow: 'May kailangang ayusin',
                    title: 'Hindi na-submit ang lugar',
                    message: errors.__all__?.[0] || 'Pakicheck ang mga detalye at subukan ulit.',
                });
            })
            .finally(() => {
                setLoaderState(false);
                submitButton?.removeAttribute('aria-busy');
                if (submitButton) {
                    submitButton.disabled = false;
                }
                // Keep location-selected gating in sync.
                setSubmitReady(Boolean(latInput?.value && lngInput?.value));
            });
    });

    submitPopup?.addEventListener('click', (event) => {
        if (event.target.closest('[data-popup-close="true"]')) {
            setPopupState({ isOpen: false });
        }
    });

    submitPopupClose?.addEventListener('click', () => {
        setPopupState({ isOpen: false });
    });

    locationModal?.addEventListener('click', (event) => {
        if (event.target.closest('[data-location-dismiss="true"]')) {
            setLocationModalState({ isOpen: false });
        }
    });

    locationModalAllowButton?.addEventListener('click', () => {
        setLocationModalState({ isOpen: false });
        requestDeviceLocation({ mode: lastLocationRequestMode, showPromptOnDeny: false });
    });

    locationModalDismissButton?.addEventListener('click', () => {
        setLocationModalState({ isOpen: false });
        handleGpsFallback('Default na area muna ang gamit. Puwede ka pa ring pumili ng pin sa mapa.');
    });

    profileInput?.addEventListener('change', () => {
        const file = profileInput.files?.[0];

        if (!imagePreview) {
            return;
        }

        if (!file) {
            preparedUploadFile = null;
            revokePreviewUrl();
            imagePreview.classList.add('is-empty');
            imagePreview.innerHTML = '<span>Preview ng larawan</span>';
            return;
        }

        setLoaderState(true, 'Inihahanda ang larawan...');

        compressImageFile(file)
            .then((result) => {
                preparedUploadFile = result.file;
                if (result.compressed) {
                    renderPreparedImagePreview(
                        result.file,
                        `Na-compress bago upload: ${formatBytes(result.originalSize)} -> ${formatBytes(result.compressedSize)}`
                    );
                    return;
                }

                renderPreparedImagePreview(result.file);
            })
            .catch(() => {
                preparedUploadFile = file;
                renderPreparedImagePreview(file, `Gagamitin ang original file: ${formatBytes(file.size)}`);
            })
            .finally(() => {
                setLoaderState(false);
            });
    });

    if (!hasSelectedLocation) {
        requestDeviceLocation({ mode: 'center', showPromptOnDeny: true });
    }
})();

import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';              // ⬅ CHANGED: added (your ESLint config requires prop validation)
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const InlineChatMap = ({
    locations = [],
    center,
    zoom = 10,
    showRoute = false,
    mapStyle = 'dark-v11'
}) => {

    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);

    const [isLoading, setIsLoading] = useState(true);
    const [routeInfo, setRouteInfo] = useState(null);
    const [mapError, setMapError] = useState(null);   // ⬅ CHANGED: surface failures instead of a permanent "Loading map..."

    // ⬅ CHANGED: Serialize object/array props into strings.
    // React compares dependencies by reference. `locations` is a new array on every
    // parent render, so the old dependency list re-ran this effect constantly —
    // destroying and rebuilding the map on every keystroke in the chat textarea.
    const locationsKey = JSON.stringify(locations);
    const centerKey = JSON.stringify(center);

    useEffect(() => {
        // ⬅ CHANGED: Fail loudly if the token is missing.
        // Without this, Mapbox throws an unhelpful internal error.
        const token = import.meta.env.VITE_MAPBOX_TOKEN;
        if (!token) {
            console.error('VITE_MAPBOX_TOKEN is not set in .env');
            setMapError('Map unavailable — missing Mapbox token');
            setIsLoading(false);
            return;
        }

        if (!mapContainerRef.current) return;   // ⬅ CHANGED: guard against a missing container

        // ⬅ CHANGED: Reset state when inputs change, so a previous route's
        // distance/duration doesn't linger on a newly rendered map.
        setIsLoading(true);
        setRouteInfo(null);
        setMapError(null);

        // ⬅ CHANGED: Tracks whether this effect run is still current.
        // Set to true by cleanup; every async continuation checks it before
        // touching the map, which prevents "map is removed" crashes.
        let cancelled = false;

        // Step 1: Set Mapbox token
        mapboxgl.accessToken = token;

        // Step 2: Calculate map center
        let mapCenter = center;
        if (!mapCenter && locations.length > 0) {
            mapCenter = { lng: locations[0].lng, lat: locations[0].lat };
        } else if (!mapCenter) {
            mapCenter = { lng: -95.7129, lat: 37.0902 };  // geographic center of the US
        }

        // Step 3: Create the map
        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: `mapbox://styles/mapbox/${mapStyle}`,
            center: [mapCenter.lng, mapCenter.lat],
            zoom: zoom
            // ⬅ CHANGED: removed `attributionControl: false`.
            // Mapbox's free tier terms require visible attribution.
        });

        mapRef.current = map;

        // ⬅ CHANGED: catch style/network failures so the UI can report them
        map.on('error', (e) => {
            console.error('Mapbox error:', e?.error || e);
            if (!cancelled) {
                setMapError('Map failed to load');
                setIsLoading(false);
            }
        });

        // Step 4: Wait for map to load, then add content
        map.on('load', async () => {
            if (cancelled) return;   // ⬅ CHANGED

            // ==========================================
            // ADD MARKERS for each location
            // ==========================================
            locations.forEach((location, index) => {
                const markerElement = document.createElement('div');
                markerElement.className = 'map-marker';
                markerElement.innerHTML = `
                    <div style="
                        background: linear-gradient(135deg, #00e0ff, #6e56ff);
                        width: 30px;
                        height: 30px;
                        border-radius: 50%;
                        border: 3px solid white;
                        box-shadow: 0 2px 8px rgba(0,224,255,0.5);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-weight: bold;
                        font-size: 14px;
                    ">
                        ${index + 1}
                    </div>
                `;

                const popup = new mapboxgl.Popup({
                    offset: 25,
                    closeButton: false
                }).setHTML(`
                    <div style="
                        padding: 8px;
                        font-weight: 600;
                        color: #1a1a2e;
                    ">
                        ${location.name || `Location ${index + 1}`}
                    </div>
                `);

                new mapboxgl.Marker(markerElement)
                    .setLngLat([location.lng, location.lat])
                    .setPopup(popup)
                    .addTo(map);
            });

            // ==========================================
            // DRAW ROUTE if requested and we have 2+ locations
            // ==========================================
            if (showRoute && locations.length >= 2) {
                try {
                    // Format: "lng1,lat1;lng2,lat2;lng3,lat3"
                    const coordinates = locations
                        .map(loc => `${loc.lng},${loc.lat}`)
                        .join(';');

                    const directionsUrl =
                        `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}` +
                        `?geometries=geojson` +
                        `&overview=full` +
                        `&access_token=${token}`;

                    // ⬅ CHANGED: removed the console.log of directionsUrl.
                    // It contained your access token in plain text in the browser console.

                    const response = await fetch(directionsUrl);

                    // ⬅ CHANGED: check the HTTP status before parsing.
                    // A bad token or malformed coords returns an error body, not a route.
                    if (!response.ok) {
                        throw new Error(`Mapbox Directions ${response.status}`);
                    }

                    const data = await response.json();

                    // ⬅ CHANGED: bail out if the component unmounted mid-fetch.
                    // Without this, addSource/addLayer run against a destroyed map and throw.
                    if (cancelled || !mapRef.current) return;

                    if (data.routes && data.routes.length > 0) {
                        const route = data.routes[0];
                        const routeGeoJSON = route.geometry;

                        // GeoJSON Source = data container for geographic features
                        map.addSource('route', {
                            type: 'geojson',
                            data: {
                                type: 'Feature',
                                properties: {},
                                geometry: routeGeoJSON
                            }
                        });

                        // Layer = how the source data is displayed
                        map.addLayer({
                            id: 'route',
                            type: 'line',
                            source: 'route',
                            layout: {
                                'line-join': 'round',
                                'line-cap': 'round'
                            },
                            paint: {
                                // ⬅ CHANGED: was '#0d3439', which is near-black and
                                // invisible against the dark-v11 basemap.
                                'line-color': '#00e0ff',
                                'line-width': 5,
                                'line-opacity': 0.9
                            }
                        });

                        const distanceKm = (route.distance / 1000).toFixed(1);
                        const distanceMiles = (route.distance * 0.000621371).toFixed(1);
                        const durationHours = (route.duration / 3600).toFixed(1);
                        const durationMinutes = Math.round(route.duration / 60);

                        setRouteInfo({
                            distanceKm,
                            distanceMiles,
                            durationHours,
                            durationMinutes
                        });
                    }

                } catch (error) {
                    console.error('Error fetching route:', error);
                    if (!cancelled) setMapError('Could not calculate route');   // ⬅ CHANGED
                }
            }

            // ==========================================
            // FIT MAP to show all markers
            // ==========================================
            if (!cancelled && locations.length > 1) {   // ⬅ CHANGED: added cancelled check
                const bounds = new mapboxgl.LngLatBounds();
                locations.forEach(loc => {
                    bounds.extend([loc.lng, loc.lat]);
                });
                map.fitBounds(bounds, {
                    padding: 50,
                    maxZoom: 15
                });
            }

            if (!cancelled) setIsLoading(false);   // ⬅ CHANGED
        });

        // CLEANUP - Remove map when component unmounts
        return () => {
            cancelled = true;              // ⬅ CHANGED: stop any in-flight async work
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;     // ⬅ CHANGED: clear the ref so guards above work
            }
        };
    // ⬅ CHANGED: depend on the serialized strings, not the raw objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locationsKey, centerKey, zoom, showRoute, mapStyle]);

    // ==========================================
    // RENDER
    // ==========================================
    return (
        <div style={{
            position: 'relative',
            width: '100%',
            marginTop: '12px'
        }}>
            {/* Loading indicator */}
            {isLoading && !mapError && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'var(--neon-cyan)',
                    fontSize: '14px',
                    fontWeight: '600',
                    zIndex: 10
                }}>
                    Loading map...
                </div>
            )}

            {/* ⬅ CHANGED: error state, so failures are visible instead of a stuck spinner */}
            {mapError && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#ff6b8a',
                    fontSize: '14px',
                    fontWeight: '600',
                    zIndex: 10,
                    textAlign: 'center'
                }}>
                    {mapError}
                </div>
            )}

            {/* Map container */}
            <div
                ref={mapContainerRef}
                style={{
                    width: '100%',
                    height: '400px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid rgba(0, 224, 255, 0.2)',
                    boxShadow: '0 4px 12px rgba(0, 224, 255, 0.1)'
                }}
            />

            {/* Route info panel - shows distance & duration */}
            {routeInfo && (
                <div style={{
                    marginTop: '12px',
                    padding: '12px 16px',
                    background: 'rgba(0, 224, 255, 0.05)',
                    border: '1px solid rgba(0, 224, 255, 0.2)',
                    borderRadius: '8px',
                    display: 'flex',
                    gap: '24px',
                    flexWrap: 'wrap',        // ⬅ CHANGED: keeps the panel readable on mobile
                    fontSize: '14px',
                    color: '#e6eef6'
                }}>
                    <div>
                        <span style={{
                            color: 'var(--neon-cyan)',
                            fontWeight: '600',
                            marginRight: '6px'
                        }}>
                            📍 Distance:
                        </span>
                        {routeInfo.distanceMiles} miles ({routeInfo.distanceKm} km)
                    </div>
                    <div>
                        <span style={{
                            color: 'var(--neon-cyan)',
                            fontWeight: '600',
                            marginRight: '6px'
                        }}>
                            ⏱️ Duration:
                        </span>
                        {routeInfo.durationHours} hours ({routeInfo.durationMinutes} min)
                    </div>
                </div>
            )}
        </div>
    );
};

// ⬅ CHANGED: added PropTypes block
InlineChatMap.propTypes = {
    locations: PropTypes.arrayOf(PropTypes.shape({
        lat: PropTypes.number.isRequired,
        lng: PropTypes.number.isRequired,
        name: PropTypes.string
    })),
    center: PropTypes.shape({
        lat: PropTypes.number,
        lng: PropTypes.number
    }),
    zoom: PropTypes.number,
    showRoute: PropTypes.bool,
    mapStyle: PropTypes.string
};

export default InlineChatMap;
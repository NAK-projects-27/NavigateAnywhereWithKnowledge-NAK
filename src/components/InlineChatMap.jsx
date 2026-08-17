// ============================================
// InlineChatMap.jsx - Interactive map
// ============================================
// Draws one or more routes on a single map.
//
// WHY MULTI-ROUTE:
// Three separate maps for three route options forces the reader to
// hold geography in their head while scrolling. Routes are inherently
// comparative - the question is "which one goes where" - and that's
// only answerable when they're overlaid on the same map.
//
// BACKWARD COMPATIBLE:
// Passing `locations` still works and renders as a single route.
// Passing `routes` enables comparison mode.
// ============================================

import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Chosen to stay legible on the dark basemap and to be
// distinguishable for the most common colour-vision deficiencies
// (they differ in lightness, not just hue).
const ROUTE_COLORS = ['#00e0ff', '#ffb020', '#ff5cf0'];

export default function InlineChatMap({
    locations = [],
    routes = null,
    center,
    zoom = 10,
    showRoute = false,
    mapStyle = 'dark-v11'
}) {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);

    // Which route layers actually made it onto the map. Needed by the
    // highlight effect, which runs separately from map construction.
    const routeLayerIds = useRef([]);

    const [isLoading, setIsLoading] = useState(true);
    const [mapError, setMapError] = useState(null);
    const [routeStats, setRouteStats] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Normalise the two input shapes into one internal form so the
    // rest of the component only deals with an array of routes.
    const normalisedRoutes = routes && routes.length > 0
        ? routes
        : [{ name: null, locations, showRoute }];

    const isComparison = normalisedRoutes.length > 1;

    const routesKey = JSON.stringify(normalisedRoutes);
    const centerKey = JSON.stringify(center);

    // ============================================
    // BUILD THE MAP
    // ============================================
    useEffect(() => {
        const token = import.meta.env.VITE_MAPBOX_TOKEN;
        if (!token) {
            console.error('VITE_MAPBOX_TOKEN is not set in .env');
            setMapError('Map unavailable — missing Mapbox token');
            setIsLoading(false);
            return;
        }

        if (!mapContainerRef.current) return;

        setIsLoading(true);
        setMapError(null);
        setRouteStats([]);
        setSelectedIndex(0);
        routeLayerIds.current = [];

        let cancelled = false;

        mapboxgl.accessToken = token;

        // Centre on the first point we have, or the middle of the US
        const firstLocation = normalisedRoutes[0]?.locations?.[0];
        const mapCenter = center
            || (firstLocation && { lng: firstLocation.lng, lat: firstLocation.lat })
            || { lng: -95.7129, lat: 37.0902 };

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: `mapbox://styles/mapbox/${mapStyle}`,
            center: [mapCenter.lng, mapCenter.lat],
            zoom
        });

        mapRef.current = map;

        map.on('error', (e) => {
            console.error('Mapbox error:', e?.error || e);
            if (!cancelled) {
                setMapError('Map failed to load');
                setIsLoading(false);
            }
        });

        map.on('load', async () => {
            if (cancelled) return;

            const bounds = new mapboxgl.LngLatBounds();
            const stats = [];

            // ---- Markers, one set per route ----
            normalisedRoutes.forEach((route, routeIndex) => {
                const color = ROUTE_COLORS[routeIndex % ROUTE_COLORS.length];

                (route.locations || []).forEach((location, stopIndex) => {
                    bounds.extend([location.lng, location.lat]);

                    const markerElement = document.createElement('div');
                    markerElement.innerHTML = `
                        <div style="
                            background: ${color};
                            width: 26px;
                            height: 26px;
                            border-radius: 50%;
                            border: 2px solid #0b1220;
                            box-shadow: 0 2px 8px ${color}88;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: #0b1220;
                            font-weight: 700;
                            font-size: 12px;
                        ">${stopIndex + 1}</div>
                    `;

                    const popup = new mapboxgl.Popup({
                        offset: 22,
                        closeButton: false
                    }).setHTML(`
                        <div style="padding: 6px; font-weight: 600; color: #1a1a2e;">
                            ${location.name || `Stop ${stopIndex + 1}`}
                        </div>
                    `);

                    new mapboxgl.Marker(markerElement)
                        .setLngLat([location.lng, location.lat])
                        .setPopup(popup)
                        .addTo(map);
                });
            });

            // ---- Route lines ----
            // Fetched in parallel. A four-route block would otherwise
            // wait for four sequential round trips.
            const routeResults = await Promise.allSettled(
                normalisedRoutes.map(route => {
                    const wantsLine = route.showRoute !== false
                        && (route.locations || []).length >= 2;

                    if (!wantsLine) return Promise.resolve(null);

                    const coordinates = route.locations
                        .map(loc => `${loc.lng},${loc.lat}`)
                        .join(';');

                    return fetchRoute(coordinates, token);
                })
            );

            if (cancelled || !mapRef.current) return;

            routeResults.forEach((outcome, routeIndex) => {
                if (outcome.status !== 'fulfilled' || !outcome.value) {
                    if (outcome.status === 'rejected') {
                        console.warn(`Route ${routeIndex} failed:`, outcome.reason?.message);
                    }
                    return;
                }

                const route = outcome.value;
                const sourceId = `route-${routeIndex}`;
                const color = ROUTE_COLORS[routeIndex % ROUTE_COLORS.length];

                map.addSource(sourceId, {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        properties: {},
                        geometry: route.geometry
                    }
                });

                map.addLayer({
                    id: sourceId,
                    type: 'line',
                    source: sourceId,
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: {
                        'line-color': color,
                        // Selected route sits on top at full strength;
                        // the others recede so the choice reads clearly.
                        'line-width': routeIndex === 0 ? 6 : 3,
                        'line-opacity': routeIndex === 0 ? 1 : 0.35
                    }
                });

                routeLayerIds.current.push(sourceId);

                stats[routeIndex] = {
                    distanceMiles: (route.distance * 0.000621371).toFixed(0),
                    distanceKm: (route.distance / 1000).toFixed(0),
                    durationHours: (route.duration / 3600).toFixed(1),
                    durationMinutes: Math.round(route.duration / 60)
                };

                // Clicking a line selects it, which is more discoverable
                // than only offering the tabs below.
                if (isComparison) {
                    map.on('click', sourceId, () => setSelectedIndex(routeIndex));
                    map.on('mouseenter', sourceId, () => {
                        map.getCanvas().style.cursor = 'pointer';
                    });
                    map.on('mouseleave', sourceId, () => {
                        map.getCanvas().style.cursor = '';
                    });
                }
            });

            if (!cancelled) setRouteStats(stats);

            // ---- Fit to everything ----
            if (!bounds.isEmpty()) {
                map.fitBounds(bounds, { padding: 55, maxZoom: 14 });
            }

            if (!cancelled) setIsLoading(false);
        });

        return () => {
            cancelled = true;
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routesKey, centerKey, zoom, mapStyle]);

    // ============================================
    // HIGHLIGHT THE SELECTED ROUTE
    // ============================================
    // Separate effect so selecting a route restyles the existing layers
    // instead of tearing down and rebuilding the whole map.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || routeLayerIds.current.length === 0) return;

        routeLayerIds.current.forEach(layerId => {
            const index = Number(layerId.split('-')[1]);
            const isSelected = index === selectedIndex;

            // The layer may be gone if the style is still swapping
            if (!map.getLayer(layerId)) return;

            map.setPaintProperty(layerId, 'line-width', isSelected ? 6 : 3);
            map.setPaintProperty(layerId, 'line-opacity', isSelected ? 1 : 0.35);
        });
    }, [selectedIndex, isLoading]);

    // ============================================
    // RENDER
    // ============================================
    const activeStats = routeStats[selectedIndex];
    const activeRoute = normalisedRoutes[selectedIndex];

    return (
        <div style={{ position: 'relative', width: '100%', marginTop: '12px' }}>
            {isLoading && !mapError && (
                <div style={overlayStyle}>Loading map...</div>
            )}

            {mapError && (
                <div style={{ ...overlayStyle, color: '#ff6b8a' }}>{mapError}</div>
            )}

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

            {/* ---------- ROUTE PICKER ---------- */}
            {isComparison && (
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginTop: '10px',
                    overflowX: 'auto',
                    paddingBottom: '2px'
                }}>
                    {normalisedRoutes.map((route, index) => {
                        const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
                        const isSelected = index === selectedIndex;
                        const stats = routeStats[index];

                        return (
                            <button
                                key={index}
                                onClick={() => setSelectedIndex(index)}
                                style={{
                                    flex: '1 0 auto',
                                    minWidth: '120px',
                                    textAlign: 'left',
                                    padding: '10px 12px',
                                    borderRadius: '10px',
                                    border: isSelected
                                        ? `1px solid ${color}`
                                        : '1px solid rgba(255,255,255,0.08)',
                                    background: isSelected
                                        ? `${color}14`
                                        : 'rgba(255,255,255,0.02)',
                                    cursor: 'pointer',
                                    opacity: isSelected ? 1 : 0.65
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    marginBottom: '3px'
                                }}>
                                    <span style={{
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '2px',
                                        background: color,
                                        flexShrink: 0
                                    }} />
                                    <span style={{
                                        fontSize: '12.5px',
                                        fontWeight: 700,
                                        color: '#eaf6ff'
                                    }}>
                                        {route.name || `Route ${index + 1}`}
                                    </span>
                                </div>

                                {stats && (
                                    <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                                        {stats.distanceMiles} mi · {stats.durationHours} hrs
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ---------- SELECTED ROUTE DETAIL ---------- */}
            {activeStats && (
                <div style={{
                    marginTop: '10px',
                    padding: '12px 16px',
                    background: 'rgba(0, 224, 255, 0.05)',
                    border: '1px solid rgba(0, 224, 255, 0.2)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#e6eef6'
                }}>
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                        <div>
                            <span style={labelStyle}>📍 Distance:</span>
                            {activeStats.distanceMiles} miles ({activeStats.distanceKm} km)
                        </div>
                        <div>
                            <span style={labelStyle}>⏱️ Duration:</span>
                            {activeStats.durationHours} hours
                        </div>
                    </div>

                    {activeRoute?.summary && (
                        <div style={{
                            marginTop: '8px',
                            fontSize: '13px',
                            opacity: 0.75,
                            lineHeight: 1.45
                        }}>
                            {activeRoute.summary}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/** One Directions call. Throws on a bad status so callers can log it. */
async function fetchRoute(coordinates, token) {
    const params = new URLSearchParams({
        geometries: 'geojson',
        overview: 'full',
        access_token: token
    });

    const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?${params}`
    );

    if (!response.ok) {
        throw new Error(`Mapbox Directions ${response.status}`);
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
        throw new Error('No route found');
    }

    return data.routes[0];
}

const overlayStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: 'var(--neon-cyan)',
    fontSize: '14px',
    fontWeight: '600',
    zIndex: 10,
    textAlign: 'center'
};

const labelStyle = {
    color: 'var(--neon-cyan)',
    fontWeight: '600',
    marginRight: '6px'
};

const locationShape = PropTypes.shape({
    lat: PropTypes.number.isRequired,
    lng: PropTypes.number.isRequired,
    name: PropTypes.string
});

InlineChatMap.propTypes = {
    locations: PropTypes.arrayOf(locationShape),
    routes: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string,
        summary: PropTypes.string,
        locations: PropTypes.arrayOf(locationShape),
        showRoute: PropTypes.bool
    })),
    center: PropTypes.shape({ lat: PropTypes.number, lng: PropTypes.number }),
    zoom: PropTypes.number,
    showRoute: PropTypes.bool,
    mapStyle: PropTypes.string
};
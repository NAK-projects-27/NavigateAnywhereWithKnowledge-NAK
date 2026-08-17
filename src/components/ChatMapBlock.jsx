// ============================================
// ChatMapBlock.jsx
// ============================================
// Turns place NAMES from the AI into coordinates, then hands them to
// InlineChatMap.
//
// WHAT CHANGED FOR MULTI-ROUTE:
// Previously this resolved one list of places. It now also handles a
// "routes" array, geocoding every route's stops in one batch so
// shared cities (all three routes start in Louisville) cost a single
// lookup rather than three.
// ============================================

import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import InlineChatMap from './InlineChatMap';
import { geocodeMultipleLocations } from '../api/mapboxApi';

export default function ChatMapBlock({ data }) {
    const [locations, setLocations] = useState([]);
    const [routes, setRoutes] = useState(null);
    const [isResolving, setIsResolving] = useState(true);
    const [error, setError] = useState(null);

    const dataKey = JSON.stringify(data);

    useEffect(() => {
        let cancelled = false;

        async function resolve() {
            setIsResolving(true);
            setError(null);
            setRoutes(null);
            setLocations([]);

            try {
                // ---------- COMPARISON MODE ----------
                if (Array.isArray(data.routes) && data.routes.length > 0) {
                    // Cap at three. Four overlapping lines on one map is
                    // unreadable and the colour palette runs out.
                    const requested = data.routes.slice(0, 3);

                    const resolvedRoutes = [];

                    for (const route of requested) {
                        const names = extractNames(route);
                        if (names.length === 0) continue;

                        // Sequential rather than parallel: the geocoder
                        // caches by name, and routes usually share stops.
                        // Running them in order lets later routes hit the
                        // cache instead of racing on the same lookups.
                        const stops = await geocodeMultipleLocations(names);
                        if (cancelled) return;

                        if (stops.length > 0) {
                            resolvedRoutes.push({
                                name: route.name || null,
                                summary: route.summary || null,
                                locations: stops,
                                showRoute: route.showRoute !== false
                            });
                        }
                    }

                    if (resolvedRoutes.length === 0) {
                        throw new Error('Could not find those places');
                    }

                    setRoutes(resolvedRoutes);
                    return;
                }

                // ---------- SINGLE ROUTE (unchanged behaviour) ----------
                const hasCoords =
                    Array.isArray(data.locations) &&
                    data.locations.length > 0 &&
                    typeof data.locations[0]?.lat === 'number';

                if (hasCoords) {
                    setLocations(data.locations);
                    return;
                }

                const names = extractNames(data);

                if (names.length === 0) {
                    throw new Error('No places to show');
                }

                const resolved = await geocodeMultipleLocations(names);
                if (cancelled) return;

                if (resolved.length === 0) {
                    throw new Error('Could not find those places');
                }

                setLocations(resolved);

            } catch (err) {
                console.error('ChatMapBlock error:', err);
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setIsResolving(false);
            }
        }

        resolve();

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataKey]);

    if (isResolving) {
        return (
            <div style={{
                marginTop: '12px',
                height: '400px',
                borderRadius: '12px',
                border: '1px solid rgba(0, 224, 255, 0.2)',
                background: 'rgba(0, 224, 255, 0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--neon-cyan)',
                fontSize: '14px',
                fontWeight: '600'
            }}>
                Finding locations...
            </div>
        );
    }

    if (error) {
        return (
            <div style={{
                marginTop: '12px',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 107, 138, 0.3)',
                background: 'rgba(255, 107, 138, 0.05)',
                color: '#ff6b8a',
                fontSize: '14px'
            }}>
                Map unavailable - {error}
            </div>
        );
    }

    // Comparison mode
    if (routes) {
        return (
            <InlineChatMap
                routes={routes}
                zoom={data.zoom || 6}
                mapStyle={data.mapStyle || 'outdoors-v12'}
            />
        );
    }

    // Single route
    const showRoute = data.showRoute !== undefined
        ? data.showRoute
        : locations.length >= 2;

    return (
        <InlineChatMap
            locations={locations}
            center={data.center}
            zoom={data.zoom || 10}
            showRoute={showRoute}
            mapStyle={data.mapStyle || 'dark-v11'}
        />
    );
}

/** Pull place names out of the shapes Claude might produce. */
function extractNames(source) {
    if (Array.isArray(source.places)) {
        return source.places.filter(Boolean);
    }

    const fromParts = [
        source.origin,
        ...(source.waypoints || []),
        source.destination
    ].filter(Boolean);

    if (fromParts.length > 0) return fromParts;

    if (Array.isArray(source.locations)) {
        return source.locations
            .map(loc => (typeof loc === 'string' ? loc : loc?.name))
            .filter(Boolean);
    }

    return [];
}

ChatMapBlock.propTypes = {
    data: PropTypes.object.isRequired
};
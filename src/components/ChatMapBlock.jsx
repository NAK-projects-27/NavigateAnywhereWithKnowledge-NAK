// ============================================
// ChatMapBlock.jsx
// --------------------------------------------
// Sits between MessageBubble and InlineChatMap.
//
// THE PROBLEM IT SOLVES:
// Claude writes place NAMES ("Dallas, TX"). InlineChatMap needs
// COORDINATES ({ lat: 32.7767, lng: -96.797 }). Claude cannot be
// trusted to produce accurate coordinates - it will invent numbers
// that look plausible but drift, especially for small towns.
//
// This component takes names, runs them through mapboxApi's
// geocoder, and hands real coordinates to the map.
// ============================================

import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import InlineChatMap from './InlineChatMap';
import { geocodeMultipleLocations } from '../api/mapboxApi';

export default function ChatMapBlock({ data }) {
    const [locations, setLocations] = useState([]);
    const [isResolving, setIsResolving] = useState(true);
    const [error, setError] = useState(null);

    // Serialize so the effect doesn't re-run on every parent render.
    // Same reference-equality trap we fixed in InlineChatMap.
    const dataKey = JSON.stringify(data);

    useEffect(() => {
        let cancelled = false;

        async function resolve() {
            setIsResolving(true);
            setError(null);

            try {
                // CASE 1: message already has real coordinates - use as-is
                const hasCoords =
                    Array.isArray(data.locations) &&
                    data.locations.length > 0 &&
                    typeof data.locations[0]?.lat === 'number';

                if (hasCoords) {
                    if (!cancelled) setLocations(data.locations);
                    return;
                }

                // CASE 2: build the list of place names to look up.
                // Supports the shapes Claude might produce:
                //   { places: ["Dallas, TX", "Memphis, TN"] }      <- preferred
                //   { origin, destination, waypoints: [] }
                let names = [];

                if (Array.isArray(data.places)) {
                    names = data.places;
                } else {
                    names = [
                        data.origin,
                        ...(data.waypoints || []),
                        data.destination
                    ].filter(Boolean);
                }

                // Fallback: locations given as bare strings or name-only objects
                if (names.length === 0 && Array.isArray(data.locations)) {
                    names = data.locations
                        .map(loc => (typeof loc === 'string' ? loc : loc?.name))
                        .filter(Boolean);
                }

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

    // Placeholder matches the map's height so chat doesn't jump
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

    // Default to showing a route whenever there are 2+ stops
    const showRoute =
        data.showRoute !== undefined
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

ChatMapBlock.propTypes = {
    data: PropTypes.object.isRequired
};
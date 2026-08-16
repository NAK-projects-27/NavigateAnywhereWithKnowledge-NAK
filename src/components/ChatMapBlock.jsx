// ============================================
// ChatMapBlock.jsx
// ============================================
// Bridge between a stored message's metadata and InlineChatMap.
//
// The database stores place NAMES (what Claude produced):
//   { type: 'map', origin: 'Dallas, TX', destination: 'Louisville, KY' }
//
// InlineChatMap needs COORDINATES. This component does the
// geocoding in between, and handles the loading and error states
// that come with an async lookup.
//
// Keeping this separate means ChatInterface only has to decide
// *whether* to render a map, not *how*.

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import InlineChatMap from './InlineChatMap';
import { buildMapData } from '../api/mapboxApi';

export default function ChatMapBlock({ spec }) {
    const [mapData, setMapData] = useState(null);
    const [error, setError] = useState(null);

    // Serialize the spec so this effect runs when the CONTENT changes,
    // not every time the parent re-renders with a new object reference.
    const specKey = JSON.stringify(spec);

    useEffect(() => {
        let cancelled = false;

        async function resolve() {
            try {
                const data = await buildMapData({
                    origin: spec.origin,
                    destination: spec.destination,
                    waypoints: spec.waypoints || []
                });

                if (cancelled) return;

                // A route needs at least two resolvable places. If Claude
                // invented a place name Mapbox can't find, say so rather
                // than rendering a broken single-marker map.
                if (data.locations.length < 2) {
                    setError('Could not locate those places on the map');
                    return;
                }

                setMapData(data);
            } catch (err) {
                console.error('Map geocoding failed:', err);
                if (!cancelled) setError('Could not load the map');
            }
        }

        resolve();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [specKey]);

    if (error) {
        return (
            <div style={{
                marginTop: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'rgba(255, 107, 138, 0.06)',
                border: '1px solid rgba(255, 107, 138, 0.2)',
                color: '#ff6b8a',
                fontSize: '14px'
            }}>
                {error}
            </div>
        );
    }

    if (!mapData) {
        return (
            <div style={{
                marginTop: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'rgba(0, 224, 255, 0.05)',
                border: '1px solid rgba(0, 224, 255, 0.15)',
                color: 'var(--neon-cyan)',
                fontSize: '14px'
            }}>
                Finding locations...
            </div>
        );
    }

    return (
        <InlineChatMap
            locations={mapData.locations}
            showRoute={mapData.showRoute}
        />
    );
}

ChatMapBlock.propTypes = {
    spec: PropTypes.shape({
        type: PropTypes.string,
        origin: PropTypes.string.isRequired,
        destination: PropTypes.string.isRequired,
        waypoints: PropTypes.arrayOf(PropTypes.string)
    }).isRequired
};
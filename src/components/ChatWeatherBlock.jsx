// ============================================
// ChatWeatherBlock.jsx
// --------------------------------------------
// The weather equivalent of ChatMapBlock.
//
// Claude writes a place NAME. OpenWeather needs COORDINATES.
// This component geocodes the name using the same cached geocoder
// the map already uses, then fetches weather for those coordinates.
//
// Because geocodeLocationCached is shared, asking for a map and
// weather for the same city costs one geocode, not two.
// ============================================

import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import InlineChatWeather from './InlineChatWeather';
import { geocodeLocationCached } from '../api/mapboxApi';
import { getWeatherBundle } from '../api/weatherApi';

export default function ChatWeatherBlock({ data }) {
    const [weather, setWeather] = useState(null);
    const [placeName, setPlaceName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Serialize so the effect doesn't re-run on every parent render
    const dataKey = JSON.stringify(data);

    const units = data.units === 'metric' ? 'metric' : 'imperial';

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setIsLoading(true);
            setError(null);

            try {
                // Accept either { place: "Dallas, TX" } or { places: [...] }
                const place = data.place
                    || (Array.isArray(data.places) ? data.places[0] : null);

                if (!place) {
                    throw new Error('No place specified');
                }

                // Step 1: name -> coordinates (cached, shared with maps)
                const location = await geocodeLocationCached(place);
                if (cancelled) return;

                // Step 2: coordinates -> weather (cached for 10 minutes)
                const bundle = await getWeatherBundle(
                    location.lat,
                    location.lng,
                    units
                );
                if (cancelled) return;

                // Prefer the geocoder's name - it's the one the user typed,
                // not OpenWeather's nearest-station name, which is sometimes
                // a suburb nobody recognises.
                setPlaceName(location.fullAddress || location.name || place);
                setWeather(bundle);

            } catch (err) {
                console.error('ChatWeatherBlock error:', err);
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        load();

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataKey, units]);

    // Placeholder roughly matches the loaded card's height
    if (isLoading) {
        return (
            <div style={{
                marginTop: '12px',
                height: '200px',
                borderRadius: '12px',
                border: '1px solid rgba(0, 224, 255, 0.2)',
                background: 'rgba(0, 224, 255, 0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--neon-cyan)',
                fontSize: '14px',
                fontWeight: 600
            }}>
                Checking the forecast...
            </div>
        );
    }

    if (error || !weather) {
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
                Weather unavailable - {error || 'no data returned'}
            </div>
        );
    }

    return (
        <InlineChatWeather
            placeName={placeName}
            current={weather.current}
            forecast={weather.forecast}
            units={units}
        />
    );
}

ChatWeatherBlock.propTypes = {
    data: PropTypes.object.isRequired
};
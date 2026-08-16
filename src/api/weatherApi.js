// ============================================
// weatherApi.js - OpenWeather API Service
// ============================================
// Wraps the two OpenWeather endpoints available on the free tier:
//
//   /weather   - current conditions at a point
//   /forecast  - 5 days of readings, one every 3 hours
//
// NOTE ON THE FREE TIER:
// OpenWeather's nice 7-day daily forecast lives behind One Call 3.0,
// which requires a card on file even though it has a free allowance.
// This file uses the endpoints that need no card. That means 5 days,
// not 7, and we build daily summaries ourselves by grouping the
// 3-hourly readings.
// ============================================

const WEATHER_TOKEN = import.meta.env.VITE_openWeatherAPI;

const BASE_URL = 'https://api.openweathermap.org/data/2.5';

if (!WEATHER_TOKEN) {
    console.error('VITE_OPENWEATHER_KEY is not set in .env');
}

// ============================================
// CACHE
// ============================================
// Weather changes slowly, and React re-renders quickly. Without a
// cache, scrolling a conversation with three weather blocks re-fetches
// all of them constantly.
//
// Entries expire after 10 minutes - long enough to stop render churn,
// short enough that the data stays honest.
const CACHE_TTL_MS = 10 * 60 * 1000;
const weatherCache = new Map();

function getCached(key) {
    const entry = weatherCache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
        weatherCache.delete(key);   // stale, throw it away
        return null;
    }

    return entry.value;
}

function setCached(key, value) {
    weatherCache.set(key, { value, storedAt: Date.now() });
}

// ============================================
// ICON MAPPING
// ============================================
// OpenWeather returns codes like "01d" (clear day) or "10n" (rain
// night). We map them to emoji so there's no extra image request and
// nothing to host.
const ICON_EMOJI = {
    '01d': '☀️', '01n': '🌙',
    '02d': '⛅', '02n': '☁️',
    '03d': '☁️', '03n': '☁️',
    '04d': '☁️', '04n': '☁️',
    '09d': '🌧️', '09n': '🌧️',
    '10d': '🌦️', '10n': '🌧️',
    '11d': '⛈️', '11n': '⛈️',
    '13d': '❄️', '13n': '❄️',
    '50d': '🌫️', '50n': '🌫️',
};

export function iconFor(code) {
    return ICON_EMOJI[code] || '🌡️';
}

// ============================================
// CURRENT WEATHER
// ============================================
/**
 * Current conditions for a coordinate.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {string} [units] 'imperial' (F) or 'metric' (C)
 * @returns {Promise<Object>}
 */
export async function getCurrentWeather(lat, lng, units = 'imperial') {
    if (!WEATHER_TOKEN) {
        throw new Error('VITE_OPENWEATHER_KEY is not set in .env');
    }

    const cacheKey = `current|${lat.toFixed(2)}|${lng.toFixed(2)}|${units}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lng),
        units,
        appid: WEATHER_TOKEN
    });

    const response = await fetch(`${BASE_URL}/weather?${params}`);

    if (!response.ok) {
        // 401 here almost always means the key is still activating.
        // New OpenWeather keys take up to a couple of hours to work.
        throw new Error(
            response.status === 401
                ? 'OpenWeather rejected the key (new keys take ~2h to activate)'
                : `OpenWeather ${response.status}`
        );
    }

    const data = await response.json();

    const result = {
        temp: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        tempMin: Math.round(data.main.temp_min),
        tempMax: Math.round(data.main.temp_max),
        humidity: data.main.humidity,
        windSpeed: Math.round(data.wind?.speed ?? 0),
        description: data.weather?.[0]?.description ?? '',
        icon: data.weather?.[0]?.icon ?? '01d',
        cityName: data.name,
        units
    };

    setCached(cacheKey, result);
    return result;
}

// ============================================
// FORECAST
// ============================================
/**
 * 5-day forecast, collapsed into one entry per day.
 *
 * The API returns ~40 readings spaced 3 hours apart. We group them by
 * local date, then take the high, the low, and the most common daytime
 * condition for each day.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {string} [units]
 * @returns {Promise<Array>} one object per day
 */
export async function getForecast(lat, lng, units = 'imperial') {
    if (!WEATHER_TOKEN) {
        throw new Error('VITE_OPENWEATHER_KEY is not set in .env');
    }

    const cacheKey = `forecast|${lat.toFixed(2)}|${lng.toFixed(2)}|${units}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lng),
        units,
        appid: WEATHER_TOKEN
    });

    const response = await fetch(`${BASE_URL}/forecast?${params}`);

    if (!response.ok) {
        throw new Error(
            response.status === 401
                ? 'OpenWeather rejected the key (new keys take ~2h to activate)'
                : `OpenWeather ${response.status}`
        );
    }

    const data = await response.json();

    // Timezone offset in seconds for the requested city. Applying it
    // means "Tuesday" is Tuesday where the traveller is, not in UTC.
    const tzOffsetSeconds = data.city?.timezone ?? 0;

    const byDay = new Map();

    (data.list || []).forEach(reading => {
        const localMs = (reading.dt + tzOffsetSeconds) * 1000;
        const localDate = new Date(localMs);
        const dayKey = localDate.toISOString().slice(0, 10);  // YYYY-MM-DD

        if (!byDay.has(dayKey)) {
            byDay.set(dayKey, {
                dateKey: dayKey,
                dateMs: localMs,
                temps: [],
                icons: [],
                descriptions: []
            });
        }

        const day = byDay.get(dayKey);
        day.temps.push(reading.main.temp);

        // Prefer daytime readings when picking the day's icon - a
        // forecast card showing a moon for Tuesday is confusing.
        const hourUTC = localDate.getUTCHours();
        if (hourUTC >= 9 && hourUTC <= 18) {
            day.icons.push(reading.weather?.[0]?.icon);
            day.descriptions.push(reading.weather?.[0]?.description);
        }
    });

    const days = Array.from(byDay.values()).map(day => {
        // Fall back to any reading if this day had no daytime samples
        // (happens for the first and last day of the window).
        const icons = day.icons.filter(Boolean);
        const descriptions = day.descriptions.filter(Boolean);

        return {
            dateKey: day.dateKey,
            label: new Date(day.dateMs).toLocaleDateString('en-US', {
                weekday: 'short',
                timeZone: 'UTC'
            }),
            high: Math.round(Math.max(...day.temps)),
            low: Math.round(Math.min(...day.temps)),
            icon: mostCommon(icons) || '01d',
            description: mostCommon(descriptions) || ''
        };
    });

    setCached(cacheKey, days);
    return days;
}

/** Most frequently occurring value in an array. */
function mostCommon(items) {
    if (!items || items.length === 0) return null;

    const counts = new Map();
    items.forEach(item => counts.set(item, (counts.get(item) || 0) + 1));

    let best = null;
    let bestCount = 0;
    counts.forEach((count, item) => {
        if (count > bestCount) {
            best = item;
            bestCount = count;
        }
    });

    return best;
}

// ============================================
// COMBINED FETCH
// ============================================
/**
 * Current conditions plus forecast in one call, fetched in parallel.
 * This is what ChatWeatherBlock uses.
 */
export async function getWeatherBundle(lat, lng, units = 'imperial') {
    const [current, forecast] = await Promise.all([
        getCurrentWeather(lat, lng, units),
        getForecast(lat, lng, units)
    ]);

    return { current, forecast };
}

/** Degree symbol for the unit system in use. */
export function unitSymbol(units) {
    return units === 'metric' ? '°C' : '°F';
}

/** Wind speed label for the unit system in use. */
export function windUnit(units) {
    return units === 'metric' ? 'm/s' : 'mph';
}
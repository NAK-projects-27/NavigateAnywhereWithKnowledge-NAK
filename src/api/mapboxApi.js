// ============================================
// mapboxApi.js - Mapbox API Service
// ============================================
// This file provides functions to interact with Mapbox APIs
// - Geocoding: Convert addresses to coordinates
// - Reverse Geocoding: Convert coordinates to addresses
// - Directions: Get routes between locations

// LEARNING NOTE: API Services
// ============================
// We create separate files for API interactions because:
// 1. Keeps code organized
// 2. Easy to reuse functions
// 3. Easy to test
// 4. Separates concerns (components don't need to know API details)

// Get the Mapbox token from environment variables
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Base URL for Mapbox APIs
const GEOCODING_API = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const DIRECTIONS_API = 'https://api.mapbox.com/directions/v5/mapbox';

// ============================================
// GEOCODING - Convert location names to coordinates
// ============================================
/**
 * Convert a location name (like "Dallas, TX") to coordinates
 * 
 * @param {string} locationName - The place to search for
 * @returns {Promise<Object>} - { name, lat, lng, fullAddress }
 * 
 * Example usage:
 * const location = await geocodeLocation("Dallas, TX");
 * // Returns: { name: "Dallas", lat: 32.7767, lng: -96.7970, fullAddress: "Dallas, Texas, United States" }
 */
export async function geocodeLocation(locationName) {
    try {
        // Encode the location name for URL (spaces become %20, etc.)
        const query = encodeURIComponent(locationName);
        
        // Build the API URL
        const url = `${GEOCODING_API}/${query}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
        
        // Make the API request
        const response = await fetch(url);
        
        // Check if request was successful
        if (!response.ok) {
            throw new Error(`Geocoding failed: ${response.statusText}`);
        }
        
        // Parse the JSON response
        const data = await response.json();
        
        // Check if we got any results
        if (!data.features || data.features.length === 0) {
            throw new Error(`Location not found: ${locationName}`);
        }
        
        // Get the first result (most relevant)
        const feature = data.features[0];
        
        // Extract the data we need
        return {
            name: feature.text,                    // Short name (e.g., "Dallas")
            fullAddress: feature.place_name,       // Full address
            lat: feature.center[1],                // Latitude (note: Mapbox returns [lng, lat])
            lng: feature.center[0],                // Longitude
            bbox: feature.bbox                     // Bounding box (useful for fitting map)
        };
        
    } catch (error) {
        console.error('Geocoding error:', error);
        throw error;
    }
}

// ============================================
// BATCH GEOCODING - Convert multiple locations at once
// ============================================
/**
 * Geocode multiple locations
 * 
 * @param {string[]} locationNames - Array of place names
 * @returns {Promise<Object[]>} - Array of geocoded locations
 * 
 * Example usage:
 * const locations = await geocodeMultipleLocations(["Dallas, TX", "Memphis, TN"]);
 */
export async function geocodeMultipleLocations(locationNames) {
    const settled = await Promise.allSettled(
        locationNames.map(name => geocodeLocationCached(name))
    );

    const results = [];
    settled.forEach((outcome, i) => {
        if (outcome.status === 'fulfilled') {
            results.push(outcome.value);
        } else {
            console.warn(`Could not geocode "${locationNames[i]}":`, outcome.reason?.message);
        }
    });

    return results;
}

// ============================================
// REVERSE GEOCODING - Convert coordinates to address
// ============================================
/**
 * Convert coordinates to a human-readable address
 * 
 * @param {number} lng - Longitude
 * @param {number} lat - Latitude
 * @returns {Promise<Object>} - { name, fullAddress, city, state, country }
 */
export async function reverseGeocode(lng, lat) {
    try {
        const url = `${GEOCODING_API}/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Reverse geocoding failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.features || data.features.length === 0) {
            throw new Error('No address found for these coordinates');
        }
        
        const feature = data.features[0];
        
        // Extract address components
        const components = {
            name: feature.text,
            fullAddress: feature.place_name,
            lat: lat,
            lng: lng
        };
        
        // Extract city, state, country from context
        if (feature.context) {
            feature.context.forEach(item => {
                if (item.id.startsWith('place.')) {
                    components.city = item.text;
                } else if (item.id.startsWith('region.')) {
                    components.state = item.text;
                } else if (item.id.startsWith('country.')) {
                    components.country = item.text;
                }
            });
        }
        
        return components;
        
    } catch (error) {
        console.error('Reverse geocoding error:', error);
        throw error;
    }
}

// ============================================
// DIRECTIONS - Get route between locations
// ============================================
/**
 * Get driving directions between multiple locations
 * 
 * @param {Array<{lng, lat}>} coordinates - Array of waypoints
 * @param {string} profile - 'driving', 'walking', 'cycling', 'driving-traffic'
 * @returns {Promise<Object>} - Route data with geometry and distance/duration
 */
export async function getDirections(coordinates, profile = 'driving') {
    try {
        // Format coordinates for the API: "lng,lat;lng,lat;lng,lat"
        const coordsString = coordinates
            .map(coord => `${coord.lng},${coord.lat}`)
            .join(';');
        
        const url = `${DIRECTIONS_API}/${profile}/${coordsString}?` +
            `geometries=geojson&` +
            `overview=full&` +
            `steps=true&` +
            `access_token=${MAPBOX_TOKEN}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Directions failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.routes || data.routes.length === 0) {
            throw new Error('No route found');
        }
        
        const route = data.routes[0];
        
        return {
            geometry: route.geometry,              // GeoJSON LineString for drawing route
            distance: route.distance,              // Distance in meters
            duration: route.duration,              // Duration in seconds
            distanceMiles: (route.distance * 0.000621371).toFixed(1), // Convert to miles
            durationHours: (route.duration / 3600).toFixed(1),        // Convert to hours
            steps: route.legs[0]?.steps || []     // Turn-by-turn directions
        };
        
    } catch (error) {
        console.error('Directions error:', error);
        throw error;
    }
}

// ============================================
// CACHING - Store geocoding results to avoid repeated API calls
// ============================================
// Simple in-memory cache
const geocodeCache = new Map();

/**
 * Geocode with caching - checks cache before making API call
 * 
 * @param {string} locationName - The place to search for
 * @returns {Promise<Object>} - Geocoded location
 */
export async function geocodeLocationCached(locationName) {
    // Check if we already have this location cached
    if (geocodeCache.has(locationName)) {
        console.log(`Using cached result for: ${locationName}`);
        return geocodeCache.get(locationName);
    }
    
    // Not in cache, make API call
    const result = await geocodeLocation(locationName);
    
    // Store in cache for next time
    geocodeCache.set(locationName, result);
    
    return result;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate distance between two points (in miles)
 * Uses the Haversine formula
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 3959; // Earth's radius in miles
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance.toFixed(1);
}

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Format distance in a human-readable way
 */
export function formatDistance(meters) {
    const miles = meters * 0.000621371;
    return miles < 1 
        ? `${(miles * 5280).toFixed(0)} feet`
        : `${miles.toFixed(1)} miles`;
}

/**
 * Format duration in a human-readable way
 */
export function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
}
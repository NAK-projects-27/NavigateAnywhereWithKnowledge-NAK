import { useEffect, useRef, useState } from 'react';
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

    useEffect(() => {
        // Step 1: Set Mapbox token
        mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

        // Step 2: Calculate map center
        let mapCenter = center;
        if (!mapCenter && locations.length > 0) {
            mapCenter = { lng: locations[0].lng, lat: locations[0].lat };
        } else if (!mapCenter) {
            mapCenter = { lng: -95.7129, lat: 37.0902 };
        }

        // Step 3: Create the map
        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: `mapbox://styles/mapbox/${mapStyle}`,
            center: [mapCenter.lng, mapCenter.lat],
            zoom: zoom,
            attributionControl: false
        });

        mapRef.current = map;

        // Step 4: Wait for map to load, then add content
        map.on('load', async () => {
            
           
            locations.forEach((location, index) => {
                // Create custom marker HTML
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

                // Create popup with location name
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

                // Add marker to map
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
                    // STEP 1: Build coordinates string for API
                    // Format: "lng1,lat1;lng2,lat2;lng3,lat3"
                    const coordinates = locations
                        .map(loc => `${loc.lng},${loc.lat}`)
                        .join(';');

                    // STEP 2: Call Mapbox Directions API
                    // ==================================
                    // API Endpoint: /directions/v5/{profile}/{coordinates}
                    // profile = driving, walking, cycling, driving-traffic
                    const directionsUrl = 
                        `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}` +
                        `?geometries=geojson` +        // Return route as GeoJSON
                        `&overview=full` +             // Full route detail
                        `&access_token=${mapboxgl.accessToken}`;

                    console.log('Fetching route from:', directionsUrl);

                    const response = await fetch(directionsUrl);
                    const data = await response.json();

                    // STEP 3: Check if we got a route
                    if (data.routes && data.routes.length > 0) {
                        const route = data.routes[0];
                        
                        // Extract route geometry (the line path)
                        const routeGeoJSON = route.geometry;

                        // STEP 4: Add route as a SOURCE to the map
                        // ========================================
                        // GeoJSON Source = data container for geographic features
                        map.addSource('route', {
                            type: 'geojson',
                            data: {
                                type: 'Feature',
                                properties: {},
                                geometry: routeGeoJSON
                            }
                        });

                        // STEP 5: Add route as a LAYER to visualize it
                        // ===========================================
                        // Layer = how the source data is displayed
                        map.addLayer({
                            id: 'route',
                            type: 'line',              // Draw as a line
                            source: 'route',           // Use the 'route' source we just added
                            layout: {
                                'line-join': 'round',  // Smooth corners
                                'line-cap': 'round'    // Rounded ends
                            },
                            paint: {
                                'line-color': '#0d3439',    
                                'line-width': 4,             
                                'line-opacity': 0.8         
                            }
                        });

                        // STEP 6: Calculate and save route info
                        // =====================================
                        const distanceKm = (route.distance / 1000).toFixed(1);  // meters → km
                        const distanceMiles = (route.distance * 0.000621371).toFixed(1);  // meters → miles
                        const durationHours = (route.duration / 3600).toFixed(1);  // seconds → hours
                        const durationMinutes = Math.round(route.duration / 60);  // seconds → minutes

                        setRouteInfo({
                            distanceKm,
                            distanceMiles,
                            durationHours,
                            durationMinutes
                        });

                        console.log('Route drawn successfully!', {
                            distance: `${distanceMiles} miles`,
                            duration: `${durationHours} hours`
                        });
                    }

                } catch (error) {
                    console.error('Error fetching route:', error);
                }
            }

            // ==========================================
            // FIT MAP to show all markers
            // ==========================================
            if (locations.length > 1) {
                const bounds = new mapboxgl.LngLatBounds();
                locations.forEach(loc => {
                    bounds.extend([loc.lng, loc.lat]);
                });
                map.fitBounds(bounds, { 
                    padding: 50,
                    maxZoom: 15  // Don't zoom in too close
                });
            }

            // Map is ready!
            setIsLoading(false);
        });

        // CLEANUP - Remove map when component unmounts
        // ============================================
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
            }
        };
    }, [locations, center, zoom, showRoute, mapStyle]);

    // ==========================================
    // RENDER - What shows on screen
    // ==========================================
    return (
        <div style={{ 
            position: 'relative',
            width: '100%',
            marginTop: '12px'
        }}>
            {/* Loading indicator */}
            {isLoading && (
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

export default InlineChatMap;
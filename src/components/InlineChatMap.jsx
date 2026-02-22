import {useRef,useEffect, useState} from 'react';
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

    useEffect(() => {
        // STEP 1: Set the Mapbox access token

        mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

        // STEP 2: Calculate map center

        let mapCenter = center;
        if(!mapCenter && locations.lenght > 0){
            mapCenter = {
                lng : locations[0].lng,
                lat : locations[0].lat

            };
         } else if(!mapCenter){
                mapCenter = { lng: -95.7129, lat: 37.0902 };

            }
             // STEP 3: Create the map

             const map = new mapboxgl.Map({
                container: mapContainerRef.current, // HTML element to put map in
                style: `mapbox://styles/mapbox/${mapStyle}`, // Dark theme (matches our app!)
                center: [mapCenter.lng, mapCenter.lat],   // [longitude, latitude]
                zoom: zoom,
                attributionControl: false // Hide Mapbox logo for cleaner look
             });

             mapRef.current = map;
             // STEP 4: Add markers for each location
             
             map.on('load', () => {
            // Map is loaded! Add our markers
            locations.forEach((location, index) => {
                // Create a custom marker element
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

            // STEP 5: Draw route if requested

            if (showRoute && locations.length >= 2) {
                console.log('Route drawing will be implemented next!');
            }

            // STEP 6: Fit map to show all markers
            
            if (locations.length > 1) {
            
                const bounds = new mapboxgl.LngLatBounds();
                locations.forEach(loc => {
                    bounds.extend([loc.lng, loc.lat]);
                });
                // Fit map to bounds with some padding
                map.fitBounds(bounds, { padding: 50 });
            }

            // Map is ready!
            setIsLoading(false);
        });


        return () => {
            if(mapRef.current){
                mapRef.current.remove();

            }
        };

        },[locations, center, zoom, showRoute, mapStyle]);

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
        </div>
    );
};

export default InlineChatMap;


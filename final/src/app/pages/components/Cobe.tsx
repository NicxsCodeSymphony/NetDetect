"use client"
import createGlobe from "cobe";
import { useEffect, useRef } from "react";

// Define interfaces for the cobe library types
interface CobeMarker {
  location: [number, number];
  size: number;
}

// Our extended marker interface with label
interface CustomMarker extends CobeMarker {
  label?: string;
}

// Helper function to strip out non-standard properties
const convertToCobeMarkers = (customMarkers: CustomMarker[]): CobeMarker[] => {
  return customMarkers.map(({ location, size }) => ({
    location,
    size,
  }));
};

export function Cobe() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        let phi = 0;
        let width = 0;
        
        const onResize = () => {
            if (canvasRef.current) {
                width = canvasRef.current.offsetWidth;
            }
        };
        
        window.addEventListener('resize', onResize);
        onResize();
        
        if (canvasRef.current) {
            // Define our markers with labels (for our app's internal use)
            const customMarkers: CustomMarker[] = [
                { location: [37.7595, -122.4367], size: 0.1, label: "San Francisco, USA" }, 
                { location: [40.7128, -74.006], size: 0.1, label: "New York, USA" }, 
                { location: [51.5074, -0.1278], size: 0.1, label: "London, UK" },                 
                { location: [48.8566, 2.3522], size: 0.1, label: "Paris, France" }, 
                { location: [35.6895, 139.6917], size: 0.1, label: "Tokyo, Japan" }, 
                { location: [-33.8688, 151.2093], size: 0.1, label: "Sydney, Australia" }, 
                { location: [39.9042, 116.4074], size: 0.1, label: "Beijing, China" }, 
                { location: [-23.5505, -46.6333], size: 0.1, label: "São Paulo, Brazil" }, 
                { location: [55.7558, 37.6173], size: 0.1, label: "Moscow, Russia" }, 
                { location: [34.0522, -118.2437], size: 0.1, label: "Los Angeles, USA" }, 
                { location: [40.7306, -73.9352], size: 0.1, label: "Brooklyn, USA" }, 
                { location: [60.1699, 24.9384], size: 0.1, label: "Helsinki, Finland" }, 
                { location: [37.7749, -122.4194], size: 0.1, label: "San Francisco, USA" },
                { location: [14.5995, 120.9842], size: 0.1, label: "Manila, Philippines" } 
            ];

            // Convert to cobe-compatible markers
            const cobeMarkers = convertToCobeMarkers(customMarkers);

            const globe = createGlobe(canvasRef.current, {
                devicePixelRatio: 2,
                width: width * 2,
                height: width * 2,
                phi: 0,
                theta: 0.3,
                dark: 0,
                diffuse: 0.5,
                mapSamples: 16000,
                mapBrightness: 1.5,
                baseColor: [0.9, 0.95, 1.0],
                markerColor: [0.5, 0.7, 1.0],
                glowColor: [1.0, 1.0, 1.0],
                // Use the converted markers that match the expected type
                markers: cobeMarkers,
                onRender: (state) => {
                    state.phi = phi;
                    phi += 0.005;
                    state.width = width * 2;
                    state.height = width * 2;
                }
            });

            setTimeout(() => {
                if (canvasRef.current) {
                    canvasRef.current.style.opacity = '1';
                }
            });

            return () => {
                globe.destroy();
                window.removeEventListener('resize', onResize);
            };
        }
        
        return () => {
            window.removeEventListener('resize', onResize);
        };
    }, []);

    return (
        <div style={{
            width: '100%',
            maxWidth: 600,
            aspectRatio: 1,
            margin: 'auto',
            position: 'relative',
        }}>
            <canvas
                ref={canvasRef}
                style={{
                    width: '100%',
                    height: '100%',
                    contain: 'layout paint size',
                    opacity: 0,
                    transition: 'opacity 1s ease',
                }}
            />
        </div>
    );
}
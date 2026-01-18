import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapPin, ArrowLeft, Sparkles, Cloud, Thermometer } from "lucide-react";
import "../styles/global.css";

export default function Destination() {
  const { name } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [destinationInfo, setDestinationInfo] = useState(null);
  
  useEffect(() => {
    // Safety check: if no name in URL, redirect home
    if (!name) {
      console.error("No destination name provided in URL");
      navigate("/");
      return;
    }
    
    const fetchDestinationInfo = async () => {
      try {
        // Simulate loading delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Create destination data
        const fakeData = {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          description: `Discover the wonders of ${name}! An incredible destination filled with culture, history, and adventure.`,
          coordinates: { 
            lat: 48.8566,
            lng: 2.3522
          },
          weather: {
            temp: 72,
            condition: "Partly Cloudy"
          }
        };
        
        setDestinationInfo(fakeData);
        setLoading(false);
        
      } catch (error) {
        console.error("Error loading destination:", error);
        setLoading(false);
      }
    };
    
    fetchDestinationInfo();
  }, [name, navigate]);
  
  // Loading state
  if (loading) {
    return (
      <div className="app-center">
        <div className="card" style={{ textAlign: "center", maxWidth: 400 }}>
          <Sparkles 
            size={40} 
            style={{ 
              margin: "0 auto 16px",
              color: "var(--neon-cyan)",
              animation: "pulse 2s infinite"
            }} 
          />
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Loading destination...
          </div>
          <div className="small">Fetching information about {name || "destination"}</div>
        </div>
      </div>
    );
  }
  
  // Safety check: if no destination info, show error
  if (!destinationInfo) {
    return (
      <div className="app-center">
        <div className="card" style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#ff9aa2" }}>
            Destination not found
          </div>
          <div className="small" style={{ marginBottom: 16 }}>
            We couldn't find information about this destination.
          </div>
          <button onClick={() => navigate("/")} className="btn">
            Go Home
          </button>
        </div>
      </div>
    );
  }
  
  // Main content
  return (
    <div style={{ padding: 28 }}>
      {/* Back button */}
      <button 
        onClick={() => navigate("/")}
        className="btn-ghost" 
        style={{ marginBottom: 20 }}
      >
        <ArrowLeft size={16} /> Back to Home
      </button>
      
      {/* Main content card */}
      <div className="card">
        {/* Header section */}
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 12, 
          marginBottom: 16 
        }}>
          <MapPin size={32} style={{ color: "var(--neon-cyan)" }} />
          <h1 style={{ fontSize: 32, margin: 0 }}>
            {destinationInfo.name}
          </h1>
        </div>
        
        {/* Description */}
        <p style={{ 
          color: "var(--muted)", 
          fontSize: 16,
          lineHeight: 1.6,
          marginBottom: 24
        }}>
          {destinationInfo.description}
        </p>
        
        {/* Weather info */}
        <div style={{
          display: "flex",
          gap: 20,
          padding: 16,
          background: "rgba(255,255,255,0.02)",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.04)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Thermometer size={18} style={{ color: "var(--neon-cyan)" }} />
            <span>{destinationInfo.weather.temp}°F</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Cloud size={18} style={{ color: "var(--neon-indigo)" }} />
            <span>{destinationInfo.weather.condition}</span>
          </div>
        </div>
        
        {/* Placeholder for map */}
        <div style={{
          marginTop: 24,
          padding: 40,
          background: "rgba(0,224,255,0.05)",
          borderRadius: 12,
          border: "1px solid rgba(0,224,255,0.1)",
          textAlign: "center"
        }}>
          <MapPin size={40} style={{ 
            margin: "0 auto 16px",
            color: "var(--neon-cyan)"
          }} />
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            Map coming soon!
          </div>
          <div className="small">
            We'll add an interactive map here in the next step
          </div>
        </div>
        
        {/* Action buttons */}
        <div style={{ 
          marginTop: 24, 
          display: "flex", 
          gap: 12,
          paddingTop: 24,
          borderTop: "1px solid rgba(255,255,255,0.04)"
        }}>
          <button className="btn">
            Save to My Trips
          </button>
          <button className="btn-ghost">
            Share Destination
          </button>
          <button 
            className="btn-ghost"
            onClick={() => navigate("/profile")}
          >
            Back to Profile
          </button>
        </div>
      </div>
    </div>
  );
}
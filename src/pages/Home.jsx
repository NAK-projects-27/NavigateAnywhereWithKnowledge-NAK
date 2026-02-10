import { useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { Plane, MessageCircle, Sparkles } from "lucide-react";
import "../styles/global.css";

export default function Home() {
  const { user } = useContext(AuthContext);

  return (
      <div style={{ 
        position: "relative",
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "28px",
        boxSizing: "border-box"
       }}>
      {/* Background decorative shapes */}
      <div className="bg-shape cyan" />
      <div className="bg-shape indigo" />

      <div style={{ maxWidth: "900px", width: "100%", margin: "0 auto" }}>
      <div className="card" style={{ display: "grid", gap: 20 }}>
        {/* Navigation */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center" 
        }}>
          <Link to="/" style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 12,
            textDecoration: "none"
          }}>
            <div style={{ 
              width: 44,
              height: 44,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center", 
              background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-indigo))", 
              boxShadow: "0 10px 30px rgba(0,224,255,0.06)" 
            }}>
              <Plane size={20} color="#031024" />
            </div>
            <div style={{ 
              fontWeight: 800, 
              fontSize: 18, 
              color: "#eaf6ff" 
            }}>
              NAK
            </div>
          </Link>

          <div style={{ display: "flex", gap: 10 }}>
            {user ? (
              <>
                <Link to="/chat" className="btn-ghost">
                  <MessageCircle size={16} /> Chat
                </Link>
                <Link to="/profile" className="btn-ghost">
                  Profile
                </Link>
              </>
            ) : (
              <>
                <Link to="/auth" className="btn-ghost">
                  Sign in
                </Link>
                <Link to="/auth" className="btn">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Hero Section */}
        <div style={{ 
          textAlign: "center", 
          padding: "60px 20px",
          maxWidth: 700,
          margin: "0 auto"
        }}>
          {/* Eyebrow */}
          <div style={{ 
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 20,
            background: "rgba(0,224,255,0.06)",
            border: "1px solid rgba(0,224,255,0.1)",
            color: "var(--neon-cyan)",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 24
          }}>
            <Sparkles size={14} />
            Your AI Travel Assistant
          </div>

          {/* Main Heading */}
          <h1 style={{ 
            fontSize: 56, 
            fontWeight: 900, 
            lineHeight: 1.1,
            marginBottom: 20,
            background: "linear-gradient(135deg, #eaf6ff, #cfeeff)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text"
          }}>
            Navigate Anywhere <br/>
            with Knowledge
          </h1>

          {/* Subtitle */}
          <p style={{ 
            fontSize: 18, 
            color: "var(--muted)",
            lineHeight: 1.6,
            marginBottom: 40,
            maxWidth: 500,
            margin: "0 auto 40px"
          }}>
            Chat with AI to plan trips, discover destinations, and get personalized 
            travel recommendations—all in one conversation.
          </p>

          {/* CTA Buttons */}
          <div style={{ 
            display: "flex", 
            gap: 12, 
            justifyContent: "center",
            flexWrap: "wrap"
          }}>
            <Link 
              to={user ? "/chat" : "/auth"} 
              className="btn"
              style={{ 
                fontSize: 16,
                padding: "14px 28px"
              }}
            >
              <MessageCircle size={18} />
              {user ? "Start Planning" : "Get Started"}
            </Link>
            
            {!user && (
              <Link 
                to="/auth" 
                className="btn-ghost"
                style={{ 
                  fontSize: 16,
                  padding: "14px 28px"
                }}
              >
                Sign in
              </Link>
            )}
          </div>

          {/* Feature Pills */}
          <div style={{ 
            marginTop: 60,
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
            fontSize: 14,
            color: "var(--muted)"
          }}>
            <div style={{ 
              padding: "8px 16px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.04)"
            }}>
              ✈️ Trip Planning
            </div>
            <div style={{ 
              padding: "8px 16px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.04)"
            }}>
              🗺️ Maps & Routes
            </div>
            <div style={{ 
              padding: "8px 16px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.04)"
            }}>
              🏨 Hotels & Events
            </div>
            <div style={{ 
              padding: "8px 16px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.04)"
            }}>
              💰 Budget Tracking
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ 
        textAlign: "center", 
        marginTop: 40,
        padding: 20,
        color: "var(--muted)",
        fontSize: 13
      }}>
        
      </div>
    </div>
    </div>
  );
}
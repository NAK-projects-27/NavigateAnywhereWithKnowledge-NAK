import { useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { MapPin, Calendar, MessageCircle, Film, Plane, Sparkles, ArrowRight } from "lucide-react";
import "../styles/global.css";

export default function Home() {
  const { user } = useContext(AuthContext);

  const features = [
    { icon: <Sparkles size={22} />, title: "AI Itinerary Builder", description: "Personalized day-by-day travel plans." },
    { icon: <MapPin size={22} />, title: "Destination Discovery", description: "Interactive maps, tips & weather." },
    { icon: <Calendar size={22} />, title: "Event Discovery", description: "Local concerts, festivals & workshops." },
    { icon: <Film size={22} />, title: "Entertainment Hub", description: "Books, movies & music tied to places." },
    { icon: <MessageCircle size={22} />, title: "Community Chat", description: "Ask locals & travelers." },
    { icon: <Plane size={22} />, title: "Smart Redirects", description: "Quick links to flights & hotels." },
  ];

  return (
    <div style={{ position: "relative", padding: 28 }}>
      <div className="bg-shape cyan" />
      <div className="bg-shape indigo" />

      <div className="card" style={{ display: "grid", gap: 20 }}>
        {/* NAV */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width:44,height:44,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center", background: "linear-gradient(135deg,var(--neon-cyan),var(--neon-indigo))", boxShadow: "0 10px 30px rgba(0,224,255,0.06)" }}>
              <Plane size={20} color="#031024" />
            </div>
            <div style={{ fontWeight:800, fontSize:18, color:"#eaf6ff" }}>NAK</div>
          </Link>

          <div style={{ display: "flex", gap: 10 }}>
            <Link to={user ? "/profile" : "/auth"} className="btn-ghost">{user ? "Dashboard" : "Sign in"}</Link>
            {user ? null : <Link to="/auth" className="btn">Get Started</Link>}
          </div>
        </div>

        {/* HERO */}
        <div className="hero">
          <div className="left">
            <div className="eyebrow">✨ Your AI Travel Companion</div>
            <h1>Navigate Anywhere <br/> <span style={{ color:"#cfeeff" }}>with Knowledge</span></h1>
            <p>Discover destinations, plan itineraries with AI, find events, and connect with travelers worldwide. Smart, fast & friendly.</p>

            <div className="cta-row">
              <Link to={user ? "/profile" : "/auth"} className="btn">Start planning</Link>
              <Link to="/events" className="btn-ghost">Explore events</Link>
            </div>

            <div className="features">
              {features.map((f, idx) => (
                <div className="feature" key={idx}>
                  <div className="icon-box">{f.icon}</div>
                  <div style={{ fontWeight:700, marginBottom:6 }}>{f.title}</div>
                  <div style={{ color: "var(--muted)" }}>{f.description}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="hero-card">
              {/* use any image url or your own asset */}
              <img className="cover" src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1400&auto=format&fit=crop&ixlib=rb-4.0.3&s=ea8a1eb7c0edb8bed7d84a9a3edb7a9d" alt="hero" />
            </div>
          </div>
        </div>

        {/* CTA-strip */}
        <div className="cta-strip">
          <div>
            <div style={{ fontWeight:800, fontSize:18 }}>Ready to explore?</div>
            <div style={{ color: "var(--muted)" }}>Join thousands of travelers using NAK — free and easy.</div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Link to="/auth" className="btn">Create account</Link>
            <Link to="/learn" className="btn-ghost">Learn more</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

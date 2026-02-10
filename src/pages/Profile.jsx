import { useContext, useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import supabase from "../api/supabaseClient";
import { 
  User, 
  Mail, 
  LogOut, 
  Edit2, 
  Save, 
  X, 
  MessageCircle,
  Package,
  ArrowLeft
} from "lucide-react";
import "../styles/global.css";

export default function Profile() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (!user) { 
      navigate("/auth"); 
      return; 
    }
    fetchProfile();
    // eslint-disable-next-line
  }, [user]);

  async function fetchProfile(){
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      
      if (data) {
        setProfile(data); 
        setFullName(data.full_name || ""); 
        setBio(data.bio || "");
      } else {
        // Create new profile if doesn't exist
        const newProfile = { 
          id: user.id, 
          email: user.email, 
          full_name: user.user_metadata?.full_name || "", 
          created_at: new Date().toISOString() 
        };
        const { data: created } = await supabase
          .from("profiles")
          .insert([newProfile])
          .select()
          .single();
        setProfile(created); 
        setFullName(created.full_name || "");
      }
    } catch(e){ 
      console.error(e) 
    } finally { 
      setLoading(false) 
    }
  }

  async function handleUpdate(e){
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          full_name: fullName, 
          bio, 
          updated_at: new Date().toISOString() 
        })
        .eq("id", user.id);
      
      if (error) throw error;
      
      setProfile(prev => ({...prev, full_name: fullName, bio}));
      setEditing(false);
    } catch(e){ 
      alert("Failed to update profile"); 
      console.error(e) 
    } finally { 
      setLoading(false) 
    }
  }

  async function handleLogout(){ 
    await supabase.auth.signOut(); 
    navigate("/"); 
  }

  // Loading state
  if (loading) return (
    <div className="app-center">
      <div style={{ textAlign: "center" }} className="card">
        <div style={{ 
          fontSize: 18, 
          fontWeight: 700, 
          marginBottom: 8 
        }}>
          Loading profile…
        </div>
        <div className="small" style={{ marginBottom: 10 }}>
          Hang tight — fetching your data
        </div>
        <div style={{ 
          width: 60, 
          height: 60, 
          borderRadius: 12, 
          margin: "0 auto", 
          background: "linear-gradient(90deg, var(--neon-cyan), var(--neon-indigo))", 
          boxShadow: "0 10px 40px rgba(0,224,255,0.12)"
        }}/>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 28, maxWidth: 1000, margin: "0 auto" }}>
      {/* Back Button */}
      <button 
        onClick={() => navigate("/")}
        className="btn-ghost" 
        style={{ marginBottom: 20 }}
      >
        <ArrowLeft size={16} /> Back to Home
      </button>

      {/* Header Card */}
      <div className="card">
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          marginBottom: 18,
          flexWrap: "wrap",
          gap: 16
        }}>
          {/* User Info */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="avatar" style={{ width: 80, height: 80 }}>
              {profile?.full_name?.[0]?.toUpperCase() || <User size={32} />}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 24 }}>
                {profile?.full_name || "Traveler"}
              </div>
              <div className="small" style={{ 
                marginTop: 6,
                display: "flex",
                alignItems: "center",
                gap: 6
              }}>
                <Mail size={14} /> 
                {user?.email}
              </div>
              <div className="small" style={{ marginTop: 4, color: "var(--muted)" }}>
                Member since {new Date(profile?.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/chat" className="btn">
              <MessageCircle size={16} /> Start Planning
            </Link>
            <button 
              onClick={() => setEditing(!editing)} 
              className="btn-ghost"
            >
              {editing ? <X size={16} /> : <Edit2 size={16} />}
              {editing ? "Cancel" : "Edit"}
            </button>
            <button 
              onClick={handleLogout} 
              className="btn-ghost" 
              style={{ 
                color: "#ff9aa2", 
                borderColor: "rgba(255,100,110,0.06)" 
              }}
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>

        {/* Bio Section */}
        <div style={{ 
          marginTop: 24,
          padding: 16,
          background: "rgba(255,255,255,0.02)",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.04)"
        }}>
          <div style={{ 
            fontWeight: 700, 
            marginBottom: 8,
            fontSize: 14,
            color: "var(--neon-cyan)"
          }}>
            About
          </div>
          {editing ? (
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              style={{
                width: "100%",
                minHeight: 80,
                padding: 12,
                borderRadius: 8,
                background: "rgba(6,9,16,0.45)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#e6eef6",
                fontSize: 14,
                fontFamily: "inherit",
                resize: "vertical"
              }}
            />
          ) : (
            <div className="small" style={{ color: "var(--muted)" }}>
              {profile?.bio || "No bio set. Click 'Edit' to add one."}
            </div>
          )}
        </div>

        {/* Edit Form */}
        {editing && (
          <form onSubmit={handleUpdate} style={{ marginTop: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ 
                display: "block", 
                marginBottom: 8, 
                fontSize: 14,
                fontWeight: 600,
                color: "var(--neon-cyan)"
              }}>
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 8,
                  background: "rgba(6,9,16,0.45)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "#e6eef6",
                  fontSize: 14
                }}
              />
            </div>

            <button 
              type="submit" 
              className="btn"
              disabled={loading}
              style={{ opacity: loading ? 0.5 : 1 }}
            >
              <Save size={16} />
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </form>
        )}
      </div>

      {/* My Saved Trips Section */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 4 }}>
              My Saved Trips
            </div>
            <div className="small" style={{ color: "var(--muted)" }}>
              Trips you've saved from chat conversations
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div style={{ 
          textAlign: "center",
          padding: "60px 20px",
          background: "rgba(0,224,255,0.02)",
          borderRadius: 12,
          border: "1px dashed rgba(0,224,255,0.1)"
        }}>
          <Package size={48} style={{ 
            color: "var(--neon-cyan)", 
            margin: "0 auto 16px",
            opacity: 0.4
          }} />
          <div style={{ 
            fontSize: 18, 
            fontWeight: 700, 
            marginBottom: 8,
            color: "#eaf6ff"
          }}>
            No trips saved yet
          </div>
          <div className="small" style={{ 
            color: "var(--muted)",
            marginBottom: 20
          }}>
            Start planning a trip in chat and click "Save Trip" to add it here
          </div>
          <Link to="/chat" className="btn">
            <MessageCircle size={16} />
            Start Planning
          </Link>
        </div>

        {/* TODO: When trips exist, show TripCard components here */}
        {/* Example:
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {trips.map(trip => <TripCard key={trip.id} trip={trip} />)}
        </div>
        */}
      </div>
    </div>
  );
}
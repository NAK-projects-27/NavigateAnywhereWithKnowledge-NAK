import { useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import supabase from "../api/supabaseClient";
import { User, Mail, Calendar, MapPin, LogOut, Edit2, Save, X, Sparkles } from "lucide-react";
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
    if (!user) { navigate("/auth"); return; }
    fetchProfile();
    // eslint-disable-next-line
  }, [user]);

  async function fetchProfile(){
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (error && error.code !== "PGRST116") throw error;
      if (data) {
        setProfile(data); setFullName(data.full_name||""); setBio(data.bio||"");
      } else {
        const newProfile = { id: user.id, email: user.email, full_name: user.user_metadata?.full_name||"", created_at: new Date().toISOString() };
        const { data: created } = await supabase.from("profiles").insert([newProfile]).select().single();
        setProfile(created); setFullName(created.full_name||"");
      }
    } catch(e){ console.error(e) }
    finally{ setLoading(false) }
  }

  async function handleUpdate(e){
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from("profiles").update({ full_name: fullName, bio, updated_at: new Date().toISOString() }).eq("id", user.id);
      if (error) throw error;
      setProfile(prev=>({...prev, full_name: fullName, bio}));
      setEditing(false);
    } catch(e){ alert("Failed"); console.error(e) } finally { setLoading(false) }
  }

  async function handleLogout(){ await supabase.auth.signOut(); navigate("/"); }

  if (loading) return (
    <div className="app-center">
      <div style={{ textAlign:"center" }} className="card">
        <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>Loading profile…</div>
        <div className="small" style={{ marginBottom:10 }}>Hang tight — fetching your data</div>
        <div style={{ width:60, height:60, borderRadius:12, margin:"0 auto", background:"linear-gradient(90deg,var(--neon-cyan),var(--neon-indigo))", boxShadow:"0 10px 40px rgba(0,224,255,0.12)"}}/>
      </div>
    </div>
  );

  return (
    <div style={{ padding:28 }}>
      <div className="card">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
            <div className="avatar">{profile?.full_name?.[0] || <User size={44} />}</div>
            <div>
              <div style={{ fontWeight:800, fontSize:20 }}>{profile?.full_name || "Traveler"}</div>
              <div className="small" style={{ marginTop:6 }}><Mail size={14} style={{ marginRight:8 }} /> {user?.email}</div>
            </div>
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={() => setEditing(!editing)} className="btn-ghost"><Edit2 size={16} /> {editing ? "Cancel" : "Edit"}</button>
            <button onClick={handleLogout} className="btn-ghost" style={{ color:"#ff9aa2", borderColor:"rgba(255,100,110,0.06)" }}><LogOut size={16} /> Logout</button>
          </div>
        </div>

        <div className="profile-grid">
          <div>
            <div style={{ marginBottom:14 }} className="card">
              <div style={{ fontWeight:700, marginBottom:6 }}>About</div>
              <div className="small" style={{ color:"var(--muted)" }}>{profile?.bio || "No bio set."}</div>
            </div>

            <div className="card">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div className="stat">
                  <div className="small">Trips</div>
                  <div className="num">0</div>
                </div>
                <div className="stat">
                  <div className="small">Saved</div>
                  <div className="num">0</div>
                </div>
                <div className="stat" style={{ gridColumn:"1 / -1" }}>
                  <div className="small">Member since</div>
                  <div style={{ marginTop:6 }}>{new Date(profile?.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            {!editing && (
              <div className="card">
                <div style={{ fontWeight:700, marginBottom:8 }}>Your dashboard</div>
                <div className="small" style={{ marginBottom:12 }}>Start planning a trip or discover places.</div>
                <div style={{ display:"flex", gap:10 }}>
                  <button className="btn">Create Itinerary</button>
                  <button className="btn-ghost">Explore</button>
                </div>
              </div>
            )}

            {editing && (
              <form onSubmit={handleUpdate} className="card">
                <div style={{ marginBottom:12 }}>
                  <label className="small">Full name</label>
                  <input className="input" value={fullName} onChange={(e)=>setFullName(e.target.value)} />
                </div>
                <div style={{ marginBottom:12 }}>
                  <label className="small">Bio</label>
                  <textarea className="input" value={bio} onChange={(e)=>setBio(e.target.value)} style={{ minHeight:120, resize:"vertical" }} />
                </div>
                <div style={{ display:"flex", gap:12 }}>
                  <button className="btn" type="submit" disabled={loading}><Save size={14} /> Save</button>
                  <button className="btn-ghost" type="button" onClick={()=>setEditing(false)}><X size={14} /> Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

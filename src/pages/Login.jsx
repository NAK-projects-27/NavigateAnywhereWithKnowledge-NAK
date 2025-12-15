import { useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../api/supabaseClient";
import { Mail, Lock, User, ArrowLeft, Plane, Sparkles } from "lucide-react";
import "../styles/global.css";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  async function handleEmailAuth(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage("✅ Login successful");
        setTimeout(() => navigate("/profile"), 700);
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        setMessage("📧 Check email to confirm");
      }
    } catch (err) {
      setMessage("❌ " + (err.message || err));
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setMessage("✨ Magic link sent!");
    } catch (err) {
      setMessage("❌ " + (err.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-center" style={{ position: "relative", overflow: "hidden" }}>
      <div className="bg-shape cyan" />
      <div className="bg-shape indigo" />

      <button onClick={() => navigate("/")} style={{ position: "absolute", left: 20, top: 18, zIndex: 40, background: "transparent", border: "none", color: "#9fbfe8", cursor: "pointer" }}>
        <ArrowLeft size={18} /> Back
      </button>

      <div className="auth-card">
        <div className="auth-brand">
          <div className="logo"><Plane size={26} color="#031024" /></div>
        </div>

        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <div className="auth-title">{isLogin ? "Welcome back" : "Create your account"}</div>
          <div className="auth-sub">{isLogin ? "Sign in to continue" : "Join NAK — explore the world"}</div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button onClick={() => { setIsLogin(true); setMessage(""); }} className={isLogin ? "btn" : "btn-ghost"} style={{ flex: 1 }}>{/* active uses .btn */}Sign in</button>
          <button onClick={() => { setIsLogin(false); setMessage(""); }} className={!isLogin ? "btn" : "btn-ghost"} style={{ flex: 1 }}>Register</button>
        </div>

        <form onSubmit={handleEmailAuth}>
          {!isLogin && (
            <div className="field">
              <label>Full name</label>
              <div style={{ position: "relative" }}>
                <div className="icon-left"><User size={16} /></div>
                <input className="input" style={{ paddingLeft: 44 }} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your awesome name" />
              </div>
            </div>
          )}

          <div className="field">
            <label>Email</label>
            <div style={{ position: "relative" }}>
              <div className="icon-left"><Mail size={16} /></div>
              <input className="input" style={{ paddingLeft: 44 }} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@domain.com" />
            </div>
          </div>

          <div className="field">
            <label>Password</label>
            <div style={{ position: "relative" }}>
              <div className="icon-left"><Lock size={16} /></div>
              <input type="password" className="input" style={{ paddingLeft: 44 }} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? "Please wait…" : (isLogin ? "Sign in" : "Create account")}
            </button>
          </div>
        </form>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={handleMagicLink} className="btn-ghost" disabled={loading || !email}>Send magic link</button>
          <button onClick={() => { setEmail("demo@nak.app"); setPassword("password123"); setIsLogin(true); }} className="btn-ghost">Demo</button>
        </div>

        {message && <div style={{ marginTop: 14, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.03)", color: "#bfeaff" }}>{message}</div>}
      </div>
    </div>
  );
}

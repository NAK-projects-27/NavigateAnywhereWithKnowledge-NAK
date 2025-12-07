import { useState } from "react";
import supabase from "../api/supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");

  async function handleLogin() {
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) {
        alert("Error: " + error.message);
      } else {
        alert("Check your email for login link!");
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    }
  }

  return (
    <div style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>Login</h1>
      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ padding: "10px", fontSize: "16px", marginRight: "8px" }}
      />
      <button
        onClick={handleLogin}
        style={{
          padding: "10px 16px",
          fontSize: "16px",
          background: "#111",
          color: "white",
          border: "none",
          cursor: "pointer",
        }}
      >
        Send Magic Link
      </button>
    </div>
  );
}

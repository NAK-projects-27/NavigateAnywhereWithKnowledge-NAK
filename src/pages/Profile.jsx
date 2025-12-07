import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import supabase from "../api/supabaseClient";

export default function Profile() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  if (!user) {
    return (
      <div style={{ padding: "40px" }}>
        <h1>Profile</h1>
        <p>You need to log in first.</p>
        <button onClick={() => navigate("/login")}>Go to Login</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "40px" }}>
      <h1>Profile</h1>
      <p>Email: {user.email}</p>
      <p>User ID: {user.id}</p>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}
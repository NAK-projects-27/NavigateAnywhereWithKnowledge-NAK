import { createBrowserRouter } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Destination from "./pages/Destinations";  
import Chat from "./pages/Chat";

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/auth", element: <Login /> },
  { path: "/profile", element: <Profile /> },
  { path: "/Destination/:name", element: <Destination /> },
  { path: "/chat", element: <Chat /> },
]);

export default router;
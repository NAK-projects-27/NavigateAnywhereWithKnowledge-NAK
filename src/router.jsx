import { createBrowserRouter } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Profile from "./pages/Profile"; 
import Chat from "./pages/Chat";
import TripDetail from './pages/TripDetail';

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/auth", element: <Login /> },
  { path: "/profile", element: <Profile /> },
  { path: "/chat", element: <Chat /> },
  { path: '/trip/:id', element: <TripDetail /> },
]);

export default router;
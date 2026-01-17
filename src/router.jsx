import { createBrowserRouter } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Destinations from "./pages/Destinations";


const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/auth", element: <Login /> },
  { path: "/profile", element: <Profile /> },
  { path: "/Destinations/:name",element: <Destinations/>}
]);

export default router;
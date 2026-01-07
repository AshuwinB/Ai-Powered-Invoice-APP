import { createBrowserRouter } from "react-router-dom";
import LoginPage from "./pages/LoginPage.jsx";
import Setup2fa from "./pages/Setup2fa.jsx";
import Verify2fa from "./pages/Verify2fa.jsx";
import Error from "./pages/Error.jsx";
import Home from "./pages/HomePage.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

const router = createBrowserRouter([
    {
        path: "/login",
        element: <LoginPage />,
        errorElement: <Error />
    },
    {
        path: "/",
        element: <ProtectedRoute/>,
        children: [
  {
        path: "/home",
        element: <Home/>,
        errorElement: <Error />
    },
    {
        path: "/setup-2fa",
        element: <Setup2fa />,
        errorElement: <Error />
    },
    {
        path: "/verify-2fa",
        element: <Verify2fa />,
        errorElement: <Error />
    }]
},
]);

export { router };
import { createBrowserRouter, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage.jsx";
import Setup2fa from "./pages/Setup2fa.jsx";
import Verify2fa from "./pages/Verify2fa.jsx";
import Error from "./pages/Error.jsx";
import Home from "./pages/HomePage.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Invoices from "./pages/Invoices.jsx";
import Payments from "./pages/Payments.jsx";
import CreateEditInvoice from "./pages/CreateEditInvoice.jsx";
import ViewInvoice from "./pages/ViewInvoice.jsx";
import Profile from "./pages/Profile.jsx";
import Notifications from "./pages/Notifications.jsx";
import PaymentSuccess from "./pages/PaymentSuccess.jsx";
import PaymentCancelled from "./pages/PaymentCancelled.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

const router = createBrowserRouter([
    {
        path: "/login",
        element: <LoginPage />,
        errorElement: <Error />
    },
    {
        path: "/payment-success",
        element: <PaymentSuccess />,
        errorElement: <Error />
    },
    {
        path: "/payment-cancelled",
        element: <PaymentCancelled />,
        errorElement: <Error />
    },
    {
        path: "/",
        element: <ProtectedRoute/>,
        children: [
            {
                path: "/",
                element: <Dashboard/>,
                errorElement: <Error />
            },
            {
                path: "/home",
                element: <Home/>,
                errorElement: <Error />
            },
            {
                path: "/dashboard",
                element: <Dashboard/>,
                errorElement: <Error />
            },
            {
                path: "/invoices",
                element: <Invoices/>,
                errorElement: <Error />
            },
            {
                path: "/payments",
                element: <Payments/>,
                errorElement: <Error />
            },
            {
                path: "/invoices/:id",
                element: <ViewInvoice/>,
                errorElement: <Error />
            },
            {
                path: "/invoices/create",
                element: <CreateEditInvoice/>,
                errorElement: <Error />
            },
            {
                path: "/invoices/:id/edit",
                element: <CreateEditInvoice/>,
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
            },
            {
                path: "/settings",
                element: <Navigate to="/profile?section=business-info" replace />,
                errorElement: <Error />
            },
            {
                path: "/profile",
                element: <Profile />,
                errorElement: <Error />
            },
            {
                path: "/notifications",
                element: <Notifications />,
                errorElement: <Error />
            }
        ]
    },
]);

export { router };
import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./context/AuthContext";
import App from "./App.jsx";
import Login from "./pages/Login.jsx";
import PublicLayout from "./website/layouts/PublicLayout.jsx";
import Home from "./website/pages/Home.jsx";
import ProductsPage from "./website/pages/ProductsPage.jsx";
import CompanyPage from "./website/pages/CompanyPage.jsx";
import PoliciesPage from "./website/pages/PoliciesPage.jsx";
import ContactPage from "./website/pages/ContactPage.jsx";
import AssistantPage from "./website/pages/AssistantPage.jsx";

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/company" element={<CompanyPage />} />
        <Route path="/policies" element={<PoliciesPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
      </Route>

      <Route path="/login" element={<Login />} />

      <Route
        path="/dashboard/*"
        element={
          <RequireAuth>
            <App />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

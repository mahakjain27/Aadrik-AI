import { useState } from "react";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import ProductExplorer from "./pages/ProductExplorer";
import ProductDetailsModal from "./components/ProductDetailsModal";
import QuotationModal from "./components/QuotationModal";
import CRMDashboard from "./pages/CRMDashboard";
import Customers from "./pages/Customers";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Policies from "./pages/Policies";
import Company from "./pages/Company";
import UserManagement from "./pages/UserManagement";
import ActivityLog from "./pages/ActivityLog";
import ProductManagement from "./pages/ProductManagement";
import KnowledgeBaseManager from "./pages/KnowledgeBaseManager";
import SalesInbox from "./pages/SalesInbox";
import { getProducts, submitQuotation } from "./services/api";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import { canAccess, permissions } from "./utils/permissions";
import logoWatermark from "./assets/logo-watermark.png";

function App() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) {
    return <Login />;
  }
  const [showProducts, setShowProducts] = useState(false);
  const [catalog, setCatalog] = useState(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState(null);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [showQuotation, setShowQuotation] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [pendingSessionId, setPendingSessionId] = useState(null);
  const [pendingQuotationId, setPendingQuotationId] = useState(null);

  function openSessionInInbox(sessionId) {
    setPendingSessionId(sessionId);
    setPage("inbox");
  }

  function openQuotationInDashboard(quotationId) {
    setPendingQuotationId(quotationId);
    setPage("dashboard");
  }

  async function openProducts() {
    if (!canAccess(user?.role, "products")) return;

    setShowProducts(true);

    if (catalog) return;

    setProductsLoading(true);
    setProductsError(null);

    try {
      const data = await getProducts();
      setCatalog(data);
    } catch (error) {
      setProductsError(error.message);
    }

    setProductsLoading(false);
  }

  function selectVariant(product, variant) {
    setSelectedProduct(product);
    setSelectedVariant(variant);
    setShowDetails(true);
  }

  function requestQuotation(product, variant) {
    setSelectedProduct(product);
    setSelectedVariant(variant);
    setShowDetails(false);
    setShowQuotation(true);
  }

  async function handleQuotationSubmit(formData) {
    await submitQuotation({
      company_name: formData.company_name,
      contact_person: formData.contact_person,
      phone: formData.phone,
      email: formData.email,
      items: formData.items,
      delivery_city: formData.city,
      pincode: formData.pincode,
      gst_number: formData.gst_number,
      notes: formData.notes,
    });
  }

  const effectivePage = canAccess(user?.role, page)
    ? page
    : permissions[user?.role]?.[0] || "dashboard";

  return (
    <div className="d-flex vh-100 bg-light">
      <Sidebar
        onOpenProducts={openProducts}
        role={user?.role}
        activePage={effectivePage}
        onOpenCRM={() => setPage("dashboard")}
        onOpenAnalytics={() => setPage("analytics")}
        onOpenCustomers={() => setPage("customers")}
        onOpenInbox={() => setPage("inbox")}
        onOpenPolicies={() => setPage("policies")}
        onOpenCompany={() => setPage("company")}
        onOpenSettings={() => setPage("settings")}
        onOpenUsers={() => setPage("users")}
        onOpenActivity={() => setPage("activity")}
        onOpenProductAdmin={() => setPage("product_admin")}
        onOpenKnowledgeAdmin={() => setPage("knowledge_admin")}
      />

      <ProductExplorer
        show={showProducts}
        onClose={() => setShowProducts(false)}
        onSelectVariant={selectVariant}
        catalog={catalog}
        loading={productsLoading}
        error={productsError}
      />

      <ProductDetailsModal
        show={showDetails}
        onClose={() => setShowDetails(false)}
        product={selectedProduct}
        selectedVariant={selectedVariant}
        onQuote={requestQuotation}
      />

      <QuotationModal
        show={showQuotation}
        onClose={() => setShowQuotation(false)}
        product={selectedProduct}
        selectedVariant={selectedVariant}
        catalog={catalog}
        onSubmit={handleQuotationSubmit}
      />

      <div className="flex-grow-1 d-flex flex-column app-content" style={{ minWidth: 0, overflowY: "auto" }}>
        <div className="app-watermark" aria-hidden="true">
          <img src={logoWatermark} alt="" />
        </div>

        <Header
          onOpenCRM={() => setPage("dashboard")}
          onOpenSession={openSessionInInbox}
          onOpenQuotation={openQuotationInDashboard}
        />

        {effectivePage === "dashboard" ? (
          <CRMDashboard
            pendingQuotationId={pendingQuotationId}
            onConsumePending={() => setPendingQuotationId(null)}
          />
        ) : effectivePage === "customers" ? (
          <Customers />
        ) : effectivePage === "analytics" ? (
          <Analytics />
        ) : effectivePage === "policies" ? (
          <Policies />
        ) : effectivePage === "company" ? (
          <Company />
        ) : effectivePage === "users" ? (
          <UserManagement />
        ) : effectivePage === "activity" ? (
          <ActivityLog />
        ) : effectivePage === "product_admin" ? (
          <ProductManagement />
        ) : effectivePage === "knowledge_admin" ? (
          <KnowledgeBaseManager />
        ) : effectivePage === "inbox" ? (
          <SalesInbox
            pendingSessionId={pendingSessionId}
            onConsumePending={() => setPendingSessionId(null)}
          />
        ) : (
          <Settings />
        )}
      </div>
    </div>
  );
}

export default App;
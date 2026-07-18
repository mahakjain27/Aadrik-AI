import { useEffect, useState } from "react";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Chatwindow from "./components/Chatwindow";
import ChatInput from "./components/ChatInput";
import SuggestedQuestions from "./components/SuggestedQuestions";
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
import {
  getProducts,
  getSessionMessages,
  getSessions,
  sendMessage,
  submitQuotation,
} from "./services/api";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import { canAccess, permissions } from "./utils/permissions";
import logoWatermark from "./assets/logo-watermark.png";

function App() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) {
    return <Login />;
  }
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [showProducts, setShowProducts] = useState(false);
  const [catalog, setCatalog] = useState(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState(null);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [showQuotation, setShowQuotation] = useState(false);
  const [page, setPage] = useState("chat");
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

  async function refreshSessions() {
    try {
      const data = await getSessions();
      setSessions(data);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    refreshSessions();
  }, []);

  async function ask(message) {
    if (!message.trim()) return;

    // Add user message
    setChat((prev) => [
      ...prev,
      {
        sender: "You",
        text: message,
      },
    ]);

    setLoading(true);

    try {
      const res = await sendMessage(message, currentSessionId);

      setCurrentSessionId(res.session_id);

      setChat((prev) => [
        ...prev,
        {
          sender: "Aadrik AI",
          text: res.reply,
          sources: res.sources || [],
        },
      ]);

      refreshSessions();
    } catch (error) {
      console.error(error);

      setChat((prev) => [
        ...prev,
        {
          sender: "System",
          text: error.message,
        },
      ]);
    }

    setLoading(false);
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

  function askAboutProduct(product, variant) {
    const message = variant
      ? `Show details for ${product.brand ? `${product.brand} ` : ""}${
          product.name
        } ${variant}`.replace(/\s+/g, " ").trim()
      : `Show details for ${product.name}`;

    setShowDetails(false);
    ask(message);
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
      product_name: formData.product_name,
      brand: formData.brand,
      size: formData.size,
      quantity: formData.quantity,
      delivery_city: formData.city,
      pincode: formData.pincode,
      gst_number: formData.gst_number,
      notes: formData.notes,
    });
  }

  function newChat() {
    setChat([]);
    setCurrentSessionId(null);
  }

  async function selectSession(sessionId) {
    try {
      const data = await getSessionMessages(sessionId);

      setChat(
        data.messages.map((m) => ({
          sender: m.role === "user" ? "You" : "Aadrik AI",
          text: m.content,
          sources: m.sources || [],
        }))
      );

      setCurrentSessionId(sessionId);
    } catch (error) {
      console.error(error);
    }
  }

  const effectivePage = canAccess(user?.role, page)
    ? page
    : permissions[user?.role]?.[0] || "chat";

  return (
    <div className="d-flex vh-100 bg-light">
      <Sidebar
        sessions={sessions}
        activeSessionId={currentSessionId}
        onNewChat={newChat}
        onSelectSession={selectSession}
        onOpenProducts={openProducts}
        loading={loading}
        role={user?.role}
        activePage={effectivePage}
        onOpenChat={() => setPage("chat")}
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
        onAsk={askAboutProduct}
        onQuote={requestQuotation}
      />

      <QuotationModal
        show={showQuotation}
        onClose={() => setShowQuotation(false)}
        product={selectedProduct}
        selectedVariant={selectedVariant}
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

        {effectivePage === "chat" ? (
          <div className="container-fluid p-4 d-flex flex-column flex-grow-1">
            {chat.length === 0 && <SuggestedQuestions onSelect={ask} />}

            <div className="flex-grow-1 mb-3">
              <Chatwindow chat={chat} loading={loading} />
            </div>

            <ChatInput onSend={ask} loading={loading} />
          </div>
        ) : effectivePage === "dashboard" ? (
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
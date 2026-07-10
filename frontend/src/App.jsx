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
import {
  getProducts,
  getSessionMessages,
  getSessions,
  sendMessage,
  submitQuotation,
} from "./services/api";

function App() {
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
  const [crmFocus, setCrmFocus] = useState("");

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

  return (
    <div className="d-flex vh-100 bg-light">
      <Sidebar
        sessions={sessions}
        activeSessionId={currentSessionId}
        onNewChat={newChat}
        onSelectSession={selectSession}
        onOpenProducts={openProducts}
        loading={loading}
        activePage={page}
        onOpenChat={() => setPage("chat")}
        onOpenCRM={() => setPage("dashboard")}
        onOpenAnalytics={() => setPage("analytics")}
        onOpenCustomers={() => setPage("customers")}
        onOpenPolicies={() => setPage("policies")}
        onOpenCompany={() => setPage("company")}
        onOpenSettings={() => setPage("settings")}
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

      <div className="flex-grow-1 d-flex flex-column" style={{ minWidth: 0, overflowY: "auto" }}>
        <Header onOpenCRM={() => setPage("dashboard")} />

        {page === "chat" ? (
          <div className="container-fluid p-4 d-flex flex-column flex-grow-1">
            {chat.length === 0 && <SuggestedQuestions onSelect={ask} />}

            <div className="flex-grow-1 mb-3">
              <Chatwindow chat={chat} loading={loading} />
            </div>

            <ChatInput onSend={ask} loading={loading} />
          </div>
        ) : page === "dashboard" ? (
          <CRMDashboard initialSearch={crmFocus} />
        ) : page === "customers" ? (
          <Customers />
        ) : page === "analytics" ? (
          <Analytics
            onOpenCRM={(company) => {
              setCrmFocus(company || "");
              setPage("dashboard");
            }}
          />
        ) : page === "policies" ? (
          <Policies />
        ) : page === "company" ? (
          <Company />
        ) : (
          <Settings />
        )}
      </div>
    </div>
  );
}

export default App;
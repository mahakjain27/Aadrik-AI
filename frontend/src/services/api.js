import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
  headers: {
    "Content-Type": "application/json",
  },
});
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");

  config.headers["x-api-key"] = import.meta.env.VITE_AADRIK_API_KEY;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.includes("/auth/login");

    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");
      window.location.href = "/";
    }

    return Promise.reject(error);
  }
);

export async function login(email, password, remember = false) {
  const response = await api.post("/auth/login", {
    email,
    password,
    remember,
  });

  return response.data;
}

export async function sendMessage(message, sessionId) {
  const response = await api.post("/chat", {
    message,
    session_id: sessionId,
  });

  return response.data;
}

export async function sendPublicMessage(message, visitorId) {
  const response = await api.post("/public/chat", {
    message,
    visitor_id: visitorId,
  });

  return response.data;
}

export async function submitPublicContact({ name, phone, company, requirement, message }) {
  const response = await api.post("/public/contact", {
    name,
    phone,
    company: company || undefined,
    requirement: requirement || undefined,
    message: message || undefined,
  });

  return response.data;
}

export async function getSessions() {
  const response = await api.get("/sessions");

  return response.data;
}

export async function getSessionMessages(sessionId) {
  const response = await api.get(`/sessions/${sessionId}/messages`);

  return response.data;
}

export async function getProducts() {
  const response = await api.get("/products");

  return response.data;
}

export async function getPublicProducts() {
  const response = await api.get("/public/products");

  return response.data;
}

export async function getManagedProducts(search, category) {
  const response = await api.get("/product-admin", {
    params: {
      search: search || undefined,
      category: category || undefined,
    },
  });

  return response.data;
}

export async function createProduct(data) {
  const response = await api.post("/product-admin", data);

  return response.data;
}

export async function updateProduct(id, data) {
  const response = await api.put(`/product-admin/${id}`, data);

  return response.data;
}

export async function deleteProduct(id) {
  const response = await api.delete(`/product-admin/${id}`);

  return response.data;
}

export async function submitQuotation(data) {
  const response = await api.post("/quotation/", data);

  return response.data;
}

export async function downloadQuotationPdf(id) {
  const response = await api.get(`/quotation/${id}/pdf`, {
    responseType: "blob",
  });

  return response.data;
}

export async function setQuotationPricing(id, pricing) {
  const response = await api.put(`/quotation/${id}/pricing`, {
    unit_price: pricing.unitPrice,
    gst_percent: pricing.gstPercent,
    discount_type: pricing.discountType,
    discount_percent: pricing.discountPercent,
    discount_amount: pricing.discountAmount,
    special_discount_percent: pricing.specialDiscountPercent,
    special_discount_amount: pricing.specialDiscountAmount,
  });

  return response.data;
}

export async function getQuotationPriceHistory(id) {
  const response = await api.get(`/quotation/${id}/price-history`);
  return response.data;
}

export async function confirmOrder(id) {
  const response = await api.post(`/quotation/${id}/confirm-order`);
  return response.data;
}

export async function submitQuotationForApproval(id) {
  const response = await api.post(`/quotation/${id}/submit-for-approval`);
  return response.data;
}

export async function approveQuotation(id) {
  const response = await api.post(`/quotation/${id}/approve`);
  return response.data;
}

export async function rejectQuotation(id, reason) {
  const response = await api.post(`/quotation/${id}/reject`, { reason });
  return response.data;
}

export async function sendQuotation(id) {
  const response = await api.post(`/quotation/${id}/send`);
  return response.data;
}

export async function getPendingApprovalQuotations() {
  const response = await api.get("/quotation/pending-approval");
  return response.data;
}

export async function updateLeadStatus(id, status) {
  const response = await api.put(
    `/crm/leads/${id}?status=${encodeURIComponent(status)}`
  );

  return response.data;
}

export async function getLeads(year, includeArchived) {
  const response = await api.get("/crm/leads", {
    params: {
      year: year || undefined,
      include_archived: includeArchived || undefined,
    },
  });
  return response.data;
}

export async function deleteLead(id) {
  const response = await api.delete(`/quotation/${id}`);

  return response.data;
}

export async function archiveLead(id) {
  const response = await api.post(`/quotation/${id}/archive`);
  return response.data;
}

export async function unarchiveLead(id) {
  const response = await api.post(`/quotation/${id}/unarchive`);
  return response.data;
}

export async function getCustomers(search) {
  const response = await api.get("/customers", {
    params: search ? { search } : undefined,
  });
  return response.data;
}

export async function getCustomer(id) {
  const response = await api.get(`/customers/${id}`);
  return response.data;
}

export async function updateCustomer(id, data) {
  const response = await api.patch(`/customers/${id}`, data);
  return response.data;
}

export async function deleteCustomer(id) {
  await api.delete(`/customers/${id}`);
}

export async function getPolicies() {
  const response = await api.get("/knowledge/policies");
  return response.data;
}

export async function getCompanyInfo() {
  const response = await api.get("/knowledge/company");
  return response.data;
}

export async function getUsers() {
  const response = await api.get("/users");
  return response.data;
}

export async function createUser(data) {
  const response = await api.post("/users", data);
  return response.data;
}

export async function updateUser(id, data) {
  const response = await api.put(`/users/${id}`, data);
  return response.data;
}

export async function setUserStatus(id, isActive) {
  const response = await api.patch(`/users/${id}/status`, {
    is_active: isActive,
  });
  return response.data;
}

export async function resetUserPassword(id, password) {
  const response = await api.post(`/users/${id}/reset-password`, {
    password,
  });
  return response.data;
}

export async function deleteUser(id) {
  const response = await api.delete(`/users/${id}`);
  return response.data;
}

export async function getAssignees() {
  const response = await api.get("/crm/assignees");
  return response.data;
}

export async function assignLead(id, assignedTo) {
  const response = await api.put(`/crm/leads/${id}/assign`, {
    assigned_to: assignedTo,
  });
  return response.data;
}

export async function getActivityLog(limit) {
  const response = await api.get("/activity", {
    params: limit ? { limit } : undefined,
  });
  return response.data;
}

export async function clearActivityLog(olderThanDays) {
  const response = await api.delete("/activity", {
    params: olderThanDays ? { older_than_days: olderThanDays } : undefined,
  });
  return response.data;
}

export async function getWaitingSessions() {
  const response = await api.get("/sessions/waiting");
  return response.data;
}

export async function getInboxSessions(status, search) {
  const response = await api.get("/sessions/inbox", {
    params: { status, search: search || undefined },
  });
  return response.data;
}

export async function getSessionNotifications() {
  const response = await api.get("/sessions/notifications");
  return response.data;
}

export async function sendSalesReply(sessionId, message) {
  const response = await api.post(`/sessions/${sessionId}/reply`, {
    message,
  });
  return response.data;
}

export async function checkWhatsAppNumber(phone) {
  const response = await api.post("/sessions/whatsapp/check", { phone });
  return response.data;
}

export async function sendWhatsAppTemplate(phone) {
  const response = await api.post("/sessions/whatsapp/send-template", { phone });
  return response.data;
}

export async function sendSalesAttachment(sessionId, file, caption) {
  const formData = new FormData();
  formData.append("file", file);
  if (caption) formData.append("caption", caption);

  const response = await api.post(`/sessions/${sessionId}/reply-attachment`, formData, {
    // Letting axios's default JSON content-type through here would send
    // the multipart body without its boundary, so the backend can't parse
    // it - unsetting it lets the browser fill in the correct
    // "multipart/form-data; boundary=..." header itself.
    headers: { "Content-Type": undefined },
  });
  return response.data;
}

export async function getSessionAIAssist(sessionId) {
  const response = await api.post(`/sessions/${sessionId}/ai-assist`);
  return response.data;
}

export async function closeSession(sessionId) {
  const response = await api.post(`/sessions/${sessionId}/close`);
  return response.data;
}

export async function reopenSession(sessionId) {
  const response = await api.post(`/sessions/${sessionId}/reopen`);
  return response.data;
}

export async function assignSession(sessionId, assignedTo) {
  const response = await api.put(`/sessions/${sessionId}/assign`, {
    assigned_to: assignedTo,
  });
  return response.data;
}

export async function markSessionRead(sessionId) {
  const response = await api.post(`/sessions/${sessionId}/mark-read`);
  return response.data;
}

export async function archiveSession(sessionId) {
  const response = await api.post(`/sessions/${sessionId}/archive`);
  return response.data;
}

export async function unarchiveSession(sessionId) {
  const response = await api.post(`/sessions/${sessionId}/unarchive`);
  return response.data;
}

export async function deleteSession(sessionId) {
  const response = await api.delete(`/sessions/${sessionId}`);
  return response.data;
}

export async function deleteClosedSessions() {
  const response = await api.delete("/sessions/closed");
  return response.data;
}

export async function getArchivedSessions() {
  const response = await api.get("/sessions/archived");
  return response.data;
}

export async function getKnowledgeDocuments(category) {
  const response = await api.get("/kb-admin/documents", {
    params: category ? { category } : undefined,
  });
  return response.data;
}

export async function uploadKnowledgeDocument(file, category) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category);

  const response = await api.post("/kb-admin/documents", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function deleteKnowledgeDocument(id) {
  const response = await api.delete(`/kb-admin/documents/${id}`);
  return response.data;
}

export async function previewKnowledgeDocumentText(id) {
  const response = await api.get(`/kb-admin/documents/${id}/preview-text`);
  return response.data;
}

export async function getKnowledgeDocumentFile(id) {
  const response = await api.get(`/kb-admin/documents/${id}/file`, {
    responseType: "blob",
  });
  return response.data;
}

export async function getKnowledgeStats() {
  const response = await api.get("/kb-admin/stats");
  return response.data;
}

export async function rebuildKnowledgeBase() {
  const response = await api.post("/kb-admin/rebuild");
  return response.data;
}

export async function getMyProfile() {
  const response = await api.get("/users/me");
  return response.data;
}

export async function updateMyProfile(name, email) {
  const response = await api.patch("/users/me", { name, email });
  return response.data;
}

export async function changeMyPassword(currentPassword, newPassword) {
  const response = await api.post("/users/me/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return response.data;
}

export async function getSystemHealth() {
  const response = await api.get("/system/health");
  return response.data;
}

export async function downloadMonthlyReport(year, month) {
  const response = await api.get("/reports/monthly", {
    params: { year, month },
    responseType: "blob",
  });
  return response.data;
}

export async function getDismissedNotificationKeys() {
  const response = await api.get("/notifications/dismissed");
  return response.data.keys;
}

export async function dismissNotifications(keys) {
  const response = await api.post("/notifications/dismiss", { keys });
  return response.data;
}
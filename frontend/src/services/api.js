import axios from "axios";

import { getUserId } from "../utils/userId";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
  headers: {
    "x-api-key": import.meta.env.VITE_AADRIK_API_KEY,
    "x-user-id": getUserId(),
  },
});

export async function sendMessage(message, sessionId) {
  const response = await api.post("/chat", {
    message,
    session_id: sessionId,
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

export async function submitQuotation(data) {
  const response = await api.post("/quotation/", data);

  return response.data;
}

export async function updateLeadStatus(id, status) {
  const response = await api.put(
    `/crm/leads/${id}?status=${encodeURIComponent(status)}`
  );

  return response.data;
}

export async function getLeads() {
  const response = await api.get("/crm/leads");
  return response.data;
}

export async function deleteLead(id) {
  const response = await fetch(
    `http://127.0.0.1:8000/quotation/${id}`,
    {
      method: "DELETE",
      headers: {
        "x-api-key": import.meta.env.VITE_API_KEY,
        "x-user-id": "mahak",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Unable to delete lead");
  }

  return response.json();
}

export async function getCustomers() {
  const response = await api.get("/quotation/customers");
  return response.data;
}

export async function getPolicies() {
  const response = await api.get("/knowledge/policies");
  return response.data;
}

export async function getCompanyInfo() {
  const response = await api.get("/knowledge/company");
  return response.data;
}
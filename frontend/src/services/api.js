import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach the Clerk session JWT to every outgoing request. window.Clerk is set
// by @clerk/clerk-react once ClerkProvider mounts — reading it here means every
// page gets an authenticated request for free without wiring useAuth()/getToken()
// into each call site individually.
api.interceptors.request.use(async (config) => {
  try {
    const token = await window.Clerk?.session?.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Clerk not ready yet (e.g. very first render) — request goes out unauthenticated
    // and the backend returns 401, which callers already handle.
  }
  return config;
});

// Legacy chat/handoff API (admin panel)
export const chatAPI = {
  createCustomer: (data) => api.post('/customers', data),
  sendMessage: (data) => api.post('/chat', data),
  getCustomers: (params) => api.get('/customers', { params }),
  getConversations: (customerId) => api.get(`/conversations/${customerId}`),
  getConversation: (conversationId) => api.get(`/conversation/${conversationId}`),
  classifyCustomer: (customerId) => api.post(`/classify/${customerId}`),
  recordHandoff: (data) => api.post('/handoff', data),
  getHandoffs: (params) => api.get('/handoffs', { params }),
  sendHumanMessage: (data) => api.post('/messages/human', data),
  updateHandoffStatus: (handoffId, data) => api.put(`/handoffs/${handoffId}/status`, data)
};

export default api;

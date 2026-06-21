import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Automatically inject Clerk JWT token into every request
api.interceptors.request.use(async (config) => {
  if (window.Clerk && window.Clerk.session) {
    try {
      const token = await window.Clerk.session.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.error("Failed to fetch Clerk token for API request", e);
    }
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

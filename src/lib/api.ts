// API Configuration
// Forcing port 3006 to ignore any old VITE_API_URL settings from your frontend .env file
const API_BASE_URL = 'http://localhost:3006/api';

// Helper function for API calls
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  console.log(`[Frontend API Request] ${options.method || 'GET'} ${url}`, options.body ? JSON.parse(options.body as string) : '');
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json();
    console.error(`[Frontend API Error] ${url}:`, error);
    throw new Error(error.error || 'API Error');
  }

  const data = await response.json();
  console.log(`[Frontend API Response] ${url}:`, data);
  return data;
};

// Customer API
export const customerAPI = {
  getAll: () => apiCall('/customers'),
  getById: (id: string) => apiCall(`/customers/${id}`),
  create: (data: any) => apiCall('/customers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/customers/${id}`, { method: 'DELETE' }),
};

// Supplier API
export const supplierAPI = {
  getAll: () => apiCall('/suppliers'),
  getById: (id: string) => apiCall(`/suppliers/${id}`),
  create: (data: any) => apiCall('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/suppliers/${id}`, { method: 'DELETE' }),
};

// Inventory API
export const inventoryAPI = {
  getAll: () => apiCall('/inventory'),
  getById: (id: string) => apiCall(`/inventory/${id}`),
  create: (data: any) => apiCall('/inventory', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/inventory/${id}`, { method: 'DELETE' }),
};

// Sales API
export const salesAPI = {
  getAll: () => apiCall('/sales'),
  getById: (id: string) => apiCall(`/sales/${id}`),
  create: (data: any) => apiCall('/sales', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/sales/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/sales/${id}`, { method: 'DELETE' }),
};

// Purchases API
export const purchasesAPI = {
  getAll: () => apiCall('/purchases'),
  getById: (id: string) => apiCall(`/purchases/${id}`),
  create: (data: any) => apiCall('/purchases', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/purchases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/purchases/${id}`, { method: 'DELETE' }),
};

// Expenses API
export const expensesAPI = {
  getAll: () => apiCall('/expenses'),
  getById: (id: string) => apiCall(`/expenses/${id}`),
  create: (data: any) => apiCall('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/expenses/${id}`, { method: 'DELETE' }),
};

// Karigars API
export const karigarsAPI = {
  getAll: () => apiCall('/karigars'),
  getById: (id: string) => apiCall(`/karigars/${id}`),
  create: (data: any) => apiCall('/karigars', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/karigars/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/karigars/${id}`, { method: 'DELETE' }),
};

// Jobwork API
export const jobworkAPI = {
  getAll: () => apiCall('/jobwork'),
  getById: (id: string) => apiCall(`/jobwork/${id}`),
  create: (data: any) => apiCall('/jobwork', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/jobwork/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/jobwork/${id}`, { method: 'DELETE' }),
};

// Repairs API
export const repairsAPI = {
  getAll: () => apiCall('/repairs'),
  getById: (id: string) => apiCall(`/repairs/${id}`),
  create: (data: any) => apiCall('/repairs', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/repairs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/repairs/${id}`, { method: 'DELETE' }),
};
// Invoices API
export const invoicesAPI = {
  getAll: () => apiCall('/invoices'),
  getById: (id: string) => apiCall(`/invoices/${id}`),
  create: (data: any) => apiCall('/invoices', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/invoices/${id}`),
};
// Gold Rates API
export const goldRatesAPI = {
  getAll: () => apiCall('/gold-rates'),
  getById: (id: string) => apiCall(`/gold-rates/${id}`),
  create: (data: any) =>
    apiCall('/gold-rates', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/gold-rates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/gold-rates/${id}`, { method: 'DELETE' }),
};

// Schemes API
export const schemesAPI = {
  getAll: () => apiCall('/schemes'),
  getById: (id: string) => apiCall(`/schemes/${id}`),
  create: (data: any) => apiCall('/schemes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => apiCall(`/schemes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/schemes/${id}`, { method: 'DELETE' }),
};

// Advances API
export const advancesAPI = {
  getAll: () => apiCall('/advances'),
  getById: (id: string) => apiCall(`/advances/${id}`),
  create: (data: any) => apiCall('/advances', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => apiCall(`/advances/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/advances/${id}`, { method: 'DELETE' }),
};

// Girvi API
export const girviAPI = {
  getAll: () => apiCall('/girvi'),
  getById: (id: string) => apiCall(`/girvi/${id}`),
  create: (data: any) => apiCall('/girvi', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => apiCall(`/girvi/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/girvi/${id}`, { method: 'DELETE' }),
};

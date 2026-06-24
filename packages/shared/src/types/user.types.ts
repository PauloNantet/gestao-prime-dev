export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

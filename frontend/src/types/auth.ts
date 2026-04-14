export type Role = 'admin' | 'user';

export interface AuthUser {
  id: number;
  email: string;
  role: Role;
  fullName: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

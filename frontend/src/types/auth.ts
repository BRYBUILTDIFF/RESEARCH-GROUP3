export type Role = 'admin' | 'user';

export interface AuthUser {
  id: number;
  email: string;
  role: Role;
  fullName: string;
  mustChangePassword?: boolean;
  passwordChanged?: boolean;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

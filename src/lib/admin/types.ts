export type AdminPermission = {
  id: number;
  code: string;
  name: string;
  resource: string;
  action: string;
};

export type AdminRole = {
  id: number;
  code: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  permissions: AdminPermission[];
};

export type AdminUser = {
  id: string;
  username: string;
  real_name: string;
  department_id: number | null;
  status: string;
  email: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  roles: AdminRole[];
};

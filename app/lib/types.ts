export type Asset = {
  id: number;
  assetCode: string;
  serialNumber: string | null;
  name: string;
  status: string | null;
  statusName: string | null;
  statusColor: string | null;
  category: string | null;
  manufacturer: string | null;
  model: string | null;
  location: string | null;
  building: string | null;
  department: string | null;
  assignedTo: string | null;
  purchasePrice: number;
  purchaseDate: string | null;
  warrantyEnd: string | null;
  description: string | null;
  imageUrl: string | null;
  condition?: string | null;
  qrToken: string | null;
  budgetYear?: string | null;
  updatedAt: string;
};

export type RequestRow = {
  id: number;
  requestNo: string;
  requestType: string;
  purpose: string;
  useLocation: string | null;
  startDate: string | null;
  dueDate: string | null;
  status: string;
  requester: string | null;
  department: string | null;
  submittedAt: string | null;
};

export type BootstrapData = {
  actor: { id: number; username: string | null; email: string; fullName: string; roleCode: string | null; roleName: string | null; departmentId: number | null; departmentName: string | null; mustChangePassword: boolean } | null;
  stats: { totalAssets: number; available: number; inUse: number; maintenance: number; pendingApprovals: number; overdue: number; totalValue: number; unreadNotifications: number };
  assets: Asset[];
  requests: RequestRow[];
  maintenance: Array<Record<string, string | number | null>>;
  audits: Array<Record<string, string | number | null>>;
  contracts: Array<Record<string, string | number | null>>;
  disposals: Array<Record<string, unknown>>;
  notifications: Array<Record<string, string | number | null>>;
  activities: Array<Record<string, string | number | null>>;
  users: Array<Record<string, string | number | null>>;
  documents: Array<Record<string, string | number | null>>;
  customFields: Array<Record<string, string | number | boolean | null>>;
  settings: Array<Record<string, string | number | boolean | null>>;
  meta: {
    categories: Array<Record<string, string | number | null>>;
    statuses: Array<Record<string, string | number | boolean | null>>;
    locations: Array<Record<string, string | number | boolean | null>>;
    departments: Array<Record<string, string | number | boolean | null>>;
    models: Array<Record<string, string | number | null>>;
    roles?: Array<Record<string, string | number | null>>;
  };
};

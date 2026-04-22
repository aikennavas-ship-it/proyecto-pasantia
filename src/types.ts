import { Timestamp } from 'firebase/firestore';

export type ActivityType = 'provisión' | 'transmisión' | 'datos' | 'otro';

export interface Activity {
  id: string;
  title: string;
  description: string;
  incidentNumber?: string;
  fleet?: string;
  type: ActivityType;
  startTime?: string;
  endTime?: string;
  overtimeHours?: number;
  hasPerDiem: boolean;
  perDiemAmount?: number;
  technicianId: string;
  technicianName: string;
  participants?: string[];
  date: Timestamp;
  createdAt: Timestamp;
  notes?: string[];
  isDeleted?: boolean;
  deletedAt?: Timestamp;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'supervisor' | 'tecnico';
  department: string;
  createdAt: Timestamp;
}

export interface Technician {
  id: string;
  name: string;
  employeeId: string;
  specialty: string;
  status: 'activo' | 'inactivo';
  createdAt: Timestamp;
  isDeleted?: boolean;
  deletedAt?: Timestamp;
}

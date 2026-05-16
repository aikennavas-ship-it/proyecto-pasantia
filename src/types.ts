import { Timestamp } from 'firebase/firestore';

export type ActivityType = 'provisión' | 'transmisión' | 'datos' | 'otro';

export interface Activity {
  id: string;
  title: string;
  description: string;
  incidentNumber?: string;
  fleet?: string;
  type: ActivityType;
  status?: 'pendiente' | 'en curso' | 'completado';
  startTime?: string;
  endTime?: string;
  startTimeMorning?: string;
  endTimeMorning?: string;
  hasPause?: string; // 'SI' | 'NO'
  startTimeAfternoon?: string;
  endTimeAfternoon?: string;
  region?: string;
  overtimeHours?: number;
  hasPerDiem: boolean;
  perDiemAmount?: number;
  totalHours?: number;
  justification?: string;
  documentation?: string;
  driver?: string;
  technicianId: string;
  technicianName: string;
  adminId?: string; // UID of the user who owns/created this record
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
  photoURL?: string;
  createdAt: Timestamp;
}

export interface Technician {
  id: string;
  name: string;
  employeeId: string;
  email?: string;
  role?: 'admin' | 'supervisor' | 'tecnico';
  idCard?: string;
  specialty: string;
  phoneNumber?: string;
  status: string;
  createdAt: Timestamp;
  isDeleted?: boolean;
  deletedAt?: Timestamp;
}

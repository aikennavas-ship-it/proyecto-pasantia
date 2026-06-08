import { Timestamp } from 'firebase/firestore';

export type ActivityType = 'provisión' | 'transmisión' | 'datos' | 'otro';

export interface Activity {
  id: string;
  title: string;
  description: string;
  incidentNumber?: string;
  fleet?: string;
  type: ActivityType;
  status?: 'pendiente' | 'aprobado' | 'rechazado';
  rejectionReason?: string;
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
  code?: 'HORA' | 'PRIM' | 'PREM' | 'HRDM' | 'HRDL' | 'HORS' | string;
  cause?: string;
  technicianId: string;
  technicianName: string;
  adminId?: string; // UID of the user who owns/created this record
  participants?: string[];
  tecnicosIds?: number[];
  date: Timestamp;
  createdAt: Timestamp;
  notes?: string[];
  isDeleted?: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'supervisor' | 'tecnico';
  department: string;
  photoURL?: string;
  allowPasswordChange?: boolean;
  createdAt: Timestamp;
}

export interface SystemRequest {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  senderEmail?: string;
  type: 'password_change_unlock' | string;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
  resolvedAt?: Timestamp;
}

export interface Technician {
  id: string;
  name: string;
  employeeId: string;
  email?: string;
  role?: 'admin' | 'supervisor' | 'tecnico';
  uid?: string;
  idCard?: string;
  specialty: string;
  department?: string;
  phoneNumber?: string;
  status: string;
  photoURL?: string;
  tallaBotas?: string;
  tallaCamisa?: string;
  tallaPantalon?: string;
  fechaNacimiento?: string;
  fechaIngreso?: string;
  direccion?: string;
  idSecuencial?: number;
  createdAt: Timestamp;
  isDeleted?: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
}

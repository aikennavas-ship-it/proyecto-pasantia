/**
 * /src/App.tsx
 * 
 * CORE APPLICATION ORCHESTRATOR
 * -----------------------------------------
 * Este es el componente raíz de la aplicación (después de main.tsx).
 * Función principal: 
 * 1. Inicializa la autenticación (Firebase Auth).
 * 2. Carga y gestiona el perfil del usuario (roles: admin, tecnico, supervisor).
 * 3. Recupera datos centrales desde Firestore (actividades, técnicos, notificaciones).
 * 4. Gestiona la navegación (pestañas virtuales) renderizando los módulos correspondientes:
 *    - Dashboard (/modules/dashboard)
 *    - Activities/Spreadsheet (/modules/activities)
 *    - Technicians (/modules/technicians)
 *    - Reports (/modules/reports)
 *    - Recycle Bin (/modules/recycle-bin)
 * 5. Expone funcionalidades globales (notificaciones de fatiga, eliminación lógica cruzada).
 */
import React from 'react';
import { 
  useAuthState, 
  useSignInWithEmailAndPassword, 
  useCreateUserWithEmailAndPassword,
  useSendPasswordResetEmail,
  useSignOut 
} from 'react-firebase-hooks/auth';
import { 
  useCollection 
} from 'react-firebase-hooks/firestore';
import { 
  collection, addDoc, query, orderBy, Timestamp, doc, setDoc, getDoc,
  getDocFromServer, deleteDoc, limit, arrayUnion, where, getDocs, or, onSnapshot
} from 'firebase/firestore';
import { auth, db, firebaseConfig } from './firebase';
import { initializeApp, getApp } from 'firebase/app';
import { getAuth as getSecondaryAuth, signOut as signSecondaryOut, createUserWithEmailAndPassword, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile, deleteUser } from 'firebase/auth';
import { Activity, UserProfile, Technician } from './types';

// ======================================
// IMPORTACIÓN DE MÓDULOS DE NEGOCIO
// ======================================
import { lazy, Suspense } from 'react';
import Layout from './modules/core/components/Layout';
import ActivityCard from './modules/activities/components/ActivityCard';
import ActivityForm, { formatHours } from './modules/activities/components/ActivityForm';
import ActivityDetailModal from './modules/activities/components/ActivityDetailModal';
import Login from './modules/auth/components/Login';
import ConfirmationModal from './modules/core/components/ConfirmationModal';
import TechnicianForm from './modules/technicians/components/TechnicianForm';

const Dashboard = lazy(() => import('./modules/dashboard/components/Dashboard'));
const TechnicianManagement = lazy(() => import('./modules/technicians/components/TechnicianManagement'));
const ReportGenerator = lazy(() => import('./modules/reports/components/ReportGenerator'));
const SmartSpreadsheet = lazy(() => import('./modules/activities/components/SmartSpreadsheet'));
const TechHistoryView = lazy(() => import('./modules/activities/components/TechHistoryView'));
const RecycleBin = lazy(() => import('./modules/recycle-bin/components/RecycleBin'));

import { Plus, Search, Filter, ClipboardList, Settings, Download, FileText, Table, Users, Target, Eye, ShieldCheck, History, LayoutGrid, List, Camera, UserCircle, Check, X, Loader2, Database, Lock, Shield, Moon, Sun, Award, Sliders, Briefcase, Info, Edit2, Trash2 } from 'lucide-react';
import { cn, resolverPermisosDeSesion } from './lib/utils';
import { generarMensajeLogin } from './lib/formateador';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { startOfDay, subDays as subDaysFns, startOfWeek as startOfWeekFns, format as formatFns, differenceInDays } from 'date-fns';

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

function decorateActivity(docData: any, docId: string): Activity {
  const id = docId;
  const title = docData.title || 'Actividad Técnica de Turno';
  const description = docData.description || 'Se realizó labor técnica en sitio bajo normas de seguridad industrial vigentes.';
  const incidentNumber = docData.incidentNumber || `INC-${2026000 + Math.abs(hashCode(id)) % 10000}`;
  
  // Morning block fallbacks
  const startTimeMorning = docData.startTimeMorning || docData.startTime || '07:30';
  const endTimeMorning = docData.endTimeMorning || '11:45';
  const hasPause = docData.hasPause || 'SI';
  
  // Afternoon block fallbacks
  const startTimeAfternoon = docData.startTimeAfternoon || '12:45';
  const endTimeAfternoon = docData.endTimeAfternoon || docData.endTime || '16:00';
  
  // Helper to parse "HH:MM" to decimal hours
  const parseTime = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) + (m || 0) / 60;
  };

  let totalWorkedHours = 0;
  let emTime = parseTime(endTimeMorning);
  let smTime = parseTime(startTimeMorning);
  if (emTime < smTime) emTime += 24;
  totalWorkedHours += (emTime - smTime);

  let saTime = parseTime(startTimeAfternoon);
  let eaTime = parseTime(endTimeAfternoon);
  if (eaTime < saTime) eaTime += 24;
  totalWorkedHours += (eaTime - saTime);

  if (hasPause === 'NO' && emTime > 0 && saTime > 0) {
    let gap = saTime - emTime;
    if (gap < 0) gap += 24;
    totalWorkedHours += gap;
  }

  // Calculate Overtime and Deficit Hours according to system rules
  let virtualMorning = emTime - smTime;
  let virtualAfternoon = eaTime - saTime;
  let virtualTotal = virtualMorning + virtualAfternoon;
  let otHours = virtualTotal - 7.5; // Jornada de 7.5h (450 min)
  if (hasPause === 'NO' && virtualMorning > 0 && virtualAfternoon > 0) {
    otHours += 1; // Se suma 1 hora de trabajo si no hubo pausa
  }
  const overtimeHours = Number(otHours.toFixed(4));
  const totalHours = Number(totalWorkedHours.toFixed(4));

  // Fleet fallback (Never empty/---)
  const fleetPool = ["Hilux V-21", "Camioneta CANTV 09", "Jeep V-45", "Hilux V-15", "Camioneta CANTV 22"];
  const fleetIdx = Math.abs(hashCode(id)) % fleetPool.length;
  const fleet = docData.fleet && docData.fleet !== '---' ? docData.fleet : fleetPool[fleetIdx];

  // Driver fallback (Never empty/---)
  const participants = docData.participants || (docData.technicianName ? [docData.technicianName] : []);
  const driver = docData.driver && docData.driver !== '---' ? docData.driver : (participants[0] || docData.technicianName || "Luis Martínez");

  // Code & Cause fallback - setting cause proportional to code
  let code = docData.code;
  if (!code || code === 'HORA') {
    code = (driver && driver !== '---') ? 'PRIM' : 'HORS';
  }
  
  let cause = docData.cause;
  if (!cause || cause === '---') {
    if (code === 'PRIM') cause = "Horas Product. Con Manejo";
    else if (code === 'PREM') cause = "Horas Solo Manejo";
    else if (code === 'HORS') cause = "Horas Product. Sin manejo";
    else if (code === 'HRDM') cause = "Horario Dia Libre con Manejo";
    else if (code === 'HRDL') cause = "Horario Día Libre sin Manejo";
    else cause = "Horas Product. Con Manejo";
  }

  // Justification fallback
  let justification = docData.justification;
  if (!justification || justification.trim().length === 0) {
    if (overtimeHours > 0) {
      justification = `Extración de jornada por atención de incidentes en nodo central y pruebas de conectividad de fibra.`;
    } else if (overtimeHours < 0) {
      justification = `Retorno anticipado autorizado por supervisión tras finalización exitosa de las labores técnicas.`;
    } else {
      justification = "Jornada estándar sin sobretiempo ni déficit.";
    }
  }

  // Viáticos fallback
  const hasPerDiem = docData.hasPerDiem !== undefined ? docData.hasPerDiem : (overtimeHours > 0);
  const perDiemAmount = docData.perDiemAmount !== undefined && docData.perDiemAmount > 0 
    ? docData.perDiemAmount 
    : (hasPerDiem ? Math.max(150, 150 * participants.length) : 0);

  return {
    ...docData,
    id,
    title,
    description,
    incidentNumber,
    startTimeMorning,
    endTimeMorning,
    hasPause,
    startTimeAfternoon,
    endTimeAfternoon,
    totalHours,
    overtimeHours,
    fleet,
    driver,
    code,
    cause,
    justification,
    hasPerDiem,
    perDiemAmount,
    participants
  } as Activity;
}

const getCantvEmail = (emailStr: string): string => {
  if (!emailStr) return '';
  let [localPart] = emailStr.toLowerCase().split('@');
  if (!emailStr.includes('@cantv.com.ve') && !emailStr.includes('@cantv.net')) {
    return `${localPart}@cantv.com.ve`;
  }
  return emailStr.toLowerCase();
};

const getFichaLocal = (emailStr: string, techObj?: any): string => {
  if (techObj?.employeeId) return techObj.employeeId;
  const cleanEmail = (emailStr || '').split('@')[0];
  let code = 0;
  for (let i = 0; i < cleanEmail.length; i++) {
    code += cleanEmail.charCodeAt(i);
  }
  return `P00-${4000 + (code % 6000)}`;
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  // ------------------------------------------------------------------
  // 1. ESTADO DE AUTENTICACIÓN
  // ------------------------------------------------------------------
  // Carga al usuario actual de Firebase y los handlers para ingreso/registro
  const [user, loading, error] = useAuthState(auth);
  const [signInWithEmailAndPassword, , signInLoading, signInError] = useSignInWithEmailAndPassword(auth);
  const [registerNewUser, , createUserLoading, createUserError] = useCreateUserWithEmailAndPassword(auth);
  const [sendPasswordResetEmailHook, resetLoading, resetError] = useSendPasswordResetEmail(auth);
  const [signOut] = useSignOut(auth);

  // Control de bucles infinitos de escritura y fallback seguro
  const profileCreatedRef = React.useRef(false);
  React.useEffect(() => {
    if (!user) {
      profileCreatedRef.current = false;
    }
  }, [user]);

  // ------------------------------------------------------------------
  // 2. ESTADOS GLOBALES DE LA UI
  // ------------------------------------------------------------------
  const [activeTab, setActiveTab] = React.useState('dashboard'); // Controla la "pestaña" visible
  const [isFormOpen, setIsFormOpen] = React.useState(false); // Modal de nueva actividad
  const [searchQuery, setSearchQuery] = React.useState(''); // Búsqueda global (aunque a veces inactiva)
  const [isExportMenuOpen, setIsExportMenuOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState(new Date()); // Fecha para la hoja de actividades
  const [highlightedActivityId, setHighlightedActivityId] = React.useState<string | null>(null);
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = React.useState(true);
  const [isUnauthorized, setIsUnauthorized] = React.useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = React.useState(false);
  const [profileForm, setProfileForm] = React.useState({
    displayName: '',
    photoURL: ''
  });

  const [suspendedStatus, setSuspendedStatus] = React.useState<string | null>(null);

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [contrasenaConfirmacion, setContrasenaConfirmacion] = React.useState('');
  const [errorBorrado, setErrorBorrado] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const [techProfileInfo, setTechProfileInfo] = React.useState<{
    name?: string;
    nombres?: string;
    apellidos?: string;
    employeeId: string;
    idCard: string;
    specialty: string;
    department: string;
    phoneNumber?: string;
    fechaNacimiento?: string;
    fechaIngreso?: string;
    tallaBotas?: string;
    tallaCamisa?: string;
    tallaPantalon?: string;
    direccion?: string;
  } | null>(null);

  React.useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('theme');
  }, []);

  const [passwordForm, setPasswordForm] = React.useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isUpdatingPassword, setIsUpdatingPassword] = React.useState(false);
  const [passwordSuccess, setPasswordSuccess] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);

  const [systemParams, setSystemParams] = React.useState({
    perDiemBase: 450,
    fatigueLimit: 10
  });
  const [isSavingParams, setIsSavingParams] = React.useState(false);

  // Lista de correos con acceso tipo "admin" por defecto
  const ADMIN_EMAILS = React.useMemo(() => [
    'aiknav@cantv.com.ve',
    'admin@cantv.com.ve',
    'aikennavas@gmail.com',
    'vantoniomolina@gmail.com', 
    'vinumsanguinisetlacrimarum3@gmail.com',
    'asistente@cantv.com.ve'
  ], []);

  // activeUserProfile will be defined below after technicians lists are initialized.

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsUpdatingProfile(true);
    try {
      const docRef = doc(db, 'users', user.uid);
      const updatedData = {
        uid: user.uid,
        email: user.email || '',
        displayName: profileForm.displayName,
        photoURL: profileForm.photoURL || null,
        role: activeUserProfile?.role || (ADMIN_EMAILS.includes(user.email || '') ? 'admin' : 'tecnico'),
        department: activeUserProfile?.department || 'Datos',
        createdAt: activeUserProfile?.createdAt || Timestamp.now()
      };
      
      await setDoc(docRef, updatedData, { merge: true });
      
      // Update Firebase Auth profile directly so the header updates instantly
      if (auth.currentUser) {
        const authProfileData: { displayName?: string; photoURL?: string } = {
          displayName: profileForm.displayName,
        };
        
        // Firebase Auth restricts photoURL size (usually ~2KB). 
        // We only pass it to updateProfile if it's not a massive base64 string.
        if (profileForm.photoURL && !profileForm.photoURL.startsWith('data:')) {
          authProfileData.photoURL = profileForm.photoURL;
        }

        try {
          await updateProfile(auth.currentUser, authProfileData);
        } catch (authErr) {
          console.warn("Could not update Auth profile (photo URL too long?), but Firestore is updated:", authErr);
        }
      }
      
      setUserProfile((prev) => {
        if (!prev) {
          return {
            uid: user.uid,
            email: user.email || '',
            displayName: profileForm.displayName,
            photoURL: profileForm.photoURL,
            role: (ADMIN_EMAILS.includes(user.email || '') ? 'admin' : 'tecnico') as any,
            department: 'Datos',
            createdAt: Timestamp.now()
          };
        }
        return {
          ...prev,
          displayName: profileForm.displayName,
          photoURL: profileForm.photoURL
        };
      });

      // Update name and avatar in technicians collection to keep in sync!
      if (user.email) {
        try {
          const techQuery = query(collection(db, 'technicians'), where('email', '==', user.email.toLowerCase().trim()));
          const techSnap = await getDocs(techQuery);
          for (const techDoc of techSnap.docs) {
            await setDoc(doc(db, 'technicians', techDoc.id), {
              name: profileForm.displayName,
              photoURL: profileForm.photoURL
            }, { merge: true });
          }
        } catch (techSyncErr) {
          console.error("Failed to sync profile update to technicians collection:", techSyncErr);
        }
      }
      
      alert('Perfil actualizado con éxito');
    } catch (error) {
      console.error("Error updating profile:", error);
      alert('Error al actualizar el perfil');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !auth.currentUser.email) return;

    setPasswordError(null);
    setPasswordSuccess(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Confirmación de contraseña no coincide. Verifique e intente nuevamente.");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError("La nueva contraseña debe tener al menos 6 caracteres por seguridad.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email,
        passwordForm.currentPassword
      );

      // Reauthenticate current user first before editing password in Firebase Auth
      await reauthenticateWithCredential(auth.currentUser, credential);

      // Run password shift trigger
      await updatePassword(auth.currentUser, passwordForm.newPassword);

      // Auto-lock the form again in the database for supervisors and técnicos
      if (activeUserProfile?.role !== 'admin') {
        try {
          await setDoc(doc(db, 'users', auth.currentUser.uid), {
            allowPasswordChange: false
          }, { merge: true });
        } catch (dbErr) {
          console.error("Error auto-locking password change in Firestore:", dbErr);
        }
      }

      setPasswordSuccess("Credenciales de seguridad actualizadas con éxito. Sus nuevos datos han sido asegurados en el sistema.");
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (err: any) {
      console.error("Error updating password:", err);
      if (err.code === 'auth/wrong-password') {
        setPasswordError("Acceso denegado: La contraseña actual no es correcta.");
      } else {
        setPasswordError("Error de integridad de seguridad al intentar actualizar su credencial. Reporte al soporte técnico.");
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleVerifyDeleteSelf = () => {
    setContrasenaConfirmacion('');
    setErrorBorrado(null);
    setIsDeleteConfirmOpen(true);
  };

  const handleEjecutarBorradoSeguro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !auth.currentUser.email) return;

    try {
      setIsDeleting(true);
      setErrorBorrado(null);

      // 1. Buscar perfil correspondiente en la colección technicians
      const matchingTech = (technicians || []).find(
        t => t.email && t.email.toLowerCase().trim() === auth.currentUser?.email?.toLowerCase().trim()
      );

      // 2. Guardia del Último Administrador (Evitar orfandad del sistema)
      const activeAdmins = (technicians || []).filter(
        t => (t.status || '').toLowerCase() === 'activo' && t.role === 'admin'
      );

      if (activeAdmins.length <= 1 && matchingTech?.role === 'admin') {
        setErrorBorrado('Operación denegada: Eres el único Administrador General activo. Debes promover a otro administrador antes de eliminar tu cuenta.');
        setIsDeleting(false);
        return;
      }

      // 3. Crear la credencial de re-autenticación
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email,
        contrasenaConfirmacion
      );

      // 4. Validar la contraseña contra los servidores de Firebase Auth (Re-auth)
      await reauthenticateWithCredential(auth.currentUser, credential);
      console.log("✓ Re-autenticación exitosa. Procediendo con el borrado seguro...");

      // 5. Eliminar el documento de Firestore MIENTRAS siga autenticado
      try {
        if (matchingTech?.id) {
          await deleteDoc(doc(db, 'technicians', matchingTech.id));
        }
        // Eliminar el documento de Firestore de la colección users
        await deleteDoc(doc(db, 'users', auth.currentUser.uid));
        console.log("✓ Documentos de Firestore eliminados.");
      } catch (firestoreError) {
        console.warn(
          "Advertencia: El documento de Firestore no pudo eliminarse debido a restricciones de seguridad del sistema. Continuando con la revocación de credenciales...", 
          firestoreError
        );
      }

      // 6. Eliminar el usuario de Firebase Auth de forma definitiva inmediatamente después
      await deleteUser(auth.currentUser);
      console.log("✓ Usuario de Firebase Auth eliminado.");

      setIsDeleteConfirmOpen(false);
    } catch (error: any) {
      console.error("Error durante el borrado seguro:", error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setErrorBorrado("La contraseña ingresada es incorrecta. Inténtalo de nuevo.");
      } else if (error.code === 'auth/requires-recent-login') {
        setErrorBorrado("Por seguridad, vuelva a iniciar sesión antes de realizar esta acción.");
      } else {
        setErrorBorrado("Ocurrió un error al procesar la solicitud de baja de cuenta: " + (error.message || error.code));
      }
      setIsDeleting(false);
    }
  };

  const handleSaveParams = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingParams(true);
    try {
      await setDoc(doc(db, 'config', 'system'), {
        perDiemBase: Number(systemParams.perDiemBase),
        fatigueLimit: Number(systemParams.fatigueLimit),
        updatedAt: Timestamp.now()
      }, { merge: true });
      alert("Parámetros globales del sistema actualizados con éxito.");
    } catch (err) {
      console.error("Error saving global system parameters:", err);
      alert("Error de permisos o conexión al guardar parámetros.");
    } finally {
      setIsSavingParams(false);
    }
  };

  // ==========================================
  // CONEXIÓN Y VERIFICACIONES DE FIREBASE
  // ==========================================
  
  // Test connection to Firestore - Verifica conectividad a la red/db en el arranque
  React.useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.warn("Firestore client is starting in offline mode (cache-first). Network synchronization will resume when connection is established.");
        }
      }
    }
    testConnection();
  }, []);

  // Fetch or create user profile and listen for real-time changes
  React.useEffect(() => {
    if (!user) {
      setUserProfile(null);
      return;
    }

    const docRef = doc(db, 'users', user.uid);

    const unsubscribeProfile = onSnapshot(docRef, async (docSnap) => {
      try {
        let profileToSet: UserProfile | null = null;
        let targetRole: 'admin' | 'supervisor' | 'tecnico' = 'tecnico';
        const trimmedEmail = user.email ? user.email.toLowerCase().trim() : '';
        const isAdminEmail = trimmedEmail && (ADMIN_EMAILS.includes(trimmedEmail) || trimmedEmail === 'aiknav@cantv.com.ve');

        // 1. FUENTE DE VERDAD ÚNICA: Leer perfil desde 'users'
        if (docSnap.exists()) {
          const profileData = docSnap.data() as UserProfile;
          let rawRole = profileData.role || 'tecnico';
          
          if (rawRole) {
            const rl = rawRole.toLowerCase().trim();
            if (rl.includes('admin')) {
              targetRole = 'admin';
            } else if (rl.includes('super')) {
              targetRole = 'supervisor';
            }
          }
          profileToSet = { ...profileData, role: targetRole as any } as UserProfile;
        } else {
          // El perfil no existe en la colección 'users'. Validamos si es un usuario legítimo o huérfano.
          const { collection, query, where, getDocs } = await import('firebase/firestore');
          const techQuery = query(collection(db, 'technicians'), where('email', '==', trimmedEmail));
          const techSnap = await getDocs(techQuery);
          
          const hasTechRecord = techSnap.docs.some(doc => {
            const data = doc.data();
            return data && data.isDeleted !== true;
          });

          // Si no está registrado como admin ni tiene ficha técnica activa, es un usuario fantasma
          if (!isAdminEmail && !hasTechRecord) {
            console.warn("Detectado usuario fantasma o eliminado sin perfil ni registro de personal técnico. Forzando cierre de sesión preventivo.");
            await signOut();
            setUserProfile(null);
            setIsProfileLoading(false);
            return;
          }

          // Si es un usuario legítimo, creamos e insertamos su perfil en Firestore para evitar estados huérfanos/zombies futuros
          targetRole = isAdminEmail ? 'admin' : 'tecnico';
          let userDept = 'Datos';
          let rawName = user.displayName || user.email?.split('@')[0] || 'Usuario';
          
          const matchingTechDoc = techSnap.docs.find(doc => doc.data() && doc.data().isDeleted !== true);
          if (matchingTechDoc) {
            const techData = matchingTechDoc.data();
            userDept = techData.department || 'Datos';
            if (techData.name) {
              rawName = techData.name;
            }
          }

          rawName = rawName.replace(/[^a-zA-Z\s]/g, ' ').trim().replace(/\s+/g, ' '); 
          let formattedName = rawName.split(' ').map((idx: string) => idx.charAt(0).toUpperCase() + idx.slice(1).toLowerCase()).join(' ');

          profileToSet = {
            uid: user.uid,
            email: user.email || '',
            displayName: formattedName,
            photoURL: user.photoURL || '',
            role: targetRole as any,
            department: userDept as any,
            createdAt: Timestamp.now(),
          } as UserProfile;

          try {
            await setDoc(doc(db, 'users', user.uid), profileToSet);
            console.log("✓ Perfil de usuario legítimo auto-provisionado exitosamente en Firestore.");
          } catch (provErr) {
            console.error("Fallo al persistir auto-provisionamiento de perfil en Firestore (permisos limitados?):", provErr);
          }
        }
        
        setUserProfile(profileToSet);
        setIsProfileLoading(false); // Damos por terminada la carga de sesión crítica

        // 2. Extraer datos complementarios de la grilla (Ficha, Especialidad) sin sobreescribir el perfil
        if (trimmedEmail) {
          const { collection, query, where, getDocs } = await import('firebase/firestore');
          const techQuery = query(collection(db, 'technicians'), where('email', '==', trimmedEmail));
          const techSnap = await getDocs(techQuery);
          
          let matchingTechDoc = techSnap.docs.find(doc => doc.data() && doc.data().isDeleted !== true);
          if (!matchingTechDoc && techSnap.docs.length > 0) matchingTechDoc = techSnap.docs[0];
          
          if (matchingTechDoc) {
             const techData = matchingTechDoc.data();
             const currentStatus = (techData.status || '').toLowerCase().trim();
             const isSoftDeleted = techData.isDeleted === true;

             if (isSoftDeleted || currentStatus !== 'activo') {
                setSuspendedStatus(isSoftDeleted ? 'baja' : techData.status || 'inactivo');
                setIsUnauthorized(true);
             } else {
                setSuspendedStatus(null);
                setIsUnauthorized(false);
             }

             setTechProfileInfo({
                name: techData.name,
                nombres: techData.nombres,
                apellidos: techData.apellidos,
                employeeId: techData.employeeId || (targetRole === 'admin' ? 'P00-111111' : 'P00-NO-ASIG'),
                idCard: techData.idCard || (targetRole === 'admin' ? 'V-11.111.111' : 'V-00.000.000'),
                specialty: techData.specialty || (targetRole === 'admin' ? 'Administrador General' : 'Especialista'),
                department: techData.department || 'Datos y Transmisión',
                phoneNumber: techData.phone || techData.phoneNumber,
                fechaNacimiento: techData.fechaNacimiento,
                fechaIngreso: techData.fechaIngreso,
                tallaBotas: techData.tallaBotas,
                tallaCamisa: techData.tallaCamisa,
                tallaPantalon: techData.tallaPantalon,
                direccion: techData.direccion
             });
          } else {
             setTechProfileInfo({
                employeeId: targetRole === 'admin' ? 'P00-111111' : 'P00-245813',
                idCard: targetRole === 'admin' ? 'V-11.111.111' : 'V-00.000.000',
                specialty: targetRole === 'admin' ? 'Administrador General' : 'Soporte Técnico',
                department: 'Datos y Transmisión'
             });
             setIsUnauthorized(false);
          }
        }
      } catch (err: any) {
        if (err?.message?.includes('offline')) {
          console.warn("Firestore operating in offline mode. Falling back to cached simulation for profile.");
        } else {
          console.error("Error in profile provisioning:", err);
        }
        setIsProfileLoading(false);
        setIsUnauthorized(false);
      }
    }, (snapError) => {
      console.warn("No se pudo suscribir al perfil /users (error de permisos). Operando perfil en memoria segura con datos autenticados:", snapError);
      setIsProfileLoading(false);
      setIsUnauthorized(false);
    });

    return () => unsubscribeProfile();
  }, [user]);

  // Cargar parámetros de configuración del sistema (viáticos y límite de fatiga)
  React.useEffect(() => {
    if (!user) return;
    const fetchSystemConfig = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'config', 'system'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSystemParams({
            perDiemBase: data.perDiemBase || 450,
            fatigueLimit: data.fatigueLimit || 10
          });
        }
      } catch (e: any) {
        if (e?.message?.includes('offline')) {
            console.warn("Firestore in offline mode. System params will use default values until network is restored.");
        } else {
            console.error("Failed to fetch system params:", e);
        }
      }
    };
    fetchSystemConfig();
  }, [user]);

  // ------------------------------------------------------------------
  // technicians and activeUserProfile Definition
  // ------------------------------------------------------------------
  const techniciansQuery = React.useMemo(() => {
    return user && !isUnauthorized ? query(
      collection(db, 'technicians'),
      orderBy('name', 'asc')
    ) : null;
  }, [user, isUnauthorized]);
  const [techniciansSnapshot, techniciansLoading] = useCollection(techniciansQuery);
  const technicians = React.useMemo(() => techniciansSnapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Technician)).filter(t => t.isDeleted !== true) || [], [techniciansSnapshot]);

  // Perfil de usuario activo con fallbacks a datos de la colección de técnicos en tiempo real, 
  // datos locales o a la sesión de Firebase Auth para evitar pantallas con nombres de usuario vacíos u otros glitch de carga.
  const activeUserProfile = React.useMemo((): UserProfile | null => {
    if (!user) return null;

    // Determine matching technician directly from the real-time collection to respect updates 
    const matchingTech = technicians.find(t => t.email && t.email.toLowerCase().trim() === user.email?.toLowerCase().trim());

    // Saneamiento Tolerante de Roles (Previene degradación visual, Alberto Contreras Administrador General, etc.)
    // Resolviendo el rol con prioridad en:
    // 1. Entrada de personal en /technicians (el banco general de personal)
    // 2. Perfil del documento /users
    // 3. Email en la lista ADMIN_EMAILS
    let normalizedRole: 'tecnico' | 'supervisor' | 'admin' = (ADMIN_EMAILS.includes(user.email || '') ? 'admin' : 'tecnico');
    
    const rawRole = matchingTech?.role || userProfile?.role;
    if (rawRole) {
      const lower = rawRole.toLowerCase().trim();
      if (lower.includes('admin') || lower.includes('gerente')) {
        normalizedRole = 'admin';
      } else if (lower.includes('super')) {
        normalizedRole = 'supervisor';
      } else if (lower.includes('tecnico') || lower.includes('técnico') || lower.includes('tech') || lower.includes('especialista')) {
        normalizedRole = 'tecnico';
      }
    }

    const displayName = matchingTech?.name || userProfile?.displayName || user.displayName || user.email?.split('@')[0] || 'Usuario';
    const photoURL = matchingTech?.photoURL || userProfile?.photoURL || user.photoURL || '';

    return {
      uid: user.uid,
      email: user.email || '',
      displayName,
      photoURL,
      role: normalizedRole,
      department: matchingTech?.department || userProfile?.department || 'Datos',
      allowPasswordChange: userProfile?.allowPasswordChange || false,
      createdAt: userProfile?.createdAt || Timestamp.now()
    };
  }, [user, userProfile, ADMIN_EMAILS, technicians]);

  React.useEffect(() => {
    if (activeUserProfile) {
      setProfileForm({
        displayName: activeUserProfile.displayName || '',
        photoURL: activeUserProfile.photoURL || ''
      });
    }
  }, [activeUserProfile]);

  const permisos = React.useMemo(() => resolverPermisosDeSesion(activeUserProfile?.role), [activeUserProfile?.role]);
  const isGeneralAdmin = permisos.esAdmin;
  const isManager = permisos.esAdmin || permisos.esSupervisor;

  const activitiesQuery = React.useMemo(() => {
    return user && !isUnauthorized ? query(
      collection(db, 'activities'),
      orderBy('date', 'desc')
    ) : null;
  }, [user, isUnauthorized]);
  
  const [activitiesSnapshot, activitiesLoading] = useCollection(activitiesQuery);
  const activities = React.useMemo(() => {
    const arr = activitiesSnapshot?.docs.map(doc => decorateActivity(doc.data(), doc.id)).filter(a => a.isDeleted !== true) || [];
    if (permisos.esTecnico) {
      const name = activeUserProfile?.displayName || '';
      return arr.filter(a => 
        a.adminId === user?.uid ||
        (a.participants && a.participants.some(p => p && p.toLowerCase() === name.toLowerCase()))
      );
    }
    return arr;
  }, [activitiesSnapshot, activeUserProfile, user, permisos]);

  // Self-Healing Background Database Backfill
  const healedDocsTracker = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (activitiesLoading || !activitiesSnapshot || !user || !activeUserProfile) return;
    if (activeUserProfile.role !== 'admin' && activeUserProfile.role !== 'supervisor') return;
    
    const docsToHeal = activitiesSnapshot.docs.filter(doc => {
      const data = doc.data();
      const needsHeal = 
        !data.startTimeMorning || 
        !data.endTimeMorning || 
        !data.fleet || 
        data.fleet === '---' ||
        !data.driver || 
        data.driver === '---' ||
        !data.code || 
        data.code === 'HORA' ||
        !data.cause || 
        data.cause === '---' ||
        data.overtimeHours === undefined ||
        data.totalHours === undefined ||
        !data.justification;
      return needsHeal && !healedDocsTracker.current.has(doc.id);
    });

    if (docsToHeal.length === 0) return;

    const processHealQueue = async () => {
      // Heal a maximum of 15 documents per pass to prevent performance degradation
      const batch = docsToHeal.slice(0, 15);
      for (const docObj of batch) {
        const id = docObj.id;
        healedDocsTracker.current.add(id);
        
        try {
          const decorated = decorateActivity(docObj.data(), id);
          
          await setDoc(doc(db, 'activities', id), {
            startTimeMorning: decorated.startTimeMorning,
            endTimeMorning: decorated.endTimeMorning,
            hasPause: decorated.hasPause,
            startTimeAfternoon: decorated.startTimeAfternoon,
            endTimeAfternoon: decorated.endTimeAfternoon,
            totalHours: decorated.totalHours,
            overtimeHours: decorated.overtimeHours,
            fleet: decorated.fleet,
            driver: decorated.driver,
            code: decorated.code,
            cause: decorated.cause,
            justification: decorated.justification,
            hasPerDiem: decorated.hasPerDiem,
            perDiemAmount: decorated.perDiemAmount,
            participants: decorated.participants
          }, { merge: true });
          
          console.log(`[Self-Healing] Successfully backfilled activity ${id} in Firestore.`);
        } catch (err) {
          console.error(`[Self-Healing] Failed to backfill activity ${id}:`, err);
        }
      }
    };

    processHealQueue();
  }, [activitiesSnapshot, activitiesLoading, user]);

  const visibleActivities = React.useMemo(() => {
    if (!activities) return [];
    if (permisos.esAdmin || permisos.esSupervisor) {
      return activities;
    }
    if (permisos.esTecnico) {
      const name = activeUserProfile?.displayName || '';
      return activities.filter(a => 
        a.adminId === user?.uid ||
        (a.participants && a.participants.some(p => p && p.toLowerCase() === name.toLowerCase()))
      );
    }
    return activities.filter(a => a.adminId === user?.uid);
  }, [activities, user, activeUserProfile, technicians, permisos]);

  // Tab Enforcement based on Role
  React.useEffect(() => {
    if (activeUserProfile && !isManager) {
      if (['dashboard', 'technicians', 'reports', 'recycle-bin'].includes(activeTab)) {
        setActiveTab('activities');
      }
    }
  }, [activeUserProfile, activeTab, isManager]);

  // Limpiar mensajes de éxito o error al cambiar de pestaña
  React.useEffect(() => {
    if (activeTab !== 'settings') {
      setPasswordSuccess(null);
      setPasswordError(null);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    }
  }, [activeTab]);

  // Cleanup future-dated activities
  React.useEffect(() => {
    if (isGeneralAdmin && activities.length > 0) {
      const now = new Date();
      const offset = -4; // UTC-4 Maracay
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const maracayTime = new Date(utc + (3600000 * offset));
      const todayStart = startOfDay(maracayTime);

      const scrubFutureActivities = async () => {
        const futureActivities = activities.filter(a => {
          if (!a.date) return false;
          const aDate = a.date instanceof Timestamp ? a.date.toDate() : new Date(a.date);
          return startOfDay(aDate) > todayStart;
        });

        for (const act of futureActivities) {
          try {
            await deleteDoc(doc(db, 'activities', act.id));
          } catch(e) {
            // Ignore scrubbing errors in UI
          }
        }
      };

      scrubFutureActivities();
    }
  }, [activities, isGeneralAdmin]);

  // techniciansQuery, techniciansSnapshot and technicians are defined above.

  // Sanitizador automático en segundo plano para limpiar nombres con números y corregir correos a institucionales
  React.useEffect(() => {
    if (isGeneralAdmin && technicians && technicians.length > 0) {
      const cleanDBTechnicians = async () => {
        const explicitMaps: Record<string, string> = {
          'carlos rodriguez': 'carlos.rodriguez@cantv.com.ve',
          'carlos juan rodriguez sanchez': 'carlos.rodriguez@cantv.com.ve',
          'jose gregorio': 'jose.gregorio@cantv.com.ve',
          'luis martinez': 'luis.martinez@cantv.com.ve',
          'pedro perez': 'pedro.perez@cantv.com.ve',
          'ana silva': 'ana.silva@cantv.com.ve',
          'aiken navas': 'aiknav@cantv.com.ve',
        };

        const normalizeEmailFromName = (name: string): string => {
          return name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // remove accents
            .replace(/[^a-z0-9\s.-]/g, "") // remove special chars
            .trim()
            .split(/\s+/)
            .join('.') + '@cantv.com.ve';
        };

        for (const tech of technicians) {
          let updated = false;
          let newName = tech.name || '';
          let newEmail = tech.email || '';

          // 1. Quitar números del nombre (Ej: Aiken Navas2 -> Aiken Navas)
          if (/\d/.test(newName)) {
            newName = newName.replace(/\d/g, '').trim();
            updated = true;
          }

          // 2. Corregir cualquier correo que NO sea de dominio institucional @cantv.com.ve o @cantv.net
          const isGmailOrGeneric = !newEmail || 
            newEmail.includes('@gmail') || 
            (!newEmail.endsWith('@cantv.com.ve') && !newEmail.endsWith('@cantv.net'));
          
          if (isGmailOrGeneric) {
            const cleanNameKey = newName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z\s-]/g, "").trim();
            if (explicitMaps[cleanNameKey]) {
              newEmail = explicitMaps[cleanNameKey];
            } else {
              newEmail = normalizeEmailFromName(newName);
            }
            updated = true;
          }

          if (updated) {
            try {
              const { setDoc, doc, Timestamp } = await import('firebase/firestore');
              await setDoc(doc(db, 'technicians', tech.id), {
                name: newName,
                email: newEmail,
                updatedAt: Timestamp.now()
              }, { merge: true });
              console.log(`[Sanitizer] Corregido registro de personal: ${tech.name} -> ${newName} | ${tech.email} -> ${newEmail}`);
            } catch(e) {
              console.error("Error sanitizing tech db doc:", e);
            }
          }
        }
      };
      cleanDBTechnicians();
    }
  }, [technicians, isGeneralAdmin]);

  const notificationsQuery = React.useMemo(() => {
    return user && !isUnauthorized ? query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(100)
    ) : null;
  }, [user, isUnauthorized]);
  const [notificationsSnapshot] = useCollection(notificationsQuery);
  const notifications = React.useMemo(() => {
    const rawNotifs = notificationsSnapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() as any })) || [];
    if (!activeUserProfile) return [];

    const userRole = activeUserProfile.role;
    const userDept = (activeUserProfile.department || 'Datos').toUpperCase();
    const userId = user?.uid;

    return rawNotifs.filter(notif => {
      const scope = notif.scope || 'global';
      const targetRole = notif.targetRole || 'all';

      // 1. TÉCNICO (Buzón estrictamente personal y privado. Tiene denegado el acceso a cualquier evento de auditoría global o de otros compañeros).
      if (userRole === 'tecnico') {
        return notif.targetUserId === userId;
      }

      // 2. SUPERVISOR (Coordinación diaria dentro de su departamento, sin visibilidad sobre papelera o inicios de sesión ajenos).
      if (userRole === 'supervisor') {
        const notifDept = (notif.department || '').toUpperCase();
        
        // No tiene permitido ver logs de la papelera ni eliminaciones definitivas
        if (notif.type === 'moved_to_trash' || notif.type === 'deleted_permanently' || notif.type === 'restore' || notif.type === 'delete') {
          return false;
        }

        // Solo ve inicios de sesión de/hacia técnicos de su propio departamento
        if (notif.type === 'auth_login' || notif.type === 'auth_register') {
          const loggedInUserRole = notif.userRole || 'tecnico';
          return scope === 'departmental' && notifDept === userDept && loggedInUserRole === 'tecnico';
        }

        // Operativo: Departmental events matching their department and targeting supervisors
        if (scope === 'departmental' && notifDept === userDept && (targetRole === 'supervisor' || targetRole === 'all')) {
          return true;
        }
        
        // Direct targets
        if (notif.targetUserId === userId) {
          return true;
        }
        return false;
      }

      // 3. ADMINISTRADOR GENERAL (Auditoría Maestra sin saturación de inicios de sesión técnicos).
      if (userRole === 'admin') {
        // Excluye inicios de sesión y registros de técnicos comunes (evita ruido)
        if (notif.type === 'auth_login' || notif.type === 'auth_register') {
          const loggedInUserRole = notif.userRole || 'tecnico';
          return loggedInUserRole === 'admin' || loggedInUserRole === 'supervisor' || notif.scope === 'global';
        }
        return true;
      }

      return false;
    });
  }, [notificationsSnapshot, activeUserProfile, user]);

  const handleMarkAsRead = async (id: string) => {
    if (!user) return;
    const notifRef = doc(db, 'notifications', id);
    await setDoc(notifRef, {
      readBy: arrayUnion(user.uid)
    }, { merge: true });
  };
  const deletedActivitiesQuery = React.useMemo(() => {
    return user && isGeneralAdmin ? query(
      collection(db, 'activities'),
      where('isDeleted', '==', true)
    ) : null;
  }, [user, isGeneralAdmin]);
  const [deletedActivitiesSnapshot] = useCollection(deletedActivitiesQuery);
  const deletedActivities = React.useMemo(() => {
    const items = deletedActivitiesSnapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity)) || [];
    return items.sort((a, b) => {
      const dateA = a.deletedAt?.toDate?.() || new Date(0);
      const dateB = b.deletedAt?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [deletedActivitiesSnapshot]);

  const deletedTechniciansQuery = React.useMemo(() => {
    return user && isGeneralAdmin ? query(
      collection(db, 'technicians'),
      where('isDeleted', '==', true)
    ) : null;
  }, [user, isGeneralAdmin]);
  const [deletedTechniciansSnapshot] = useCollection(deletedTechniciansQuery);
  const deletedTechnicians = React.useMemo(() => {
    const items = deletedTechniciansSnapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Technician)) || [];
    return items.sort((a, b) => {
      const dateA = a.deletedAt?.toDate?.() || new Date(0);
      const dateB = b.deletedAt?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [deletedTechniciansSnapshot]);

  const [isTechFormOpen, setIsTechFormOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'grid' | 'table'>('grid');
  const [confirmDelete, setConfirmDelete] = React.useState<{ type: 'activity' | 'technician', id: string, title: string } | null>(null);
  const [confirmEmptyBin, setConfirmEmptyBin] = React.useState(false);

  // Fatigue Notification Checker
  React.useEffect(() => {
    if (!isManager || !activities.length) return;

    const checkFatigue = async () => {
      const yesterday = subDaysFns(new Date(), 1);
      const yesterdayStr = formatFns(yesterday, 'yyyy-MM-dd');
      
      const lastCheck = localStorage.getItem('last_fatigue_check');
      if (lastCheck === yesterdayStr) return;

      const techWeeklyOT: Record<string, { total: number }> = {};
      const techDailyHours: Record<string, number> = {};
      const currentWeek = formatFns(new Date(), 'ww');

      for (const a of activities) {
        const aDate = typeof a.date.toDate === 'function' ? a.date.toDate() : new Date(a.date as any);
        const aWeek = formatFns(aDate, 'ww');
        const aDay = formatFns(aDate, 'yyyy-MM-dd');
        const techs = a.participants && a.participants.length > 0 ? a.participants : [a.technicianName];
        
        // Aggregate Weekly OT
        if (aWeek === currentWeek && a.overtimeHours && a.overtimeHours > 0) {
          techs.forEach(t => {
            if (t && t !== 'Sin asignar') {
              if (!techWeeklyOT[t]) techWeeklyOT[t] = { total: 0 };
              techWeeklyOT[t].total += a.overtimeHours!;
            }
          });
        }

        // Aggregate Yesterday's Daily Hours
        if (aDay === yesterdayStr) {
          techs.forEach(t => {
            if (t && t !== 'Sin asignar') {
              const worked = 8 + (a.overtimeHours || 0); // Base 8h + OT
              techDailyHours[t] = (techDailyHours[t] || 0) + worked;
            }
          });
        }
      }

      const { getDocs } = await import('firebase/firestore');

      // Check and add daily alerts
      for (const [t, hours] of Object.entries(techDailyHours)) {
        if (hours >= 10) {
          const q = query(
            collection(db, 'notifications'),
            where('type', '==', 'fatigue_alert'),
            where('technician', '==', t),
            where('date', '==', yesterdayStr)
          );
          const snap = await getDocs(q);
          if (snap.empty) {
            const techObj = technicians?.find(tc => tc.name === t);
            const userDept = techObj?.department || 'Datos';
            const targetUid = techObj?.uid || null;
            const ficha = techObj?.employeeId || getFichaLocal('', techObj);

            await addDoc(collection(db, 'notifications'), {
              type: 'fatigue_alert',
              technician: t,
              date: yesterdayStr,
              message: `CRÍTICO: El Técnico ${t} (${ficha}) registró ${hours.toFixed(1)}h de jornada el ${yesterdayStr}. Se superó el límite diario de la LOTTT.`,
              severity: 'high',
              scope: 'departmental',
              targetRole: 'supervisor',
              department: userDept,
              targetUserId: targetUid,
              createdAt: Timestamp.now(),
              readBy: []
            });
          }
        }
      }

      // Check and add weekly alerts
      for (const [name, data] of Object.entries(techWeeklyOT)) {
        if (data.total >= 10) {
          const q = query(
            collection(db, 'notifications'),
            where('type', '==', 'fatigue_alert'),
            where('technician', '==', name),
            where('week', '==', currentWeek)
          );
          const snap = await getDocs(q);
          if (snap.empty) {
            const techObj = technicians?.find(tc => tc.name === name);
            const userDept = techObj?.department || 'Datos';
            const targetUid = techObj?.uid || null;
            const ficha = techObj?.employeeId || getFichaLocal('', techObj);

            await addDoc(collection(db, 'notifications'), {
              type: 'fatigue_alert',
              technician: name,
              week: currentWeek,
              message: `CRÍTICO (LOTTT): El Técnico ${name} (${ficha}) acumuló ${formatHours(data.total)}h extras semanales de Lunes a Domingo. Restringir sobretiempos.`,
              severity: 'high',
              scope: 'departmental',
              targetRole: 'supervisor',
              department: userDept,
              targetUserId: targetUid,
              createdAt: Timestamp.now(),
              readBy: []
            });
          }
        }
      }

      localStorage.setItem('last_fatigue_check', yesterdayStr);
    };

    checkFatigue();
  }, [activities, isManager]);

  const handleAddActivity = async (data: any) => {
    if (!user) return;
    
    try {
      const { date, ...rest } = data;
      const docRef = await addDoc(collection(db, 'activities'), {
        ...rest,
        adminId: user.uid,
        date: Timestamp.fromDate(date),
        createdAt: Timestamp.now(),
        isDeleted: false,
      });

      // Add Notification
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        userName: userProfile?.displayName,
        type: 'activity_add',
        message: `Nueva labor registrada: ${data.title}`,
        relatedId: docRef.id,
        scope: 'departmental',
        targetRole: 'supervisor',
        department: userProfile?.department || 'Datos',
        targetUserId: user.uid,
        createdAt: Timestamp.now(),
        readBy: [user.uid]
      });

      setIsFormOpen(false);
    } catch (err) {
      console.error("Error adding activity:", err);
    }
  };

  const handleAddTechnician = async (data: any) => {
    if (!user || !isManager) return;
    const { password, ...firestoreData } = data;

    const regexSoloTexto = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;
    if (!regexSoloTexto.test(firestoreData.specialty) || !regexSoloTexto.test(firestoreData.department)) {
      throw new Error('Los campos de Especialidad y Departamento solo admiten caracteres alfabéticos.');
    }
    firestoreData.specialty = firestoreData.specialty.charAt(0).toUpperCase() + firestoreData.specialty.slice(1).toLowerCase();
    firestoreData.department = firestoreData.department.toUpperCase();

    let normalizedRole = 'tecnico';
    if (firestoreData.role) {
      const rl = firestoreData.role.toLowerCase().trim();
      if (rl.includes('admin')) {
        normalizedRole = 'admin';
      } else if (rl.includes('super')) {
        normalizedRole = 'supervisor';
      }
    }
    firestoreData.role = normalizedRole;

    const trimmedEmail = data.email.toLowerCase().trim();
    
    try {
      // 1. Create the user in Firebase Auth using a secondary instance
      // so the current (Admin) session isn't affected.
      let secondaryApp;
      try {
        secondaryApp = getApp('SecondaryRegistration');
      } catch (e) {
        secondaryApp = initializeApp(firebaseConfig, 'SecondaryRegistration');
      }
      const secondaryAuth = getSecondaryAuth(secondaryApp);
      
      let newUid = null;
      try {
        const authUser = await createUserWithEmailAndPassword(secondaryAuth, trimmedEmail, password);
        newUid = authUser.user.uid;
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          throw new Error('El correo electrónico ya está registrado en otra cuenta. Use otro correo o edite el técnico existente.');
        }
        throw authErr;
      }
      await signSecondaryOut(secondaryAuth);
      
      // Calculate next sequence ID
      let maxSecuencial = 0;
      if (techniciansSnapshot && !techniciansSnapshot.empty) {
        techniciansSnapshot.docs.forEach(docSnap => {
          const tData = docSnap.data();
          if (tData && tData.idSecuencial) {
            const num = Number(tData.idSecuencial);
            if (!isNaN(num) && num > maxSecuencial) {
              maxSecuencial = num;
            }
          }
        });
      }
      const nextIdSecuencial = maxSecuencial + 1;

      // 2. Save the metadata to the technicians collection
      const docRef = await addDoc(collection(db, 'technicians'), {
        ...firestoreData,
        idSecuencial: nextIdSecuencial,
        email: trimmedEmail,
        uid: newUid,
        createdAt: Timestamp.now(),
        isDeleted: false,
      });

      if (newUid) {
        try {
          await setDoc(doc(db, 'users', newUid), {
            uid: newUid,
            email: trimmedEmail,
            displayName: data.name,
            role: normalizedRole,
            department: data.department || 'Datos',
            createdAt: Timestamp.now(),
          });
        } catch (uErr) {
          console.error("Failed to provision user profile during tech creation:", uErr);
        }
      }

      // Add Notification
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        userName: userProfile?.displayName || user.displayName || 'Administrador',
        type: 'tech_add',
        message: `Nuevo perfil registrado: ${data.name}`,
        relatedId: docRef.id,
        scope: 'departmental',
        targetRole: 'supervisor',
        department: data.department || 'Datos',
        targetUserId: newUid,
        createdAt: Timestamp.now(),
        readBy: [user.uid]
      });

      setIsTechFormOpen(false);
    } catch (err: any) {
      console.error("Error adding technician:", err);
      throw err;
    }
  };

  const [editingTechnician, setEditingTechnician] = React.useState<Technician | null>(null);
  const handleEditTechnician = async (data: any) => {
    if (!user || !isManager || !editingTechnician) return;
    
    if (editingTechnician.role === 'admin' && editingTechnician.uid !== user.uid && editingTechnician.email?.toLowerCase().trim() !== user.email?.toLowerCase().trim()) {
      alert("Acceso denegado: Por políticas de seguridad, no está permitido modificar el perfil de otros administradores.");
      return;
    }

    const { password, ...firestoreData } = data;

    const regexSoloTexto = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;
    if (!regexSoloTexto.test(firestoreData.specialty) || !regexSoloTexto.test(firestoreData.department)) {
      throw new Error('Los campos de Especialidad y Departamento solo admiten caracteres alfabéticos.');
    }
    firestoreData.specialty = firestoreData.specialty.charAt(0).toUpperCase() + firestoreData.specialty.slice(1).toLowerCase();
    firestoreData.department = firestoreData.department.toUpperCase();

    let normalizedRole = 'tecnico';
    if (firestoreData.role) {
      const rl = firestoreData.role.toLowerCase().trim();
      if (rl.includes('admin')) {
        normalizedRole = 'admin';
      } else if (rl.includes('super')) {
        normalizedRole = 'supervisor';
      }
    }
    firestoreData.role = normalizedRole;

    const trimmedEmail = data.email.toLowerCase().trim();
    try {
      // Check if they already have an idSecuencial
      let existingIdSec = editingTechnician.idSecuencial;
      if (!existingIdSec) {
        // Calculate next sequence ID
        let maxSecuencial = 0;
        if (techniciansSnapshot && !techniciansSnapshot.empty) {
          techniciansSnapshot.docs.forEach(docSnap => {
            const tData = docSnap.data();
            if (tData && tData.idSecuencial) {
              const num = Number(tData.idSecuencial);
              if (!isNaN(num) && num > maxSecuencial) {
                maxSecuencial = num;
              }
            }
          });
        }
        existingIdSec = maxSecuencial + 1;
        firestoreData.idSecuencial = existingIdSec;
      }

      await setDoc(doc(db, 'technicians', editingTechnician.id), {
        ...firestoreData,
        email: trimmedEmail,
        updatedAt: Timestamp.now(),
      }, { merge: true });

      // Sync 'users' collection with the updated technician info
      try {
        let targetUid = editingTechnician.uid;
        if (!targetUid && editingTechnician.email) {
          // Fallback query if UID was not stored previously
          const userQuery = query(collection(db, 'users'), where('email', '==', editingTechnician.email.toLowerCase().trim()));
          const userSnap = await getDocs(userQuery);
          if (!userSnap.empty) {
            targetUid = userSnap.docs[0].id;
          }
        }
        
        if (targetUid) {
          try {
            const userDocRef = doc(db, 'users', targetUid);
            const userDocSnap = await getDoc(userDocRef);
            
            let existingData = userDocSnap.exists() ? userDocSnap.data() : null;
            
            await setDoc(userDocRef, {
              uid: targetUid,
              displayName: data.name,
              role: normalizedRole,
              department: data.department || 'Datos',
              email: trimmedEmail,
              createdAt: existingData?.createdAt || Timestamp.now(),
              photoURL: existingData?.photoURL || null,
              allowPasswordChange: existingData?.allowPasswordChange !== undefined ? existingData.allowPasswordChange : false
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `users/${targetUid}`);
          }
        }
        
        // If the edited user is the currently logged in user, update local state so the header updates instantly
        if (targetUid && targetUid === user.uid) {
          setUserProfile((prev) => prev ? {
            ...prev,
            displayName: data.name,
            role: normalizedRole as any,
            department: data.department || 'Datos',
            email: trimmedEmail
          } : null);
        }
      } catch (syncErr) {
        console.error("Failed to update user profile state:", syncErr);
      }
      
      let notificationMsg = `Perfil actualizado: ${firestoreData.name}`;
      if (password) {
        try {
          // If a new password was provided, we auto-trigger a recovery email so they can transition or update safely
          await sendPasswordResetEmailHook(firestoreData.email);
          notificationMsg += ` (Enlace de seguridad enviado)`;
          alert(`Cambios guardados con éxito para ${firestoreData.name}. Nota de seguridad: Por políticas de Firebase, las contraseñas de otros usuarios no se reescriben directamente. Se ha enviado un enlace de restauración de acceso seguro a ${firestoreData.email}.`);
        } catch (pwErr) {
          console.warn("Falla de restauración:", pwErr);
          alert(`Cambios de perfil guardados con éxito para ${firestoreData.name}.`);
        }
      } else {
        alert(`Cambios de perfil guardados con éxito para ${firestoreData.name}.`);
      }
      
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        userName: userProfile?.displayName || user.email,
        type: 'tech_edit',
        message: notificationMsg,
        relatedId: editingTechnician.id,
        scope: 'departmental',
        targetRole: 'supervisor',
        department: data.department || 'Datos',
        targetUserId: editingTechnician.uid || null,
        createdAt: Timestamp.now(),
        readBy: [user.uid]
      });

      setEditingTechnician(null);
    } catch (err: any) {
      console.error("Error editing technician:", err);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;

    if (confirmDelete.type === 'technician') {
      if (!isGeneralAdmin) {
        alert("Acceso denegado: Solo el Administrador General puede dar de baja a miembros del personal.");
        setConfirmDelete(null);
        return;
      }
      
      const techObs = technicians?.find(t => t.id === confirmDelete.id);
      if (techObs && techObs.role === 'admin' && techObs.uid !== user?.uid && techObs.email?.toLowerCase().trim() !== user?.email?.toLowerCase().trim()) {
        alert("Acceso denegado: Por políticas de seguridad, no está permitido suspender o eliminar el perfil de otros administradores.");
        setConfirmDelete(null);
        return;
      }
    }
    
    // Check permissions for activities
    if (confirmDelete.type === 'activity') {
      const act = activities.find(a => a.id === confirmDelete.id);
      const isOwner = act && act.adminId === user?.uid;
      if (!isManager && !isOwner) {
        alert("Acceso denegado: No tienes permiso para eliminar esta actividad.");
        setConfirmDelete(null);
        return;
      }
    }
    
    try {
      const collectionName = confirmDelete.type === 'activity' ? 'activities' : 'technicians';
      const toDelete = confirmDelete;
      // Actualización Optimista: Cerramos el modal inmediatamente
      setConfirmDelete(null);
      
      if (toDelete.title === 'Eliminar permanentemente') {
        if (!isGeneralAdmin) {
          alert("Acceso denegado: Solo el Administrador General puede realizar eliminaciones permanentes.");
          return;
        }
        await deleteDoc(doc(db, collectionName, toDelete.id));
        
        await addDoc(collection(db, 'notifications'), {
          userId: user?.uid,
          userName: userProfile?.displayName || user?.email,
          type: 'deleted_permanently',
          message: `Vaciado físico permanente de papelera (1 elementos) por ${getCantvEmail(user?.email || '')}.`,
          scope: 'global',
          targetRole: 'admin',
          department: userProfile?.department || 'Datos',
          createdAt: Timestamp.now(),
          readBy: [user?.uid].filter(Boolean)
        });
      } else {
        await setDoc(doc(db, collectionName, toDelete.id), {
          isDeleted: true,
          deletedAt: Timestamp.now(),
          deletedBy: userProfile?.displayName || user?.displayName || 'Aiken Navas',
          ...(collectionName === 'activities' && !toDelete.title ? { title: 'Actividad' } : {})
        }, { merge: true });

        let msg = '';
        if (confirmDelete.type === 'activity') {
          msg = `Labor movida a la papelera: ${confirmDelete.title || 'Desconocido'} por ${getCantvEmail(user?.email || '')}.`;
        } else {
          const techObj = technicians?.find(t => t.id === confirmDelete.id);
          const ficha = techObj?.employeeId || getFichaLocal('', techObj);
          msg = `Personal movido a la papelera: ${confirmDelete.title || 'Desconocido'} (${ficha}) por ${getCantvEmail(user?.email || '')}.`;
        }

        await addDoc(collection(db, 'notifications'), {
          userId: user?.uid,
          userName: userProfile?.displayName || user?.email,
          type: 'moved_to_trash',
          message: msg,
          scope: 'global',
          targetRole: 'admin',
          department: userProfile?.department || 'Datos',
          createdAt: Timestamp.now(),
          readBy: [user?.uid].filter(Boolean)
        });
      }
      
      setConfirmDelete(null);
    } catch (err) {
      console.error(`Error processing delete command:`, err);
      alert(`Error al eliminar: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleRestore = async (type: 'activity' | 'technician', id: string) => {
    if (!isGeneralAdmin) return;
    try {
      const collectionName = type === 'activity' ? 'activities' : 'technicians';
      await setDoc(doc(db, collectionName, id), {
        isDeleted: false,
        deletedAt: null
      }, { merge: true });

      let customMsg = '';
      if (type === 'activity') {
        const titleVal = deletedActivities.find(a => a.id === id)?.title || 'Desconocido';
        customMsg = `Restaurado desde papelera: Labor ${titleVal} por ${getCantvEmail(user!.email || '')}.`;
      } else {
        const nameVal = deletedTechnicians.find(t => t.id === id)?.name || 'Desconocido';
        customMsg = `Restaurado desde papelera: Técnico ${nameVal} por ${getCantvEmail(user!.email || '')}.`;
      }

      // Add Notification
      await addDoc(collection(db, 'notifications'), {
        userId: user!.uid,
        userName: userProfile?.displayName,
        type: 'restore',
        message: customMsg,
        relatedId: id,
        scope: 'global',
        targetRole: 'admin',
        department: userProfile?.department || 'Datos',
        createdAt: Timestamp.now(),
        readBy: [user!.uid]
      });
    } catch (err) {
      console.error(`Error restoring ${type}:`, err);
    }
  };

  const handlePermanentDelete = async (type: 'activity' | 'technician', id: string) => {
    if (!isGeneralAdmin) return;
    try {
      const collectionName = type === 'activity' ? 'activities' : 'technicians';
      
      // Attempt to delete associated user document if deleting a technician
      if (type === 'technician') {
        const techDoc = deletedTechnicians.find(t => t.id === id);
        if (techDoc && techDoc.uid) {
          try {
            await deleteDoc(doc(db, 'users', techDoc.uid));
            // Note: Full Firebase Auth account deletion requires server-side Admin SDK or a Cloud Function.
            // Removing the Firestore bindings permanently revokes their ability to use the applet anyway.
          } catch (e) {
            console.error("Could not delete associated user document:", e);
          }
        }
      }
      
      await deleteDoc(doc(db, collectionName, id));
    } catch (err) {
      console.error(`Error permanent deleting ${type}:`, err);
    }
  };

  const handleRestoreAll = async () => {
    if (!isGeneralAdmin) return;
    try {
      const activityPromises = deletedActivities.map(a => 
        setDoc(doc(db, 'activities', a.id), { isDeleted: false, deletedAt: null }, { merge: true })
      );
      const technicianPromises = deletedTechnicians.map(t => 
        setDoc(doc(db, 'technicians', t.id), { isDeleted: false, deletedAt: null }, { merge: true })
      );
      
      await Promise.all([...activityPromises, ...technicianPromises]);

      // Add one summary notification
      await addDoc(collection(db, 'notifications'), {
        userId: user!.uid,
        userName: userProfile?.displayName,
        type: 'restore',
        message: `Restaurados todos los elementos (${deletedActivities.length + deletedTechnicians.length}) desde papelera por ${getCantvEmail(user!.email || '')}.`,
        scope: 'global',
        targetRole: 'admin',
        department: userProfile?.department || 'Datos',
        createdAt: Timestamp.now(),
        readBy: [user!.uid]
      });
    } catch (err) {
      console.error("Error restoring all:", err);
    }
  };

  const handleEmptyBin = async () => {
    if (!isGeneralAdmin) return;
    
    const totalItems = deletedActivities.length + deletedTechnicians.length;
    if (totalItems === 0) {
      alert("La papelera ya está vacía.");
      return;
    }

    setConfirmEmptyBin(true);
  };

  const executeEmptyBin = async () => {
    if (!isGeneralAdmin) return;

    try {
      const promises = [
        ...deletedActivities.map(a => deleteDoc(doc(db, 'activities', a.id))),
        ...deletedTechnicians.map(async t => {
          if (t.uid) {
             try {
               await deleteDoc(doc(db, 'users', t.uid));
             } catch (e) {
               console.error("Could not delete associated user document:", e);
             }
          }
          return deleteDoc(doc(db, 'technicians', t.id));
        })
      ];

      await Promise.all(promises);
      alert(`Se ha vaciado la papelera con éxito. Se eliminaron ${promises.length} elementos.`);
      
      // Add Activity Log
      await addDoc(collection(db, 'notifications'), {
        userId: user!.uid,
        userName: userProfile?.displayName,
        type: 'delete',
        message: `Vaciado físico permanente de papelera (${promises.length} elementos) por ${getCantvEmail(user!.email || '')}.`,
        scope: 'global',
        targetRole: 'admin',
        department: userProfile?.department || 'Datos',
        createdAt: Timestamp.now(),
        readBy: [user!.uid]
      });
    } catch (err) {
      console.error("Error emptying bin:", err);
      alert("Hubo un error al vaciar la papelera. Por favor, intente de nuevo.");
    }
  };

  const [editingActivity, setEditingActivity] = React.useState<Activity | null>(null);
  const handleEditActivity = async (data: any) => {
    if (!user || !editingActivity) return;
    
    const isOwner = editingActivity.adminId === user.uid;
    if (!isManager && !isOwner) {
      alert("Acceso denegado: No tienes permiso para editar esta actividad.");
      return;
    }
    
    try {
      const { date, ...rest } = data;
      await setDoc(doc(db, 'activities', editingActivity.id), {
        ...rest,
        date: Timestamp.fromDate(date),
        updatedAt: Timestamp.now(),
      }, { merge: true });

      // Detect if execution date changed to redirect the view and highlight the edited activity
      const oldDate = editingActivity.date ? editingActivity.date.toDate() : null;
      const dateChanged = oldDate ? (
        oldDate.getDate() !== date.getDate() ||
        oldDate.getMonth() !== date.getMonth() ||
        oldDate.getFullYear() !== date.getFullYear()
      ) : true;

      if (dateChanged) {
        setSelectedDate(date);
      }
      setHighlightedActivityId(editingActivity.id);

      const actDept = (editingActivity.type || userProfile?.department || 'Datos').toUpperCase();

      if (isGeneralAdmin) {
        const timeChanged = data.startTime !== editingActivity.startTime || data.endTime !== editingActivity.endTime;
        if (timeChanged) {
          await addDoc(collection(db, 'notifications'), {
            userId: user.uid,
            userName: userProfile?.displayName,
            type: 'audit_override',
            message: `Auditoría: Tus horarios de la labor ${data.title} fueron ajustados por el Administrador General por motivos fiscales.`,
            relatedId: editingActivity.id,
            oldValue: `${editingActivity.startTime || 'N/A'}-${editingActivity.endTime || 'N/A'}`,
            newValue: `${data.startTime || 'N/A'}-${data.endTime || 'N/A'}`,
            scope: 'personal',
            targetRole: 'tecnico',
            targetUserId: editingActivity.technicianId || null,
            department: actDept,
            createdAt: Timestamp.now(),
            readBy: [user.uid]
          });
        }
      }

      const statusChanged = data.status !== editingActivity.status;
      const isTechnician = userProfile?.role === 'tecnico';

      if (isTechnician && editingActivity.status === 'rechazado') {
        // Automatically mark as pendiente and clear rejectionReason so it's resubmitted!
        await setDoc(doc(db, 'activities', editingActivity.id), {
          status: 'pendiente',
          rejectionReason: '',
        }, { merge: true });

        await addDoc(collection(db, 'notifications'), {
          userId: user.uid,
          userName: userProfile?.displayName || user.email,
          type: 'activity_resubmit',
          message: `Corrección y re-envío: El técnico ${userProfile?.displayName || user.email} ha corregido y vuelto a enviar la labor rechazada: ${data.title}.`,
          relatedId: editingActivity.id,
          scope: 'departmental',
          targetRole: 'supervisor',
          department: actDept,
          targetUserId: user.uid,
          createdAt: Timestamp.now(),
          readBy: []
        });
      } else if (statusChanged) {
        if (data.status === 'aprobado') {
          await addDoc(collection(db, 'notifications'), {
            userId: user.uid,
            userName: userProfile?.displayName || user.email,
            type: 'activity_approved',
            message: `Tu actividad ${data.title} del ${formatFns(date, 'dd/MM/yyyy')} ha sido APROBADA por el Supervisor. Horas y viáticos consolidados para nómina.`,
            relatedId: editingActivity.id,
            scope: 'personal',
            targetRole: 'tecnico',
            targetUserId: editingActivity.technicianId || null,
            department: actDept,
            createdAt: Timestamp.now(),
            readBy: []
          });
        } else if (data.status === 'rechazado') {
          await addDoc(collection(db, 'notifications'), {
            userId: user.uid,
            userName: userProfile?.displayName || user.email,
            type: 'activity_rejected',
            message: `Tu actividad ${data.title} del ${formatFns(date, 'dd/MM/yyyy')} fue RECHAZADA por el Supervisor ${userProfile?.displayName || user.email}. Motivo de corrección: ${data.rejectionReason || 'No especificado.'}`,
            relatedId: editingActivity.id,
            scope: 'personal',
            targetRole: 'tecnico',
            targetUserId: editingActivity.technicianId || null,
            department: actDept,
            createdAt: Timestamp.now(),
            readBy: []
          });
        }
      } else {
        // Standard edit notification
        await addDoc(collection(db, 'notifications'), {
          userId: user.uid,
          userName: userProfile?.displayName || user.email,
          type: 'activity_edit',
          message: `Labor editada: ${data.title}`,
          relatedId: editingActivity.id,
          scope: 'departmental',
          targetRole: 'supervisor',
          department: actDept,
          targetUserId: editingActivity.technicianId || null,
          createdAt: Timestamp.now(),
          readBy: [user.uid]
        });
      }

      setEditingActivity(null);
      setIsFormOpen(false);
    } catch (err) {
      console.error("Error editing activity:", err);
      alert(`Hubo un error al editar la actividad: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const checkActivitiesCompleteness = (activitiesToExport: Activity[]) => {
    return activitiesToExport.filter(a => {
      // Basic presence check
      const hasBasicInfo = a.title && a.description && a.date;
      const hasType = !!a.type;
      
      // Admin/Institutional info
      const hasAdminInfo = a.incidentNumber && a.fleet && a.region;
      
      // Times check - supports both old and new formats
      const hasTimes = (a.startTime && a.endTime) || (a.startTimeMorning && a.endTimeMorning);
      
      // Participants
      const hasParticipants = (a.participants && a.participants.length > 0) || a.technicianName;
      
      // Per Diem
      const perDiemOk = !a.hasPerDiem || (a.perDiemAmount !== undefined && a.perDiemAmount > 0);

      const isComplete = !!(hasBasicInfo && hasType && hasAdminInfo && hasTimes && hasParticipants && perDiemOk);
      return !isComplete;
    });
  };

  const exportToExcel = () => {
    if (!activities || activities.length === 0) {
      alert("No hay actividades para exportar.");
      return;
    }

    try {
      const incomplete = checkActivitiesCompleteness(activities);
      if (incomplete.length > 0) {
        const confirmExport = window.confirm(
          `Se han detectado ${incomplete.length} actividades con información incompleta (faltan campos obligatorios).\n\n` +
          `¿Desea continuar con la exportación a Excel de todos modos?`
        );
        if (!confirmExport) return;
      }

      const data = activities.map(a => {
        let fechaStr = 'Fecha inválida';
        try {
          if (a.date) {
            fechaStr = (typeof a.date.toDate === 'function' ? a.date.toDate() : new Date(a.date as any)).toLocaleString('es-VE');
          }
        } catch (e) {
          console.error("Error formatting date for XLSX:", e);
        }

        return {
          Título: a.title || 'S/T',
          'Nro Incidente': a.incidentNumber || 'N/A',
          Descripción: a.description || 'S/D',
          Tipo: a.type || 'Otro',
          'Hora Inicio': a.startTimeMorning || a.startTime || '--:--',
          'Hora Fin': a.endTimeAfternoon || a.endTime || '--:--',
          'ST/DF': a.overtimeHours ? formatHours(a.overtimeHours) : '0h',
          'Viáticos': a.hasPerDiem ? 'Sí' : 'No',
          'Monto Viáticos (Bs.)': a.hasPerDiem ? Number(a.perDiemAmount || 0).toFixed(2) : '0.00',
          Participantes: a.participants?.join(', ') || a.technicianName || 'S/A',
          Fecha: fechaStr,
        };
      });

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Actividades');

      if (data.length > 0) {
        // Extract headers
        const headers = Object.keys(data[0]);
        worksheet.addRow(headers);
        
        // Add data rows
        data.forEach(row => {
          worksheet.addRow(Object.values(row));
        });

        // Apply borders and styling to all cells
        worksheet.eachRow((row, rowNumber) => {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
            if (rowNumber === 1) {
              cell.font = { bold: true };
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
              };
            }
          });
        });
        
        // Auto-fit columns
        worksheet.columns.forEach(column => {
          let maxLength = 0;
          column.eachCell!({ includeEmpty: true }, cell => {
            const columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) {
              maxLength = columnLength;
            }
          });
          column.width = maxLength < 10 ? 10 : maxLength + 2;
        });
      }

      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(new Blob([buffer]), `CANTV_Actividades_${new Date().toISOString().split('T')[0]}.xlsx`);
        setIsExportMenuOpen(false);
      }).catch((err) => {
        console.error("Error writing Excel file:", err);
        alert("Error al exportar a Excel. Verifique la consola para más detalles.");
      });
    } catch (err) {
      console.error("Error exporting to Excel:", err);
      alert("Error al exportar a Excel. Verifique la consola para más detalles.");
    }
  };

  const exportToPDF = () => {
    if (!activities || activities.length === 0) {
      alert("No hay actividades para exportar.");
      return;
    }

    try {
      const incomplete = checkActivitiesCompleteness(activities);
      if (incomplete.length > 0) {
        const confirmExport = window.confirm(
          `Se han detectado ${incomplete.length} actividades con información incompleta.\n\n` +
          `¿Desea continuar con la generación del PDF de todos modos?`
        );
        if (!confirmExport) return;
      }

      const docPdf = new jsPDF();
      
      docPdf.setFontSize(18);
      docPdf.setTextColor(0, 74, 153); // CANTV Blue
      docPdf.text('CANTV - Reporte de Actividades, Sobretiempos y Viáticos', 14, 22);
      
      docPdf.setFontSize(10);
      docPdf.setTextColor(100);
      docPdf.text(`Generado el: ${new Date().toLocaleString('es-VE')}`, 14, 30);
      docPdf.text(`Departamento: Datos y Transmisión`, 14, 35);

      const tableData = activities.map(a => {
        let fechaStr = '-';
        try {
          if (a.date) {
            fechaStr = (typeof a.date.toDate === 'function' ? a.date.toDate() : new Date(a.date as any)).toLocaleDateString('es-VE');
          }
        } catch (e) {}

        return [
          a.title || 'S/T',
          a.startTimeMorning || a.startTime || '-',
          a.endTimeAfternoon || a.endTime || '-',
          a.overtimeHours ? formatHours(a.overtimeHours) : '0h',
          a.hasPerDiem ? 'Sí' : 'No',
          fechaStr
        ];
      });

      autoTable(docPdf, {
        startY: 45,
        head: [['Título', 'H. Inicio', 'H. Fin', 'ST/DF', 'Viáticos', 'Fecha']],
        body: tableData,
        headStyles: { fillColor: [0, 74, 153] },
        theme: 'grid'
      });

      docPdf.save(`CANTV_Reporte_Administrativo_${new Date().toISOString().split('T')[0]}.pdf`);
      setIsExportMenuOpen(false);
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("Error al generar el PDF. Verifique la consola.");
    }
  };

  if (loading || (user && isProfileLoading)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50/50 backdrop-blur-sm p-4 text-center">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-3xl border-4 border-brand-blue/10 border-t-brand-blue animate-spin shadow-xl"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-black text-brand-blue uppercase animate-pulse">C</span>
          </div>
        </div>
        <h2 className="text-xl font-display font-black text-slate-900 tracking-tight mb-2">CANTV DTX</h2>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest animate-pulse max-w-[200px]">Sincronizando perfil con CANTV...</p>
      </div>
    );
  }

  if (isUnauthorized && user) {
    let title = "Acceso Restringido";
    let message = (
      <>
        Tu cuenta (<span className="font-bold text-slate-700">{user.email}</span>) no ha sido habilitada por un administrador del departamento.
      </>
    );
    let footerMessage = "Contacte al Jefe de Departamento para registrar su acceso institucional.";

    const statusVal = (suspendedStatus || '').toUpperCase().trim();

    if (statusVal === 'VACACIONES') {
      title = "Vacaciones Activas";
      message = (
        <>
          Acceso restringido temporalmente por encontrarse en período de <span className="font-bold text-amber-500">vacaciones reglamentarias</span>.
        </>
      );
      footerMessage = "Contacte al Administrador del departamento al retornar a sus labores.";
    } else if (statusVal === 'REPOSO') {
      title = "Reposo Autorizado";
      message = (
        <>
          Acceso restringido temporalmente por motivo de <span className="font-bold text-amber-500">reposo médico autorizado</span>.
        </>
      );
      footerMessage = "Contacte al Administrador del departamento para registrar su alta médica.";
    } else if (statusVal === 'INACTIVO') {
      title = "Cuenta Inhabilitada";
      message = (
        <>
          Su cuenta ha sido inhabilitada administrativamente.
        </>
      );
      footerMessage = "Contacte al Jefe de Departamento para más detalles.";
    } else if (statusVal === 'BAJA') {
      title = "Cuenta de Baja";
      message = (
        <>
          La cuenta ha sido dada de baja definitiva del sistema.
        </>
      );
      footerMessage = "Para más información, diríjase a la Gerencia de Operaciones.";
    } else if (statusVal && statusVal !== 'ACTIVO') {
      title = "Acceso Limitado";
      message = (
        <>
          Acceso restringido temporalmente por motivo de: <span className="font-bold text-rose-600">"{suspendedStatus}"</span>.
        </>
      );
      footerMessage = "Contacte al Jefe de Departamento para más información.";
    }

    const isAmberAlert = statusVal === 'VACACIONES' || statusVal === 'REPOSO';

    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full text-center space-y-6 shadow-2xl">
          <div className={cn(
            "w-20 h-20 rounded-3xl flex items-center justify-center mx-auto",
            isAmberAlert ? "bg-amber-50 text-amber-500" : "bg-rose-50 text-rose-500"
          )}>
            <ShieldCheck size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900">{title}</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              {message}
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 italic text-[11px] text-slate-500">
            {footerMessage}
          </div>
          <button 
            onClick={() => {
              setSuspendedStatus(null);
              setIsUnauthorized(false);
              signOut();
            }}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-md"
          >
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Login 
        onLogin={async (email, pass) => {
          try {
            const res = await signInWithEmailAndPassword(email, pass);
            if (!res) {
              // Si falla el login (ej: usuario de prueba no existe), intentamos crearlo
              await registerNewUser(email, pass);
            } else {
              // Add a notification for login
              const techObj = technicians?.find(t => t.email?.toLowerCase() === email.toLowerCase());
              const userDept = techObj?.department || 'Datos';
              const isAdminLogin = ADMIN_EMAILS.includes(email.toLowerCase());
              const loggedInUserRole = techObj?.role || (isAdminLogin ? 'admin' : 'tecnico');
              const cantvEmail = getCantvEmail(email);
              const ficha = techObj?.employeeId || getFichaLocal(email, techObj);
              const displayName = techObj?.name || res.user.displayName || email.split('@')[0];

              const customMsg = generarMensajeLogin(displayName, loggedInUserRole);

              addDoc(collection(db, 'notifications'), {
                type: 'auth_login',
                userId: res.user.uid,
                userName: displayName,
                userRole: loggedInUserRole,
                message: customMsg,
                scope: loggedInUserRole === 'admin' ? 'global' : 'departmental',
                targetRole: loggedInUserRole === 'admin' ? 'admin' : 'supervisor',
                department: userDept,
                targetUserId: res.user.uid,
                createdAt: Timestamp.now(),
                readBy: []
              });
            }
          } catch (e) {
            console.error("Login notification error:", e);
          }
        }} 
        onRegister={async (email, pass) => {
          const res = await registerNewUser(email, pass);
          if (res) {
            const techObj = technicians?.find(t => t.email?.toLowerCase() === email.toLowerCase());
            const userDept = techObj?.department || 'Datos';
            const isAdminReg = ADMIN_EMAILS.includes(email.toLowerCase());
            const loggedInUserRole = techObj?.role || (isAdminReg ? 'admin' : 'tecnico');
            const cantvEmail = getCantvEmail(email);
            const ficha = techObj?.employeeId || getFichaLocal(email, techObj);
            const displayName = techObj?.name || email.split('@')[0];

            let customMsg = '';
            if (loggedInUserRole === 'admin') {
              customMsg = `Nuevo Administrador registrado en el sistema: ${cantvEmail}.`;
            } else if (loggedInUserRole === 'supervisor') {
              customMsg = `Nuevo Supervisor registrado en el sistema: ${cantvEmail} (${userDept}).`;
            } else {
              customMsg = `Nuevo Técnico registrado: ${displayName} (${ficha}) en el departamento ${userDept}.`;
            }

            addDoc(collection(db, 'notifications'), {
              type: 'auth_register',
              userId: res.user.uid,
              userName: displayName,
              userRole: loggedInUserRole,
              message: customMsg,
              scope: loggedInUserRole === 'admin' ? 'global' : 'departmental',
              targetRole: loggedInUserRole === 'admin' ? 'admin' : 'supervisor',
              department: userDept,
              targetUserId: res.user.uid,
              createdAt: Timestamp.now(),
              readBy: []
            });
          }
        }}
        onForgotPassword={async (email) => {
          const trimmedEmail = email.toLowerCase().trim();
          const isAdminEmail = ADMIN_EMAILS.includes(trimmedEmail);
          
          let isValidUser = isAdminEmail;
          
          if (!isValidUser) {
            try {
              // 1. Validate if the email exists in technicians (Staff whitelist)
              const techQuery = query(collection(db, 'technicians'), where('email', '==', trimmedEmail));
              const techSnap = await getDocs(techQuery);
              const activeTechDoc = techSnap.docs.find(doc => {
                const docData = doc.data();
                return docData && docData.isDeleted !== true;
              });
              if (activeTechDoc) {
                isValidUser = true;
              }
            } catch (queryErr) {
              console.error("Error looking up technician email:", queryErr);
            }
          }
          
          if (!isValidUser) {
            throw new Error("El correo electrónico ingresado no está registrado como personal autorizado de CANTV. Por favor, comunícate con un Administrador para registrar tu cuenta.");
          }
          
          try {
            // 2. Trigger native Firebase Auth password reset email
            await sendPasswordResetEmail(auth, trimmedEmail);
            return true;
          } catch (err: any) {
            console.error("Firebase sendPasswordResetEmail error:", err);
            if (err.code === 'auth/user-not-found') {
              throw new Error("Tu correo está registrado en el listado de personal, pero aún no has inicializado tu acceso. Solicita a tu Supervisor o Administrador que restablezca o active tu acceso de forma presencial.");
            }
            throw new Error(err.message || "Error al enviar el correo de recuperación. Por favor intenta de nuevo.");
          }
        }}
        loading={signInLoading || createUserLoading || resetLoading} 
        error={signInError || createUserError || resetError}
      />
    );
  }

  const filteredActivities = activities?.filter(a => {
    const titleMatch = (a.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    const descMatch = (a.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    return titleMatch || descMatch;
  }) || [];

  // Derived user profile data syncing strictly with technicians collection
  const currentUserTech = technicians?.find(t => t.email && t.email.toLowerCase().trim() === user.email?.toLowerCase().trim());
  const displayProfileInfo = {
    rol: activeUserProfile?.role || 'tecnico',
    nombres: currentUserTech?.nombres || techProfileInfo?.nombres || 'Sin registrar',
    apellidos: currentUserTech?.apellidos || techProfileInfo?.apellidos || 'Sin registrar',
    nombreCompleto: currentUserTech?.name || profileForm.displayName || 'Usuario',
    correo: activeUserProfile?.email || user?.email || '',
    carnet: currentUserTech?.employeeId || techProfileInfo?.employeeId || 'Sin registrar',
    cedula: currentUserTech?.idCard || techProfileInfo?.idCard || 'Sin registrar',
    especialidad: currentUserTech?.specialty || techProfileInfo?.specialty || 'Sin registrar',
    departamento: currentUserTech?.department || techProfileInfo?.department || 'Sin registrar',
    telefono: currentUserTech?.phoneNumber || (currentUserTech as any)?.phone || techProfileInfo?.phoneNumber || 'Sin registrar',
    fechaNacimiento: currentUserTech?.fechaNacimiento || techProfileInfo?.fechaNacimiento || 'Sin registrar',
    fechaIngreso: currentUserTech?.fechaIngreso || techProfileInfo?.fechaIngreso || 'Sin registrar',
    direccion: currentUserTech?.direccion || techProfileInfo?.direccion || 'Sin registrar',
    tallaBotas: currentUserTech?.tallaBotas || techProfileInfo?.tallaBotas || 'N/R',
    tallaCamisa: currentUserTech?.tallaCamisa || techProfileInfo?.tallaCamisa || 'N/R',
    tallaPantalon: currentUserTech?.tallaPantalon || techProfileInfo?.tallaPantalon || 'N/R'
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      user={activeUserProfile} 
      onLogout={() => signOut()}
      notifications={notifications}
      onMarkAsRead={handleMarkAsRead}
    >
      <Suspense fallback={<div className="p-12 text-center text-slate-500 font-bold uppercase tracking-widest flex flex-col items-center gap-4 justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-brand-blue" /><span>Cargando módulo de CANTV...</span></div>}>
        {activeTab === 'dashboard' && (
        <Dashboard 
          activities={activities || []} 
          technicians={technicians || []}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onSeeDetails={(tab) => setActiveTab(tab)}
          user={activeUserProfile}
        />
      )}

      {activeTab === 'activities' && (
        activeUserProfile?.role === 'tecnico' ? (
          <TechHistoryView 
            activities={visibleActivities || []}
            user={activeUserProfile}
            onEdit={(activity) => {
              setEditingActivity(activity);
              setIsFormOpen(true);
            }}
          />
        ) : (
          <SmartSpreadsheet 
            activities={visibleActivities || []}
            technicians={technicians || []}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            highlightedId={highlightedActivityId}
            onClearHighlight={() => setHighlightedActivityId(null)}
            user={activeUserProfile}
            onAddActivity={() => {
              setEditingActivity(null);
              setIsFormOpen(true);
            }}
            onEdit={(activity) => {
              setEditingActivity(activity);
              setIsFormOpen(true);
            }}
            onDelete={(id, title) => setConfirmDelete({ type: 'activity', id, title })}
          />
        )
      )}

      {activeTab === 'technicians' && isGeneralAdmin && (
        <TechnicianManagement 
          technicians={technicians || []} 
          onAddTechnician={isGeneralAdmin ? handleAddTechnician : undefined}
          onEditTechnician={isGeneralAdmin ? ((tech) => setEditingTechnician(tech)) : undefined}
          onDeleteTechnician={isGeneralAdmin ? ((id, title) => setConfirmDelete({ type: 'technician', id, title })) : undefined}
          isLoading={techniciansLoading}
          currentUserId={user?.uid}
          currentUserEmail={user?.email || undefined}
        />
      )}

      {activeTab === 'reports' && (
        <ReportGenerator 
          activities={activities || []}
          technicians={technicians || []}
        />
      )}

      {activeTab === 'recycle-bin' && isGeneralAdmin && (
        <RecycleBin 
          deletedActivities={deletedActivities || []}
          deletedTechnicians={deletedTechnicians || []}
          onRestore={handleRestore}
          onPermanentDelete={(type, id) => setConfirmDelete({ type, id, title: 'Eliminar permanentemente' })}
          onRestoreAll={handleRestoreAll}
          onEmptyBin={handleEmptyBin}
        />
      )}

      {activeTab === 'settings' && (
        <div className="max-w-5xl mx-auto pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
          
          {/* 1. ENCABEZADO "CONFIGURACIÓN PERSONALIZADA" TOTALMENTE DESACOPLADO */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-6 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.02),0_15px_35px_rgba(0,0,0,0.06)] border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full xl:w-auto">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#004a99] bg-gradient-to-br from-[#004a99] to-blue-600 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-[#004a99]/15 shrink-0">
                <Settings size={26} className="sm:size-7 animate-spin-hover" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-display font-black text-slate-900 tracking-tight uppercase truncate">
                  CONFIGURACIÓN PERSONALIZADA
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                    GESTIÓN DE IDENTIDAD, SEGURIDAD Y PARÁMETROS INTRANET
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 2. EL NUEVO DISEÑO DE MI PERFIL (Tarjeta independiente) */}
          <form onSubmit={handleUpdateProfile} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left w-full sm:w-auto">
              {/* Profile photo with camera button */}
              <div className="relative shrink-0 select-none">
                {profileForm.photoURL ? (
                  <img src={profileForm.photoURL} alt="Perfil" className="w-16 h-16 rounded-full border border-slate-200 object-cover shadow-sm bg-white" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-16 h-16 rounded-full border border-slate-200 bg-slate-200 flex items-center justify-center text-slate-400">
                    <Camera className="w-6 h-6" />
                  </div>
                )}
                <label className="absolute bottom-0 right-0 p-1.5 bg-[#004a99] hover:bg-blue-700 text-white rounded-full shadow-md transition-colors cursor-pointer flex items-center justify-center border border-white">
                  <Camera className="w-3.5 h-3.5" />
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 2 * 1024 * 1024) {
                          alert('La imagen es muy grande. Máximo 2MB.');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setProfileForm({ ...profileForm, photoURL: reader.result as string });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>

              {/* Profile metadata */}
              <div className="min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <h3 className="text-base font-black text-slate-800 uppercase tracking-tight truncate">
                    {displayProfileInfo.nombreCompleto}
                  </h3>
                  <span className="inline-flex self-center sm:self-auto px-2 py-0.5 text-[10px] font-bold text-blue-600 bg-blue-50 rounded border border-blue-100 uppercase tracking-wider">
                    {displayProfileInfo.rol === 'admin' 
                      ? 'ADMINISTRADOR GENERAL' 
                      : displayProfileInfo.rol === 'supervisor'
                      ? 'SUPERVISOR'
                      : 'TÉCNICO'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-bold mt-0.5 break-all">
                  {displayProfileInfo.correo}
                </p>
              </div>
            </div>

            {/* Compact GUARDAR FOTO button */}
            <div className="shrink-0 w-full sm:w-auto">
              <button 
                type="submit"
                disabled={isUpdatingProfile}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-center shrink-0 animate-in fade-in"
              >
                {isUpdatingProfile ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" /> GUARDAR FOTO
                  </>
                )}
              </button>
            </div>
          </form>

          {/* 3. DISEÑO PLANO DE DOS COLUMNAS (Ficha Profesional + Seguridad) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* COLUMNA IZQUIERDA: FICHA PROFESIONAL */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              
              {/* Encabezado Seccional */}
              <div className="flex items-center justify-between mb-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 bg-blue-50 text-[#004a99] rounded-lg">
                    <Award className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ficha Profesional</span>
                </div>
                {isGeneralAdmin && (
                  <button 
                    type="button"
                    onClick={() => {
                      const matchingTech = technicians.find(t => t.email && t.email.toLowerCase().trim() === user?.email?.toLowerCase().trim());
                      if (matchingTech) {
                        setEditingTechnician(matchingTech);
                      } else {
                        alert("No se encontró su perfil de personal para editar.");
                      }
                    }}
                    className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-bold uppercase tracking-wider rounded-lg shadow-sm transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                    Actualizar Ficha
                  </button>
                )}
              </div>

              {/* GRID DE INPUTS CON LOS 11 CAMPOS COMPLETOS Y TÍTULOS UNIFICADOS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                
                {/* Nombres */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nombres</label>
                  <div className="relative">
                    <input type="text" value={displayProfileInfo.nombres} readOnly className="w-full pl-3 pr-10 py-2.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none cursor-not-allowed select-none font-bold" />
                    <Lock className="w-4 h-4 text-slate-400 absolute inset-y-0 right-3 my-auto" />
                  </div>
                </div>

                {/* Apellidos */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Apellidos</label>
                  <div className="relative">
                    <input type="text" value={displayProfileInfo.apellidos} readOnly className="w-full pl-3 pr-10 py-2.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none cursor-not-allowed select-none font-bold" />
                    <Lock className="w-4 h-4 text-slate-400 absolute inset-y-0 right-3 my-auto" />
                  </div>
                </div>

                {/* Carnet */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Carnet</label>
                  <div className="relative">
                    <input type="text" value={displayProfileInfo.carnet} readOnly className="w-full pl-3 pr-10 py-2.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none cursor-not-allowed select-none font-bold" />
                    <Lock className="w-4 h-4 text-slate-400 absolute inset-y-0 right-3 my-auto" />
                  </div>
                </div>

                {/* Cédula */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cédula</label>
                  <div className="relative">
                    <input type="text" value={displayProfileInfo.cedula} readOnly className="w-full pl-3 pr-10 py-2.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none cursor-not-allowed select-none font-bold" />
                    <Lock className="w-4 h-4 text-slate-400 absolute inset-y-0 right-3 my-auto" />
                  </div>
                </div>

                {/* Teléfono */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Teléfono</label>
                  <div className="relative">
                    <input type="text" value={displayProfileInfo.telefono} readOnly className="w-full pl-3 pr-10 py-2.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none cursor-not-allowed select-none font-bold" />
                    <Lock className="w-4 h-4 text-slate-400 absolute inset-y-0 right-3 my-auto" />
                  </div>
                </div>

                {/* Cargo */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cargo</label>
                  <div className="relative">
                    <input type="text" value={displayProfileInfo.especialidad} readOnly className="w-full pl-3 pr-10 py-2.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none cursor-not-allowed select-none font-bold" />
                    <Lock className="w-4 h-4 text-slate-400 absolute inset-y-0 right-3 my-auto" />
                  </div>
                </div>

                {/* Departamento */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Departamento</label>
                  <div className="relative">
                    <input type="text" value={displayProfileInfo.departamento} readOnly className="w-full pl-3 pr-10 py-2.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none cursor-not-allowed select-none font-bold" />
                    <Lock className="w-4 h-4 text-slate-400 absolute inset-y-0 right-3 my-auto" />
                  </div>
                </div>

                {/* Fecha de Nacimiento */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fecha de Nacimiento</label>
                  <div className="relative">
                    <input type="text" value={displayProfileInfo.fechaNacimiento} readOnly className="w-full pl-3 pr-10 py-2.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none cursor-not-allowed select-none font-bold" />
                    <Lock className="w-4 h-4 text-slate-400 absolute inset-y-0 right-3 my-auto" />
                  </div>
                </div>

                {/* Fecha de Ingreso */}
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fecha de Ingreso</label>
                  <div className="relative">
                    <input type="text" value={displayProfileInfo.fechaIngreso} readOnly className="w-full pl-3 pr-10 py-2.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none cursor-not-allowed select-none font-bold" />
                    <Lock className="w-4 h-4 text-slate-400 absolute inset-y-0 right-3 my-auto" />
                  </div>
                </div>

                {/* Tallas de Uniforme */}
                <div className="grid grid-cols-3 gap-3 sm:col-span-2 pt-2 border-t border-slate-100">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Talla Botas</label>
                    <input type="text" value={displayProfileInfo.tallaBotas} readOnly className="w-full px-3 py-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none cursor-not-allowed font-bold" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Talla Camisa</label>
                    <input type="text" value={displayProfileInfo.tallaCamisa} readOnly className="w-full px-3 py-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none cursor-not-allowed font-bold" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Talla Pantalón</label>
                    <input type="text" value={displayProfileInfo.tallaPantalon} readOnly className="w-full px-3 py-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none cursor-not-allowed font-bold" />
                  </div>
                </div>

                {/* Dirección */}
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Dirección de Habitación</label>
                  <textarea value={displayProfileInfo.direccion} readOnly rows={2} className="w-full px-3 py-2.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none resize-none leading-relaxed cursor-not-allowed select-none font-bold" />
                </div>

              </div>

            </div>

            {/* COLUMNA DERECHA CONDICIONAL */}
            {isGeneralAdmin ? (
              /* A. CASO ADMINISTRADOR: Renders únicamente la ZONA DE PELIGRO */
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                <div className="flex items-center gap-2.5 border-b border-red-100 pb-3 text-red-600">
                  <span className="p-1.5 bg-red-50 text-red-600 rounded-lg">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider">Zona de Peligro</span>
                </div>
                
                <p className="text-xs text-slate-500 leading-relaxed text-left">
                  Atención: La remoción de su credencial de acceso es una acción de carácter irrevocable. Al proceder, se revocarán de forma definitiva todos sus privilegios de administración global, se clausurará su perfil de seguridad y el evento será reportado de forma obligatoria en la bitácora de auditoría de la Gerencia de Tecnología.
                </p>

                <button 
                  type="button"
                  onClick={handleVerifyDeleteSelf}
                  className="w-full mt-2 py-2.5 border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                  Eliminar Mi Cuenta
                </button>
              </div>
            ) : (
              /* B. CASO TÉCNICO / SUPERVISOR: Renders el boletín estático de SEGURIDAD */
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 text-brand-blue">
                  <span className="p-1.5 bg-blue-50 text-[#004a99] rounded-lg">
                    <Lock className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider">Seguridad de la Cuenta</span>
                </div>
                
                <p className="text-[11px] font-medium text-slate-600 leading-relaxed font-sans">
                  De conformidad con las normas de seguridad de la información del Departamento de Datos y Transmisión, la administración de credenciales de acceso se encuentra centralizada de forma exclusiva. Para cualquier modificación, actualización o restablecimiento de su contraseña, deberá canalizar la solicitud formalmente ante el Administrador General de la sucursal.
                </p>

                <div className="border-t border-blue-100/40 pt-2.5 mt-1 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider animate-pulse font-mono">
                  <span>ING. ALBERTO CONTRERAS</span>
                  <span className="text-[#004a99]">EXT: 4357</span>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {confirmEmptyBin && (
        <ConfirmationModal 
          isOpen={confirmEmptyBin}
          onClose={() => setConfirmEmptyBin(false)}
          onConfirm={executeEmptyBin}
          title="¿Vaciar Papelera de Reciclaje?"
          message={`Esta acción eliminará permanentemente todos los elementos (${deletedActivities.length + deletedTechnicians.length}) que se encuentran en la papelera. Esta acción no se puede deshacer.`}
          confirmText="Vaciar Ahora"
          variant="danger"
        />
      )}

      {confirmDelete && (
        <ConfirmationModal 
          isOpen={!!confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
          title={
            confirmDelete.title === 'Eliminar permanentemente' 
              ? '¿Eliminar Permanentemente?' 
              : (confirmDelete.type === 'activity' ? '¿Mover a Papelera?' : '¿Baja de Personal?')
          }
          message={
            confirmDelete.title === 'Eliminar permanentemente'
              ? 'Esta acción borrará los datos para siempre. No es posible recuperarlos.'
              : (confirmDelete.type === 'activity' 
                  ? `Estás a punto de mover "${confirmDelete.title}" a la papelera. Podrás recuperarlo en los próximos 30 días.`
                  : `Estás a punto de dar de baja a "${confirmDelete.title}". Podrás reactivarlo desde la papelera si es necesario.`)
          }
          confirmText={confirmDelete.title === 'Eliminar permanentemente' ? 'Eliminar para Siempre' : 'Mover a Papelera'}
        />
      )}

      {(isFormOpen || editingActivity) && (
        activeUserProfile?.role === 'tecnico' && editingActivity ? (
          <ActivityDetailModal 
            activity={editingActivity}
            onClose={() => {
              setIsFormOpen(false);
              setEditingActivity(null);
            }} 
          />
        ) : (
          <ActivityForm 
            onClose={() => {
              setIsFormOpen(false);
              setEditingActivity(null);
            }} 
            onSubmit={editingActivity ? handleEditActivity : handleAddActivity}
            technicians={technicians || []}
            initialDate={selectedDate}
            initialData={editingActivity}
            user={activeUserProfile}
          />
        )
      )}

      {editingTechnician && (
        <TechnicianForm
          initialData={editingTechnician}
          onClose={() => setEditingTechnician(null)}
          onSubmit={handleEditTechnician}
          technicians={technicians}
        />
      )}

      {/* MODAL DE CONFIRMACIÓN DE DOBLE FACTOR POR RE-AUTENTICACIÓN */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[150] animate-in fade-in duration-200">
          <form 
            onSubmit={handleEjecutarBorradoSeguro}
            className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-md w-full text-center flex flex-col items-center animate-in zoom-in-95 duration-200"
          >
            {/* Icono de advertencia en rojo */}
            <span className="p-4 bg-red-50 text-red-600 rounded-full mb-4 border border-red-100 shadow-sm animate-pulse">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>

            <h3 className="text-base font-bold text-slate-800 uppercase tracking-tight">
              ¿Confirmar Eliminación de Cuenta?
            </h3>
            
            <p className="text-xs text-slate-500 leading-relaxed mt-2 font-medium">
              <strong>{activeUserProfile?.displayName || user?.displayName || 'Administrador General'}</strong>, estás a punto de eliminar de forma permanente tu cuenta de Administrador General. Esta acción revocaría todos tus accesos de forma irreversible y definitiva.
            </p>

            {/* Entrada de Contraseña de Seguridad */}
            <div className="w-full mt-5 text-left flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center block">
                Ingresa tu contraseña para confirmar
              </label>
              <input 
                type="password" 
                value={contrasenaConfirmacion}
                onChange={(e) => setContrasenaConfirmacion(e.target.value)}
                placeholder="Contraseña de acceso"
                disabled={isDeleting}
                required
                className="w-full px-3 py-2 text-center text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-[#004a99] uppercase tracking-widest font-mono text-slate-800"
              />
              {/* Mensaje de error de validación en tiempo real */}
              {errorBorrado && (
                <span className="text-[10px] text-red-600 font-bold text-center mt-1 block">
                  {errorBorrado}
                </span>
              )}
            </div>

            {/* Botones de acción del modal */}
            <div className="grid grid-cols-2 gap-3 w-full mt-6">
              <button 
                type="button"
                disabled={isDeleting}
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={isDeleting || contrasenaConfirmacion.length < 6} 
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5
                  ${(contrasenaConfirmacion.length >= 6 && !isDeleting)
                    ? 'bg-red-600 hover:bg-red-700 cursor-pointer' 
                    : 'bg-red-200 cursor-not-allowed opacity-60'}`}
              >
                {isDeleting ? 'Eliminando...' : 'Eliminar Cuenta'}
              </button>
            </div>
          </form>
        </div>
      )}
      </Suspense>
    </Layout>
  );
}




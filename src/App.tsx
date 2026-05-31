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
import { getAuth as getSecondaryAuth, signOut as signSecondaryOut, createUserWithEmailAndPassword, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile } from 'firebase/auth';
import { Activity, UserProfile, Technician } from './types';

// ======================================
// IMPORTACIÓN DE MÓDULOS DE NEGOCIO
// ======================================
import Layout from './modules/core/components/Layout';
import Dashboard from './modules/dashboard/components/Dashboard';
import ActivityCard from './modules/activities/components/ActivityCard';
import ActivityForm, { formatHours } from './modules/activities/components/ActivityForm';
import ActivityDetailModal from './modules/activities/components/ActivityDetailModal';
import Login from './modules/auth/components/Login';
import TechnicianManagement from './modules/technicians/components/TechnicianManagement';
import ReportGenerator from './modules/reports/components/ReportGenerator';
import SmartSpreadsheet from './modules/activities/components/SmartSpreadsheet';
import TechHistoryView from './modules/activities/components/TechHistoryView';
import ConfirmationModal from './modules/core/components/ConfirmationModal';
import RecycleBin from './modules/recycle-bin/components/RecycleBin';
import TechnicianForm from './modules/technicians/components/TechnicianForm';

import { Plus, Search, Filter, ClipboardList, Settings, Download, FileText, Table, Users, Target, Eye, ShieldCheck, History, LayoutGrid, List, Camera, UserCircle, Check, X, Loader2, Database, Lock, Shield, Moon, Sun, Award, Sliders, Briefcase, Info } from 'lucide-react';
import { cn } from './lib/utils';
import * as XLSX from 'xlsx';
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
  const startTimeMorning = docData.startTimeMorning || docData.startTime || '07:45';
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
  let virtualMorning = (emTime - 11.75) + 4; // Base 4h
  let virtualAfternoon = (eaTime - 16) + 3.25; // Base 3.25h
  let virtualTotal = virtualMorning + virtualAfternoon;
  let otHours = virtualTotal - 7.25; // Jornada de 7.25h
  if (hasPause === 'NO' && virtualMorning > 0 && virtualAfternoon > 0) {
    otHours += 1;
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

  // ------------------------------------------------------------------
  // 2. ESTADOS GLOBALES DE LA UI
  // ------------------------------------------------------------------
  const [activeTab, setActiveTab] = React.useState('dashboard'); // Controla la "pestaña" visible
  const [isFormOpen, setIsFormOpen] = React.useState(false); // Modal de nueva actividad
  const [searchQuery, setSearchQuery] = React.useState(''); // Búsqueda global (aunque a veces inactiva)
  const [isExportMenuOpen, setIsExportMenuOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState(new Date()); // Fecha para la hoja de actividades
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [isUnauthorized, setIsUnauthorized] = React.useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = React.useState(false);
  const [profileForm, setProfileForm] = React.useState({
    displayName: '',
    photoURL: ''
  });

  const [suspendedStatus, setSuspendedStatus] = React.useState<string | null>(null);

  const [techProfileInfo, setTechProfileInfo] = React.useState<{
    employeeId: string;
    idCard: string;
    specialty: string;
    department: string;
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

  // Perfil de usuario activo con fallbacks a datos locales o a la sesión de Firebase Auth 
  // para evitar pantallas con nombres de usuario vacíos u otros glitch de carga.
  const activeUserProfile = React.useMemo((): UserProfile | null => {
    if (!user) return null;
    let normalizedRole: 'tecnico' | 'supervisor' | 'admin' = (ADMIN_EMAILS.includes(user.email || '') ? 'admin' : 'tecnico');
    const rawRole = userProfile?.role;
    if (rawRole) {
      const lower = rawRole.toLowerCase().trim();
      if (lower === 'técnico' || lower === 'tecnico' || lower === 'technician' || lower === 'tecnico especialista') {
        normalizedRole = 'tecnico';
      } else if (lower === 'administrador' || lower === 'admin') {
        normalizedRole = 'admin';
      } else if (lower === 'supervisor' || lower === 'manager') {
        normalizedRole = 'supervisor';
      }
    }

    return {
      uid: user.uid,
      email: user.email || '',
      displayName: userProfile?.displayName || user.displayName || user.email?.split('@')[0] || 'Usuario',
      photoURL: userProfile?.photoURL || user.photoURL || '',
      role: normalizedRole,
      department: userProfile?.department || 'Datos',
      allowPasswordChange: userProfile?.allowPasswordChange || false,
      createdAt: userProfile?.createdAt || Timestamp.now()
    };
  }, [user, userProfile, ADMIN_EMAILS]);

  React.useEffect(() => {
    if (activeUserProfile) {
      setProfileForm({
        displayName: activeUserProfile.displayName || '',
        photoURL: activeUserProfile.photoURL || ''
      });
    }
  }, [activeUserProfile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsUpdatingProfile(true);
    try {
      const docRef = doc(db, 'users', user.uid);
      const updatedData = {
        displayName: profileForm.displayName,
        photoURL: profileForm.photoURL
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
    let isProvisioningComplete = false;

    const unsubscribeProfile = onSnapshot(docRef, async (docSnap) => {
      // 1. Sincronización en tiempo real garantizada (si el documento existe)
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
        
        // Si ya se hizo la verificación inicial (whitelist/provisioning), no ejecutarla de nuevo
        if (isProvisioningComplete) return;
      }

      // 2. Provisión inicial y Whitelist (Corre solo una vez por sesión)
      if (isProvisioningComplete) return;
      isProvisioningComplete = true;

      try {
        const trimmedEmail = user.email ? user.email.toLowerCase().trim() : '';

        const AUTO_WHITELIST: Record<string, { role: 'admin' | 'supervisor' | 'tecnico', name: string, emp: string, ic: string, specialty: string, department: string }> = {
          'aiknav@cantv.com.ve': { role: 'admin', name: 'Aiken Navas', emp: 'P00-111111', ic: 'V-11.111.111', specialty: 'Administrador General', department: 'Gerencia y Soporte' },
          'ana.silva@cantv.com.ve': { role: 'supervisor', name: 'Ana Silva', emp: 'P00-235235', ic: 'V-12.312.312', specialty: 'Supervisor Técnico', department: 'Datos y Transmisión' },
          'anabolena@cantv.com.ve': { role: 'supervisor', name: 'Ana Silva', emp: 'P00-235235', ic: 'V-12.312.312', specialty: 'Supervisor Técnico', department: 'Datos y Transmisión' },
        };

        const isAdminEmail = trimmedEmail && (ADMIN_EMAILS.includes(trimmedEmail) || trimmedEmail === 'aiknav@cantv.com.ve');
        
        let targetRole: 'admin' | 'supervisor' | 'tecnico' = 'tecnico';
        let techName = '';
        let fetchedPhotoURL = '';
        
        if (trimmedEmail && AUTO_WHITELIST[trimmedEmail]) {
          const whitelisted = AUTO_WHITELIST[trimmedEmail];
          targetRole = whitelisted.role;
          techName = whitelisted.name;
          setTechProfileInfo({
            employeeId: whitelisted.emp,
            idCard: whitelisted.ic,
            specialty: whitelisted.specialty,
            department: whitelisted.department
          });
          setIsUnauthorized(false);

          try {
            const { collection, query, where, getDocs, addDoc, Timestamp } = await import('firebase/firestore');
            const techQuery = query(collection(db, 'technicians'), where('email', '==', trimmedEmail));
            const techSnap = await getDocs(techQuery);
            if (techSnap.empty) {
              await addDoc(collection(db, 'technicians'), {
                name: whitelisted.name,
                email: trimmedEmail,
                role: whitelisted.role === 'admin' ? 'admin' : whitelisted.role,
                employeeId: whitelisted.emp,
                idCard: whitelisted.ic,
                specialty: whitelisted.specialty,
                department: whitelisted.department,
                status: 'activo',
                isDeleted: false,
                createdAt: Timestamp.now()
              });
            } else {
              // Si ya existe en la base de datos, respetar el rol y datos que tenga configurados
              const activeDbDoc = techSnap.docs.find(doc => doc.data() && doc.data().isDeleted !== true);
              if (activeDbDoc) {
                targetRole = activeDbDoc.data().role || targetRole;
              }
            }
          } catch (err) {
            console.error("Auto seeding error:", err);
          }
        } else if (isAdminEmail) {
          targetRole = 'admin';
          setTechProfileInfo({
            employeeId: 'P00-111111',
            idCard: 'V-11.111.111',
            specialty: 'Administrador General',
            department: 'Gerencia y Soporte'
          });
          setIsUnauthorized(false);
        } else if (user.email) {
          try {
            const techQuery = query(collection(db, 'technicians'), where('email', '==', user.email.toLowerCase().trim()));
            const techSnap = await getDocs(techQuery);
            
            // Prefer an active doc if available, otherwise take any (even deleted)
            let matchingTechDoc = techSnap.docs.find(doc => {
              const data = doc.data();
              return data && data.isDeleted !== true;
            });

            if (!matchingTechDoc && techSnap.docs.length > 0) {
              matchingTechDoc = techSnap.docs[0];
            }
            
            if (matchingTechDoc) {
              const techData = matchingTechDoc.data();
              const currentStatus = (techData.status || '').toLowerCase().trim();
              const isSoftDeleted = techData.isDeleted === true;

              if (isSoftDeleted || currentStatus === 'inactivo' || currentStatus === 'baja' || currentStatus === 'reposo' || currentStatus === 'vacaciones') {
                const finalSuspensionStatus = isSoftDeleted ? 'baja' : currentStatus;
                setSuspendedStatus(finalSuspensionStatus);
                setIsUnauthorized(true);
                return;
              } else {
                setSuspendedStatus(null);
              }

              targetRole = techData.role || 'tecnico';
              techName = techData.name || '';
              fetchedPhotoURL = techData.photoURL || '';
              
              if (!techData.uid && user.uid) {
                try {
                  await setDoc(doc(db, 'technicians', matchingTechDoc.id), { uid: user.uid }, { merge: true });
                } catch (uidUpdateErr) {
                  console.error("Failed to set uid in technicians document:", uidUpdateErr);
                }
              }
              
              setTechProfileInfo({
                employeeId: techData.employeeId || (targetRole === 'admin' ? 'P00-111111' : 'P00-NO-ASIG'),
                idCard: techData.idCard || (targetRole === 'admin' ? 'V-11.111.111' : 'V-00.000.000'),
                specialty: techData.specialty || (targetRole === 'admin' ? 'Administrador General' : 'Especialista'),
                department: techData.department || 'Datos y Transmisión'
              });
              setIsUnauthorized(false);
            } else {
              setIsUnauthorized(true);
              return;
            }
          } catch (error) {
            console.error("Error looking up technician whitelist in Firestore:", error);
            if (docSnap && docSnap.exists()) {
              const profileData = docSnap.data() as UserProfile;
              targetRole = profileData.role || 'tecnico';
              techName = profileData.displayName || '';
              setTechProfileInfo({
                employeeId: targetRole === 'admin' ? 'P00-111111' : ((profileData as any).employeeId || 'P00-245813'),
                idCard: targetRole === 'admin' ? 'V-11.111.111' : 'V-00.000.000',
                specialty: targetRole === 'admin' ? 'Administrador General' : 'Soporte Técnico',
                department: 'Datos y Transmisión'
              });
              setIsUnauthorized(false);
            } else {
              setIsUnauthorized(true);
              return;
            }
          }
        }

        let profile: UserProfile;
        if (docSnap.exists()) {
          profile = docSnap.data() as UserProfile;
          let needsUpdate = false;
          let updatedFields: Partial<UserProfile> = {};
          
          if (profile.role !== targetRole) {
            profile.role = targetRole as any;
            updatedFields.role = targetRole as any;
            needsUpdate = true;
          }
          
          if (techName && !profile.displayName) {
            profile.displayName = techName;
            updatedFields.displayName = techName;
            needsUpdate = true;
          }
          
          if (fetchedPhotoURL && !profile.photoURL) {
            profile.photoURL = fetchedPhotoURL;
            updatedFields.photoURL = fetchedPhotoURL;
            needsUpdate = true;
          } else if (user.photoURL && !profile.photoURL) {
            profile.photoURL = user.photoURL;
            updatedFields.photoURL = user.photoURL;
            needsUpdate = true;
          }
          
          if (needsUpdate) {
            await setDoc(docRef, updatedFields, { merge: true });
          }
        } else {
          let rawName = techName || user.displayName || user.email?.split('@')[0] || 'Usuario';
          rawName = rawName.replace(/[^a-zA-Z\s]/g, ' ').trim().replace(/\s+/g, ' '); 
          let formattedName = rawName.split(' ').map((idx: string) => idx.charAt(0).toUpperCase() + idx.slice(1).toLowerCase()).join(' ');

          profile = {
            uid: user.uid,
            email: user.email || '',
            displayName: formattedName,
            photoURL: user.photoURL || '',
            role: targetRole as any,
            department: 'Datos',
            createdAt: Timestamp.now(),
          };
          await setDoc(docRef, profile);
          setUserProfile(profile); // Ensure local state is updated immediately on creation
        }
        
        if (targetRole === 'admin' && user.email) {
          try {
            const techQuery = query(collection(db, 'technicians'), where('email', '==', user.email.toLowerCase().trim()));
            const techSnap = await getDocs(techQuery);
            for (const document of techSnap.docs) {
              if (document.data()?.role !== 'admin') {
                await setDoc(doc(db, 'technicians', document.id), { role: 'admin' }, { merge: true });
              }
            }
          } catch (e) {
            console.error("Failed to sync admin role to technicians DB", e);
          }
        }

      } catch (err: any) {
        if (err?.message?.includes('offline')) {
          console.warn("Firestore operating in offline mode. Falling back to cached or local simulation for profile.");
        } else {
          console.error("Error in profile provisioning, falling back to local simulation:", err);
        }
        const isAdminEmail = user.email && ADMIN_EMAILS.includes(user.email);
        let rawName = user?.displayName || user?.email?.split('@')[0] || 'Usuario';
        rawName = rawName.replace(/[^a-zA-Z\s]/g, ' ').trim().replace(/\s+/g, ' '); 
        let formattedName = rawName.split(' ').map((idx: string) => idx.charAt(0).toUpperCase() + idx.slice(1).toLowerCase()).join(' ');
        
        const fallbackProfile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: formattedName,
          photoURL: user?.photoURL || '',
          role: (isAdminEmail ? 'admin' : 'tecnico') as any,
          department: 'Datos',
          createdAt: Timestamp.now(),
        };
        setTechProfileInfo({
          employeeId: isAdminEmail ? 'P00-111111' : 'P00-245813',
          idCard: 'V-11.111.111',
          specialty: isAdminEmail ? 'Administrador General' : 'Soporte Técnico',
          department: 'Datos y Transmisión'
        });
        setUserProfile(fallbackProfile);
        setIsUnauthorized(false);
      }
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

  const isGeneralAdmin = activeUserProfile?.role === 'admin';
  const isManager = isGeneralAdmin || activeUserProfile?.role === 'supervisor';

  const activitiesQuery = user && !isUnauthorized ? query(
    collection(db, 'activities'),
    orderBy('date', 'desc')
  ) : null;
  
  const [activitiesSnapshot, activitiesLoading] = useCollection(activitiesQuery);
  const activities = React.useMemo(() => {
    const arr = activitiesSnapshot?.docs.map(doc => decorateActivity(doc.data(), doc.id)).filter(a => a.isDeleted !== true) || [];
    if (activeUserProfile?.role === 'tecnico') {
      const name = activeUserProfile.displayName || '';
      return arr.filter(a => 
        a.adminId === user?.uid ||
        (a.participants && a.participants.some(p => p && p.toLowerCase() === name.toLowerCase()))
      );
    }
    return arr;
  }, [activitiesSnapshot, activeUserProfile, user]);

  // Self-Healing Background Database Backfill
  const healedDocsTracker = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (activitiesLoading || !activitiesSnapshot || !user) return;
    
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
    if (activeUserProfile?.role === 'admin' || activeUserProfile?.role === 'supervisor') {
      return activities;
    }
    if (activeUserProfile?.role === 'tecnico') {
      const name = activeUserProfile.displayName || '';
      return activities.filter(a => 
        a.adminId === user?.uid ||
        (a.participants && a.participants.some(p => p && p.toLowerCase() === name.toLowerCase()))
      );
    }
    return activities.filter(a => a.adminId === user?.uid);
  }, [activities, user, activeUserProfile]);

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

  const techniciansQuery = user && !isUnauthorized ? query(
    collection(db, 'technicians'),
    orderBy('name', 'asc')
  ) : null;
  const [techniciansSnapshot, techniciansLoading] = useCollection(techniciansQuery);
  const technicians = React.useMemo(() => techniciansSnapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Technician)).filter(t => t.isDeleted !== true) || [], [techniciansSnapshot]);

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

  const notificationsQuery = user && !isUnauthorized ? query(
    collection(db, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(100)
  ) : null;
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
  const deletedActivitiesQuery = user && isGeneralAdmin ? query(
    collection(db, 'activities'),
    where('isDeleted', '==', true)
  ) : null;
  const [deletedActivitiesSnapshot] = useCollection(deletedActivitiesQuery);
  const deletedActivities = React.useMemo(() => {
    const items = deletedActivitiesSnapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity)) || [];
    return items.sort((a, b) => {
      const dateA = a.deletedAt?.toDate?.() || new Date(0);
      const dateB = b.deletedAt?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [deletedActivitiesSnapshot]);

  const deletedTechniciansQuery = user && isGeneralAdmin ? query(
    collection(db, 'technicians'),
    where('isDeleted', '==', true)
  ) : null;
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
      
      const authUser = await createUserWithEmailAndPassword(secondaryAuth, trimmedEmail, password);
      await signSecondaryOut(secondaryAuth);
      
      // 2. Save the metadata to the technicians collection
      const docRef = await addDoc(collection(db, 'technicians'), {
        ...firestoreData,
        email: trimmedEmail,
        uid: authUser.user.uid,
        createdAt: Timestamp.now(),
        isDeleted: false,
      });

      // 3. Immediately pre-create the user profile document in the 'users' collection too
      // so when they sign in, their name, role and department are set perfectly and immediately,
      // without needing to wait or rely on other synchronization fallbacks.
      const userProfileRef = doc(db, 'users', authUser.user.uid);
      await setDoc(userProfileRef, {
        uid: authUser.user.uid,
        email: trimmedEmail,
        displayName: data.name,
        photoURL: data.photoURL || '',
        role: data.role || 'tecnico',
        department: data.department || 'Datos',
        createdAt: Timestamp.now()
      });

      // Add Notification
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        userName: userProfile?.displayName,
        type: 'tech_add',
        message: `Técnico registrado: ${data.name}`,
        relatedId: docRef.id,
        scope: 'departmental',
        targetRole: 'supervisor',
        department: data.department || 'Datos',
        targetUserId: authUser.user.uid,
        createdAt: Timestamp.now(),
        readBy: [user.uid]
      });

      setIsTechFormOpen(false);
    } catch (err: any) {
      console.error("Error adding technician:", err);
      alert("Error al registrar: " + (err.message || String(err)));
    }
  };

  const [editingTechnician, setEditingTechnician] = React.useState<Technician | null>(null);
  const handleEditTechnician = async (data: any) => {
    if (!user || !isManager || !editingTechnician) return;
    const { password, ...firestoreData } = data;
    const trimmedEmail = data.email.toLowerCase().trim();
    try {
      await setDoc(doc(db, 'technicians', editingTechnician.id), {
        ...firestoreData,
        email: trimmedEmail,
        updatedAt: Timestamp.now(),
      }, { merge: true });

      // Keep user profile in 'users' collection in sync with the updated technician info
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
          const userProfileRef = doc(db, 'users', targetUid);
          await setDoc(userProfileRef, {
            displayName: data.name,
            role: data.role || 'tecnico',
            department: data.department || 'Datos',
            email: trimmedEmail,
          }, { merge: true });
          
          // If the edited user is the currently logged in user, update local state as well
          if (targetUid === user.uid) {
            setUserProfile((prev) => prev ? {
              ...prev,
              displayName: data.name,
              role: data.role || 'tecnico',
              department: data.department || 'Datos',
              email: trimmedEmail
            } : null);
          }
        }
      } catch (syncErr) {
        console.error("Failed to sync edited technician to users profile:", syncErr);
      }
      
      let notificationMsg = `Personal editado: ${firestoreData.name}`;
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
      alert("Error al editar personal: " + (err.message || String(err)));
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;

    if (confirmDelete.type === 'technician' && !isGeneralAdmin) {
      alert("Acceso denegado: Solo el Administrador General puede dar de baja a miembros del personal.");
      setConfirmDelete(null);
      return;
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
      
      if (confirmDelete.title === 'Eliminar permanentemente') {
        if (!isGeneralAdmin) {
          alert("Acceso denegado: Solo el Administrador General puede realizar eliminaciones permanentes.");
          return;
        }
        await deleteDoc(doc(db, collectionName, confirmDelete.id));
        
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
        await setDoc(doc(db, collectionName, confirmDelete.id), {
          isDeleted: true,
          deletedAt: Timestamp.now(),
          deletedBy: userProfile?.displayName || user?.displayName || 'Aiken Navas',
          ...(collectionName === 'activities' && !confirmDelete.title ? { title: 'Actividad' } : {})
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

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Actividades");
      XLSX.writeFile(wb, `CANTV_Actividades_${new Date().toISOString().split('T')[0]}.xlsx`);
      setIsExportMenuOpen(false);
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50/50 backdrop-blur-sm p-4 text-center">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-3xl border-4 border-brand-blue/10 border-t-brand-blue animate-spin shadow-xl"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-black text-brand-blue uppercase animate-pulse">C</span>
          </div>
        </div>
        <h2 className="text-xl font-display font-black text-slate-900 tracking-tight mb-2">CANTV DTX</h2>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest animate-pulse max-w-[200px]">Iniciando Módulo de Datos y Transmisión...</p>
      </div>
    );
  }

  if (isUnauthorized && user) {
    let title = "Acceso No Autorizado";
    let message = (
      <>
        Tu cuenta (<span className="font-bold text-slate-700">{user.email}</span>) no ha sido habilitada por un administrador del departamento.
      </>
    );
    let footerMessage = "Contacte al Jefe de Departamento para registrar su acceso institucional.";

    if (suspendedStatus === 'vacaciones' || suspendedStatus === 'reposo') {
      title = "Acceso Temporalmente Suspendido";
      message = (
        <>
          Tu cuenta ha sido suspendida temporalmente por encontrarte en período de <span className="font-bold text-amber-600">{suspendedStatus}</span> activo.
        </>
      );
      footerMessage = "Contacte al Jefe de Departamento para restablecer su acceso al retornar a sus actividades.";
    } else if (suspendedStatus === 'inactivo' || suspendedStatus === 'baja') {
      title = "Acceso Denegado";
      message = (
        <>
          Esta cuenta ha sido desactivada de forma permanente por el Administrador General del departamento.
        </>
      );
      footerMessage = "Para más información, diríjase a la Gerencia de Operaciones.";
    }

    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full text-center space-y-6 shadow-2xl">
          <div className={cn(
            "w-20 h-20 rounded-3xl flex items-center justify-center mx-auto",
            (suspendedStatus === 'vacaciones' || suspendedStatus === 'reposo') ? "bg-amber-50 text-amber-500" : "bg-rose-50 text-rose-500"
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

              let customMsg = '';
              if (loggedInUserRole === 'admin') {
                customMsg = `INICIO DE SESIÓN: El Administrador General ${cantvEmail} ha ingresado al sistema.`;
              } else if (loggedInUserRole === 'supervisor') {
                customMsg = `INICIO DE SESIÓN: El Supervisor ${cantvEmail} ha ingresado al sistema.`;
              } else {
                customMsg = `INICIO DE SESIÓN: El Técnico ${displayName} (${ficha}) de tu departamento ha ingresado al sistema.`;
              }

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

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      user={activeUserProfile} 
      onLogout={() => signOut()}
      notifications={notifications}
      onMarkAsRead={handleMarkAsRead}
    >
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
            highlightedId={editingActivity?.id}
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
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto pb-12">
          {/* Header Card de Configuración */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-6 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.02),0_15px_35px_rgba(0,0,0,0.06)] border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full xl:w-auto">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-brand-blue to-blue-600 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-brand-blue/15 shrink-0">
                <Settings size={26} className="sm:size-7" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-display font-black text-slate-900 tracking-tight uppercase truncate">Configuración Personalizada</h2>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Gestión de identidad, seguridad y parámetros intranet</p>
                  <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-slate-300" />
                  <p className="text-[10px] text-slate-100/0 font-black uppercase tracking-widest flex items-center gap-1 text-slate-400">
                    Central Maracay 4357
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Grid Bento de Dos Columnas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Columna Izquierda: Información de Perfil */}
            <div className="space-y-8">
              {/* Tarjeta 1: Editar Perfil de Usuario */}
              <div className="bg-white border border-slate-200 rounded-3xl shadow-xl p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-blue/10 rounded-xl text-brand-blue">
                    <UserCircle size={20} />
                  </div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Editar Información Personal</h3>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  {/* Avatar Upload Preview */}
                  <div className="flex items-center gap-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-200/50 border-dashed">
                    <div className="relative">
                      <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center text-slate-300 border-2 border-white overflow-hidden ring-4 ring-slate-100 ring-offset-2">
                        {profileForm.photoURL ? (
                          <img src={profileForm.photoURL} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Camera size={32} className="text-slate-400" />
                        )}
                      </div>
                      <label className="absolute -bottom-2 -right-2 w-8 h-8 bg-brand-blue text-white rounded-xl shadow-lg flex items-center justify-center border-2 border-white cursor-pointer hover:bg-slate-900 hover:scale-105 transition-all">
                        <Camera size={14} />
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
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Foto de Perfil</p>
                      <p className="text-[10px] text-slate-500 font-bold leading-tight">Cargue una foto corporativa o asigne una URL externa abajo.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between ml-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre Completo</label>
                      </div>
                      <div className="relative">
                        <input 
                          type="text"
                          value={profileForm.displayName}
                          onChange={(e) => setProfileForm({...profileForm, displayName: e.target.value})}
                          readOnly={activeUserProfile?.role === 'tecnico' || activeUserProfile?.role === 'supervisor'}
                          disabled={activeUserProfile?.role === 'tecnico' || activeUserProfile?.role === 'supervisor'}
                          className={cn(
                            "w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/25 focus:shadow-md transition-all placeholder:text-slate-400",
                            (activeUserProfile?.role === 'tecnico' || activeUserProfile?.role === 'supervisor') && "opacity-75 cursor-not-allowed bg-slate-100 pl-10"
                          )}
                          placeholder="Edite su nombre..."
                          required
                        />
                        {(activeUserProfile?.role === 'tecnico' || activeUserProfile?.role === 'supervisor') && (
                          <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={isUpdatingProfile}
                    className="w-full h-12 bg-slate-900 hover:bg-brand-blue text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isUpdatingProfile ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        <Check size={18} />
                        Guardar Cambios
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Columna Derecha: Ficha Profesional Laboral y Seguridad de la Cuenta */}
            <div className="space-y-8">
              {/* Tarjeta 3: Ficha Profesional CANTV (Solo Lectura con candados) */}
              <div className="bg-white border border-slate-200 rounded-3xl shadow-xl p-8 space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 h-40 w-40 bg-gradient-to-br from-brand-blue/5 to-transparent rounded-full -mr-10 -mt-10 pointer-events-none" />
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-blue/10 rounded-xl text-brand-blue">
                      <Award size={20} />
                    </div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Ficha Profesional CANTV</h3>
                  </div>
                  <span className="text-[9px] font-black text-brand-blue tracking-wider uppercase px-2 py-0.5 rounded bg-brand-blue/10">SOLO LECTURA</span>
                </div>

                <div className="p-5 bg-blue-50/50 border border-blue-100/50 rounded-2xl flex gap-4 items-center">
                  <div className="w-12 h-12 bg-white rounded-2xl border border-blue-200/40 shadow-sm flex items-center justify-center shrink-0">
                    <Shield size={24} className="text-brand-blue" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Identificación Institucional</p>
                    <p className="text-[10px] text-slate-500 font-bold leading-tight">Detalles de personal inalterables para resguardo de auditorías corporativas.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Briefcase size={10} /> Código de Empleado (Ficha)
                    </label>
                    <div className="w-full h-11 bg-slate-100 border border-slate-200/50 rounded-xl px-4 flex items-center text-xs font-bold text-slate-500 cursor-not-allowed justify-between">
                      {techProfileInfo?.employeeId || 'Cargando...'}
                      <Lock size={12} className="text-slate-400 shrink-0" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <UserCircle size={10} /> Cédula de Identidad (C.I.)
                    </label>
                    <div className="w-full h-11 bg-slate-100 border border-slate-200/50 rounded-xl px-4 flex items-center text-xs font-bold text-slate-550 dynamic text-slate-500 cursor-not-allowed justify-between">
                      {techProfileInfo?.idCard || 'Cargando...'}
                      <Lock size={12} className="text-slate-400 shrink-0" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Award size={10} /> Especialidad Primaria
                    </label>
                    <div className="w-full h-11 bg-slate-100 border border-slate-200/50 rounded-xl px-4 flex items-center text-xs font-bold text-slate-500 cursor-not-allowed justify-between">
                      {techProfileInfo?.specialty || 'Cargando...'}
                      <Lock size={12} className="text-slate-400 shrink-0" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Shield size={10} /> Departamento
                    </label>
                    <div className="w-full h-11 bg-slate-100 border border-slate-200/50 rounded-xl px-4 flex items-center text-xs font-bold text-slate-500 cursor-not-allowed justify-between">
                      {techProfileInfo?.department || 'Datos y Transmisión'}
                      <Lock size={12} className="text-slate-400 shrink-0" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tarjeta 4: Seguridad de la Cuenta (Cambio de contraseña) */}
              {!isGeneralAdmin ? (
                <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-blue/10 rounded-xl text-brand-blue">
                      <Shield size={20} />
                    </div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">POLÍTICA DE SEGURIDAD DE CREDENCIALES</h3>
                  </div>
                  <p className="text-[13px] font-medium text-slate-600 leading-relaxed">
                    De conformidad con las normas de seguridad de la información de la Gerencia de Datos y Transmisión, la administración de credenciales de acceso se encuentra centralizada de forma exclusiva. Para cualquier modificación, actualización o restablecimiento de su contraseña de usuario, deberá canalizar la solicitud formalmente ante el Administrador General de la plataforma.
                  </p>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-3xl shadow-xl p-8 space-y-6">
                  <div className="flex justify-between items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-brand-blue/10 rounded-xl text-brand-blue">
                        <Lock size={20} />
                      </div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Seguridad de la Cuenta</h3>
                    </div>
                  </div>

                  <form onSubmit={handleUpdatePassword} className="space-y-4">
                    {passwordSuccess && (
                      <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800 space-y-1.5 animate-in fade-in duration-300">
                        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
                          <Check size={14} className="text-emerald-600" />
                          Operación Exitosa
                        </div>
                        <p className="text-[11px] font-medium leading-relaxed text-emerald-700">
                          {passwordSuccess}
                        </p>
                      </div>
                    )}

                    {passwordError && (
                      <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-rose-800 space-y-1.5 animate-in fade-in duration-300">
                        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
                          <X size={14} className="text-rose-600" />
                          Error de Validación
                        </div>
                        <p className="text-[11px] font-medium leading-relaxed text-rose-700">
                          {passwordError}
                        </p>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña Actual</label>
                      <input 
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => {
                          setPasswordError(null);
                          setPasswordSuccess(null);
                          setPasswordForm({...passwordForm, currentPassword: e.target.value});
                        }}
                        className="w-full h-11 border rounded-xl px-4 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/25 transition-all bg-slate-50 border-slate-200 hover:border-slate-300"
                        placeholder="Contraseña actual"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nueva Contraseña</label>
                        <input 
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={(e) => {
                            setPasswordError(null);
                            setPasswordSuccess(null);
                            setPasswordForm({...passwordForm, newPassword: e.target.value});
                          }}
                          className="w-full h-11 border rounded-xl px-4 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/25 transition-all bg-slate-50 border-slate-200 hover:border-slate-300"
                          placeholder="Mínimo 6 caracteres"
                          required
                          minLength={6}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirmar Contraseña</label>
                        <input 
                          type="password"
                          value={passwordForm.confirmPassword}
                          onChange={(e) => {
                            setPasswordError(null);
                            setPasswordSuccess(null);
                            setPasswordForm({...passwordForm, confirmPassword: e.target.value});
                          }}
                          className="w-full h-11 border rounded-xl px-4 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/25 transition-all bg-slate-50 border-slate-200 hover:border-slate-300"
                          placeholder="Re-ingrese contraseña"
                          required
                          minLength={6}
                        />
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={isUpdatingPassword || !(passwordForm.currentPassword && passwordForm.newPassword && passwordForm.confirmPassword)}
                      className="w-full h-11 font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all text-xs rounded-xl bg-slate-900 hover:bg-brand-blue text-white shadow-md hover:shadow-lg hover:shadow-brand-blue/15 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                    >
                      {isUpdatingPassword ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <>
                          <ShieldCheck size={16} />
                          Actualizar Credenciales
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
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
    </Layout>
  );
}




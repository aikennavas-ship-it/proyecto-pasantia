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
  getDocFromServer, deleteDoc, limit, arrayUnion, where, getDocs
} from 'firebase/firestore';
import { auth, db, firebaseConfig } from './firebase';
import { initializeApp, getApp } from 'firebase/app';
import { getAuth as getSecondaryAuth, signOut as signSecondaryOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { Activity, UserProfile, Technician } from './types';

// ======================================
// IMPORTACIÓN DE MÓDULOS DE NEGOCIO
// ======================================
import Layout from './modules/core/components/Layout';
import Dashboard from './modules/dashboard/components/Dashboard';
import ActivityCard from './modules/activities/components/ActivityCard';
import ActivityForm, { formatHours } from './modules/activities/components/ActivityForm';
import Login from './modules/auth/components/Login';
import TechnicianManagement from './modules/technicians/components/TechnicianManagement';
import ReportGenerator from './modules/reports/components/ReportGenerator';
import SmartSpreadsheet from './modules/activities/components/SmartSpreadsheet';
import ConfirmationModal from './modules/core/components/ConfirmationModal';
import RecycleBin from './modules/recycle-bin/components/RecycleBin';
import TechnicianForm from './modules/technicians/components/TechnicianForm';

import { Plus, Search, Filter, ClipboardList, Settings, Download, FileText, Table, Users, Target, Eye, ShieldCheck, History, LayoutGrid, List, Camera, UserCircle, Check, X, Loader2, Database } from 'lucide-react';
import { cn } from './lib/utils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { startOfDay, subDays as subDaysFns, startOfWeek as startOfWeekFns, format as formatFns, differenceInDays } from 'date-fns';

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

  React.useEffect(() => {
    if (userProfile) {
      setProfileForm({
        displayName: userProfile.displayName,
        photoURL: userProfile.photoURL || ''
      });
    }
  }, [userProfile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile) return;
    
    setIsUpdatingProfile(true);
    try {
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, {
        displayName: profileForm.displayName,
        photoURL: profileForm.photoURL
      }, { merge: true });
      
      setUserProfile({
        ...userProfile,
        displayName: profileForm.displayName,
        photoURL: profileForm.photoURL
      });
      alert('Perfil actualizado con éxito');
    } catch (error) {
      console.error("Error updating profile:", error);
      alert('Error al actualizar el perfil');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Lista de correos con acceso tipo "admin" por defecto
  const ADMIN_EMAILS = [
    'aikennavas@gmail.com',
    'vantoniomolina@gmail.com', 
    'vinumsanguinisetlacrimarum3@gmail.com',
    'admin@cantv.com.ve', 
    'asistente@cantv.com.ve'
  ];

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
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Fetch or create user profile
  React.useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        
        // Dynamic Role Lookup: 
        // 1. Check if hardcoded Admin
        // 2. Check technicians collection (Staff whitelist)
        const isAdminEmail = user.email && ADMIN_EMAILS.includes(user.email);
        
        let targetRole: 'admin' | 'supervisor' | 'tecnico' = 'tecnico';
        let techName = '';
        
        if (isAdminEmail) {
          targetRole = 'admin';
          setIsUnauthorized(false);
        } else if (user.email) {
          // Look up in technicians collection (Staff Whitelist)
          const techQuery = query(collection(db, 'technicians'), where('email', '==', user.email.toLowerCase()), where('isDeleted', '==', false));
          const techSnap = await getDocs(techQuery);
          if (!techSnap.empty) {
            const techData = techSnap.docs[0].data();
            targetRole = techData.role || 'tecnico';
            techName = techData.name || '';
            setIsUnauthorized(false);
          } else {
            // Not in whitelist!
            setIsUnauthorized(true);
            return;
          }
        }

        let profile: UserProfile;
        if (docSnap.exists()) {
          profile = docSnap.data() as UserProfile;
          if (profile.role !== targetRole || (techName && profile.displayName !== techName)) {
            profile.role = targetRole as any;
            if (techName) profile.displayName = techName;
            await setDoc(docRef, { role: targetRole, displayName: techName || profile.displayName }, { merge: true });
          }
        } else {
          profile = {
            uid: user.uid,
            email: user.email || '',
            displayName: techName || user.email?.split('@')[0] || 'Usuario',
            role: targetRole as any,
            department: 'Datos',
            createdAt: Timestamp.now(),
          };
          await setDoc(docRef, profile);
        }
        setUserProfile(profile);
      };
      fetchProfile();
    } else {
      setUserProfile(null);
    }
  }, [user]);

  const isGeneralAdmin = userProfile?.role === 'admin';
  const isManager = isGeneralAdmin || userProfile?.role === 'supervisor';

  const activitiesQuery = query(
    collection(db, 'activities'),
    orderBy('date', 'desc')
  );
  
  const [activitiesSnapshot, activitiesLoading] = useCollection(activitiesQuery);
  const activities = React.useMemo(() => activitiesSnapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity)).filter(a => a.isDeleted !== true) || [], [activitiesSnapshot]);

  const visibleActivities = React.useMemo(() => {
    if (!activities) return [];
    if (isManager) return activities;
    return activities.filter(a => a.adminId === user?.uid);
  }, [activities, isManager, user]);

  // Tab Enforcement based on Role
  React.useEffect(() => {
    if (userProfile && !isManager) {
      if (['dashboard', 'technicians', 'reports', 'recycle-bin'].includes(activeTab)) {
        setActiveTab('activities');
      }
    }
  }, [userProfile, activeTab, isManager]);

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

  const techniciansQuery = query(
    collection(db, 'technicians'),
    orderBy('name', 'asc')
  );
  const [techniciansSnapshot, techniciansLoading] = useCollection(techniciansQuery);
  const technicians = React.useMemo(() => techniciansSnapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Technician)).filter(t => t.isDeleted !== true) || [], [techniciansSnapshot]);

  const notificationsQuery = query(
    collection(db, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  const [notificationsSnapshot] = useCollection(notificationsQuery);
  const notifications = React.useMemo(() => notificationsSnapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [], [notificationsSnapshot]);

  const handleMarkAsRead = async (id: string) => {
    if (!user) return;
    const notifRef = doc(db, 'notifications', id);
    await setDoc(notifRef, {
      readBy: arrayUnion(user.uid)
    }, { merge: true });
  };
  const deletedActivitiesQuery = query(
    collection(db, 'activities'),
    where('isDeleted', '==', true)
  );
  const [deletedActivitiesSnapshot] = useCollection(deletedActivitiesQuery);
  const deletedActivities = React.useMemo(() => {
    const items = deletedActivitiesSnapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity)) || [];
    return items.sort((a, b) => {
      const dateA = a.deletedAt?.toDate?.() || new Date(0);
      const dateB = b.deletedAt?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [deletedActivitiesSnapshot]);

  const deletedTechniciansQuery = query(
    collection(db, 'technicians'),
    where('isDeleted', '==', true)
  );
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
            await addDoc(collection(db, 'notifications'), {
              type: 'fatigue_alert',
              technician: t,
              date: yesterdayStr,
              message: `CRITICO: ${t} cumplió ${hours.toFixed(1)}h de jornada el día ${yesterdayStr}. Según LOTTT, no se permite exceder límites de sobretiempo.`,
              severity: 'high',
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
            await addDoc(collection(db, 'notifications'), {
              type: 'fatigue_alert',
              technician: name,
              week: currentWeek,
              message: `CRÍTICO (LOTTT): ${name} ha alcanzado el límite de ${formatHours(data.total)} extras semanales. Restringir sobretiempos hasta próxima semana.`,
              severity: 'high',
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
        createdAt: Timestamp.now(),
        readBy: [user.uid]
      });

      setIsFormOpen(false);
    } catch (err) {
      console.error("Error adding activity:", err);
    }
  };

  const handleAddTechnician = async (data: any) => {
    if (!user || !isGeneralAdmin) return;
    const { password, ...firestoreData } = data;
    
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
      
      const authUser = await createUserWithEmailAndPassword(secondaryAuth, data.email, password);
      await signSecondaryOut(secondaryAuth);
      
      // 2. Save the metadata to the technicians collection
      const docRef = await addDoc(collection(db, 'technicians'), {
        ...firestoreData,
        createdAt: Timestamp.now(),
        isDeleted: false,
      });

      // Add Notification
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        userName: userProfile?.displayName,
        type: 'tech_add',
        message: `Técnico registrado: ${data.name}`,
        relatedId: docRef.id,
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
    try {
      await setDoc(doc(db, 'technicians', editingTechnician.id), {
        ...firestoreData,
        updatedAt: Timestamp.now(),
      }, { merge: true });
      
      setEditingTechnician(null);
    } catch (err: any) {
      console.error("Error editing technician:", err);
      alert("Error al editar personal: " + (err.message || String(err)));
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;

    if (confirmDelete.type === 'technician' && !isGeneralAdmin) {
      alert("Acceso denegado: Solo el Administrador General puede dar de baja a técnicos.");
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
      } else {
        await setDoc(doc(db, collectionName, confirmDelete.id), {
          isDeleted: true,
          deletedAt: Timestamp.now(),
          ...(collectionName === 'activities' && !confirmDelete.title ? { title: 'Actividad' } : {})
        }, { merge: true });
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

      // Add Notification
      await addDoc(collection(db, 'notifications'), {
        userId: user!.uid,
        userName: userProfile?.displayName,
        type: 'restore',
        message: `Restaurado ${type === 'activity' ? 'labor' : 'técnico'} desde papelera`,
        relatedId: id,
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
        message: `Restaurados todos los elementos (${deletedActivities.length + deletedTechnicians.length}) desde papelera`,
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
        ...deletedTechnicians.map(t => deleteDoc(doc(db, 'technicians', t.id)))
      ];

      await Promise.all(promises);
      alert(`Se ha vaciado la papelera con éxito. Se eliminaron ${promises.length} elementos.`);
      
      // Add Activity Log
      await addDoc(collection(db, 'notifications'), {
        userId: user!.uid,
        userName: userProfile?.displayName,
        type: 'delete',
        message: `Vaciado total de papelera (${promises.length} elementos)`,
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

      // Add Notification
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        userName: userProfile?.displayName,
        type: 'activity_edit',
        message: `Labor editada: ${data.title}`,
        relatedId: editingActivity.id,
        createdAt: Timestamp.now(),
        readBy: [user.uid]
      });

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
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full text-center space-y-6 shadow-2xl">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto">
            <ShieldCheck size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900">Acceso No Autorizado</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Tu cuenta (<span className="font-bold text-slate-700">{user.email}</span>) no ha sido habilitada por un administrador del departamento.
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 italic text-[11px] text-slate-500">
            Contacte al Jefe de Departamento para registrar su acceso institucional.
          </div>
          <button 
            onClick={() => {
              setIsUnauthorized(false);
              signOut();
            }}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all"
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
          const res = await signInWithEmailAndPassword(email, pass);
          if (!res) {
            // Si falla el login (ej: usuario de prueba no existe), intentamos crearlo
            await registerNewUser(email, pass);
          }
        }} 
        onRegister={(email, pass) => registerNewUser(email, pass)}
        onForgotPassword={async (email) => {
          const success = await sendPasswordResetEmailHook(email);
          if (success) {
            alert('Correo de recuperación enviado exitosamente.');
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
      user={userProfile} 
      onLogout={() => signOut()}
      notifications={notifications}
      onMarkAsRead={handleMarkAsRead}
    >
      {activeTab === 'dashboard' && (
        <Dashboard 
          activities={activities || []} 
          technicians={technicians || []}
          onSeeDetails={(tab) => setActiveTab(tab)}
        />
      )}

      {activeTab === 'activities' && (
        <SmartSpreadsheet 
          activities={visibleActivities || []}
          technicians={technicians || []}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          highlightedId={editingActivity?.id}
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
      )}

      {activeTab === 'technicians' && (
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

      {activeTab === 'recycle-bin' && (
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
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="glass-card p-8 max-w-4xl mx-auto border-none shadow-2xl">
            <div className="flex items-center justify-between gap-4 mb-10 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-brand-blue/10 rounded-2xl flex items-center justify-center text-brand-blue shadow-inner">
                  <Settings size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-display font-black text-slate-900 tracking-tight uppercase">Configuración Personalizada</h3>
                  <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Gestión de identidad y preferencias del sistema</p>
                </div>
              </div>
              {isGeneralAdmin && (
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm("¿Seguro que desea generar información de prueba en la base de datos?")) {
                      try {
                        const { seedDummyData } = await import('./lib/seedDummyData');
                        await seedDummyData(user?.uid || '');
                        alert('Data de prueba insertada. Recargue la página para verla');
                      } catch (err) {
                        console.error(err);
                        alert('Error');
                      }
                    }
                  }}
                  className="bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20 font-bold py-2 px-4 rounded-xl transition-all flex items-center gap-2"
                >
                  <Database size={16} /> Data Dummy
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* User Section */}
              <div className="space-y-8">
                <div>
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mb-6 flex items-center gap-2">
                    <UserCircle size={14} />
                    Editar Perfil
                  </h4>
                  
                  <form onSubmit={handleUpdateProfile} className="space-y-6">
                    {/* Avatar Upload Preview */}
                    <div className="flex items-center gap-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 border-dashed">
                      <div className="relative group">
                        <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center text-slate-300 border-2 border-white overflow-hidden ring-4 ring-slate-100 ring-offset-2">
                          {profileForm.photoURL ? (
                            <img src={profileForm.photoURL} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <Camera size={32} />
                          )}
                        </div>
                        <label className="absolute -bottom-2 -right-2 w-8 h-8 bg-brand-blue text-white rounded-xl shadow-lg flex items-center justify-center border-2 border-white cursor-pointer hover:bg-slate-900 transition-colors">
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
                        <p className="text-[10px] text-slate-500 font-bold leading-tight">Suba una imagen o pegue un enlace debajo.</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre para mostrar</label>
                        <input 
                          type="text"
                          value={profileForm.displayName}
                          onChange={(e) => setProfileForm({...profileForm, displayName: e.target.value})}
                          className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all"
                          placeholder="Su nombre..."
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">URL de la Imagen</label>
                        <input 
                          type="url"
                          value={profileForm.photoURL}
                          onChange={(e) => setProfileForm({...profileForm, photoURL: e.target.value})}
                          className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all"
                          placeholder="https://ejemplo.com/mifoto.jpg"
                        />
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={isUpdatingProfile}
                      className="w-full h-12 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-blue hover:shadow-lg hover:shadow-brand-blue/40 transition-all disabled:opacity-50"
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

                <div className="pt-4 space-y-4">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mb-4">Información de Cuenta</h4>
                  <div className="p-5 border border-slate-100 rounded-3xl bg-slate-50/50 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</span>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Activa</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rol del Sistema</span>
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">
                        {userProfile?.role === 'admin' ? 'Administrador General' : userProfile?.role === 'supervisor' ? 'Usuario Administrador' : 'Técnico Operativo'}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-200/40">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Identificador Único (UID)</p>
                      <p className="text-[10px] font-mono font-medium text-slate-400 text-center truncate">{userProfile?.uid}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Institutional Section */}
              <div className="space-y-6">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Marco del Proyecto (UNEFA)</h4>
                <div className="space-y-4">
                  <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors">
                    <div className="shrink-0 w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
                      <Target size={20} />
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-slate-800 mb-1">Misión</h5>
                      <p className="text-xs text-slate-500 leading-relaxed italic">"CANTV es la empresa estratégica del Estado... capaz de servir con calidad, eficiencia y eficacia..."</p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors">
                    <div className="shrink-0 w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                      <Eye size={20} />
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-slate-800 mb-1">Visión</h5>
                      <p className="text-xs text-slate-500 leading-relaxed italic">"Ser una empresa socialista operadora y proveedora de soluciones integrales... reconocida por su capacidad innovadora..."</p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors">
                    <div className="shrink-0 w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-brand-blue">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-slate-800 mb-1">Valores</h5>
                      <p className="text-xs text-slate-500 leading-relaxed">Ética socialista, Honestidad, Solidaridad, Esfuerzo Colectivo.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Ubicación Estratégica</p>
                  <div className="bg-slate-900 rounded-2xl p-4 text-white">
                    <p className="text-xs font-medium text-white/70 italic">Central 4357 - Casco Central Maracay, Aragua. Calle 100 con Av. Miranda.</p>
                  </div>
                </div>
              </div>
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
        <ActivityForm 
          onClose={() => {
            setIsFormOpen(false);
            setEditingActivity(null);
          }} 
          onSubmit={editingActivity ? handleEditActivity : handleAddActivity}
          technicians={technicians || []}
          initialDate={selectedDate}
          initialData={editingActivity}
        />
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




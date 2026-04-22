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
  collection, 
  addDoc, 
  query, 
  orderBy, 
  Timestamp, 
  doc, 
  setDoc, 
  getDoc,
  getDocFromServer,
  deleteDoc,
  limit,
  arrayUnion
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { Activity, UserProfile, Technician } from './types';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ActivityCard from './components/ActivityCard';
import ActivityForm from './components/ActivityForm';
import Login from './components/Login';
import TechnicianManagement from './components/TechnicianManagement';
import ReportGenerator from './components/ReportGenerator';
import SmartSpreadsheet from './components/SmartSpreadsheet';
import ConfirmationModal from './components/ConfirmationModal';
import RecycleBin from './components/RecycleBin';
import TechnicianForm from './components/TechnicianForm';
import { Plus, Search, Filter, ClipboardList, Settings, Download, FileText, Table, Users, Target, Eye, ShieldCheck, History, LayoutGrid, List } from 'lucide-react';
import { cn } from './lib/utils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { where } from 'firebase/firestore';

export default function App() {
  const [user, loading, error] = useAuthState(auth);
  const [signInWithEmailAndPassword, , signInLoading, signInError] = useSignInWithEmailAndPassword(auth);
  const [createUserWithEmailAndPassword, , createUserLoading, createUserError] = useCreateUserWithEmailAndPassword(auth);
  const [sendPasswordResetEmail, resetLoading, resetError] = useSendPasswordResetEmail(auth);
  const [signOut] = useSignOut(auth);
  const [activeTab, setActiveTab] = React.useState('dashboard');
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isExportMenuOpen, setIsExportMenuOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState(new Date());
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);

  const ADMIN_EMAILS = [
    'aikennavas@gmail.com',
    'vantoniomolina@gmail.com', 
    'admin@cantv.com.ve', 
    'asistente@cantv.com.ve'
  ];

  // Test connection to Firestore
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
        
        let profile: UserProfile;
        const isAdminEmail = user.email && ADMIN_EMAILS.includes(user.email);

        if (docSnap.exists()) {
          profile = docSnap.data() as UserProfile;
          // Actualizar rol si es un correo administrador
          if (isAdminEmail && profile.role !== 'admin') {
            profile.role = 'admin';
            await setDoc(docRef, { role: 'admin' }, { merge: true });
          }
        } else {
          profile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Usuario',
            role: isAdminEmail ? 'admin' : 'tecnico',
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
    where('isDeleted', '==', true),
    orderBy('deletedAt', 'desc')
  );
  const [deletedActivitiesSnapshot] = useCollection(deletedActivitiesQuery);
  const deletedActivities = React.useMemo(() => deletedActivitiesSnapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity)) || [], [deletedActivitiesSnapshot]);

  const deletedTechniciansQuery = query(
    collection(db, 'technicians'),
    where('isDeleted', '==', true),
    orderBy('deletedAt', 'desc')
  );
  const [deletedTechniciansSnapshot] = useCollection(deletedTechniciansQuery);
  const deletedTechnicians = React.useMemo(() => deletedTechniciansSnapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Technician)) || [], [deletedTechniciansSnapshot]);

  const [isTechFormOpen, setIsTechFormOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'grid' | 'table'>('grid');
  const [confirmDelete, setConfirmDelete] = React.useState<{ type: 'activity' | 'technician', id: string, title: string } | null>(null);

  const handleAddActivity = async (data: any) => {
    if (!user || !isManager) return;
    
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
    if (!user || !isManager) return;
    try {
      const docRef = await addDoc(collection(db, 'technicians'), {
        ...data,
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
    } catch (err) {
      console.error("Error adding technician:", err);
    }
  };

  const [editingTechnician, setEditingTechnician] = React.useState<Technician | null>(null);
  const handleEditTechnician = async (data: any) => {
    if (!user || !isManager || !editingTechnician) return;
    try {
      await setDoc(doc(db, 'technicians', editingTechnician.id), {
        ...data,
        updatedAt: Timestamp.now(),
      }, { merge: true });
      
      setEditingTechnician(null);
    } catch (err) {
      console.error("Error editing technician:", err);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;

    if (confirmDelete.type === 'technician' && !isGeneralAdmin) {
      alert("Acceso denegado: Solo el Administrador General puede dar de baja a técnicos.");
      setConfirmDelete(null);
      return;
    }
    
    if (confirmDelete.type === 'activity' && !isManager) {
      return;
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
          deletedAt: Timestamp.now()
        }, { merge: true });
      }
      
      setConfirmDelete(null);
    } catch (err) {
      console.error(`Error processing delete command:`, err);
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

  const [editingActivity, setEditingActivity] = React.useState<Activity | null>(null);
  const handleEditActivity = async (data: any) => {
    if (!user || !isManager || !editingActivity) return;
    
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
    } catch (err) {
      console.error("Error editing activity:", err);
    }
  };

  const exportToExcel = () => {
    if (!activities) return;
    const data = activities.map(a => ({
      Título: a.title,
      'Nro Incidente': a.incidentNumber || 'N/A',
      Descripción: a.description,
      Tipo: a.type,
      'Hora Inicio': a.startTime || '--:--',
      'Hora Fin': a.endTime || '--:--',
      'Horas Extra': a.overtimeHours || 0,
      'Viáticos': a.hasPerDiem ? 'Sí' : 'No',
      Participantes: a.participants?.join(', ') || a.technicianName,
      Fecha: a.date.toDate().toLocaleString('es-VE'),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Actividades");
    XLSX.writeFile(wb, `CANTV_Actividades_${new Date().toISOString().split('T')[0]}.xlsx`);
    setIsExportMenuOpen(false);
  };

  const exportToPDF = () => {
    if (!activities) return;
    const docPdf = new jsPDF();
    
    docPdf.setFontSize(18);
    docPdf.setTextColor(0, 74, 153); // CANTV Blue
    docPdf.text('CANTV - Reporte de Actividades, Sobretiempos y Viáticos', 14, 22);
    
    docPdf.setFontSize(10);
    docPdf.setTextColor(100);
    docPdf.text(`Generado el: ${new Date().toLocaleString('es-VE')}`, 14, 30);
    docPdf.text(`Departamento: Datos y Transmisión`, 14, 35);

    const tableData = activities.map(a => [
      a.title,
      a.startTime || '-',
      a.endTime || '-',
      a.overtimeHours ? `${a.overtimeHours}h` : '0h',
      a.hasPerDiem ? 'Sí' : 'No',
      a.date.toDate().toLocaleDateString('es-VE')
    ]);

    autoTable(docPdf, {
      startY: 45,
      head: [['Título', 'H. Inicio', 'H. Fin', 'S. Tiempo', 'Viáticos', 'Fecha']],
      body: tableData,
      headStyles: { fillColor: [0, 74, 153] },
      theme: 'grid'
    });

    docPdf.save(`CANTV_Reporte_Administrativo_${new Date().toISOString().split('T')[0]}.pdf`);
    setIsExportMenuOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-blue border-t-transparent"></div>
        <p className="ml-4 text-slate-600 font-medium">Cargando aplicación...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Login 
        onLogin={(email, pass) => signInWithEmailAndPassword(email, pass)} 
        onRegister={(email, pass) => createUserWithEmailAndPassword(email, pass)}
        onForgotPassword={async (email) => {
          const success = await sendPasswordResetEmail(email);
          if (success) {
            alert('Correo de recuperación enviado exitosamente.');
          }
        }}
        loading={signInLoading || createUserLoading || resetLoading} 
        error={signInError || createUserError || resetError}
      />
    );
  }

  const filteredActivities = activities?.filter(a => 
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.description.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

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
        <Dashboard activities={activities || []} />
      )}

      {activeTab === 'activities' && (
        <SmartSpreadsheet 
          activities={activities || []}
          technicians={technicians || []}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onAddActivity={isManager ? () => {
            setEditingActivity(null);
            setIsFormOpen(true);
          } : undefined}
          onEdit={isManager ? ((activity) => {
            setEditingActivity(activity);
            setIsFormOpen(true);
          }) : undefined}
          onDelete={isManager ? ((id, title) => setConfirmDelete({ type: 'activity', id, title })) : undefined}
        />
      )}

      {activeTab === 'technicians' && (
        <TechnicianManagement 
          technicians={technicians || []} 
          onAddTechnician={isManager ? handleAddTechnician : undefined}
          onEditTechnician={isManager ? ((tech) => setEditingTechnician(tech)) : undefined}
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
        />
      )}

      {activeTab === 'settings' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="glass-card p-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b border-slate-100">
              <div className="w-12 h-12 bg-brand-blue/10 rounded-2xl flex items-center justify-center text-brand-blue">
                <Settings size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Configuración e Información</h3>
                <p className="text-sm text-slate-500 font-medium">Gestión del sistema y marco institucional</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* User Section */}
              <div className="space-y-6">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Perfil del Administrador</h4>
                <div className="p-6 border border-slate-100 rounded-3xl bg-slate-50/50 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-400 border border-slate-100">
                      <Users size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{userProfile?.displayName}</p>
                      <p className="text-xs text-slate-500 font-mono">{userProfile?.email}</p>
                    </div>
                  </div>
                  <div className="badge bg-brand-blue/10 text-brand-blue text-[10px] uppercase font-black tracking-widest px-3 py-1 rounded-full inline-block">
                    Rol: {userProfile?.role === 'admin' ? 'Administrador General' : userProfile?.role === 'supervisor' ? 'Usuario Administrador' : 'Técnico'}
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Herramientas de Auditoría</h4>
                  <button className="w-full flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-3">
                      <History size={18} className="text-slate-400 group-hover:text-brand-blue" />
                      <span className="text-sm font-bold text-slate-700">Ver Log de Actividades</span>
                    </div>
                    <Plus size={16} className="text-slate-300" />
                  </button>
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
        />
      )}
    </Layout>
  );
}




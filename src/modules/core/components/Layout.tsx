/**
 * src/modules/core/components/Layout.tsx
 * 
 * CORE MODULE - Layout Principal
 * -----------------------------------------
 * Este componente define la estructura visual base (App Shell) de toda la aplicación.
 * Provee la barra lateral de navegación (Sidebar), el área principal de contenido (Main Content)
 * y la cabecera (Header) con acciones de usuario.
 *
 * Funciones clave:
 * - Gestiona la navegación de "pestañas" sin cambiar la URL (SPA approach).
 * - Componente responsivo: en móvil la barra lateral se vuelve colapsable.
 */
import React from 'react';
import { LayoutDashboard, ClipboardList, Settings, LogOut, Menu, X, Bell, User, ChevronLeft, ChevronRight, FileBarChart, Trash2, Database, MapPin, Server, Radio } from 'lucide-react';
import { cn, resolverPermisosDeSesion } from '../../../lib/utils';
import { obtenerNombreCorto } from '../../../lib/formateador';
import NotificationCenter from '../../notifications/components/NotificationCenter';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
  onLogout: () => void;
  notifications?: any[];
  onMarkAsRead?: (id: string) => void;
}

export default function Layout({ children, activeTab, setActiveTab, user, onLogout, notifications = [], onMarkAsRead = () => {} }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);

  const permisos = React.useMemo(() => resolverPermisosDeSesion(user?.role), [user?.role]);
  const isAdmin = permisos.esAdmin;
  const isManager = permisos.esAdmin || permisos.esSupervisor;
  const unreadCount = notifications.filter(n => !(n.readBy || []).includes(user?.uid)).length;
  const hasCriticalUnread = notifications.some(n => !(n.readBy || []).includes(user?.uid) && (n.type === 'fatigue_alert' || n.severity === 'high'));

  const navItems = [
    ...(isManager ? [{ id: 'dashboard', label: 'Panel', icon: LayoutDashboard }] : []),
    { id: 'activities', label: permisos.esTecnico ? 'Mis Labores' : 'Actividades', icon: ClipboardList },
    ...(isAdmin ? [{ id: 'technicians', label: 'Personal', icon: User }] : []),
    ...(isManager ? [{ id: 'reports', label: 'Reportes', icon: FileBarChart }] : []),
    ...(isAdmin ? [{ id: 'recycle-bin', label: 'Papelera', icon: Trash2 }] : []),
    { id: 'settings', label: 'Configuración', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-slate-100/50 font-sans transition-all duration-300">
      {/* Sidebar Desktop */}
      <aside className={cn(
        "hidden md:flex flex-col bg-[#0b1120] border-r border-slate-800/60 transition-all duration-300 relative text-slate-300 shadow-[4px_0_24px_rgba(0,0,0,0.2)] z-[60] group/sidebar",
        isCollapsed ? "w-20" : "w-64"
      )}>
        {/* Collapse Toggle Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3.5 top-24 -translate-y-1/2 w-7 h-7 bg-[#0b1120] border border-slate-800/60 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:border-brand-blue hover:bg-brand-blue shadow-md z-[100] transition-all opacity-0 group-hover/sidebar:opacity-100 focus:opacity-100"
        >
          {isCollapsed ? <ChevronRight size={14} strokeWidth={3} /> : <ChevronLeft size={14} strokeWidth={3} />}
        </button>

        <div className={cn("p-6 border-b border-slate-800/60 h-24 flex items-center transition-all bg-gradient-to-b from-white/[0.02] to-transparent", isCollapsed ? "justify-center px-4" : "gap-4")}>
          <svg 
            className={cn(
              "shrink-0 transition-all",
              isCollapsed ? "w-11 h-11" : "w-9 h-9"
            )}
            viewBox="0 0 32 32" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="6" cy="26" r="2.5" fill="#FFFFFF" />
            <path 
              d="M6 18A8 8 0 0 1 14 26" 
              stroke="#F2C94C" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
            />
            <path 
              d="M6 12A14 14 0 0 1 20 26" 
              stroke="#2F80ED" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
            />
            <path 
              d="M6 6A20 20 0 0 1 26 26" 
              stroke="#EB5757" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
            />
          </svg>
          {!isCollapsed && (
            <div className="animate-in fade-in slide-in-from-left-2 duration-300 min-w-0 flex flex-col justify-center">
              <span className="text-base font-extrabold text-white tracking-[0.15em] leading-none">CANTV</span>
              <span className="text-[9px] text-slate-400 font-bold tracking-wider uppercase leading-tight mt-1.5 relative left-[1px]">
                Departamento de Datos y Transmisión
              </span>
            </div>
          )}
        </div>

        {/* Scrollable Navigation Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden sidebar-scrollbar min-h-0 bg-[#0b1120]">
          <nav className={cn("space-y-1.5 transition-all", isCollapsed ? "p-3" : "p-4")}>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center rounded-xl transition-all duration-200 group relative",
                  isCollapsed ? "justify-center p-3" : "gap-3.5 px-4 py-3.5",
                  activeTab === item.id
                    ? "bg-brand-blue/10 text-brand-blue border border-brand-blue/20 shadow-[inset_0_1px_0_0_rgba(14,165,233,0.1)]"
                    : "text-slate-400 hover:bg-white-[0.03] hover:text-slate-200 border border-transparent"
                )}
              >
                <item.icon size={isCollapsed ? 22 : 20} className={cn("shrink-0 transition-all", activeTab === item.id ? "text-brand-blue drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "text-slate-500 group-hover:text-slate-300")} />
                {!isCollapsed && <span className={cn("text-sm transition-colors", activeTab === item.id ? "font-bold" : "font-medium")}>{item.label}</span>}
                
                {/* Tooltip on collapse */}
                {isCollapsed && (
                  <div className="absolute left-full ml-4 px-3 py-2 bg-slate-800 border border-slate-700 text-white text-xs font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-xl shadow-black/50">
                    <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 border-r-slate-800" />
                    {item.label}
                  </div>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800/60 bg-[#0b1120]/80 backdrop-blur-md flex flex-col gap-2 relative z-10">
          <button
            onClick={onLogout}
            className={cn(
              "w-full flex items-center rounded-xl transition-all duration-200 group relative",
              isCollapsed ? "justify-center p-3" : "gap-3.5 px-4 py-3",
              "text-slate-400 hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/20"
            )}
          >
            <LogOut size={isCollapsed ? 22 : 20} className="shrink-0 transition-colors group-hover:text-red-400 text-slate-500" />
            <span className={cn("font-semibold text-sm animate-in fade-in slide-in-from-left-1 duration-300", isCollapsed ? "hidden" : "inline-block")}>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between w-full sticky top-0 z-50 transition-all">
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-blue/40 via-brand-blue to-brand-blue/40" />
          
          {/* SECCIÓN IZQUIERDA: TÍTULO Y FECHA (Se adapta en tamaño) */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="md:hidden p-1.5 text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg shrink-0 transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={18} />
            </button>
            <div className="flex flex-col min-w-0">
              <h1 className="text-base lg:text-lg font-bold text-slate-800 leading-none uppercase truncate">
                {navItems.find(i => i.id === activeTab)?.label || activeTab}
              </h1>
              <span className="text-[10px] text-slate-400 font-medium mt-1 uppercase hidden sm:block truncate">
                {new Intl.DateTimeFormat('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
              </span>
            </div>
          </div>

          {/* SECCIÓN DERECHA: ESTADOS Y PERFIL */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            
            {/* ESTADO SINCRONIZADO: Visible desde tablets (md) */}
            <div className="hidden md:block">
              <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-slow"></span>
                Sincronizado
              </span>
            </div>

            {/* Notifications & Profile */}
            <div className="flex items-center gap-1 lg:gap-2 shrink-0">
            <div className="relative shrink-0">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={cn(
                  "p-2 text-slate-400 hover:text-brand-blue transition-colors relative rounded-xl hover:bg-brand-blue/5 border border-transparent hover:border-brand-blue/10 flex items-center justify-center",
                  isNotificationsOpen && "bg-brand-blue/10 text-brand-blue border-brand-blue/20",
                  hasCriticalUnread && !isNotificationsOpen && "bg-red-50 text-brand-red animate-pulse border-brand-red/20 shadow-sm shadow-brand-red/10"
                )}
              >
                <Bell size={18} className={cn("lg:w-5 lg:h-5", unreadCount > 0 && "animate-swing origin-top", hasCriticalUnread && "text-brand-red")} />
                {unreadCount > 0 && (
                  <span className={cn(
                    "absolute -top-1 -right-1 min-w-[16px] h-[16px] lg:min-w-[18px] lg:h-[18px] flex items-center justify-center rounded-full border-2 border-white shadow-sm px-1 text-[8px] font-black leading-none text-white",
                    hasCriticalUnread ? "bg-brand-red animate-pulse" : "bg-brand-blue"
                  )}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              
              {isNotificationsOpen && (
                <>
                  <div className="fixed inset-0 z-[100]" onClick={() => setIsNotificationsOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-96 z-[110]">
                    <NotificationCenter 
                      notifications={notifications}
                      onMarkAsRead={onMarkAsRead}
                      onClose={() => setIsNotificationsOpen(false)}
                      userId={user?.uid}
                      onNavigate={(tab) => {
                        setActiveTab(tab);
                        setIsNotificationsOpen(false);
                      }}
                    />
                  </div>
                </>
              )}
            </div>
            
            <div className="relative shrink-0 ml-1 sm:ml-4 border-l border-slate-100 pl-2 sm:pl-4">
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded-xl transition-colors focus:outline-none"
              >
                <div className="text-right hidden sm:block">
                  <span className="block text-xs font-bold text-slate-700">
                    {obtenerNombreCorto(user?.displayName)}
                  </span>
                  <span className="block text-[9px] text-brand-blue font-bold uppercase tracking-wider mt-0.5">
                    {permisos.rolVisual}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 overflow-hidden shrink-0 bg-slate-100">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt={user?.displayName || 'User'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="font-black text-xs leading-none">{(user?.displayName || 'U').charAt(0).toUpperCase()}</span>
                  )}
                </div>
              </button>

              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-[100]" onClick={() => setIsProfileOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-[110] animate-in fade-in zoom-in-95 duration-200">
                    {/* Cover/Header */}
                    <div className="h-20 bg-slate-900 relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/20 to-transparent"></div>
                      <button 
                        onClick={() => setIsProfileOpen(false)}
                        className="absolute top-3 right-3 p-1.5 bg-black/20 text-white/70 hover:text-white rounded-full transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    
                    {/* User Info Container */}
                    <div className="px-6 pb-6 pt-0 -mt-10 relative">
                      <div className="w-20 h-20 bg-white rounded-full shadow-xl flex items-center justify-center text-slate-300 border-4 border-white overflow-hidden mb-4 mx-auto">
                        {user?.photoURL ? (
                          <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-brand-blue to-blue-600 flex items-center justify-center text-white font-black text-4xl leading-none">
                            {(user?.displayName || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-center space-y-1">
                        <h4 className="text-lg font-display font-black text-slate-900 tracking-tight leading-none truncate px-2">
                          {user?.displayName}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium truncate px-4">{user?.email}</p>
                        <div className="pt-2">
                          <span className="inline-flex px-3 py-1 bg-brand-blue/10 text-brand-blue text-[10px] font-black uppercase tracking-widest rounded-full border border-brand-blue/10">
                            {user?.role === 'admin' ? 'Administrador General' : user?.role === 'supervisor' ? 'Supervisor' : 'Técnico'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-8 space-y-2">
                        <button 
                          onClick={() => {
                            setActiveTab('settings');
                            setIsProfileOpen(false);
                          }}
                          className="w-full flex items-center gap-3 p-3 text-slate-600 hover:bg-slate-50 hover:text-brand-blue rounded-2xl transition-all group font-bold text-sm"
                        >
                          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-brand-blue/10 transition-colors">
                            <Settings size={16} />
                          </div>
                          Configurar Perfil
                        </button>
                        
                        <div className="h-px bg-slate-100 mx-2" />
                        
                        <button 
                          onClick={() => {
                            setIsProfileOpen(false);
                            onLogout();
                          }}
                          className="w-full flex items-center gap-3 p-3 text-red-500 hover:bg-red-50 rounded-2xl transition-all group font-bold text-sm"
                        >
                          <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                            <LogOut size={16} />
                          </div>
                          Cerrar Sesión
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-50 px-6 py-4 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ID Sistema</span>
                         <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-tighter truncate max-w-[120px]">{user?.uid}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col bg-slate-100/30">
          <div className="p-6 flex-1">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </div>
          
          {/* Main Footer */}
          <footer className="mt-auto border-t border-slate-200 bg-white/80 px-6 py-6 backdrop-blur-md">
            <div className="max-w-7xl mx-auto">
              {/* Bottom Brand Corporate Bar */}
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 font-medium font-sans">
                    Gerencia General de Tecnología y Operaciones · © {new Date().getFullYear()} Departamento de Datos y Transmisión. Todos los derechos reservados.
                  </p>
                </div>
                
                <div className="flex items-center gap-2 sm:gap-4 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100/80 px-3 py-2 rounded-2xl border border-slate-200 w-fit">
                  <span className="text-brand-blue whitespace-nowrap">SGAV-DyT (Gestión de Actividades, Viáticos y Sobretiempos)</span>
                  <div className="w-1 h-1 bg-slate-300 rounded-full hidden sm:block shrink-0" />
                  <span className="bg-brand-blue text-white font-mono px-2 py-0.5 rounded-md text-[8px] sm:text-[9px] shrink-0 whitespace-nowrap">v2.6.0 PROD</span>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </main>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div className="absolute inset-0 bg-[#0b1120]/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsMobileMenuOpen(false)}></div>
          <aside className="absolute inset-y-0 left-0 w-64 bg-[#0b1120] border-r border-slate-800/60 shadow-[4px_0_24px_rgba(0,0,0,0.2)] flex flex-col animate-in slide-in-from-left duration-300 z-[110]">
            <div className="p-5 border-b border-slate-800/60 flex items-center justify-between h-20 bg-gradient-to-b from-white/[0.02] to-transparent">
              <div className="flex items-center gap-4">
                <svg 
                  className="w-9 h-9 shrink-0" 
                  viewBox="0 0 32 32" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="6" cy="26" r="2.5" fill="#FFFFFF" />
                  <path d="M6 18A8 8 0 0 1 14 26" stroke="#F2C94C" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M6 12A14 14 0 0 1 20 26" stroke="#2F80ED" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M6 6A20 20 0 0 1 26 26" stroke="#EB5757" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <div className="flex flex-col justify-center min-w-0">
                  <span className="text-base font-extrabold text-white tracking-[0.15em] leading-none">CANTV</span>
                  <span className="text-[9px] text-slate-400 font-bold tracking-wider uppercase leading-tight mt-1.5 whitespace-normal">
                    Departamento de Datos y Transmisión
                  </span>
                </div>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-white bg-white/[0.03] rounded-full hover:bg-white/10 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto overflow-x-hidden sidebar-scrollbar min-h-0">
              <nav className="p-4 space-y-1.5">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all",
                      activeTab === item.id ? "bg-brand-blue/10 text-brand-blue border border-brand-blue/20 shadow-[inset_0_1px_0_0_rgba(14,165,233,0.1)]" : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200 border border-transparent"
                    )}
                  >
                    <item.icon size={22} className={cn("transition-colors shrink-0", activeTab === item.id ? "text-brand-blue" : "text-slate-500")} />
                    <span className={cn("text-sm", activeTab === item.id ? "font-bold" : "font-medium")}>{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-4 border-t border-slate-800/60 bg-[#0b1120]/80">
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/20 transition-all"
              >
                <LogOut size={22} className="shrink-0 text-slate-500 group-hover:text-red-400" />
                <span className="font-semibold text-sm">Cerrar Sesión</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

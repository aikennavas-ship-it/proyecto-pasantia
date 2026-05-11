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
import { LayoutDashboard, ClipboardList, Settings, LogOut, Menu, X, Bell, User, ChevronLeft, ChevronRight, FileBarChart, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
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

  const isAdmin = user?.role === 'admin';
  const isManager = isAdmin || user?.role === 'supervisor';
  const unreadCount = notifications.filter(n => !(n.readBy || []).includes(user?.uid)).length;
  const hasCriticalUnread = notifications.some(n => !(n.readBy || []).includes(user?.uid) && (n.type === 'fatigue_alert' || n.severity === 'high'));

  const navItems = [
    ...(isManager ? [{ id: 'dashboard', label: 'Panel', icon: LayoutDashboard }] : []),
    { id: 'activities', label: 'Actividades', icon: ClipboardList },
    ...(isManager ? [{ id: 'technicians', label: 'Personal', icon: User }] : []),
    ...(isManager ? [{ id: 'reports', label: 'Reportes', icon: FileBarChart }] : []),
    ...(isAdmin ? [{ id: 'recycle-bin', label: 'Papelera', icon: Trash2 }] : []),
    { id: 'settings', label: 'Configuración', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-slate-100/50 font-sans transition-all duration-300">
      {/* Sidebar Desktop */}
      <aside className={cn(
        "hidden md:flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 relative text-slate-300 shadow-2xl shadow-slate-900/20 z-20",
        isCollapsed ? "w-20" : "w-64"
      )}>
        {/* Collapse Toggle Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:border-brand-blue hover:bg-brand-blue shadow-sm z-20 transition-all"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className={cn("p-6 border-b border-slate-800 h-24 flex items-center transition-all", isCollapsed ? "justify-center px-4" : "gap-4")}>
          <div className={cn(
            "bg-gradient-to-br from-brand-blue to-blue-600 rounded-xl flex items-center justify-center text-white font-display font-black transition-all shrink-0 shadow-lg shadow-brand-blue/30 border border-blue-500/30",
            isCollapsed ? "w-10 h-10 text-lg" : "w-12 h-12 text-2xl"
          )}>
            C
          </div>
          {!isCollapsed && (
            <div className="animate-in fade-in slide-in-from-left-2 duration-300 overflow-hidden whitespace-nowrap">
              <h1 className="font-display font-black text-white leading-none text-xl tracking-tighter">CANTV</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Gerencia de Datos</p>
            </div>
          )}
        </div>

        {/* Scrollable Navigation Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden sidebar-scrollbar min-h-0">
          <nav className="p-4 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center rounded-xl transition-all duration-200 group relative",
                  isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
                  activeTab === item.id
                    ? "bg-brand-blue text-white shadow-lg shadow-brand-blue/20"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon size={20} className="shrink-0" />
                {!isCollapsed && <span className="font-medium animate-in fade-in slide-in-from-left-1 duration-300">{item.label}</span>}
                
                {/* Tooltip on collapse */}
                {isCollapsed && (
                  <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-800 border border-slate-700 text-white text-xs font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur-md">
          <button
            onClick={onLogout}
            className={cn(
              "w-full flex items-center rounded-xl transition-all duration-200 group relative",
              isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
              "text-slate-400 hover:bg-red-500/10 hover:text-red-400"
            )}
          >
            <LogOut size={20} className="shrink-0" />
            {!isCollapsed && <span className="font-medium animate-in fade-in slide-in-from-left-1 duration-300">Cerrar Sesión</span>}
            
            {isCollapsed && (
              <div className="absolute left-full ml-4 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                Cerrar Sesión
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-50 shadow-sm transition-all">
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-blue/40 via-brand-blue to-brand-blue/40" />
          <div className="flex items-center gap-4">
            <button
              className="md:hidden p-2.5 text-slate-600 bg-white shadow-sm border border-slate-200 rounded-xl"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-display font-black text-slate-800 tracking-tight uppercase">
                  {navItems.find(i => i.id === activeTab)?.label || activeTab}
                </h2>
                <span className="hidden lg:inline-flex px-1.5 py-0.5 bg-slate-100 text-[8px] font-black text-slate-400 rounded border border-slate-200 tracking-widest translate-y-[-1px]">V1.0.4-LTS</span>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {new Intl.DateTimeFormat('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'}).format(new Date())}
              </p>
            </div>
          </div>

          {/* Technical Info Bar - Essential for Dedicated Systems */}
          <div className="hidden xl:flex items-center gap-8 px-8 py-2.5 bg-slate-50/50 border border-slate-200 rounded-[1.25rem] shadow-inner shadow-slate-200/50">
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-0.5">Sede Operativa</span>
              <span className="text-[10px] font-bold text-slate-700 tracking-tight">CENTRAL MARACAY 4357</span>
            </div>
            <div className="w-[1px] h-6 bg-slate-200" />
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-0.5">Unidad Organizativa</span>
              <span className="text-[10px] font-bold text-slate-700 tracking-tight">DATOS Y TRANSMISIÓN</span>
            </div>
            <div className="w-[1px] h-6 bg-slate-200" />
            <div className="flex items-center gap-2.5 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-slow shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.25em]">Sincronizado</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={cn(
                  "p-2 sm:p-2.5 text-slate-400 hover:text-brand-blue transition-colors relative rounded-xl hover:bg-brand-blue/5 border border-transparent hover:border-brand-blue/10",
                  isNotificationsOpen && "bg-brand-blue/10 text-brand-blue border-brand-blue/20",
                  hasCriticalUnread && !isNotificationsOpen && "bg-red-50 text-brand-red animate-pulse border-brand-red/20 shadow-sm shadow-brand-red/10"
                )}
              >
                <Bell size={20} className={cn(unreadCount > 0 && "animate-swing origin-top", hasCriticalUnread && "text-brand-red")} />
                {unreadCount > 0 && (
                  <span className={cn(
                    "absolute top-2 right-2 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm",
                    hasCriticalUnread ? "bg-brand-red animate-ping" : "bg-brand-blue"
                  )}></span>
                )}
                {unreadCount > 0 && hasCriticalUnread && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-brand-red rounded-full border-2 border-white"></span>
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
                    />
                  </div>
                </>
              )}
            </div>
            
            <div className="h-8 w-px bg-slate-200 hidden min-[480px]:block"></div>
            
            <div className="relative">
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={cn(
                  "flex items-center gap-3 bg-white pl-4 pr-1.5 py-1.5 rounded-full border border-slate-200/60 shadow-sm shadow-slate-200/20 max-w-[120px] sm:max-w-none transition-all hover:bg-slate-50",
                  isProfileOpen && "border-brand-blue/30 ring-4 ring-brand-blue/5 bg-slate-50"
                )}
              >
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[100px]">{user?.displayName || 'Usuario'}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    {user?.role === 'admin' ? 'Admin General' : user?.role === 'supervisor' ? 'Usu. Administrador' : 'Técnico'}
                  </p>
                </div>
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-brand-blue rounded-full flex items-center justify-center text-white shadow-inner shrink-0 overflow-hidden border border-slate-200">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User size={16} />
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
                      <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center text-slate-300 border-4 border-white overflow-hidden mb-4 mx-auto">
                        {user?.photoURL ? (
                          <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-brand-blue flex items-center justify-center text-white">
                            <User size={32} />
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
                            {user?.role === 'admin' ? 'Administrador General' : user?.role === 'supervisor' ? 'Usuario Autorizado' : 'Técnico Especialista'}
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
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col bg-slate-100/30">
          <div className="p-6 flex-1">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </div>
          
          {/* Main Footer */}
          <footer className="mt-auto border-t border-slate-200/60 bg-white/50 px-6 py-4 backdrop-blur-sm">
             <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
                 <div className="flex items-center gap-2 text-slate-500">
                    <span className="font-display font-black text-brand-blue tracking-tight">CANTV</span>
                    <span className="text-xs font-medium">© {new Date().getFullYear()} Gerencia de Datos y Transmisión. Todos los derechos reservados.</span>
                 </div>
                 <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-4">
                   <span>Sistema de Gestión Inteligente</span>
                   <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                   <span>V 2.1.0</span>
                 </div>
             </div>
          </footer>
        </div>
      </main>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <aside className="absolute inset-y-0 left-0 w-72 bg-slate-900 shadow-2xl flex flex-col">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-brand-blue rounded flex items-center justify-center text-white font-bold">C</div>
                <h1 className="font-bold text-white tracking-tight">CANTV</h1>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden sidebar-scrollbar min-h-0">
              <nav className="p-4 space-y-2">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                      activeTab === item.id ? "bg-brand-blue text-white shadow-lg shadow-brand-blue/20" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    <item.icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur-md">
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all font-bold"
              >
                <LogOut size={20} />
                <span className="font-medium">Cerrar Sesión</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

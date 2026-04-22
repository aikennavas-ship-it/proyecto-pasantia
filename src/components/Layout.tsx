import React from 'react';
import { LayoutDashboard, ClipboardList, Settings, LogOut, Menu, X, Bell, User, ChevronLeft, ChevronRight, FileBarChart, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import NotificationCenter from './NotificationCenter';

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

  const isAdmin = user?.role === 'admin';
  const unreadCount = notifications.filter(n => !(n.readBy || []).includes(user?.uid)).length;

  const navItems = [
    { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
    { id: 'activities', label: 'Actividades', icon: ClipboardList },
    { id: 'technicians', label: 'Personal', icon: User },
    { id: 'reports', label: 'Reportes', icon: FileBarChart },
    ...(isAdmin ? [{ id: 'recycle-bin', label: 'Papelera', icon: Trash2 }] : []),
    { id: 'settings', label: 'Configuración', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-[#f1f5f9] font-sans transition-all duration-300">
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
        <header className="h-20 bg-white/60 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-6 sticky top-0 z-10 transition-all">
          <div className="flex items-center gap-4">
            <button
              className="md:hidden p-2.5 text-slate-600 bg-white shadow-sm border border-slate-200 rounded-xl"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="hidden md:flex flex-col">
              <h2 className="text-xl font-display font-black text-slate-800 tracking-tight">
                {navItems.find(i => i.id === activeTab)?.label || activeTab}
              </h2>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{new Intl.DateTimeFormat('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'}).format(new Date())}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={cn(
                  "p-2.5 text-slate-400 hover:text-brand-blue transition-colors relative rounded-xl hover:bg-brand-blue/5 border border-transparent hover:border-brand-blue/10",
                  isNotificationsOpen && "bg-brand-blue/10 text-brand-blue border-brand-blue/20"
                )}
              >
                <Bell size={20} className={cn(unreadCount > 0 && "animate-swing origin-top")} />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-brand-red rounded-full border-2 border-white shadow-sm"></span>
                )}
              </button>
              
              {isNotificationsOpen && (
                <>
                  <div className="fixed inset-0 z-[90]" onClick={() => setIsNotificationsOpen(false)}></div>
                  <NotificationCenter 
                    notifications={notifications}
                    onMarkAsRead={onMarkAsRead}
                    onClose={() => setIsNotificationsOpen(false)}
                    userId={user?.uid}
                  />
                </>
              )}
            </div>
            
            <div className="h-8 w-px bg-slate-200"></div>
            
            <div className="flex items-center gap-3 bg-white pl-4 pr-1.5 py-1.5 rounded-full border border-slate-200/60 shadow-sm shadow-slate-200/20">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900 leading-tight">{user?.displayName || 'Usuario'}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  {user?.role === 'admin' ? 'Admin General' : user?.role === 'supervisor' ? 'Usu. Administrador' : 'Técnico'}
                </p>
              </div>
              <div className="w-9 h-9 bg-brand-blue rounded-full flex items-center justify-center text-white shadow-inner">
                <User size={16} />
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
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

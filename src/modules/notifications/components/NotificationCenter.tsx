import { Bell, X, Check, Clock, UserPlus, FileEdit, Plus, Trash2, ShieldAlert } from 'lucide-react';
import { cn, formatDateSpanish } from '../../../lib/utils';

interface Notification {
  id: string;
  type: 'activity_add' | 'activity_edit' | 'tech_add' | 'tech_edit' | 'restore' | 'fatigue_alert' | 'auth_login' | 'auth_register' | 'deleted_permanently' | 'moved_to_trash' | 'password_unlock_request' | 'password_unlock_approved' | string;
  message: string;
  userName?: string;
  createdAt: any;
  readBy: string[];
  severity?: 'normal' | 'medium' | 'high';
}

interface NotificationCenterProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onClose: () => void;
  userId: string;
  onNavigate?: (tab: string) => void;
}

export default function NotificationCenter({ notifications, onMarkAsRead, onClose, userId, onNavigate }: NotificationCenterProps) {
  const unreadCount = notifications.filter(n => !(n.readBy || []).includes(userId)).length;

  const getIcon = (type: string, severity?: string) => {
    switch (type) {
      case 'fatigue_alert': return <ShieldAlert size={14} className={cn(severity === 'high' ? "text-brand-red" : "text-amber-500")} />;
      case 'activity_add': return <Plus size={14} className="text-emerald-600" />;
      case 'activity_edit': return <FileEdit size={14} className="text-brand-blue" />;
      case 'tech_add': return <UserPlus size={14} className="text-slate-600" />;
      case 'tech_edit': return <FileEdit size={14} className="text-slate-600" />;
      case 'restore': return <Clock size={14} className="text-orange-600" />;
      case 'auth_login': return <Check size={14} className="text-emerald-500" />;
      case 'auth_register': return <UserPlus size={14} className="text-indigo-500" />;
      case 'deleted_permanently': return <Trash2 size={14} className="text-brand-red" />;
      case 'moved_to_trash': return <Trash2 size={14} className="text-amber-500" />;
      default: return <Bell size={14} className="text-slate-400" />;
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <h3 className="font-display font-black text-slate-900">Notificaciones</h3>
          {unreadCount > 0 && (
            <span className="bg-brand-red text-white text-[10px] font-black px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
          <X size={18} className="text-slate-400" />
        </button>
      </div>

      <div className="max-h-[400px] overflow-y-auto sidebar-scrollbar">
        {notifications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto text-slate-300 mb-4">
              <Bell size={24} />
            </div>
            <p className="text-sm font-bold text-slate-400 italic">No hay actividad reciente</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {notifications.map((notif) => {
              const isRead = (notif.readBy || []).includes(userId);
              const isCritical = notif.type === 'fatigue_alert' || notif.severity === 'high';
              
              // SANITIZADOR DINÁMICO:
              // Si el mensaje ya incluye el nombre al inicio, lo removemos temporalmente para el renderizado
              const mensajeLimpio = notif.userName && notif.message.startsWith(notif.userName)
                ? notif.message.replace(notif.userName, '').trim()
                : notif.message;

              return (
                <div 
                  key={notif.id} 
                  className={cn(
                    "p-4 hover:bg-slate-50 transition-colors group relative cursor-pointer",
                    !isRead && (isCritical ? "bg-red-50/50" : "bg-brand-blue/5")
                  )}
                  onClick={() => {
                    if (!isRead) onMarkAsRead(notif.id);
                    if (notif.type && notif.type.startsWith('password_unlock_')) {
                      if (onNavigate) onNavigate('settings');
                    }
                  }}
                >
                  <div className="flex gap-4">
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                      !isRead ? "bg-white" : "bg-slate-100"
                    )}>
                      {getIcon(notif.type, notif.severity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-xs leading-relaxed",
                        !isRead ? "text-slate-900 font-bold" : "text-slate-500 font-medium"
                      )}>
                        {notif.userName && <span className="font-bold text-blue-600 hover:underline cursor-pointer mr-1">{notif.userName}</span>}
                        {mensajeLimpio}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 font-bold italic">
                        {formatDateSpanish(notif.createdAt.toDate(), "HH:mm · d 'de' MMM")}
                      </p>
                    </div>
                    {!isRead && (
                      <div className={cn(
                        "w-2 h-2 rounded-full mt-2 shrink-0 shadow-sm animate-pulse",
                        isCritical ? "bg-brand-red" : "bg-brand-blue"
                      )} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actividad del Sistema en Tiempo Real</p>
      </div>
    </div>
  );
}

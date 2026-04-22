import React from 'react';
import { Bell, X, Check, Clock, UserPlus, FileEdit, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../lib/utils';

interface Notification {
  id: string;
  type: 'activity_add' | 'activity_edit' | 'tech_add' | 'tech_edit' | 'restore';
  message: string;
  userName: string;
  createdAt: any;
  readBy: string[];
}

interface NotificationCenterProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onClose: () => void;
  userId: string;
}

export default function NotificationCenter({ notifications, onMarkAsRead, onClose, userId }: NotificationCenterProps) {
  const unreadCount = notifications.filter(n => !(n.readBy || []).includes(userId)).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'activity_add': return <Plus size={14} className="text-emerald-600" />;
      case 'activity_edit': return <FileEdit size={14} className="text-brand-blue" />;
      case 'tech_add': return <UserPlus size={14} className="text-slate-600" />;
      case 'restore': return <Clock size={14} className="text-orange-600" />;
      default: return <Bell size={14} className="text-slate-400" />;
    }
  };

  return (
    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[100]">
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
              return (
                <div 
                  key={notif.id} 
                  className={cn(
                    "p-4 hover:bg-slate-50 transition-colors group relative",
                    !isRead && "bg-brand-blue/5"
                  )}
                  onClick={() => !isRead && onMarkAsRead(notif.id)}
                >
                  <div className="flex gap-4">
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                      !isRead ? "bg-white" : "bg-slate-100"
                    )}>
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-xs leading-relaxed",
                        !isRead ? "text-slate-900 font-bold" : "text-slate-500 font-medium"
                      )}>
                        <span className="text-brand-blue">{notif.userName}</span> {notif.message}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 font-bold italic">
                        {format(notif.createdAt.toDate(), "HH:mm · d 'de' MMM", { locale: es })}
                      </p>
                    </div>
                    {!isRead && (
                      <div className="w-2 h-2 bg-brand-blue rounded-full mt-2 shrink-0 shadow-sm animate-pulse" />
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

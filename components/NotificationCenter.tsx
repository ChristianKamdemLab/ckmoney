
import React, { useState, useEffect } from 'react';
import { Bell, Check, X, Info, AlertTriangle, AlertOctagon } from 'lucide-react';
import { Notification, User } from '../types';
import { getUserNotifications, markNotificationAsRead } from '../services/notificationService';
import { respondToDelay, confirmPendingPayments } from '../services/loanService';

interface NotificationCenterProps {
  user: User;
  onRefreshLoans: () => void; // Pour rafraichir la liste des prêts après une action
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ user, onRefreshLoans }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifs = async () => {
      const data = await getUserNotifications(user.email);
      setNotifs(data);
      setUnreadCount(data.filter(n => !n.read).length);
  };

  useEffect(() => {
      fetchNotifs();
      // Polling simple toutes les 30s
      const interval = setInterval(fetchNotifs, 30000);
      return () => clearInterval(interval);
  }, [user.email]);

  const handleOpen = () => {
      setIsOpen(!isOpen);
      if (!isOpen) fetchNotifs();
  };

  const handleAction = async (notif: Notification, accept: boolean) => {
      try {
          if (notif.actionType === 'review_delay') {
              await respondToDelay(notif.loanId, accept);
          } else if (notif.actionType === 'review_payment' && accept) {
              await confirmPendingPayments(notif.loanId);
          }
      } catch (e) {
          console.error(e);
          alert("L'action n'a pas pu être enregistrée.");
          return;
      }
      
      // Marquer comme lu et rafraichir
      await markNotificationAsRead(notif.id);
      await fetchNotifs();
      onRefreshLoans();
      alert(accept ? "Action confirmée avec succès." : "Demande refusée.");
  };

  const getIcon = (type: string) => {
      switch(type) {
          case 'danger': return <AlertOctagon size={16} className="text-rose-500" />;
          case 'warning': return <AlertTriangle size={16} className="text-amber-500" />;
          case 'success': return <Check size={16} className="text-emerald-500" />;
          default: return <Info size={16} className="text-indigo-500" />;
      }
  };

  return (
    <div className="relative">
      <button 
        onClick={handleOpen}
        className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all relative"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
            <span className="absolute top-2 right-2 w-3 h-3 bg-rose-500 rounded-full border-2 border-white"></span>
        )}
      </button>

      {isOpen && (
        <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden max-h-[80vh] flex flex-col animate-in fade-in slide-in-from-top-2">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900">Notifications</h3>
                    <span className="text-xs font-bold text-slate-400">{unreadCount} non lues</span>
                </div>
                <div className="overflow-y-auto p-2">
                    {notifs.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-sm">Aucune notification</div>
                    ) : (
                        notifs.map(n => (
                            <div key={n.id} className={`p-4 mb-2 rounded-xl border transition-all ${n.read ? 'bg-white border-transparent' : 'bg-indigo-50/50 border-indigo-100'}`}>
                                <div className="flex gap-3">
                                    <div className="mt-0.5 shrink-0">{getIcon(n.type)}</div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="text-sm font-bold text-slate-900">{n.title}</h4>
                                            <span className="text-[10px] text-slate-400">{new Date(n.date).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed mb-2">{n.message}</p>
                                        
                                        {n.actionType && !n.read && (
                                            <div className="flex gap-2 mt-2">
                                                <button 
                                                    onClick={() => handleAction(n, true)}
                                                    className="flex-1 py-2 bg-slate-900 text-white text-[10px] font-bold uppercase rounded-lg hover:bg-slate-800"
                                                >
                                                    {n.actionType === 'review_payment' ? 'Confirmer la réception' : 'Accepter'}
                                                </button>
                                                {n.actionType !== 'review_payment' && (
                                                    <button 
                                                        onClick={() => handleAction(n, false)}
                                                        className="px-3 py-2 bg-white border border-slate-200 text-slate-600 text-[10px] font-bold uppercase rounded-lg hover:bg-slate-50"
                                                    >
                                                        Refuser
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;

import React, { useEffect, useState } from 'react';
import { Shield, Monitor, Smartphone, RefreshCw, LogOut, CheckCircle } from 'lucide-react';
import Loader from '@/components/ui/Loader';
import { authService } from '@/services/auth.service';
import { useConfirm } from '@/contexts/ConfirmContext';

interface Session {
  id: string;
  ip: string;
  user_agent: string;
  refresh_issued_at: number;
  last_active_at: number;
  is_current: boolean;
}

interface SessionsSectionProps {
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}

const SessionsSection: React.FC<SessionsSectionProps> = ({ showToast }) => {
  const confirm = useConfirm();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  useEffect(() => {
    void loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await authService.getActiveSessions();
      setSessions(data || []);
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to load active sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    const isConfirmed = await confirm({
      title: 'Terminate Session',
      message: `Are you sure you want to terminate the session on ${name}?`,
    });
    if (!isConfirmed) return;
    setRevokingId(id);
    try {
      await authService.revokeSession(id);
      showToast('success', `Session terminated on ${name}`);
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to terminate session');
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeOthers = async () => {
    const isConfirmed = await confirm({
      title: 'Terminate Other Sessions',
      message: 'Are you sure you want to terminate all other sessions? This will log out all other devices.',
    });
    if (!isConfirmed) return;
    setRevokingAll(true);
    try {
      await authService.revokeOtherSessions();
      showToast('success', 'All other sessions terminated');
      setSessions(prev => prev.filter(s => s.is_current));
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to terminate other sessions');
    } finally {
      setRevokingAll(false);
    }
  };

  const getDeviceDetails = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    let os = 'Unknown OS';
    let isMobile = false;

    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('macintosh') || ua.includes('mac os')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) {
      os = 'Android';
      isMobile = true;
    } else if (ua.includes('iphone') || ua.includes('ipad')) {
      os = 'iOS';
      isMobile = true;
    }

    let browser = 'Unknown Browser';
    if (ua.includes('chrome')) browser = 'Chrome';
    else if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
    else if (ua.includes('edge')) browser = 'Edge';

    return { os, browser, isMobile };
  };

  const getDeviceIcon = (userAgent: string) => {
    const { isMobile } = getDeviceDetails(userAgent);
    if (isMobile) {
      return <Smartphone size={18} className="text-on-surface-variant" />;
    }
    return <Monitor size={18} className="text-on-surface-variant" />;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <Loader size={20} />
      </div>
    );
  }

  const otherSessionsCount = sessions.filter(s => !s.is_current).length;

  return (
    <div className="space-y-6">
      {/* Sessions Overview Header Card */}
      <div className="rounded-[2.5rem] border border-outline glass-panel p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface shrink-0">
            <Shield size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-on-surface tracking-tight">Logged-in Devices</h3>
            <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest mt-1">
              You are logged in to {sessions.length} active device{sessions.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {otherSessionsCount > 0 && (
          <button
            onClick={handleRevokeOthers}
            disabled={revokingAll}
            className="px-5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {revokingAll ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <LogOut size={12} />
            )}
            Log out other devices
          </button>
        )}
      </div>

      {/* Sessions List */}
      <div className="rounded-3xl border border-outline glass-panel overflow-hidden divide-y divide-outline-variant">
        {sessions.map(session => {
          const { os, browser } = getDeviceDetails(session.user_agent);
          const deviceName = `${os} • ${browser}`;

          return (
            <div
              key={session.id}
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 hover:bg-surface-container transition-colors group"
            >
              <div className="flex gap-4 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-surface-container border border-outline-variant flex items-center justify-center shrink-0 group-hover:border-outline transition-all">
                  {getDeviceIcon(session.user_agent)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <h4 className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">
                      {deviceName}
                    </h4>
                    {session.is_current && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary uppercase tracking-widest flex items-center gap-1">
                        <CheckCircle size={8} /> Current Session
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant/60 font-medium flex flex-wrap gap-x-3 gap-y-1">
                    <span>IP: {session.ip}</span>
                    <span className="text-on-surface-variant/20">•</span>
                    <span>Last active: {formatDate(session.last_active_at)}</span>
                  </p>
                </div>
              </div>

              {!session.is_current && (
                <button
                  onClick={() => handleRevoke(session.id, deviceName)}
                  disabled={revokingId === session.id}
                  className="self-end md:self-auto px-4 py-2 rounded-xl bg-surface hover:bg-surface-container border border-outline text-[9px] font-bold text-on-surface-variant hover:text-on-surface uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  {revokingId === session.id ? (
                    <RefreshCw size={10} className="animate-spin" />
                  ) : (
                    'Terminate'
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SessionsSection;

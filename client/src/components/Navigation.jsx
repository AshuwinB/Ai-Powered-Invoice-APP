import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useSessionContext } from '../context/SessionContext';
import { logoutUser } from '../service/authApi';
import { getNotificationStreamUrl } from '../service/notificationApi';
import Button from './Button';
import { Home, FileText, BarChart3, CreditCard, LogOut, User, Bell } from 'lucide-react';

const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useSessionContext();
  const [unreadCount, setUnreadCount] = React.useState(0);

  React.useEffect(() => {
    const eventSource = new EventSource(getNotificationStreamUrl(), { withCredentials: true });

    const onConnected = (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        setUnreadCount(Number(payload.unreadCount || 0));
      } catch (error) {
        // ignore malformed payloads
      }
    };

    const onUnreadCount = (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        setUnreadCount(Number(payload.unreadCount || 0));
      } catch (error) {
        // ignore malformed payloads
      }
    };

    eventSource.addEventListener('connected', onConnected);
    eventSource.addEventListener('unread-count', onUnreadCount);

    eventSource.onerror = () => {
      // Native EventSource reconnects automatically.
    };

    return () => {
      eventSource.removeEventListener('connected', onConnected);
      eventSource.removeEventListener('unread-count', onUnreadCount);
      eventSource.close();
    };
  }, [user?.username]);

  const handleLogout = async () => {
    try {
      const data = await logoutUser();
      logout(data);
      navigate('/login');
    } catch (error) {
      console.error("Logout failed:", error);
      // Still logout on client side even if API call fails
      logout();
      navigate('/login');
    }
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    { path: '/invoices', label: 'Invoices', icon: FileText },
    { path: '/payments', label: 'Payments', icon: CreditCard },
    { path: '/notifications', label: 'Notifications', icon: Bell },
    { path: '/home', label: 'Home', icon: Home },
  ];

  const isActive = (path) => {
    if (path === '/dashboard' && location.pathname === '/') return true;
    return location.pathname === path;
  };

  return (
    <nav className="sticky top-0 z-20 border-b border-slate-200 bg-white/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between min-h-16 py-3 items-center gap-4">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center space-x-2 px-1 py-1 transition-colors hover:text-teal-700">
              <div className="rounded-md bg-teal-600 p-2 text-white">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Workspace</p>
                <span className="text-lg font-bold text-slate-900">Invoice Studio</span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1 border-b border-slate-200 pb-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
                    isActive(item.path)
                      ? 'text-teal-700 bg-teal-50'
                      : 'text-slate-600 hover:text-teal-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {item.path === '/notifications' && unreadCount > 0 && (
                    <span className="inline-flex min-w-5 justify-center rounded-full bg-teal-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {/* Profile Dropdown */}
            <div className="relative">
              <Link to="/profile" className="hidden md:flex items-center space-x-2 border-b border-slate-200 py-2 px-1 transition-colors hover:text-teal-700">
                <div className="rounded-full bg-slate-100 p-1 text-slate-700">
                  <User className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm text-slate-700 font-semibold">{user?.username}</span>
              </Link>
            </div>

            {/* Logout Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-3">
          <div className="grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center justify-center space-x-1 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors border ${
                    isActive(item.path)
                      ? 'text-teal-700 bg-teal-50 border-teal-200'
                      : 'text-slate-600 bg-white border-slate-200 hover:text-teal-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {item.path === '/notifications' && unreadCount > 0 && (
                    <span className="inline-flex min-w-5 justify-center rounded-full bg-teal-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="md:hidden pb-4">
          <Link to="/profile" className="flex items-center justify-center gap-2 rounded-lg bg-white border border-slate-200 py-2 text-sm font-semibold text-slate-700">
            <User className="h-4 w-4" />
            {user?.username}
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
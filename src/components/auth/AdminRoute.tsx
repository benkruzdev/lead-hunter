import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';

export default function AdminRoute() {
    const { user, profile, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/30">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (profile?.role !== 'admin') {
        return <Navigate to="/app/search" replace />;
    }

    // Render AdminLayout which contains the nav tabs + <Outlet />
    return <AdminLayout />;
}


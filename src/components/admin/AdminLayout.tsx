import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Settings, CreditCard } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AdminLayout() {
    const { t } = useTranslation();
    const location = useLocation();

    const tabs = [
        { icon: LayoutDashboard, label: t('admin.navigation.dashboard'), path: '/app/admin' },
        { icon: Users, label: t('admin.navigation.users'), path: '/app/admin/users' },
        { icon: CreditCard, label: t('admin.navigation.credits'), path: '/app/admin/credits' },
        { icon: Settings, label: t('admin.navigation.config'), path: '/app/admin/config' },
    ];

    return (
        <div className="space-y-6">
            {/* Navigation Tabs */}
            <div className="border-b">
                <nav className="flex gap-6">
                    {tabs.map((tab) => {
                        const isActive = location.pathname === tab.path;
                        return (
                            <NavLink
                                key={tab.path}
                                to={tab.path}
                                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${isActive
                                    ? 'border-primary text-primary font-medium'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </NavLink>
                        );
                    })}
                </nav>
            </div>

            {/* Content */}
            <Outlet />
        </div>
    );
}

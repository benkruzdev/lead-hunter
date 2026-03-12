import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
    LayoutDashboard, Users, CreditCard, Search, FileDown, Wallet,
    LineChart, FileText, Mail, Wrench, Settings, Banknote, Package, Database,
} from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * AdminLayout — grouped navigation.
 *
 * Group 1 (Operations): Dashboard · Users · Credits · Payments · Packages
 * Group 2 (Logs):       Search Logs · Exports · System Logs · Costs
 * Group 3 (Config):     SMTP · System Settings · App Config · Payment Providers
 *
 * On mobile/smaller viewports each group wraps independently.
 */

interface NavItem {
    icon: React.ElementType;
    label: string;
    path: string;
}

interface NavGroup {
    label: string;
    items: NavItem[];
}

export default function AdminLayout() {
    const { t } = useTranslation();
    const location = useLocation();

    const groups: NavGroup[] = [
        {
            label: "Operasyon",
            items: [
                { icon: LayoutDashboard, label: t('admin.navigation.dashboard'), path: '/app/admin' },
                { icon: Users, label: t('admin.navigation.users'), path: '/app/admin/users' },
                { icon: CreditCard, label: t('admin.navigation.credits'), path: '/app/admin/credits' },
                { icon: Wallet, label: t('admin.navigation.payments'), path: '/app/admin/payments' },
                { icon: Package, label: 'Paketler', path: '/app/admin/packages' },
            ],
        },
        {
            label: "Loglar & İzleme",
            items: [
                { icon: Search, label: t('admin.navigation.searchLogs'), path: '/app/admin/search-logs' },
                { icon: FileDown, label: t('admin.navigation.exports'), path: '/app/admin/exports' },
                { icon: FileText, label: t('admin.navigation.systemLogs'), path: '/app/admin/system-logs' },
                { icon: LineChart, label: t('admin.navigation.costs'), path: '/app/admin/costs' },
                { icon: Database, label: 'Cache', path: '/app/admin/cache' },
            ],
        },
        {
            label: "Yapılandırma",
            items: [
                { icon: Banknote, label: 'Ödeme Sağlayıcıları', path: '/app/admin/payment-providers' },
                { icon: Mail, label: t('admin.navigation.smtpSettings'), path: '/app/admin/smtp-settings' },
                { icon: Wrench, label: t('admin.navigation.systemSettings'), path: '/app/admin/system-settings' },
                { icon: Settings, label: t('admin.navigation.config'), path: '/app/admin/config' },
            ],
        },
    ];

    function isActive(path: string) {
        return path === '/app/admin'
            ? location.pathname === path
            : location.pathname.startsWith(path);
    }

    return (
        <div className="space-y-6">
            {/* Grouped Navigation */}
            <div className="border-b bg-background">
                <nav className="flex flex-wrap gap-x-8 gap-y-0 min-w-0">
                    {groups.map((group) => (
                        <div key={group.label} className="flex flex-col min-w-0">
                            {/* Group label */}
                            <span className="px-1 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                                {group.label}
                            </span>
                            {/* Items row */}
                            <div className="flex items-center gap-0.5">
                                {group.items.map((tab) => (
                                    <NavLink
                                        key={tab.path}
                                        to={tab.path}
                                        className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 text-sm whitespace-nowrap transition-colors ${
                                            isActive(tab.path)
                                                ? 'border-primary text-primary font-medium'
                                                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                                        }`}
                                    >
                                        <tab.icon className="w-3.5 h-3.5 shrink-0" />
                                        {tab.label}
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>
            </div>

            {/* Content */}
            <Outlet />
        </div>
    );
}

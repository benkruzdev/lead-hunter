import re

with open(r'c:\lead-hunter\src\pages\admin\AdminUsersPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

cols_code = """
    const userColumns: ColumnDef<AdminUser>[] = [
        {
            key: "user",
            header: "Kullanici",
            render: (user) => (
                <Link to={`/app/admin/users/${user.id}`} className="hover:underline">
                    <div className="font-medium leading-tight truncate max-w-[160px]">{user.full_name || "\u2014"}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[160px]">{user.email || "\u2014"}</div>
                </Link>
            ),
        },
        { key: "phone", header: "Telefon", className: "text-xs text-muted-foreground whitespace-nowrap", render: (user) => user.phone || "\u2014" },
        { key: "role", header: "Rol", render: (user) => <RoleBadge role={user.role} /> },
        { key: "plan", header: "Plan", render: (user) => <PlanBadge plan={user.plan} /> },
        { key: "credits", header: "Kredi", className: "font-medium tabular-nums", render: (user) => user.credits.toLocaleString() },
        { key: "status", header: "Durum", render: (user) => <UserStatusBadge status={user.status} /> },
        { key: "last_sign_in_at", header: "Son Giris", className: "text-xs text-muted-foreground whitespace-nowrap", render: (user) => fmtDate(user.last_sign_in_at) },
        { key: "last_login_ip", header: "IP", className: "text-xs font-mono text-muted-foreground whitespace-nowrap", render: (user) => user.last_login_ip || "\u2014" },
        { key: "created_at", header: "Kayit", className: "text-xs text-muted-foreground whitespace-nowrap", render: (user) => new Date(user.created_at).toLocaleDateString("tr-TR") },
        {
            key: "actions",
            header: "",
            render: (user) => (
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditUser(user as AdminUser)}>Duzenle</Button>
                    <Link to={`/app/admin/users/${user.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><ExternalLink className="w-3 h-3" /></Button>
                    </Link>
                </div>
            ),
        },
    ];

"""

idx = content.rfind("    return (")
if idx == -1:
    print("ERROR: return not found")
else:
    content = content[:idx] + cols_code + content[idx:]
    with open(r'c:\lead-hunter\src\pages\admin\AdminUsersPage.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Done - inserted userColumns")

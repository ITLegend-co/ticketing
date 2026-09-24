import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { createUserWithEmailAndPassword, deleteUser, onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword } from "firebase/auth";
import { onValue, ref, set, update } from "firebase/database";
import { auth, database, provisionUser, sendUserPasswordReset } from "./firebase";
import {
  Activity,
  Bell,
  BookOpen,
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleAlert,
  Clock3,
  FileBarChart,
  Filter,
  Headphones,
  LayoutDashboard,
  LifeBuoy,
  KeyRound,
  MapPin,
  Menu,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Ticket,
  UserPlus,
  Users,
  X,
} from "lucide-react";

type TicketItem = {
  id: string;
  subject: string;
  requester: string;
  initials: string;
  department: string;
  category: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  status: "Open" | "In Progress" | "Pending" | "Resolved";
  technician: string;
  technicianInitials: string;
  created: string;
  sla: string;
};

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: "Employee" | "IT Technician" | "IT Admin" | "Management";
  department: string;
  status: "Active" | "Invited" | "Suspended";
  lastActive: string;
};

const tickets: TicketItem[] = [
  {
    id: "IT-2026-0184",
    subject: "Main office internet connection unstable",
    requester: "Marcus Lee",
    initials: "ML",
    department: "Operations",
    category: "Network",
    priority: "Critical",
    status: "In Progress",
    technician: "Aiman",
    technicianInitials: "AR",
    created: "12 Mar, 9:42 AM",
    sla: "42m left",
  },
  {
    id: "IT-2026-0183",
    subject: "Unable to access finance shared drive",
    requester: "Sarah Chen",
    initials: "SC",
    department: "Finance",
    category: "Access",
    priority: "High",
    status: "Open",
    technician: "Unassigned",
    technicianInitials: "",
    created: "12 Mar, 9:18 AM",
    sla: "1h 12m left",
  },
  {
    id: "IT-2026-0182",
    subject: "Printer on Level 3 showing paper jam",
    requester: "Noah Wong",
    initials: "NW",
    department: "HR",
    category: "Hardware",
    priority: "Medium",
    status: "Pending",
    technician: "Sofia",
    technicianInitials: "SM",
    created: "12 Mar, 8:51 AM",
    sla: "3h 08m left",
  },
  {
    id: "IT-2026-0181",
    subject: "New employee email account setup",
    requester: "Priya Nair",
    initials: "PN",
    department: "People",
    category: "Email",
    priority: "Low",
    status: "Resolved",
    technician: "Daniel",
    technicianInitials: "DK",
    created: "11 Mar, 4:22 PM",
    sla: "Met",
  },
  {
    id: "IT-2026-0180",
    subject: "CCTV feed unavailable at north entrance",
    requester: "Raymond Tan",
    initials: "RT",
    department: "Security",
    category: "CCTV",
    priority: "High",
    status: "In Progress",
    technician: "Sofia",
    technicianInitials: "SM",
    created: "11 Mar, 3:46 PM",
    sla: "Breached",
  },
];

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Tickets", icon: Ticket, count: 24 },
  { label: "Assets", icon: Boxes },
  { label: "Reports", icon: FileBarChart },
  { label: "Knowledge Base", icon: BookOpen },
];

const manageItems = [
  { label: "Users", icon: Users },
  { label: "Locations", icon: MapPin },
  { label: "System Settings", icon: Settings },
];

const stats = [
  { label: "Open tickets", value: "48", change: "+8.2%", tone: "blue", icon: Ticket },
  { label: "In progress", value: "19", change: "+2.1%", tone: "violet", icon: Activity },
  { label: "SLA at risk", value: "7", change: "Needs attention", tone: "amber", icon: Clock3 },
  { label: "Resolved this month", value: "126", change: "+18.4%", tone: "green", icon: Check },
];

const priorityClass: Record<TicketItem["priority"], string> = {
  Critical: "badge critical",
  High: "badge high",
  Medium: "badge medium",
  Low: "badge low",
};

const statusClass: Record<TicketItem["status"], string> = {
  Open: "status open",
  "In Progress": "status progress",
  Pending: "status pending",
  Resolved: "status resolved",
};

function authMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code.includes("invalid-credential")) return "The email or password is incorrect.";
  if (code.includes("email-already-in-use")) return "An account already exists for this email.";
  if (code.includes("weak-password")) return "Use a password with at least 6 characters.";
  if (code.includes("operation-not-allowed")) return "Email/password sign-in must be enabled in Firebase Authentication.";
  if (code.includes("permission-denied")) return "Firebase Database permissions rejected this request. Deploy the included database rules.";
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function LoginScreen() {
  const [setup, setSetup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email")).trim();
    const password = String(data.get("password"));
    try {
      if (setup) {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        try {
          await set(ref(database, `users/${credential.user.uid}`), {
            name: String(data.get("name")).trim(),
            email,
            role: "IT Admin",
            department: "Information Technology",
            status: "Active",
            createdAt: Date.now(),
            lastActive: Date.now(),
            mustChangePassword: false,
          });
        } catch (writeError) {
          await deleteUser(credential.user);
          throw writeError;
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (caught) {
      setError(authMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async (form: HTMLFormElement) => {
    const email = String(new FormData(form).get("email")).trim();
    if (!email) {
      setError("Enter your email address first.");
      return;
    }
    try {
      await sendUserPasswordReset(email);
      setNotice(`A password reset link was sent to ${email}.`);
      setError("");
    } catch (caught) {
      setError(authMessage(caught));
    }
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><div className="brand-mark"><Headphones size={22} /></div><div><strong>Nexus</strong><span>IT Helpdesk</span></div></div>
        <div className="login-copy"><h1>{setup ? "Set up your helpdesk" : "Welcome back"}</h1><p>{setup ? "Create the first administrator account. This option closes after setup." : "Sign in with your company account to continue."}</p></div>
        <form onSubmit={submit}>
          {setup && <label>Administrator name<input name="name" required autoFocus placeholder="Full name" /></label>}
          <label>Email address<input name="email" type="email" required autoFocus={!setup} placeholder="name@company.com" /></label>
          <label>Password<input name="password" type="password" minLength={6} required placeholder="Enter your password" /></label>
          {!setup && <button type="button" className="forgot-link" onClick={(event) => forgotPassword(event.currentTarget.form!)}>Forgot password?</button>}
          {error && <div className="auth-message error"><CircleAlert size={15} />{error}</div>}
          {notice && <div className="auth-message success"><Check size={15} />{notice}</div>}
          <button className="primary-btn login-submit" disabled={busy}>{busy ? "Please wait..." : setup ? "Create administrator" : "Sign in"}</button>
        </form>
        <div className="setup-switch">
          <span>{setup ? "Already configured?" : "New installation?"}</span>
          <button onClick={() => { setSetup(!setup); setError(""); setNotice(""); }}>{setup ? "Return to sign in" : "Set up first administrator"}</button>
        </div>
      </section>
      <p className="login-footer">Protected by Firebase Authentication</p>
    </main>
  );
}

function App() {
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("All priorities");
  const [toast, setToast] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<(ManagedUser & { mustChangePassword?: boolean }) | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [credential, setCredential] = useState<{ name: string; email: string; password: string; reset: boolean } | null>(null);

  const filteredTickets = useMemo(
    () =>
      tickets.filter(
        (item) =>
          (priority === "All priorities" || item.priority === priority) &&
          `${item.id} ${item.subject} ${item.requester}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, priority],
  );

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  useEffect(() => onAuthStateChanged(auth, (user) => {
    setCurrentUser(user);
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
    } else {
      setProfileLoading(true);
    }
    setAuthLoading(false);
  }), []);

  useEffect(() => {
    if (!currentUser) return;
    return onValue(ref(database, `users/${currentUser.uid}`), (snapshot) => {
      setProfile(snapshot.exists() ? { id: currentUser.uid, ...snapshot.val() } : null);
      setProfileLoading(false);
    }, () => {
      setProfile(null);
      setProfileLoading(false);
    });
  }, [currentUser]);

  useEffect(() => {
    if (profile?.role !== "IT Admin") {
      setUsers([]);
      return;
    }
    return onValue(ref(database, "users"), (snapshot) => {
      const value = snapshot.val() || {};
      setUsers(Object.entries(value).map(([id, item]) => {
        const user = item as Omit<ManagedUser, "id"> & { lastActive?: string | number };
        return {
          ...user,
          id,
          lastActive: typeof user.lastActive === "number"
            ? new Date(user.lastActive).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
            : user.lastActive || "Not signed in yet",
        };
      }));
    });
  }, [profile?.role]);

  const generatePassword = () => `Nexus-${Math.random().toString(36).slice(2, 7)}-${Math.floor(10 + Math.random() * 89)}!`;

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (profile?.role !== "IT Admin") {
      notify("Only IT Administrators can create users");
      return;
    }
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name"));
    const email = String(data.get("email"));
    const password = String(data.get("password")) || generatePassword();
    try {
      await provisionUser({
        name,
        email,
        role: String(data.get("role")) as ManagedUser["role"],
        department: String(data.get("department")),
      }, password);
      setUserModalOpen(false);
      setCredential({ name, email, password, reset: false });
    } catch (caught) {
      notify(authMessage(caught));
    }
  };

  const resetUserPassword = async (user: ManagedUser) => {
    if (profile?.role !== "IT Admin") return;
    try {
      await sendUserPasswordReset(user.email);
      notify(`Password reset email sent to ${user.email}`);
    } catch (caught) {
      notify(authMessage(caught));
    }
  };

  const changeUserRole = async (user: ManagedUser, role: ManagedUser["role"]) => {
    if (profile?.role !== "IT Admin") return;
    if (user.id === currentUser?.uid) {
      notify("You cannot change your own administrator role");
      return;
    }
    try {
      await update(ref(database, `users/${user.id}`), { role });
      notify(`${user.name} is now assigned as ${role}`);
    } catch (caught) {
      notify(authMessage(caught));
    }
  };

  const changeTemporaryPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser) return;
    const password = String(new FormData(event.currentTarget).get("newPassword"));
    try {
      await updatePassword(currentUser, password);
      await update(ref(database, `users/${currentUser.uid}`), { mustChangePassword: false });
      setProfile((current) => current ? { ...current, mustChangePassword: false } : current);
      notify("Your password has been updated");
    } catch (caught) {
      notify(authMessage(caught));
    }
  };

  if (authLoading || profileLoading) return <div className="auth-loading"><div className="brand-mark"><Headphones size={22} /></div><span>Loading helpdesk…</span></div>;
  if (!currentUser) return <LoginScreen />;
  if (!profile) return <main className="access-denied"><CircleAlert size={28} /><h1>Account access is not configured</h1><p>Your Firebase account exists, but no helpdesk role has been assigned. Ask an IT Administrator to add your user profile.</p><button className="secondary-btn" onClick={() => signOut(auth)}>Sign out</button></main>;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Headphones size={21} strokeWidth={2.2} /></div>
          <div><strong>Nexus</strong><span>IT Helpdesk</span></div>
          <button className="icon-btn close-mobile" onClick={() => setSidebarOpen(false)}><X size={19} /></button>
        </div>

        <nav className="sidebar-nav">
          <p className="nav-heading">Workspace</p>
          {navItems.map(({ label, icon: Icon, count }) => (
            <button
              key={label}
              className={`nav-item ${activeNav === label ? "active" : ""}`}
              onClick={() => { setActiveNav(label); setSidebarOpen(false); }}
            >
              <Icon size={18} /><span>{label}</span>{count ? <em>{count}</em> : null}
            </button>
          ))}
          {profile.role === "IT Admin" && <>
            <p className="nav-heading manage">Manage</p>
            {manageItems.map(({ label, icon: Icon }) => (
              <button
                key={label}
                className={`nav-item ${activeNav === label ? "active" : ""}`}
                onClick={() => { setActiveNav(label); setSidebarOpen(false); }}
              >
                <Icon size={18} /><span>{label}</span>
              </button>
            ))}
          </>}
        </nav>

        <div className="support-card">
          <div className="support-icon"><LifeBuoy size={18} /></div>
          <strong>Need assistance?</strong>
          <p>Browse setup guides and support documentation.</p>
          <button onClick={() => notify("Knowledge Base opened")}>View help center</button>
        </div>
        <div className="sidebar-user">
          <div className="avatar avatar-navy">{profile.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
          <div><strong>{profile.name}</strong><span>{profile.role}</span></div>
          <button className="icon-btn" title="Sign out" onClick={() => signOut(auth)}><MoreHorizontal size={18} /></button>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}

      <main className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button>
          <div className="global-search">
            <Search size={18} />
            <input aria-label="Global search" placeholder="Search tickets, users, or assets..." />
            <kbd>⌘ K</kbd>
          </div>
          <div className="top-actions">
            <button className="icon-btn notification" onClick={() => notify("You have 3 new notifications")}><Bell size={19} /><i /></button>
            <div className="top-divider" />
            <button className="profile-chip">
              <div className="avatar avatar-soft">{profile.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
              <div><strong>{profile.name}</strong><span>{profile.role}</span></div>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{activeNav}</strong></div>
              <h1>{activeNav === "Dashboard" ? `Good morning, ${profile.name.split(" ")[0]}` : activeNav}</h1>
              <p>{activeNav === "Dashboard" ? "Here’s what’s happening with your IT operations today." : `Manage and review your ${activeNav.toLowerCase()} workspace.`}</p>
            </div>
            {activeNav === "Users" ? (
              <button className="primary-btn" onClick={() => setUserModalOpen(true)}><UserPlus size={17} /> Create user</button>
            ) : (
              <button className="primary-btn" onClick={() => setCreateOpen(true)}><Plus size={17} /> Create ticket</button>
            )}
          </div>

          {activeNav === "Users" ? (
            <section className="users-workspace">
              <div className="access-banner">
                <div><ShieldCheck size={19} /><div><strong>Administrator-only workspace</strong><p>Only IT Administrators can create users, assign roles, or reset passwords.</p></div></div>
                <span>Protected</span>
              </div>
              <div className="user-summary">
                <article><span>Total users</span><strong>{users.length}</strong><em>Across all roles</em></article>
                <article><span>Administrators</span><strong>{users.filter((user) => user.role === "IT Admin").length}</strong><em>Full system access</em></article>
                <article><span>Technicians</span><strong>{users.filter((user) => user.role === "IT Technician").length}</strong><em>Operational access</em></article>
                <article><span>Pending invitations</span><strong>{users.filter((user) => user.status === "Invited").length}</strong><em>Awaiting first sign-in</em></article>
              </div>
              <div className="panel users-panel">
                <div className="panel-heading users-heading">
                  <div><h2>User directory</h2><p>Manage access and role assignments for your organization</p></div>
                  <div className="table-search"><Search size={16} /><input value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder="Search users..." /></div>
                </div>
                <div className="table-scroll">
                  <table className="users-table">
                    <thead><tr><th>User</th><th>Role</th><th>Department</th><th>Status</th><th>Last active</th><th>Security</th></tr></thead>
                    <tbody>
                      {users.filter((user) => `${user.name} ${user.email} ${user.department}`.toLowerCase().includes(userQuery.toLowerCase())).map((user) => (
                        <tr key={user.id}>
                          <td><div className="person user-person"><div className="mini-avatar">{user.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><div><strong>{user.name}</strong><span>{user.email}</span></div></div></td>
                          <td><label className={`role-select role-${user.role.toLowerCase().replaceAll(" ", "-")}`}><select value={user.role} onChange={(event) => changeUserRole(user, event.target.value as ManagedUser["role"])} disabled={user.id === currentUser?.uid}><option>Employee</option><option>IT Technician</option><option>IT Admin</option><option>Management</option></select><ChevronsUpDown size={12} /></label></td>
                          <td className="muted-cell">{user.department}</td>
                          <td><span className={`user-status ${user.status.toLowerCase()}`}><i />{user.status}</span></td>
                          <td className="muted-cell">{user.lastActive}</td>
                          <td><button className="reset-btn" onClick={() => resetUserPassword(user)}><KeyRound size={14} /> Reset password</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : (
          <>
          <section className="stats-grid">
            {stats.map(({ label, value, change, tone, icon: Icon }) => (
              <article className="stat-card" key={label}>
                <div className={`stat-icon ${tone}`}><Icon size={19} /></div>
                <span className="stat-label">{label}</span>
                <strong className="stat-value">{value}</strong>
                <div className={`stat-change ${tone === "amber" ? "attention" : ""}`}>
                  {tone !== "amber" && <span>↗</span>} {change} <em>{tone === "amber" ? "" : "vs last month"}</em>
                </div>
              </article>
            ))}
          </section>

          <section className="overview-grid">
            <article className="panel chart-panel">
              <div className="panel-heading">
                <div><h2>Ticket overview</h2><p>Created and resolved tickets over time</p></div>
                <button className="select-btn">Last 7 days <ChevronDown size={14} /></button>
              </div>
              <div className="chart-legend"><span><i className="created-dot" />Created</span><span><i className="resolved-dot" />Resolved</span></div>
              <div className="line-chart">
                <div className="y-labels"><span>30</span><span>20</span><span>10</span><span>0</span></div>
                <div className="chart-area">
                  <div className="grid-lines"><i /><i /><i /><i /></div>
                  <svg viewBox="0 0 700 190" preserveAspectRatio="none" aria-label="Ticket trend chart">
                    <defs>
                      <linearGradient id="blueArea" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#2764e7" stopOpacity=".17" />
                        <stop offset="100%" stopColor="#2764e7" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0 142 C70 130,90 82,150 92 S245 142,300 104 S390 46,450 69 S540 139,600 100 S665 52,700 44 L700 190 L0 190Z" fill="url(#blueArea)" />
                    <path d="M0 142 C70 130,90 82,150 92 S245 142,300 104 S390 46,450 69 S540 139,600 100 S665 52,700 44" fill="none" stroke="#2764e7" strokeWidth="3" strokeLinecap="round" />
                    <path d="M0 166 C75 142,95 137,150 141 S240 105,300 129 S375 116,450 110 S530 78,600 92 S665 80,700 78" fill="none" stroke="#20a973" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="6 5" />
                  </svg>
                  <div className="x-labels"><span>Mar 6</span><span>Mar 7</span><span>Mar 8</span><span>Mar 9</span><span>Mar 10</span><span>Mar 11</span><span>Today</span></div>
                </div>
              </div>
            </article>

            <article className="panel priority-panel">
              <div className="panel-heading"><div><h2>Tickets by priority</h2><p>Current open tickets</p></div><button className="icon-btn"><MoreHorizontal size={19} /></button></div>
              <div className="donut-wrap">
                <div className="donut"><div><strong>48</strong><span>Total open</span></div></div>
              </div>
              <div className="priority-list">
                <div><span><i className="dot red" />Critical</span><strong>5 <em>10%</em></strong></div>
                <div><span><i className="dot orange" />High</span><strong>12 <em>25%</em></strong></div>
                <div><span><i className="dot blue" />Medium</span><strong>21 <em>44%</em></strong></div>
                <div><span><i className="dot gray" />Low</span><strong>10 <em>21%</em></strong></div>
              </div>
            </article>
          </section>

          <section className="panel tickets-panel">
            <div className="panel-heading tickets-heading">
              <div><h2>Recent tickets</h2><p>Latest requests across your organization</p></div>
              <button className="text-btn" onClick={() => setActiveNav("Tickets")}>View all tickets <ChevronRight size={15} /></button>
            </div>
            <div className="table-tools">
              <div className="table-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tickets..." /></div>
              <div className="filter-group">
                <label><Filter size={15} /><select value={priority} onChange={(e) => setPriority(e.target.value)}><option>All priorities</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select><ChevronDown size={14} /></label>
                <button className="select-btn">All statuses <ChevronDown size={14} /></button>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Ticket</th><th>Requester</th><th>Priority</th><th>Status</th><th>Assigned to</th><th>Created</th><th>SLA</th><th /></tr></thead>
                <tbody>
                  {filteredTickets.map((item) => (
                    <tr key={item.id} onClick={() => setSelectedTicket(item)}>
                      <td><button className="ticket-name"><strong>{item.subject}</strong><span>{item.id} · {item.category}</span></button></td>
                      <td><div className="person"><div className="mini-avatar">{item.initials}</div><div><strong>{item.requester}</strong><span>{item.department}</span></div></div></td>
                      <td><span className={priorityClass[item.priority]}>{item.priority}</span></td>
                      <td><span className={statusClass[item.status]}><i />{item.status}</span></td>
                      <td>{item.technician === "Unassigned" ? <span className="unassigned">Unassigned</span> : <div className="assignee"><div className="mini-avatar dark">{item.technicianInitials}</div>{item.technician}</div>}</td>
                      <td className="muted-cell">{item.created}</td>
                      <td><span className={`sla ${item.sla === "Breached" ? "breached" : item.sla === "Met" ? "met" : ""}`}><Clock3 size={13} />{item.sla}</span></td>
                      <td><button className="icon-btn" onClick={(e) => e.stopPropagation()}><MoreHorizontal size={18} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredTickets.length && <div className="empty-state">No tickets match your filters.</div>}
            </div>
          </section>
          </>
          )}
        </div>
      </main>

      {createOpen && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Create ticket">
          <button className="modal-backdrop" onClick={() => setCreateOpen(false)} />
          <form className="ticket-modal" onSubmit={(e) => { e.preventDefault(); setCreateOpen(false); notify("Ticket IT-2026-0185 created successfully"); }}>
            <div className="modal-heading"><div><h2>Create new ticket</h2><p>Provide the issue details below.</p></div><button type="button" className="icon-btn" onClick={() => setCreateOpen(false)}><X size={20} /></button></div>
            <div className="form-body">
              <label className="full">Subject<input required placeholder="Short summary of the issue" /></label>
              <label className="full">Description<textarea required rows={4} placeholder="What happened, and how is it affecting your work?" /></label>
              <label>Category<select required defaultValue=""><option value="" disabled>Select category</option><option>Hardware</option><option>Software</option><option>Network</option><option>Access</option></select></label>
              <label>Priority<select defaultValue="Medium"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label>
              <label>Location<select defaultValue="KK Office"><option>KK Office</option><option>Kinabalu Park</option><option>Pendant Hut</option></select></label>
              <label>Business impact<select defaultValue="Single User"><option>Single User</option><option>Multiple Users</option><option>Department</option><option>Entire Company</option></select></label>
            </div>
            <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setCreateOpen(false)}>Cancel</button><button className="primary-btn" type="submit">Submit ticket</button></div>
          </form>
        </div>
      )}

      {userModalOpen && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Create user">
          <button className="modal-backdrop" onClick={() => setUserModalOpen(false)} />
          <form className="ticket-modal user-modal" onSubmit={createUser}>
            <div className="modal-heading">
              <div><h2>Create a new user</h2><p>Assign the correct access level for this team member.</p></div>
              <button type="button" className="icon-btn" onClick={() => setUserModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="form-body">
              <label>Full name<input name="name" required autoFocus placeholder="e.g. Jamie Tan" /></label>
              <label>Work email<input name="email" type="email" required placeholder="name@company.com" /></label>
              <label>Role<select name="role" required defaultValue="Employee"><option>Employee</option><option>IT Technician</option><option>IT Admin</option><option>Management</option></select></label>
              <label>Department<select name="department" required defaultValue=""><option value="" disabled>Select department</option><option>Information Technology</option><option>Finance</option><option>Operations</option><option>People</option><option>Security</option><option>Management</option></select></label>
              <label className="full">Temporary password<input name="password" type="text" minLength={6} placeholder="Leave blank to generate a secure password" /></label>
              <div className="permission-preview full">
                <ShieldCheck size={18} />
                <div><strong>Role-based access is applied automatically</strong><p>The user receives only the permissions assigned to their selected role. A temporary password will be generated when you create the account.</p></div>
              </div>
            </div>
            <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setUserModalOpen(false)}>Cancel</button><button className="primary-btn" type="submit"><UserPlus size={15} /> Create user</button></div>
          </form>
        </div>
      )}

      {credential && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Temporary password">
          <button className="modal-backdrop" onClick={() => setCredential(null)} />
          <div className="ticket-modal credential-modal">
            <div className="credential-icon"><KeyRound size={23} /></div>
            <h2>{credential.reset ? "Password reset complete" : "User account created"}</h2>
            <p>A one-time password has been generated for <strong>{credential.name}</strong>. They will be required to change it after signing in.</p>
            <div className="credential-field">
              <div><span>Temporary password</span><strong>{credential.password}</strong></div>
              <button onClick={() => { navigator.clipboard.writeText(credential.password); notify("Temporary password copied"); }} type="button">Copy</button>
            </div>
            <div className="credential-email"><Mail size={15} />{credential.email}</div>
            <div className="security-note"><CircleAlert size={16} /><span>This password is shown only once. Share it with the user through a secure channel.</span></div>
            <div className="credential-actions"><button className="primary-btn" onClick={() => setCredential(null)}>Done</button></div>
          </div>
        </div>
      )}

      {profile.mustChangePassword && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Change temporary password">
          <div className="modal-backdrop" />
          <form className="ticket-modal credential-modal password-change" onSubmit={changeTemporaryPassword}>
            <div className="credential-icon"><KeyRound size={23} /></div>
            <h2>Create a new password</h2>
            <p>You signed in with a temporary password. Choose a new password before continuing.</p>
            <label>New password<input name="newPassword" type="password" minLength={8} required autoFocus placeholder="At least 8 characters" /></label>
            <button className="primary-btn" type="submit">Update password</button>
          </form>
        </div>
      )}

      {selectedTicket && (
        <div className="drawer-layer">
          <button className="drawer-backdrop" onClick={() => setSelectedTicket(null)} />
          <aside className="ticket-drawer">
            <div className="drawer-head"><span>Ticket details</span><button className="icon-btn" onClick={() => setSelectedTicket(null)}><X size={20} /></button></div>
            <div className="drawer-body">
              <div className="drawer-id">{selectedTicket.id}<span className={priorityClass[selectedTicket.priority]}>{selectedTicket.priority}</span></div>
              <h2>{selectedTicket.subject}</h2>
              <div className="drawer-meta"><span className={statusClass[selectedTicket.status]}><i />{selectedTicket.status}</span><span><Clock3 size={14} />{selectedTicket.sla}</span></div>
              <div className="detail-grid">
                <div><span>Requester</span><strong>{selectedTicket.requester}</strong></div>
                <div><span>Department</span><strong>{selectedTicket.department}</strong></div>
                <div><span>Category</span><strong>{selectedTicket.category}</strong></div>
                <div><span>Assigned technician</span><strong>{selectedTicket.technician}</strong></div>
              </div>
              <div className="update-card"><div><ShieldCheck size={17} /><strong>Latest update</strong></div><p>Initial diagnostics are in progress. The requester has been notified and the team is monitoring service impact.</p><span>Updated 18 minutes ago by Alex Kim</span></div>
              <h3>Activity</h3>
              <div className="timeline"><i /><div><strong>Ticket status updated</strong><p>Moved from Open to {selectedTicket.status}</p><span>Today, 10:14 AM</span></div></div>
              <div className="timeline"><i /><div><strong>Ticket created</strong><p>Request submitted by {selectedTicket.requester}</p><span>{selectedTicket.created}</span></div></div>
            </div>
            <div className="drawer-actions"><button className="secondary-btn" onClick={() => notify("Internal note editor opened")}>Add internal note</button><button className="primary-btn" onClick={() => notify("Ticket workspace opened")}>Open ticket</button></div>
          </aside>
        </div>
      )}

      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </div>
  );
}

export default App;

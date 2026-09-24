import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword } from "firebase/auth";
import { equalTo, onValue, orderByChild, push, query, ref, set, update } from "firebase/database";
import { auth, database, sendUserPasswordReset } from "./firebase";
import { Check, ChevronDown, CircleAlert, Clock3, Filter, Headphones, LayoutDashboard, LogOut, Menu, Plus, Search, ShieldCheck, Ticket, UserPlus, Users, X } from "lucide-react";

type Role = "Employee" | "IT Technician" | "IT Admin" | "Management";
type Status = "Open" | "In Progress" | "Pending" | "Resolved";
type Priority = "Low" | "Medium" | "High" | "Critical";
type Profile = { id: string; name: string; email: string; role: Role; department: string; status: "Active" | "Suspended"; mustChangePassword?: boolean };
type TicketItem = {
  id: string; subject: string; description: string; category: string; priority: Priority; status: Status;
  location: string; impact: string; requesterId: string; requester: string; department: string;
  technicianId: string; technician: string; createdAt: number; updatedAt: number;
  updates?: Record<string, { text: string; author: string; createdAt: number }>;
};
const statuses: Status[] = ["Open", "In Progress", "Pending", "Resolved"];
const priorities: Priority[] = ["Low", "Medium", "High", "Critical"];
const adminRoles: Role[] = ["IT Admin", "IT Technician"];
const canWorkTickets = (role?: Role) => !!role && adminRoles.includes(role);
const displayDate = (value: number) => value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";
const initials = (name: string) => name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const issueMessage = (error: unknown) => {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code.includes("invalid-credential")) return "The email or password is incorrect.";
  if (code.includes("permission-denied")) return "Database permissions rejected this action. Ask the administrator to check the database rules.";
  if (code.includes("email-already-in-use")) return "An account already exists for this email.";
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
};

function LoginScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try { await signInWithEmailAndPassword(auth, String(data.get("email")).trim(), String(data.get("password"))); }
    catch (caught) { setError(issueMessage(caught)); }
    finally { setBusy(false); }
  }
  async function reset(form: HTMLFormElement) {
    const email = String(new FormData(form).get("email")).trim();
    if (!email) { setError("Enter your email address first."); return; }
    try { await sendUserPasswordReset(email); setNotice("Password reset email sent."); setError(""); }
    catch (caught) { setError(issueMessage(caught)); }
  }
  return <main className="login-page"><section className="login-card">
    <div className="login-brand"><div className="brand-mark"><Headphones size={22} /></div><div><strong>Nexus</strong><span>IT Helpdesk</span></div></div>
    <div className="login-copy"><h1>Welcome back</h1><p>Sign in with your helpdesk account.</p></div>
    <form onSubmit={submit}>
      <label>Email address<input name="email" type="email" autoComplete="username" required autoFocus placeholder="name@company.com" /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required placeholder="Enter your password" /></label>
      <button type="button" className="forgot-link" onClick={(event) => reset(event.currentTarget.form!)}>Forgot password?</button>
      {error && <div className="auth-message error"><CircleAlert size={15} />{error}</div>}
      {notice && <div className="auth-message success"><Check size={15} />{notice}</div>}
      <button className="primary-btn login-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  </section></main>;
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState<"Dashboard" | "Tickets" | "Users">("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [selected, setSelected] = useState<TicketItem | null>(null);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("All priorities");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 4500); };

  useEffect(() => onAuthStateChanged(auth, (next) => {
    setUser(next); setProfile(null); setProfileLoading(!!next); setAuthLoading(false);
  }), []);
  useEffect(() => {
    if (!user) return;
    return onValue(ref(database, `users/${user.uid}`), (snapshot) => {
      setProfile(snapshot.exists() ? { id: user.uid, ...snapshot.val() } : null); setProfileLoading(false);
    }, (error) => { setProfile(null); setProfileLoading(false); setLoadError(issueMessage(error)); });
  }, [user]);
  useEffect(() => {
    if (!user || !profile || profile.status !== "Active") { setTickets([]); setTicketsLoading(false); return; }
    setTicketsLoading(true);
    const ticketQuery = profile.role === "Employee"
      ? query(ref(database, "tickets"), orderByChild("requesterId"), equalTo(user.uid))
      : ref(database, "tickets");
    return onValue(ticketQuery, (snapshot) => {
      const value = snapshot.val() || {};
      setTickets(Object.entries(value).map(([id, item]) => ({ ...item as Omit<TicketItem, "id">, id })).sort((a, b) => b.createdAt - a.createdAt));
      setTicketsLoading(false); setLoadError("");
    }, (error) => { setTicketsLoading(false); setLoadError(issueMessage(error)); });
  }, [user, profile?.id, profile?.role, profile?.status]);
  useEffect(() => {
    if (profile?.role !== "IT Admin") { setUsers([]); return; }
    return onValue(ref(database, "users"), (snapshot) => {
      setUsers(Object.entries(snapshot.val() || {}).map(([id, item]) => ({ ...item as Omit<Profile, "id">, id })));
    }, (error) => setLoadError(issueMessage(error)));
  }, [profile?.role]);

  const visibleTickets = useMemo(() => tickets.filter((ticket) =>
    (profile?.role !== "Employee" || ticket.requesterId === user?.uid) &&
    (priority === "All priorities" || ticket.priority === priority) &&
    (statusFilter === "All statuses" || ticket.status === statusFilter) &&
    `${ticket.subject} ${ticket.requester} ${ticket.category} ${ticket.id}`.toLowerCase().includes(search.toLowerCase())
  ), [tickets, profile?.role, user?.uid, search, priority, statusFilter]);
  const myTickets = profile?.role === "Employee" ? tickets.filter((item) => item.requesterId === user?.uid) : tickets;
  const count = (status: Status) => myTickets.filter((item) => item.status === status).length;
  const selectedLive = selected ? tickets.find((item) => item.id === selected.id) || selected : null;
  const technicians = users.filter((item) => canWorkTickets(item.role) && item.status === "Active");

  async function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !profile || busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const ticketRef = push(ref(database, "tickets"));
      await set(ticketRef, {
        subject: String(data.get("subject")).trim(), description: String(data.get("description")).trim(),
        category: String(data.get("category")), priority: String(data.get("priority")) as Priority,
        location: String(data.get("location")).trim(), impact: String(data.get("impact")),
        status: "Open", requesterId: user.uid, requester: profile.name, department: profile.department,
        technicianId: "", technician: "", createdAt: Date.now(), updatedAt: Date.now(),
      });
      setCreateOpen(false); setPage("Tickets"); notify("Ticket submitted.");
    } catch (error) { notify(issueMessage(error)); }
    finally { setBusy(false); }
  }
  async function changeTicket(fields: Partial<TicketItem>) {
    if (!selectedLive || !canWorkTickets(profile?.role)) return;
    try { await update(ref(database, `tickets/${selectedLive.id}`), { ...fields, updatedAt: Date.now() }); notify("Ticket updated."); }
    catch (error) { notify(issueMessage(error)); }
  }
  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLive || !profile || !canWorkTickets(profile.role)) return;
    const form = event.currentTarget;
    const value = String(new FormData(form).get("note")).trim();
    if (!value) return;
    try {
      const noteRef = push(ref(database, `tickets/${selectedLive.id}/updates`));
      await set(noteRef, { text: value, author: profile.name, createdAt: Date.now() });
      form.reset(); notify("Update added.");
    } catch (error) { notify(issueMessage(error)); }
  }
  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (profile?.role !== "IT Admin" || busy) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email")).trim();
    const uid = String(data.get("uid")).trim();
    if (users.some((person) => person.id === uid)) { notify("A helpdesk profile already exists for that UID."); return; }
    setBusy(true);
    try {
      await set(ref(database, `users/${uid}`), {
        name: String(data.get("name")).trim(), email, role: String(data.get("role")) as Role,
        department: String(data.get("department")).trim(), status: "Active", mustChangePassword: false,
        createdAt: Date.now()
      });
      setUserOpen(false); notify("Helpdesk profile linked to the Firebase account.");
    } catch (error) { notify(issueMessage(error)); }
    finally { setBusy(false); }
  }
  async function changeRole(person: Profile, role: Role) {
    if (person.id === user?.uid || profile?.role !== "IT Admin") return;
    try { await update(ref(database, `users/${person.id}`), { role }); notify("Role updated."); }
    catch (error) { notify(issueMessage(error)); }
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const password = String(new FormData(event.currentTarget).get("newPassword"));
    try { await updatePassword(user, password); await update(ref(database, `users/${user.uid}`), { mustChangePassword: false }); notify("Password updated."); }
    catch (error) { notify(issueMessage(error)); }
  }

  if (authLoading || profileLoading) return <div className="auth-loading">Loading helpdesk…</div>;
  if (!user) return <LoginScreen />;
  if (!profile) return <main className="access-denied"><CircleAlert size={28} /><h1>Account access is not configured</h1><p>{loadError || "Your account needs a helpdesk user profile. Ask an IT Administrator to add your account."}</p><button className="secondary-btn" onClick={() => signOut(auth)}>Sign out</button></main>;
  if (profile.status !== "Active") return <main className="access-denied"><CircleAlert size={28} /><h1>Account suspended</h1><p>Contact an IT Administrator to restore access.</p><button className="secondary-btn" onClick={() => signOut(auth)}>Sign out</button></main>;

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? "mobile-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Headphones size={21} /></div><div><strong>Nexus</strong><span>IT Helpdesk</span></div><button className="icon-btn close-mobile" onClick={() => setMenuOpen(false)}><X size={19}/></button></div>
      <nav className="sidebar-nav"><p className="nav-heading">Workspace</p>
        {(["Dashboard", "Tickets", ...(profile.role === "IT Admin" ? ["Users"] : [])] as Array<typeof page>).map((name) => {
          const Icon = name === "Dashboard" ? LayoutDashboard : name === "Tickets" ? Ticket : Users;
          return <button key={name} className={`nav-item ${page === name ? "active" : ""}`} onClick={() => { setPage(name); setMenuOpen(false); }}><Icon size={18}/>{name}</button>;
        })}
      </nav>
      <div className="sidebar-user"><div className="avatar avatar-navy">{initials(profile.name)}</div><div><strong>{profile.name}</strong><span>{profile.role}</span></div><button className="icon-btn" title="Sign out" aria-label="Sign out" onClick={() => signOut(auth)}><LogOut size={18}/></button></div>
    </aside>
    {menuOpen && <button className="sidebar-backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)}/>}
    <main className="main"><header className="topbar"><button className="icon-btn menu-btn" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu size={21}/></button><span className="header-title">Nexus IT Helpdesk</span><span className="header-account">{profile.email}</span></header>
      <div className="content">
        <div className="page-heading"><div><h1>{page === "Dashboard" ? `Welcome, ${profile.name.split(" ")[0]}` : page}</h1><p>{page === "Dashboard" ? "Your helpdesk at a glance." : page === "Tickets" ? "Track and manage support requests." : "Manage helpdesk accounts."}</p></div>
          <button className="primary-btn" onClick={() => page === "Users" ? setUserOpen(true) : setCreateOpen(true)}>{page === "Users" ? <UserPlus size={17}/> : <Plus size={17}/>} {page === "Users" ? "Link account" : "Create ticket"}</button>
        </div>
        {loadError && <div className="auth-message error workspace-error"><CircleAlert size={17}/>{loadError}</div>}
        {page === "Dashboard" && <>
          <section className="stats-grid">{[
            ["Open", count("Open"), "blue"], ["In progress", count("In Progress"), "violet"],
            ["Pending", count("Pending"), "amber"], ["Resolved", count("Resolved"), "green"]
          ].map(([label, value, tone]) => <article className="stat-card" key={label}><div className={`stat-icon ${tone}`}><Ticket size={19}/></div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong></article>)}</section>
          <section className="panel tickets-panel dashboard-tickets"><div className="panel-heading tickets-heading"><div><h2>Recent tickets</h2><p>Latest support requests</p></div><button className="text-btn" onClick={() => setPage("Tickets")}>View all</button></div>
            {ticketsLoading ? <div className="empty-state">Loading tickets…</div> : myTickets.length ? <div className="compact-ticket-list">{myTickets.slice(0, 5).map((item) => <button key={item.id} onClick={() => setSelected(item)}><span><strong>{item.subject}</strong><small>{item.requester} · {displayDate(item.createdAt)}</small></span><span className={`status ${item.status.toLowerCase().replace(/ /g, "-")}`}>{item.status}</span></button>)}</div> : <div className="empty-state"><strong>No tickets yet</strong><p>Create the first ticket to start tracking support requests.</p><button className="secondary-btn" onClick={() => setCreateOpen(true)}>Create ticket</button></div>}
          </section>
        </>}
        {page === "Tickets" && <section className="panel tickets-panel"><div className="panel-heading tickets-heading"><div><h2>{profile.role === "Employee" ? "My tickets" : "All tickets"}</h2><p>{visibleTickets.length} ticket{visibleTickets.length === 1 ? "" : "s"}</p></div></div>
          <div className="table-tools"><label className="table-search"><Search size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets" aria-label="Search tickets"/></label>
            <div className="filter-group"><label><Filter size={15}/><select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Filter priority"><option>All priorities</option>{priorities.map((p) => <option key={p}>{p}</option>)}</select><ChevronDown size={14}/></label>
              <label><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter status"><option>All statuses</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select><ChevronDown size={14}/></label></div>
          </div>
          {ticketsLoading ? <div className="empty-state">Loading tickets…</div> : !visibleTickets.length ? <div className="empty-state"><strong>{tickets.length ? "No matching tickets" : "No tickets yet"}</strong><p>{tickets.length ? "Try changing your search or filters." : "Create the first ticket to get started."}</p></div> : <div className="table-scroll"><table><thead><tr><th>Ticket</th><th>Requester</th><th>Priority</th><th>Status</th><th>Assigned to</th><th>Created</th></tr></thead><tbody>{visibleTickets.map((item) => <tr key={item.id} onClick={() => setSelected(item)}><td><button className="ticket-name"><strong>{item.subject}</strong><span>#{item.id.slice(-7)} · {item.category}</span></button></td><td>{item.requester}</td><td><span className={`badge ${item.priority.toLowerCase()}`}>{item.priority}</span></td><td><span className={`status ${item.status.toLowerCase().replace(/ /g, "-")}`}>{item.status}</span></td><td>{item.technician || "Unassigned"}</td><td>{displayDate(item.createdAt)}</td></tr>)}</tbody></table></div>}
        </section>}
        {page === "Users" && profile.role === "IT Admin" && <section className="panel users-panel"><div className="panel-heading users-heading"><div><h2>User directory</h2><p>{users.length} registered profile{users.length === 1 ? "" : "s"}</p></div></div><div className="table-scroll"><table className="users-table"><thead><tr><th>User</th><th>Role</th><th>Department</th><th>Status</th><th>Security</th></tr></thead><tbody>{users.map((person) => <tr key={person.id}><td><div className="person user-person"><div className="mini-avatar">{initials(person.name)}</div><div><strong>{person.name}</strong><span>{person.email}</span></div></div></td><td><select value={person.role} onChange={(e) => changeRole(person, e.target.value as Role)} disabled={person.id === user.uid} aria-label={`Role for ${person.name}`}><option>Employee</option><option>IT Technician</option><option>IT Admin</option><option>Management</option></select></td><td>{person.department}</td><td>{person.status}</td><td><button className="reset-btn" onClick={async () => { try { await sendUserPasswordReset(person.email); notify("Password reset email sent."); } catch (error) { notify(issueMessage(error)); } }}>Send reset email</button></td></tr>)}</tbody></table>{!users.length && <div className="empty-state">No user profiles found.</div>}</div></section>}
      </div>
    </main>
    {createOpen && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Create ticket"><button className="modal-backdrop" onClick={() => setCreateOpen(false)}/><form className="ticket-modal" onSubmit={createTicket}><div className="modal-heading"><div><h2>Create ticket</h2><p>Describe the issue so the IT team can help.</p></div><button type="button" className="icon-btn" onClick={() => setCreateOpen(false)}><X size={20}/></button></div><div className="form-body">
      <label className="full">Subject<input name="subject" required maxLength={160} autoFocus placeholder="Short summary of the issue"/></label><label className="full">Description<textarea name="description" required rows={4} placeholder="What happened, and how is it affecting your work?"/></label>
      <label>Category<select name="category" required defaultValue=""><option value="" disabled>Select category</option><option>Hardware</option><option>Software</option><option>Network</option><option>Access</option><option>Email</option><option>Other</option></select></label>
      <label>Priority<select name="priority" defaultValue="Medium">{priorities.map((p) => <option key={p}>{p}</option>)}</select></label>
      <label>Location<input name="location" placeholder="e.g. KK Office" required/></label><label>Business impact<select name="impact" defaultValue="Single User"><option>Single User</option><option>Multiple Users</option><option>Department</option><option>Entire Company</option></select></label>
    </div><div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setCreateOpen(false)}>Cancel</button><button className="primary-btn" disabled={busy}>Submit ticket</button></div></form></div>}
    {userOpen && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Link Firebase account"><button className="modal-backdrop" onClick={() => setUserOpen(false)}/><form className="ticket-modal" onSubmit={createUser}><div className="modal-heading"><div><h2>Link Firebase account</h2><p>First add the account in Firebase Authentication, then copy its User UID here.</p></div><button type="button" className="icon-btn" onClick={() => setUserOpen(false)}><X size={20}/></button></div><div className="form-body">
      <label className="full">Firebase User UID<input name="uid" required autoFocus placeholder="Paste the UID from Firebase Authentication"/></label><label>Full name<input name="name" required/></label><label>Work email<input name="email" type="email" required/></label><label>Role<select name="role">{(["Employee", "IT Technician", "IT Admin", "Management"] as Role[]).map((r) => <option key={r}>{r}</option>)}</select></label><label>Department<input name="department" required/></label>
    </div><div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setUserOpen(false)}>Cancel</button><button className="primary-btn" disabled={busy}>Link account</button></div></form></div>}
    {profile.mustChangePassword && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Change temporary password"><div className="modal-backdrop"/><form className="ticket-modal credential-modal password-change" onSubmit={changePassword}><div className="credential-icon"><ShieldCheck size={23}/></div><h2>Choose a new password</h2><p>Your temporary password must be changed before continuing.</p><label>New password<input name="newPassword" type="password" minLength={8} required autoFocus/></label><button className="primary-btn">Update password</button></form></div>}
    {selectedLive && <div className="drawer-layer"><button className="drawer-backdrop" onClick={() => setSelected(null)}/><aside className="ticket-drawer"><div className="drawer-head"><span>Ticket #{selectedLive.id.slice(-7)}</span><button className="icon-btn" onClick={() => setSelected(null)}><X size={20}/></button></div><div className="drawer-body"><h2>{selectedLive.subject}</h2><p className="ticket-description">{selectedLive.description}</p><div className="detail-grid"><div><span>Requester</span><strong>{selectedLive.requester}</strong></div><div><span>Created</span><strong>{displayDate(selectedLive.createdAt)}</strong></div><div><span>Department</span><strong>{selectedLive.department}</strong></div><div><span>Location</span><strong>{selectedLive.location}</strong></div><div><span>Category</span><strong>{selectedLive.category}</strong></div><div><span>Priority</span><strong>{selectedLive.priority}</strong></div><div><span>Business impact</span><strong>{selectedLive.impact}</strong></div></div>
      <div className="ticket-controls"><label>Status<select value={selectedLive.status} disabled={!canWorkTickets(profile.role)} onChange={(e) => changeTicket({ status: e.target.value as Status })}>{statuses.map((s) => <option key={s}>{s}</option>)}</select></label><label>Assigned to<select value={selectedLive.technicianId || ""} disabled={!canWorkTickets(profile.role) || profile.role !== "IT Admin"} onChange={(e) => { const person = technicians.find((item) => item.id === e.target.value); changeTicket({ technicianId: person?.id || "", technician: person?.name || "" }); }}><option value="">Unassigned</option>{technicians.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
      <h3>Updates</h3>{Object.entries(selectedLive.updates || {}).sort((a,b) => a[1].createdAt - b[1].createdAt).map(([id, note]) => <div className="ticket-note" key={id}><p>{note.text}</p><small>{note.author} · {displayDate(note.createdAt)}</small></div>)}{!selectedLive.updates && <p className="muted-cell">No updates yet.</p>}
      {canWorkTickets(profile.role) && <form className="ticket-note-form" onSubmit={addNote}><label>Update<textarea name="note" rows={3} required placeholder="Add a progress update"/></label><button className="primary-btn">Add note</button></form>}
      </div></aside></div>}
    {toast && <div className="toast" role="status"><Check size={17}/>{toast}</div>}
  </div>;
}

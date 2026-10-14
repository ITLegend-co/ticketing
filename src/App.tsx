import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword } from "firebase/auth";
import { equalTo, onValue, orderByChild, push, query, ref, remove, set, update } from "firebase/database";
import DriveAttachments from "./DriveAttachments";
import TicketPhotoPicker from "./TicketPhotoPicker";
import { driveReady, uploadPhoto, wakeTicketNotifications } from "./drive";
import { submitWithPhotos } from "./ticket-submission";
import { canUpdateTicket, isOperatorPath, isStaffRole, portalLink } from "./portal";
import { auth, database, generateTemporaryPassword, provisionUser, sendUserPasswordReset } from "./firebase";
import { Check, ChevronDown, CircleAlert, Clock3, Filter, Headphones, LayoutDashboard, LogOut, Menu, Plus, Search, ShieldCheck, Ticket, UserPlus, Users, X } from "lucide-react";

type Role = "Employee" | "IT Technician" | "IT Admin" | "Management";
type Status = "Open" | "In Progress" | "Pending" | "Resolved";
type Priority = "Unreviewed" | "Low" | "Medium" | "High" | "Critical";
type Profile = { id: string; name: string; email: string; role: Role; department: string; status: "Active" | "Suspended"; mustChangePassword?: boolean };
type TicketItem = {
  id: string; subject: string; description: string; category: string; priority: Priority; status: Status;
  location: string; impact: string; requesterId: string; requester: string; department: string;
  technicianId: string; technician: string; createdAt: number; updatedAt: number;
  reviewedAt?: number; reviewedBy?: string;
  updates?: Record<string, { text: string; author: string; createdAt: number }>;
};
const operatorPortal = isOperatorPath(window.location.pathname);
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
  if (code.includes("email-already-in-use")) return "An account already exists for this email. Use Link existing account if it needs a helpdesk profile.";
  if (code.includes("invalid-email")) return "Enter a valid work email address.";
  if (code.includes("weak-password") || code.includes("password-does-not-meet-requirements")) return "The temporary password does not meet the password requirements. Use a longer password with upper and lowercase letters, numbers, and a symbol.";
  if (code.includes("too-many-requests")) return "Too many attempts. Wait a moment before trying again.";
  if (code.includes("network-request-failed")) return "Check your internet connection and try again.";
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
    <div className="login-brand"><div className="brand-mark"><Headphones size={22} /></div><div><strong>Mountain Torq</strong><span>IT Helpdesk</span></div></div>
    <div className="login-copy"><h1>Welcome back</h1><p>{operatorPortal ? "Staff sign-in for IT operations." : "Sign in to submit and track your support requests."}</p></div>
    <form onSubmit={submit}>
      <label>Email address<input name="email" type="email" defaultValue={new URLSearchParams(window.location.search).get("email") || ""} autoComplete="username" required autoFocus placeholder="name@company.com" /></label>
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
  const ticketsReady = useRef(false);
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState<"Dashboard" | "Tickets" | "Users">(operatorPortal ? "Dashboard" : "Tickets");
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [ticketPhotos, setTicketPhotos] = useState<File[]>([]);
  const [createError, setCreateError] = useState("");
  const [submitProgress, setSubmitProgress] = useState("");
  const [photoWarning, setPhotoWarning] = useState<{ id: string; message: string } | null>(null);
  const ticketSubmitting = useRef(false);
  function closeCreate() {
    if (ticketSubmitting.current) return;
    setCreateOpen(false); setTicketPhotos([]); setCreateError("");
  }
  const [userOpen, setUserOpen] = useState(false);
  const [userMode, setUserMode] = useState<"create" | "link">("create");
  const [userError, setUserError] = useState("");
  const [userBusy, setUserBusy] = useState(false);
  const userSubmitting = useRef(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string; role: Role } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [selected, setSelected] = useState<TicketItem | null>(null);
  const [ticketDraft, setTicketDraft] = useState<Partial<TicketItem>>({});
  const [replyDraft, setReplyDraft] = useState("");
  useEffect(() => { setTicketDraft({}); setReplyDraft(""); }, [selected?.id]);
  function closeTicket() {
    if (noteSubmitting.current) return;
    if ((Object.keys(ticketDraft).length || replyDraft.trim()) && !window.confirm("Discard your unsent reply and ticket changes?")) return;
    setSelected(null);
  }
  const [linkedTicket, setLinkedTicket] = useState(() => new URLSearchParams(window.location.search).get("ticket"));
  const [linkError, setLinkError] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const noteSubmitting = useRef(false);
  const [deleteTarget, setDeleteTarget] = useState<TicketItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deletingTicket = useRef(false);
  const [deleteError, setDeleteError] = useState("");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("All priorities");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 4500); };

  useEffect(() => onAuthStateChanged(auth, (next) => {
    ticketsReady.current = false;
    setUser(next); setProfile(null); setProfileLoading(!!next); setAuthLoading(false);
    setCredentials(null); setUserOpen(false); setUserError("");
    setSelected(null); setLinkError("");
    setDeleteTarget(null); setDeleteError("");
    setCreateOpen(false); setTicketPhotos([]); setCreateError(""); setPhotoWarning(null);
  }), []);
  useEffect(() => {
    if (!user) return;
    return onValue(ref(database, `users/${user.uid}`), (snapshot) => {
      setProfile(snapshot.exists() ? { id: user.uid, ...snapshot.val() } : null); setProfileLoading(false);
    }, (error) => { setProfile(null); setProfileLoading(false); setLoadError(issueMessage(error)); });
  }, [user]);
  useEffect(() => {
    if (!user || !profile || profile.status !== "Active") { setTickets([]); setTicketsLoading(false); return; }
    ticketsReady.current = false;
    setTicketsLoading(true);
    if (operatorPortal && !isStaffRole(profile.role)) { setTickets([]); setTicketsLoading(false); return; }
    const ticketQuery = !operatorPortal || profile.role === "Employee"
      ? query(ref(database, "tickets"), orderByChild("requesterId"), equalTo(user.uid))
      : profile.role === "IT Technician"
        ? query(ref(database, "tickets"), orderByChild("technicianId"), equalTo(user.uid))
        : ref(database, "tickets");
    return onValue(ticketQuery, (snapshot) => {
      const value = snapshot.val() || {};
      setTickets(Object.entries(value).map(([id, item]) => ({ ...item as Omit<TicketItem, "id">, id })).sort((a, b) => b.createdAt - a.createdAt));
      ticketsReady.current = true;
      setTicketsLoading(false); setLoadError("");
    }, (error) => { setTicketsLoading(false); setLoadError(issueMessage(error)); });
  }, [user, profile?.id, profile?.role, profile?.status]);
  useEffect(() => {
    if (!operatorPortal || profile?.role !== "IT Admin") { setUsers([]); return; }
    return onValue(ref(database, "users"), (snapshot) => {
      setUsers(Object.entries(snapshot.val() || {}).map(([id, item]) => ({ ...item as Omit<Profile, "id">, id })));
    }, (error) => setLoadError(issueMessage(error)));
  }, [profile?.role]);

  useEffect(() => {
    if (!linkedTicket || !ticketsReady.current || ticketsLoading || !user || !profile || loadError) return;
    const ticket = tickets.find((item) => item.id === linkedTicket);
    if (ticket) { setSelected(ticket); setPage("Tickets"); setLinkError(""); }
    else setLinkError("This ticket is unavailable or you do not have access to it.");
    setLinkedTicket(null);
  }, [linkedTicket, ticketsLoading, tickets, user, profile, loadError]);

  const visibleTickets = useMemo(() => tickets.filter((ticket) =>
    (operatorPortal || ticket.requesterId === user?.uid) &&
    (priority === "All priorities" || ticket.priority === priority) &&
    (statusFilter === "All statuses" || ticket.status === statusFilter) &&
    `${ticket.subject} ${ticket.requester} ${ticket.category} ${ticket.id}`.toLowerCase().includes(search.toLowerCase())
  ), [tickets, profile?.role, user?.uid, search, priority, statusFilter]);
  const myTickets = !operatorPortal || profile?.role === "Employee" ? tickets.filter((item) => item.requesterId === user?.uid) : tickets;
  const count = (status: Status) => myTickets.filter((item) => item.status === status).length;
  const selectedLive = selected ? tickets.find((item) => item.id === selected.id) || selected : null;
  const technicians = users.filter((item) => canWorkTickets(item.role) && item.status === "Active");

  async function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !profile || busy || ticketSubmitting.current) return;
    const data = new FormData(event.currentTarget);
    ticketSubmitting.current = true;
    setBusy(true); setCreateError(""); setSubmitProgress("Submitting request…");
    try {
      const ticketRef = push(ref(database, "tickets"));
      const newTicket: Omit<TicketItem, "id"> = {
        subject: String(data.get("subject")).trim(), description: String(data.get("description")).trim(),
        category: String(data.get("category")), priority: "Unreviewed", reviewedAt: 0, reviewedBy: "",
        location: String(data.get("location")).trim(), impact: String(data.get("impact")),
        status: "Open", requesterId: user.uid, requester: profile.name, department: profile.department,
        technicianId: "", technician: "", createdAt: Date.now(), updatedAt: Date.now(),
      };
      const result = await submitWithPhotos(ticketPhotos, async () => {
        await set(ticketRef, newTicket);
        return { ...newTicket, id: ticketRef.key! };
      }, uploadPhoto, (index, total) => setSubmitProgress(`Uploading photo ${index} of ${total}…`));
      wakeTicketNotifications(result.ticket.id);
      setSelected(result.ticket);
      setPhotoWarning(result.incomplete.length ? {
        id: result.ticket.id,
        message: `Your request was saved, but photo uploads were interrupted: ${issueMessage(result.error)} Check the Photos list below before adding missing pictures (${result.incomplete.map((file) => file.name).join(", ")}). You do not need to submit another request.`,
      } : null);
      setTicketPhotos([]); setCreateOpen(false); setPage("Tickets"); notify("Request submitted for IT Admin review.");
    } catch (error) { setCreateError(issueMessage(error)); }
    finally { setBusy(false); setSubmitProgress(""); ticketSubmitting.current = false; }
  }
  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLive || !profile || !user || noteSubmitting.current || !(selectedLive.requesterId === user.uid || (operatorPortal && canUpdateTicket(profile.role, user.uid, selectedLive)))) return;
    const form = event.currentTarget;
    const value = replyDraft.trim();
    if (!value || value.length > 4000) return;
    const fields: Partial<TicketItem> = {};
    const canEdit = operatorPortal && canUpdateTicket(profile.role, user.uid, selectedLive);
    if (canEdit) {
      if (ticketDraft.status !== undefined) fields.status = ticketDraft.status;
      if (profile.role === "IT Admin" && (ticketDraft.priority !== undefined || ticketDraft.technicianId !== undefined)) {
        const priority = ticketDraft.priority ?? selectedLive.priority;
        const technician = technicians.find((person) => person.id === (ticketDraft.technicianId ?? selectedLive.technicianId));
        if (!priorities.includes(priority) || !technician) { notify("Choose a priority and an IT person before sending."); return; }
        Object.assign(fields, { priority, technicianId: technician.id, technician: technician.name, reviewedAt: Date.now(), reviewedBy: user.uid });
      }
      if (!selectedLive.reviewedAt && !fields.reviewedAt && fields.status && fields.status !== "Open") {
        notify("Choose a priority and an IT person before changing status."); return;
      }
      fields.updatedAt = Date.now();
    }
    noteSubmitting.current = true; setNoteBusy(true);
    try {
      const noteRef = push(ref(database, `tickets/${selectedLive.id}/updates`));
      await update(ref(database, `tickets/${selectedLive.id}`), {
        ...fields,
        [`updates/${noteRef.key}`]: { text: value, author: profile.name, authorId: user.uid, createdAt: Date.now() },
      });
      wakeTicketNotifications(selectedLive.id);
      form.reset(); setTicketDraft({}); setReplyDraft(""); notify("Reply and ticket changes saved. Email notification queued.");
    } catch (error) { notify(issueMessage(error)); }
    finally { noteSubmitting.current = false; setNoteBusy(false); }
  }
  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!operatorPortal || profile?.role !== "IT Admin" || userSubmitting.current) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email")).trim().toLowerCase();
    const input = {
      name: String(data.get("name")).trim(), email, role: String(data.get("role")) as Role,
      department: String(data.get("department")).trim(),
    };
    setUserError("");
    userSubmitting.current = true;
    setUserBusy(true);
    try {
      if (!input.name || !input.department) throw new Error("Enter a name and department.");
      if (userMode === "link") {
        const uid = String(data.get("uid")).trim();
        if (!uid || [...uid].some((character) => ".#$[]/".includes(character))) throw new Error("Paste a valid Firebase User UID.");
        if (users.some((person) => person.id === uid || person.email.toLowerCase() === email)) throw new Error("A helpdesk profile already exists for this account.");
        await set(ref(database, `users/${uid}`), { ...input, status: "Active", mustChangePassword: false, createdAt: Date.now() });
        setUserOpen(false); notify("Helpdesk profile linked to the Firebase account.");
      } else {
        const password = String(data.get("password") || "") || generateTemporaryPassword();
        await provisionUser(input, password);
        setUserOpen(false); setCopyFeedback(""); setCredentials({ email, password, role: input.role }); notify("User account created.");
      }
    } catch (error) { setUserError(issueMessage(error)); }
    finally { userSubmitting.current = false; setUserBusy(false); }
  }
  async function changeRole(person: Profile, role: Role) {
    if (person.id === user?.uid || profile?.role !== "IT Admin") return;
    try { await update(ref(database, `users/${person.id}`), { role }); notify("Role updated."); }
    catch (error) { notify(issueMessage(error)); }
  }
  async function deleteTicket() {
    if (!operatorPortal || profile?.role !== "IT Admin" || !deleteTarget || deletingTicket.current) return;
    deletingTicket.current = true;
    setDeleting(true); setDeleteError("");
    try {
      await remove(ref(database, `tickets/${deleteTarget.id}`));
      setSelected(null); setDeleteTarget(null); notify("Ticket submission deleted.");
    } catch (error) { setDeleteError(issueMessage(error)); }
    finally { deletingTicket.current = false; setDeleting(false); }
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

  if (operatorPortal && !isStaffRole(profile.role)) return <main className="access-denied"><ShieldCheck size={28}/><h1>Staff access only</h1><p>Use the request portal to submit and track your support requests.</p><a className="primary-btn" href={import.meta.env.BASE_URL}>Open request portal</a><button className="secondary-btn" onClick={() => signOut(auth)}>Sign out</button></main>;

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? "mobile-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Headphones size={21} /></div><div><strong>Mountain Torq</strong><span>IT Helpdesk</span></div><button className="icon-btn close-mobile" onClick={() => setMenuOpen(false)}><X size={19}/></button></div>
      <nav className="sidebar-nav"><p className="nav-heading">Workspace</p>
        {([... (operatorPortal ? ["Dashboard", "Tickets"] : ["Tickets"]), ...(operatorPortal && profile.role === "IT Admin" ? ["Users"] : [])] as Array<typeof page>).map((name) => {
          const Icon = name === "Dashboard" ? LayoutDashboard : name === "Tickets" ? Ticket : Users;
          return <button key={name} className={`nav-item ${page === name ? "active" : ""}`} onClick={() => { setPage(name); setMenuOpen(false); }}><Icon size={18}/>{!operatorPortal && name === "Tickets" ? "My requests" : name}</button>;
        })}
      </nav>
      <div className="sidebar-user"><div className="avatar avatar-navy">{initials(profile.name)}</div><div><strong>{profile.name}</strong><span>{profile.role}</span></div><button className="icon-btn" title="Sign out" aria-label="Sign out" onClick={() => signOut(auth)}><LogOut size={18}/></button></div>
    </aside>
    {menuOpen && <button className="sidebar-backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)}/>}
    <main className="main"><header className="topbar"><button className="icon-btn menu-btn" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu size={21}/></button><span className="header-title">Mountain Torq IT Helpdesk · {operatorPortal ? "Staff portal" : "Request portal"}</span><span className="header-account">{profile.email}</span></header>
      <div className="content">
        <div className="page-heading"><div><h1>{page === "Dashboard" ? `Welcome, ${profile.name.split(" ")[0]}` : !operatorPortal ? "My requests" : page}</h1><p>{page === "Dashboard" ? "Your helpdesk at a glance." : page === "Tickets" ? operatorPortal ? "Review and manage support requests." : "Submit a request and follow its progress." : "Manage helpdesk accounts."}</p></div>
          <button className="primary-btn" onClick={() => { if (page === "Users") { setUserMode("create"); setUserError(""); setUserOpen(true); } else setCreateOpen(true); }}>{page === "Users" ? <UserPlus size={17}/> : <Plus size={17}/>} {page === "Users" ? "Create user" : "Submit request"}</button>
        </div>
        {linkError && <div className="auth-message error workspace-error" role="alert">{linkError}</div>}
        {loadError && <div className="auth-message error workspace-error"><CircleAlert size={17}/>{loadError}</div>}
        {page === "Dashboard" && <>
          <section className="stats-grid">{[
            ["Awaiting review", myTickets.filter((item) => !item.reviewedAt).length, "blue"], ["In progress", count("In Progress"), "violet"],
            ["Pending", count("Pending"), "amber"], ["Resolved", count("Resolved"), "green"]
          ].map(([label, value, tone]) => <article className="stat-card" key={label}><div className={`stat-icon ${tone}`}><Ticket size={19}/></div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong></article>)}</section>
          <section className="panel tickets-panel dashboard-tickets"><div className="panel-heading tickets-heading"><div><h2>Recent tickets</h2><p>Latest support requests</p></div><button className="text-btn" onClick={() => setPage("Tickets")}>View all</button></div>
            {ticketsLoading ? <div className="empty-state">Loading tickets…</div> : myTickets.length ? <div className="compact-ticket-list">{myTickets.slice(0, 5).map((item) => <button key={item.id} onClick={() => setSelected(item)}><span><strong>{item.subject}</strong><small>{item.requester} · {displayDate(item.createdAt)}</small></span><span className={`status ${item.status.toLowerCase().replace(/ /g, "-")}`}>{item.status}</span></button>)}</div> : <div className="empty-state"><strong>No tickets yet</strong><p>Create the first ticket to start tracking support requests.</p><button className="secondary-btn" onClick={() => setCreateOpen(true)}>Create ticket</button></div>}
          </section>
        </>}
        {page === "Tickets" && <section className="panel tickets-panel"><div className="panel-heading tickets-heading"><div><h2>{!operatorPortal ? "My requests" : "Request queue"}</h2><p>{visibleTickets.length} ticket{visibleTickets.length === 1 ? "" : "s"}</p></div></div>
          <div className="table-tools"><label className="table-search"><Search size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets" aria-label="Search tickets"/></label>
            <div className="filter-group"><label><Filter size={15}/><select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Filter priority"><option>All priorities</option>{["Unreviewed", ...priorities].map((p) => <option key={p}>{p}</option>)}</select><ChevronDown size={14}/></label>
              <label><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter status"><option>All statuses</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select><ChevronDown size={14}/></label></div>
          </div>
          {ticketsLoading ? <div className="empty-state">Loading tickets…</div> : !visibleTickets.length ? <div className="empty-state"><strong>{tickets.length ? "No matching tickets" : "No tickets yet"}</strong><p>{tickets.length ? "Try changing your search or filters." : "Create the first ticket to get started."}</p></div> : <div className="table-scroll"><table><thead><tr><th>Ticket</th><th>Requester</th><th>Priority</th><th>Status</th><th>Assigned to</th><th>Created</th></tr></thead><tbody>{visibleTickets.map((item) => <tr key={item.id} onClick={() => setSelected(item)}><td><button className="ticket-name"><strong>{item.subject}</strong><span>#{item.id.slice(-7)} · {item.category}</span></button></td><td>{item.requester}</td><td><span className={`badge ${item.reviewedAt ? item.priority.toLowerCase() : "unreviewed"}`}>{item.reviewedAt ? item.priority : "Awaiting review"}</span></td><td><span className={`status ${item.status.toLowerCase().replace(/ /g, "-")}`}>{item.status}</span></td><td>{item.technician || "Unassigned"}</td><td>{displayDate(item.createdAt)}</td></tr>)}</tbody></table></div>}
        </section>}
        {page === "Users" && profile.role === "IT Admin" && <section className="panel users-panel"><div className="panel-heading users-heading"><div><h2>User directory</h2><p>{users.length} registered profile{users.length === 1 ? "" : "s"}</p></div><button className="text-btn" onClick={() => { setUserMode("link"); setUserError(""); setUserOpen(true); }}>Link existing account</button></div><div className="table-scroll"><table className="users-table"><thead><tr><th>User</th><th>Role</th><th>Department</th><th>Status</th><th>Security</th></tr></thead><tbody>{users.map((person) => <tr key={person.id}><td><div className="person user-person"><div className="mini-avatar">{initials(person.name)}</div><div><strong>{person.name}</strong><span>{person.email}</span></div></div></td><td><select value={person.role} onChange={(e) => changeRole(person, e.target.value as Role)} disabled={person.id === user.uid} aria-label={`Role for ${person.name}`}><option>Employee</option><option>IT Technician</option><option>IT Admin</option><option>Management</option></select></td><td>{person.department}</td><td>{person.status}</td><td><button className="reset-btn" onClick={async () => { try { await navigator.clipboard.writeText(portalLink(import.meta.env.BASE_URL, window.location.origin, person.role, person.email)); notify("Login link copied."); } catch { notify("Copy unavailable. Please try another browser."); } }}>Copy login link</button><button className="reset-btn" onClick={async () => { try { await sendUserPasswordReset(person.email); notify("Password reset email sent."); } catch (error) { notify(issueMessage(error)); } }}>Send reset email</button></td></tr>)}</tbody></table>{!users.length && <div className="empty-state">No user profiles found.</div>}</div></section>}
      </div>
    </main>
    {createOpen && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Submit request"><button className="modal-backdrop" aria-label="Close request form" disabled={busy} onClick={closeCreate}/><form className="ticket-modal" onSubmit={createTicket}><div className="modal-heading"><div><h2>Submit support request</h2><p>Describe the issue so the IT team can help.</p></div><button type="button" className="icon-btn" aria-label="Close request form" disabled={busy} onClick={closeCreate}><X size={20}/></button></div><fieldset className="form-body" disabled={busy}>
      <label className="full">Subject<input name="subject" required maxLength={160} autoFocus placeholder="Short summary of the issue"/></label><label className="full">Description<textarea name="description" required rows={4} placeholder="What happened, and how is it affecting your work?"/></label>
      <label>Category<select name="category" required defaultValue=""><option value="" disabled>Select category</option><option>Hardware</option><option>Software</option><option>Network</option><option>Access</option><option>Email</option><option>Other</option></select></label>
      <div className="request-review-info full">IT Admin will review your request, determine its priority, and assign an IT person.</div>
      <label>Location<input name="location" placeholder="e.g. KK Office" required/></label><label>Business impact<select name="impact" defaultValue="Single User"><option>Single User</option><option>Multiple Users</option><option>Department</option><option>Entire Company</option></select></label>
      {driveReady && <TicketPhotoPicker files={ticketPhotos} onChange={setTicketPhotos} disabled={busy}/>}
      {createError && <div className="auth-message error full" role="alert">{createError}</div>}
      {busy && <div className="submission-progress full" role="status">{submitProgress} Please keep this page open.</div>}
    </fieldset><div className="modal-actions"><button type="button" className="secondary-btn" disabled={busy} onClick={closeCreate}>Cancel</button><button className="primary-btn" disabled={busy}>{busy ? submitProgress : "Submit request"}</button></div></form></div>}
    {userOpen && profile.role === "IT Admin" && <div className="modal-layer" role="dialog" aria-modal="true" aria-label={userMode === "create" ? "Create user" : "Link existing account"}>
      <button className="modal-backdrop" aria-label="Close user form" disabled={userBusy} onClick={() => setUserOpen(false)}/>
      <form className="ticket-modal" onSubmit={createUser}>
        <div className="modal-heading"><div><h2>{userMode === "create" ? "Create user" : "Link existing account"}</h2><p>{userMode === "create" ? "Create a login and assign helpdesk access." : "Add a helpdesk profile for an account already in Firebase Authentication."}</p></div><button type="button" className="icon-btn" aria-label="Close user form" disabled={userBusy} onClick={() => setUserOpen(false)}><X size={20}/></button></div>
        <fieldset className="form-body user-form-fields" disabled={userBusy}>
          {userMode === "link" && <label className="full">Firebase User UID<input name="uid" required autoFocus placeholder="Paste the UID from Firebase Authentication"/></label>}
          <label>Full name<input name="name" required autoFocus={userMode === "create"} maxLength={120} autoComplete="off"/></label>
          <label>Work email<input name="email" type="email" required autoComplete="off"/></label>
          <label>Role<select name="role" defaultValue="Employee">{(["Employee", "IT Technician", "IT Admin", "Management"] as Role[]).map((role) => <option key={role}>{role}</option>)}</select></label>
          <label>Department<input name="department" required maxLength={120} placeholder="e.g. Operations"/></label>
          {userMode === "create" && <label className="full">Temporary password<input name="password" type="password" minLength={8} autoComplete="new-password" placeholder="Leave blank to generate a password"/><small>At least 8 characters. The user will be asked to choose a new password on first sign-in.</small></label>}
          {userError && <div className="auth-message error full user-form-message" role="alert"><CircleAlert size={16}/>{userError}</div>}
        </fieldset>
        <div className="modal-actions"><button type="button" className="secondary-btn" disabled={userBusy} onClick={() => setUserOpen(false)}>Cancel</button><button className="primary-btn" disabled={userBusy}>{userBusy ? "Saving…" : userMode === "create" ? "Create user" : "Link account"}</button></div>
      </form>
    </div>}
    {credentials && profile.role === "IT Admin" && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="User account created">
      <div className="modal-backdrop"/>
      <div className="ticket-modal credential-modal">
        <div className="credential-icon"><Check size={23}/></div><h2>User account created</h2><p>{credentials.email} can now sign in. Copy the link and share it together with the temporary password.</p>
        <div className="credential-field"><div><span>Temporary password</span><strong>{credentials.password}</strong></div><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(credentials.password); setCopyFeedback("Password copied."); } catch { setCopyFeedback("Copy unavailable. Select and copy the password manually."); } }}>Copy</button></div>
        <div className="credential-field login-link-field"><div><span>Login link</span><strong>{portalLink(import.meta.env.BASE_URL, window.location.origin, credentials.role, credentials.email)}</strong></div><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(portalLink(import.meta.env.BASE_URL, window.location.origin, credentials.role, credentials.email)); setCopyFeedback("Login link copied."); } catch { setCopyFeedback("Select and copy the link manually."); } }}>Copy link</button></div>
        <p className="credential-warning">This password is shown only here. Copy it before closing.</p><p role="status">{copyFeedback}</p>
        <div className="credential-actions"><button className="primary-btn" onClick={() => setCredentials(null)}>Done</button></div>
      </div>
    </div>}
    {profile.mustChangePassword && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Change temporary password"><div className="modal-backdrop"/><form className="ticket-modal credential-modal password-change" onSubmit={changePassword}><div className="credential-icon"><ShieldCheck size={23}/></div><h2>Choose a new password</h2><p>Your temporary password must be changed before continuing.</p><label>New password<input name="newPassword" type="password" minLength={8} required autoFocus/></label><button className="primary-btn">Update password</button></form></div>}
    {selectedLive && <div className="drawer-layer"><button className="drawer-backdrop" onClick={closeTicket}/><aside className="ticket-drawer"><div className="drawer-head"><span>Ticket #{selectedLive.id.slice(-7)}</span><button className="icon-btn" onClick={closeTicket}><X size={20}/></button></div><div className="drawer-body"><h2>{selectedLive.subject}</h2><p className="ticket-description">{selectedLive.description}</p><div className="detail-grid"><div><span>Requester</span><strong>{selectedLive.requester}</strong></div><div><span>Created</span><strong>{displayDate(selectedLive.createdAt)}</strong></div><div><span>Department</span><strong>{selectedLive.department}</strong></div><div><span>Location</span><strong>{selectedLive.location}</strong></div><div><span>Category</span><strong>{selectedLive.category}</strong></div><div><span>Priority</span><strong>{selectedLive.reviewedAt ? selectedLive.priority : "Awaiting review"}</strong></div><div><span>Business impact</span><strong>{selectedLive.impact}</strong></div></div>
      <div className="request-review-info">{selectedLive.reviewedAt ? `Reviewed · ${selectedLive.priority} priority · Assigned to ${selectedLive.technician}` : "Awaiting IT Admin review. Priority and assignment have not been set."}</div>
      {operatorPortal && profile.role === "IT Admin" && <div className="admin-review-form">
        <h3>{selectedLive.reviewedAt ? "Update priority and assignment" : "Review request"}</h3>
        <label>1. Determine priority<select name="reviewPriority" disabled={noteBusy} value={ticketDraft.priority ?? (selectedLive.reviewedAt ? selectedLive.priority : "")} onChange={(e) => setTicketDraft((draft) => ({ ...draft, priority: e.target.value as Priority }))}><option value="" disabled>Select priority</option>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
        <label>2. Assign IT person<select name="technician" disabled={noteBusy} value={ticketDraft.technicianId ?? selectedLive.technicianId ?? ""} onChange={(e) => setTicketDraft((draft) => ({ ...draft, technicianId: e.target.value }))}><option value="" disabled>Select IT person</option>{technicians.map((person) => <option key={person.id} value={person.id}>{person.name}{person.id === user.uid ? " (myself)" : ""}</option>)}</select></label>
      </div>}
      <div className="ticket-controls"><label>Status<select value={ticketDraft.status ?? selectedLive.status} disabled={noteBusy || !operatorPortal || !canUpdateTicket(profile.role, user.uid, selectedLive)} onChange={(e) => setTicketDraft((draft) => ({ ...draft, status: e.target.value as Status }))}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label></div>
      {operatorPortal && canUpdateTicket(profile.role, user.uid, selectedLive) && <p className="request-review-info" role="status">{Object.keys(ticketDraft).length ? "Unsent changes. " : ""}Status, priority, and assignment are saved and included in the email when you click Send reply.</p>}
      {photoWarning?.id === selectedLive.id && <div className="auth-message error attachment-warning" role="alert">{photoWarning.message}</div>}
      <DriveAttachments key={selectedLive.id} ticketId={selectedLive.id} canUpload={selectedLive.requesterId === user.uid || profile.role === "IT Admin" || (operatorPortal && canUpdateTicket(profile.role, user.uid, selectedLive))}/>
      <h3>Updates</h3>{Object.entries(selectedLive.updates || {}).sort((a,b) => a[1].createdAt - b[1].createdAt).map(([id, note]) => <div className="ticket-note" key={id}><p>{note.text}</p><small>{note.author} · {displayDate(note.createdAt)}</small></div>)}{!selectedLive.updates && <p className="muted-cell">No updates yet.</p>}
      {(selectedLive.requesterId === user.uid || (operatorPortal && canUpdateTicket(profile.role, user.uid, selectedLive))) && <form className="ticket-note-form" onSubmit={addNote}><label>Reply / update<textarea name="note" value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} rows={3} required maxLength={4000} disabled={noteBusy} placeholder="Add a reply or progress update"/></label><button className="primary-btn" disabled={noteBusy}>{noteBusy ? "Sending…" : "Send reply"}</button></form>}
      {operatorPortal && profile.role === "IT Admin" && <div className="ticket-delete-section"><button type="button" className="danger-btn" onClick={() => { setDeleteError(""); setDeleteTarget(selectedLive); }}>Delete ticket</button></div>}
      </div></aside></div>}
    {deleteTarget && operatorPortal && profile.role === "IT Admin" && <div className="modal-layer" role="alertdialog" aria-modal="true" aria-labelledby="delete-ticket-title" aria-describedby="delete-ticket-description">
      <button className="modal-backdrop" aria-label="Cancel deletion" disabled={deleting} onClick={() => setDeleteTarget(null)}/>
      <div className="ticket-modal delete-ticket-modal"><div className="modal-heading"><h2 id="delete-ticket-title">Delete this ticket?</h2></div><div className="delete-ticket-copy">
        <strong>{deleteTarget.subject}</strong><p id="delete-ticket-description">This permanently removes the submission and all its updates. It cannot be undone. Uploaded photos stay in your Google Drive archive.</p>
        {deleteError && <div className="auth-message error" role="alert">{deleteError}</div>}
      </div><div className="modal-actions"><button type="button" className="secondary-btn" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</button><button type="button" className="danger-btn" disabled={deleting} onClick={deleteTicket}>{deleting ? "Deleting…" : "Delete permanently"}</button></div></div>
    </div>}
    {toast && <div className="toast" role="status"><Check size={17}/>{toast}</div>}
  </div>;
}

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import {
  adminClient,
  AdminRequestError,
  getAdminAccess,
  getAdminFeedback,
  getAdminOverview,
  setTicketStatus,
  type AdminOverview,
  type AdminTicket,
} from './api';
import {
  feedbackCategories,
  feedbackStatuses,
  type FeedbackStatus,
} from '../src/domain/feedback';
import './portal.css';

type Phase = 'loading' | 'signed-out' | 'denied' | 'mfa' | 'ready' | 'error';
type Factor = { id: string; friendly_name?: string };
function Brand() {
  return (
    <div className="brand" aria-label="Pulse by Science By Hugs">
      <strong>
        pulse<span>.</span>
      </strong>
      <small>by Science By Hugs</small>
    </div>
  );
}
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="notice">
      {children}
    </div>
  );
}
function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [create, setCreate] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const sending = useRef(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending.current) return;
    setNotice('');
    sending.current = true;
    setBusy(true);
    try {
      if (create) {
        if (
          email.trim().toLowerCase() !== 'admin@sciencebyhugs.com' ||
          !eligible ||
          password.length < 12 ||
          password !== confirmation
        ) {
          setNotice(
            'Use your dedicated admin email, confirm eligibility, and choose matching passwords of at least 12 characters.',
          );
          return;
        }
        const { data, error } = await adminClient.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: 'pulse://auth/callback',
            data: {
              eligibility_confirmation: {
                age18Plus: true,
                usResident: true,
                confirmedAt: new Date().toISOString(),
              },
            },
          },
        });
        if (error) {
          setNotice(
            'Could not create this sign-in. Try signing in if it already exists, or contact support.',
          );
          return;
        }
        if (data.session) {
          await adminClient.auth.signOut({ scope: 'local' });
          setNotice(
            'Email verification must be enabled before admin setup can continue. Contact support.',
          );
          return;
        }
        setPassword('');
        setConfirmation('');
        setCreate(false);
        setNotice(
          'Check the verification email, open its link in Pulse, then return here to sign in. The account also needs administrator activation before it can view this dashboard.',
        );
      } else {
        const { error } = await adminClient.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error)
          setNotice(
            'Could not sign in. Check your email, password and email verification.',
          );
        else setPassword('');
      }
    } catch {
      setNotice('Could not connect. Check your connection and try again.');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="auth-card">
      <p className="eyebrow">PRIVATE ADMINISTRATION</p>
      <h1>{create ? 'Create your admin sign-in' : 'Sign in to Pulse Admin'}</h1>
      <p className="muted">
        Account totals and submitted feedback. Tracking records are outside this
        dashboard.
      </p>
      {notice && <Notice>{notice}</Notice>}
      <form onSubmit={submit}>
        <label>
          Email address
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          {create ? 'Choose a password' : 'Password'}
          <input
            type="password"
            required
            minLength={create ? 12 : 1}
            autoComplete={create ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
        </label>
        {create && (
          <>
            <label>
              Confirm password
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={eligible}
                onChange={(e) => setEligible(e.target.checked)}
                disabled={busy}
              />
              I am 18 or older and reside in the United States.
            </label>
          </>
        )}
        <button className="primary" disabled={busy || (create && !eligible)}>
          {busy ? 'Please wait…' : create ? 'Create sign-in' : 'Sign in'}
        </button>
      </form>
      <button
        className="text-button"
        disabled={busy}
        onClick={() => {
          setCreate(!create);
          setNotice('');
          setPassword('');
          setConfirmation('');
        }}
      >
        {create ? 'Back to sign in' : 'Set up the new admin login'}
      </button>
      <p className="footnote">
        Administrator access is assigned separately and requires an
        authenticator code. Creating a sign-in does not grant access.
      </p>
    </section>
  );
}
function Authenticator({ onVerified }: { onVerified: () => void }) {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [pending, setPending] = useState<Factor[]>([]);
  const [factor, setFactor] = useState('');
  const [enrollment, setEnrollment] = useState<{
    id: string;
    qr: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const sending = useRef(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await adminClient.auth.mfa.listFactors();
      if (error) throw error;
      const verified = data.totp.filter((f) => f.status === 'verified');
      setFactors(verified);
      setFactor((value) =>
        verified.some((f) => f.id === value) ? value : (verified[0]?.id ?? ''),
      );
      setPending(
        data.all.filter(
          (f) =>
            f.factor_type === 'totp' &&
            f.status === 'unverified' &&
            f.friendly_name === 'Pulse Admin',
        ),
      );
    } catch {
      setNotice(
        'Authenticator settings could not load. Retry before continuing.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function enroll() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setNotice('');
    try {
      const { data, error } = await adminClient.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Pulse Admin',
      });
      if (error) throw error;
      setEnrollment({
        id: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
      });
      setCode('');
    } catch {
      setNotice(
        'Setup could not start. Refresh to check for an unfinished setup before trying again.',
      );
      void load();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function verify(e: FormEvent) {
    e.preventDefault();
    if (sending.current || !/^\d{6}$/.test(code)) return;
    sending.current = true;
    setBusy(true);
    setNotice('');
    try {
      const { error } = await adminClient.auth.mfa.challengeAndVerify({
        factorId: enrollment?.id ?? factor,
        code,
      });
      if (error) throw error;
      setCode('');
      setEnrollment(null);
      onVerified();
    } catch {
      setCode('');
      setNotice(
        'That code could not be verified. Use a current code from your authenticator and try again.',
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function removeUnfinished(id: string) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setNotice('');
    try {
      const { error } = await adminClient.auth.mfa.unenroll({ factorId: id });
      if (error) throw error;
      if (enrollment?.id === id) setEnrollment(null);
      setCode('');
      await load();
    } catch {
      setNotice(
        'The unfinished setup could not be removed. Refresh and try again.',
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="auth-card">
      <p className="eyebrow">SECOND STEP</p>
      <h1>
        {factors.length
          ? 'Verify your admin sign-in'
          : 'Set up your authenticator'}
      </h1>
      <p className="muted">
        Your account is approved. An authenticator code is required before any
        totals or feedback can load.
      </p>
      {notice && <Notice>{notice}</Notice>}
      {loading ? (
        <p>Loading authenticator settings…</p>
      ) : enrollment ? (
        <>
          <p>
            Scan this code in your authenticator app, then enter its six-digit
            code.
          </p>
          <img
            className="qr"
            src={enrollment.qr}
            alt="Authenticator enrollment QR code"
          />
          <details>
            <summary>Enter a setup key instead</summary>
            <code className="setup-key">{enrollment.secret}</code>
          </details>
        </>
      ) : factors.length === 0 ? (
        <>
          {pending.length > 0 ? (
            <>
              <p>
                An unfinished setup exists. Remove it to start again; verified
                authenticators are unchanged.
              </p>
              {pending.map((f) => (
                <button
                  key={f.id}
                  disabled={busy}
                  onClick={() => void removeUnfinished(f.id)}
                >
                  Remove unfinished setup
                </button>
              ))}
            </>
          ) : (
            <button
              className="primary"
              disabled={busy}
              onClick={() => void enroll()}
            >
              Set up authenticator
            </button>
          )}
        </>
      ) : null}
      {!loading && (factors.length > 0 || enrollment) && (
        <form onSubmit={verify}>
          {!enrollment && factors.length > 1 && (
            <label>
              Authenticator
              <select
                value={factor}
                onChange={(e) => setFactor(e.target.value)}
                disabled={busy}
              >
                {factors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.friendly_name ?? 'Authenticator'}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Six-digit code
            <input
              aria-label="Six-digit authenticator code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
              disabled={busy}
            />
          </label>
          <button className="primary" disabled={busy || code.length !== 6}>
            {busy ? 'Verifying…' : 'Verify & open dashboard'}
          </button>
        </form>
      )}
      {enrollment && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void removeUnfinished(enrollment.id)}
        >
          Cancel this setup
        </button>
      )}
      <button
        className="text-button"
        disabled={busy || loading}
        onClick={() => void load()}
      >
        Refresh authenticator settings
      </button>
    </section>
  );
}
function Overview({ data }: { data: AdminOverview }) {
  const max = Math.max(1, ...data.signup_days.map((d) => d.count));
  return (
    <>
      <div className="metrics">
        {[
          { label: 'Verified users', value: data.verified_users },
          { label: 'New · 7 days', value: data.new_verified_7_days },
          { label: 'Pending confirmation', value: data.pending_confirmation },
          { label: 'Open feedback', value: data.open_feedback },
        ].map((tile) => (
          <section className="metric" key={tile.label}>
            <h2>{tile.label}</h2>
            <strong>{tile.value.toLocaleString()}</strong>
          </section>
        ))}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">GROWTH</p>
            <h2>Verified signups · last 30 days</h2>
          </div>
          <strong>{data.new_verified_30_days.toLocaleString()}</strong>
        </div>
        <div
          className="chart"
          role="img"
          aria-label={`${data.new_verified_30_days} verified accounts created in the last 30 days`}
        >
          {data.signup_days.map((d) => (
            <div
              key={d.day}
              className="bar-wrap"
              title={`${d.day}: ${d.count} signups`}
            >
              <div
                className="bar"
                style={{
                  height: `${Math.max(2, (d.count / max) * 100)}%`,
                  opacity: d.count ? 1 : 0.25,
                }}
              />
            </div>
          ))}
        </div>
        <p className="muted">
          {data.registered_users.toLocaleString()} registered accounts in total.
          Admin and explicitly marked demo/test accounts are excluded. Dates use
          UTC. Counts reflect currently registered accounts; deleted accounts
          disappear. These are signup counts, not activity or health metrics.
        </p>
        <details>
          <summary>View daily counts</summary>
          <table>
            <thead>
              <tr>
                <th>Date (UTC)</th>
                <th>Verified signups</th>
              </tr>
            </thead>
            <tbody>
              {data.signup_days.map((d) => (
                <tr key={d.day}>
                  <td>{d.day}</td>
                  <td>{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
      <p className="footnote">
        Updated {new Date(data.generated_at).toLocaleString()} ·{' '}
        {data.received_feedback} feedback tickets awaiting review.
      </p>
    </>
  );
}
function Ticket({
  ticket,
  onSave,
  busy,
}: {
  ticket: AdminTicket;
  onSave: (ticket: AdminTicket, status: FeedbackStatus) => void;
  busy: boolean;
}) {
  const [status, setStatus] = useState(ticket.status);
  useEffect(() => setStatus(ticket.status), [ticket.status]);
  return (
    <article className="panel ticket">
      <div className="ticket-top">
        <h2>
          {feedbackCategories.find((c) => c.value === ticket.category)?.label ??
            'Feedback'}{' '}
          <small>#{ticket.id.slice(0, 8)}</small>
        </h2>
        <span className="badge">
          {feedbackStatuses.find((s) => s.value === ticket.status)?.label}
        </span>
      </div>
      <p className="message">{ticket.message}</p>
      <p className="footnote">
        Pulse {ticket.app_version} ({ticket.build_number}) · {ticket.platform} ·{' '}
        {new Date(ticket.created_at).toLocaleString()}
      </p>
      {ticket.contact_email ? (
        <p className="contact">
          Follow-up permitted: <span>{ticket.contact_email}</span>
        </p>
      ) : (
        <p className="footnote">No reply contact shared.</p>
      )}
      <div className="status-controls">
        <label>
          Status
          <select
            aria-label={`Status for ticket ${ticket.id.slice(0, 8)}`}
            value={status}
            disabled={busy}
            onChange={(e) => setStatus(e.target.value as FeedbackStatus)}
          >
            {feedbackStatuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={busy || status === ticket.status}
          onClick={() => onSave(ticket, status)}
        >
          {busy ? 'Saving…' : 'Save status'}
        </button>
      </div>
    </article>
  );
}
function Portal() {
  const [session, setSession] = useState<Session | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [notice, setNotice] = useState('');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [next, setNext] = useState<AdminTicket | null>(null);
  const [section, setSection] = useState<'overview' | 'feedback'>('overview');
  const [filter, setFilter] = useState<FeedbackStatus | ''>('');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const explicitSignOut = useRef(false);
  const owner = useRef<string | null>(null);
  const version = useRef(0);
  const writing = useRef(false);
  const clearData = useCallback(() => {
    setOverview(null);
    setTickets([]);
    setNext(null);
  }, []);
  useEffect(() => {
    let active = true;
    void adminClient.auth.getSession().then(({ data, error }) => {
      if (active && !explicitSignOut.current) {
        if (error) {
          setPhase('error');
          setNotice('Your sign-in could not load. Refresh this page.');
        }
        setSession(data.session);
      }
    });
    const { data } = adminClient.auth.onAuthStateChange((event, value) => {
      if (event === 'SIGNED_IN') explicitSignOut.current = false;
      if (active && !explicitSignOut.current) {
        owner.current = value?.user.id ?? null;
        version.current++;
        clearData();
        setPhase(value ? 'loading' : 'signed-out');
        setSession(value);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [clearData]);
  const verifyAccess = useCallback(async () => {
    const uid = session?.user.id;
    owner.current = uid ?? null;
    const request = ++version.current;
    clearData();
    setNotice('');
    if (!uid) {
      setPhase('signed-out');
      return;
    }
    setPhase('loading');
    try {
      const { data, error } = await adminClient.auth.getUser();
      if (error || !data.user?.email_confirmed_at || data.user.id !== uid)
        throw new Error();
      const access = await getAdminAccess();
      if (owner.current !== uid || request !== version.current) return;
      setPhase(!access.member ? 'denied' : access.authorized ? 'ready' : 'mfa');
    } catch {
      if (owner.current === uid && request === version.current) {
        setPhase('error');
        setNotice(
          'Admin access could not be verified. Check your connection and retry.',
        );
      }
    }
  }, [session?.user.id, session?.access_token, clearData]);
  useEffect(() => {
    void verifyAccess();
  }, [verifyAccess]);
  const load = useCallback(
    async (more?: AdminTicket) => {
      if (phase !== 'ready' || !session) return;
      const uid = session.user.id,
        request = ++version.current;
      setLoading(true);
      setNotice('');
      try {
        const [counts, page] = await Promise.all([
          getAdminOverview(),
          getAdminFeedback(filter, more),
        ]);
        if (owner.current !== uid || request !== version.current) return;
        setOverview(counts);
        setTickets((rows) =>
          more
            ? [
                ...rows,
                ...page.rows.filter(
                  (t) => !rows.some((row) => row.id === t.id),
                ),
              ]
            : page.rows,
        );
        setNext(page.next);
      } catch (e) {
        if (owner.current !== uid || request !== version.current) return;
        setNotice(
          e instanceof Error ? e.message : 'Could not load the dashboard.',
        );
        if (e instanceof AdminRequestError && e.needsVerification) {
          clearData();
          void verifyAccess();
        }
      } finally {
        if (owner.current === uid && request === version.current)
          setLoading(false);
      }
    },
    [phase, session?.user.id, filter, clearData, verifyAccess],
  );
  useEffect(() => {
    if (phase === 'ready') void load();
  }, [load, phase]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible' && phase === 'ready')
        void load();
    };
    document.addEventListener('visibilitychange', refresh);
    const timer = setInterval(refresh, 60000);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      clearInterval(timer);
    };
  }, [load, phase]);
  async function save(ticket: AdminTicket, status: FeedbackStatus) {
    if (writing.current || !session) return;
    writing.current = true;
    setBusyId(ticket.id);
    setNotice('');
    const uid = session.user.id;
    try {
      await setTicketStatus(ticket, status);
      if (owner.current !== uid) return;
      setNotice('Status saved.');
      await load();
    } catch (e) {
      if (owner.current === uid) {
        setNotice(e instanceof Error ? e.message : 'Could not save status.');
        if (e instanceof AdminRequestError && e.needsVerification) {
          clearData();
          void verifyAccess();
        }
      }
    } finally {
      writing.current = false;
      setBusyId('');
    }
  }
  async function signOut() {
    explicitSignOut.current = true;
    version.current++;
    setSession(null);
    owner.current = null;
    clearData();
    setPhase('signed-out');
    try {
      const { error } = await adminClient.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch {
      setNotice(
        'Sign-out cleanup needs a retry. Close this tab if you are using a shared device.',
      );
    }
  }
  return (
    <main>
      <header>
        <Brand />
        {session && <button onClick={() => void signOut()}>Sign out</button>}
      </header>
      {phase === 'signed-out' && notice && <Notice>{notice}</Notice>}
      {phase === 'signed-out' ? (
        <SignIn />
      ) : phase === 'loading' ? (
        <section className="auth-card">
          <h1>Checking admin access…</h1>
          <p>Totals and feedback stay hidden until verification finishes.</p>
        </section>
      ) : phase === 'denied' ? (
        <section className="auth-card">
          <h1>Administrator activation required</h1>
          <p className="muted">
            This sign-in has no dashboard access. The operator must approve the
            verified account before authenticator setup and admin access can
            continue.
          </p>
          <button onClick={() => void verifyAccess()}>
            Check activation again
          </button>
        </section>
      ) : phase === 'error' ? (
        <section className="auth-card">
          <h1>Could not verify access</h1>
          <Notice>{notice}</Notice>
          <button onClick={() => void verifyAccess()}>
            Retry verification
          </button>
        </section>
      ) : phase === 'mfa' ? (
        <Authenticator onVerified={() => void verifyAccess()} />
      ) : (
        <>
          <div className="page-heading">
            <p className="eyebrow">PULSE ADMIN</p>
            <h1>
              {section === 'overview'
                ? 'Your app at a glance'
                : 'Feedback inbox'}
            </h1>
            <p className="muted">
              User counts and submitted feedback. Health tracking records are
              not available here.
            </p>
          </div>
          <nav aria-label="Admin sections">
            <button
              aria-current={section === 'overview' ? 'page' : undefined}
              onClick={() => setSection('overview')}
            >
              Overview
            </button>
            <button
              aria-current={section === 'feedback' ? 'page' : undefined}
              onClick={() => setSection('feedback')}
            >
              Feedback
            </button>
            <button
              className="refresh"
              disabled={loading || !!busyId}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </nav>
          {notice && <Notice>{notice}</Notice>}
          {section === 'overview' ? (
            overview ? (
              <Overview data={overview} />
            ) : (
              <p>Loading account totals…</p>
            )
          ) : (
            <>
              <div className="inbox-heading">
                <label>
                  Filter by status
                  <select
                    value={filter}
                    disabled={!!busyId}
                    onChange={(e) => {
                      setFilter(e.target.value as FeedbackStatus | '');
                      setTickets([]);
                      setNext(null);
                    }}
                  >
                    <option value="">All statuses</option>
                    {feedbackStatuses.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="footnote">
                  Newest first · only opted-in reply emails are shown
                </p>
              </div>
              {tickets.length === 0 && !loading ? (
                <section className="panel">
                  <h2>No feedback in this view</h2>
                  <p className="muted">
                    Submissions will appear here when users send them from
                    Pulse.
                  </p>
                </section>
              ) : (
                tickets.map((ticket) => (
                  <Ticket
                    key={ticket.id}
                    ticket={ticket}
                    onSave={(t, s) => void save(t, s)}
                    busy={!!busyId}
                  />
                ))
              )}
              {next && (
                <button
                  disabled={loading || !!busyId}
                  onClick={() => void load(next)}
                >
                  {loading ? 'Loading…' : 'Load older feedback'}
                </button>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Portal />);

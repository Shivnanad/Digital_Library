import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerUser } from "../services/authService";
import "../styles/register.css";

/* ── Interactive constellation canvas hook ── */
function useConstellation(canvasRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w = window.innerWidth, h = window.innerHeight;
    canvas.width = w; canvas.height = h;
    const resize = () => { w = window.innerWidth; h = window.innerHeight; canvas.width = w; canvas.height = h; };
    window.addEventListener("resize", resize);
    let mouse = { x: w / 2, y: h / 2 };
    const onMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    window.addEventListener("mousemove", onMove);
    const COUNT = 50, MAX_DIST = 135, MAX_DIST_SQ = MAX_DIST * MAX_DIST, MOUSE_DIST = 170, MOUSE_DIST_SQ = MOUSE_DIST * MOUSE_DIST;
    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.42, vy: (Math.random() - 0.5) * 0.42,
      r: Math.random() * 2 + 0.8,
      gold: Math.random() > 0.72,
    }));
    let animId;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 0.7;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
          const dSq = dx * dx + dy * dy;
          if (dSq < MAX_DIST_SQ) {
            const d = Math.sqrt(dSq);
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(139,92,246,${(1 - d / MAX_DIST) * 0.3})`;
            ctx.stroke();
          }
        }
      }
      for (const p of particles) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y, dSq = dx * dx + dy * dy;
        if (dSq < MOUSE_DIST_SQ) {
          const d = Math.sqrt(dSq);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(245,158,11,${(1 - d / MOUSE_DIST) * 0.6})`;
          ctx.lineWidth = 1; ctx.stroke();
          ctx.lineWidth = 0.7;
          p.vx += (dx / d) * 0.028; p.vy += (dy / d) * 0.028;
        }
      }
      for (const p of particles) {
        p.vx *= 0.99; p.vy *= 0.99;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 1.1) { p.vx = (p.vx / sp) * 1.1; p.vy = (p.vy / sp) * 1.1; }
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.gold ? "rgba(245,158,11,0.9)" : "rgba(139,92,246,0.9)";
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); window.removeEventListener("mousemove", onMove); };
  }, []);
}

export default function Register() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  useConstellation(canvasRef);

  /* Force dark mode on this page; restore previous theme on unmount */
  useEffect(() => {
    const prev = document.body.getAttribute("data-theme") || "dark";
    document.body.setAttribute("data-theme", "dark");
    return () => document.body.setAttribute("data-theme", prev);
  }, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [focusField, setFocusField] = useState(null);

  const LIMITS = { name: { min: 3, max: 30 }, email: { min: 5, max: 60 }, password: { min: 8, max: 32 } };

  const validateForm = () => {
    const errors = {};
    const n = name.trim();
    if (n.length < LIMITS.name.min) errors.name = `At least ${LIMITS.name.min} characters`;
    else if (n.length > LIMITS.name.max) errors.name = `Max ${LIMITS.name.max} characters`;
    else if (!/^[a-zA-Z\s]*$/.test(n)) errors.name = "Letters and spaces only";
    else if (/\s{2,}/.test(n)) errors.name = "No consecutive spaces";
    const e2 = email.trim();
    if (e2.length < LIMITS.email.min) errors.email = `At least ${LIMITS.email.min} characters`;
    else if (e2.length > LIMITS.email.max) errors.email = `Max ${LIMITS.email.max} characters`;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e2)) errors.email = "Invalid email format";
    if (password.length < LIMITS.password.min) errors.password = `At least ${LIMITS.password.min} characters`;
    else if (password.length > LIMITS.password.max) errors.password = `Max ${LIMITS.password.max} characters`;
    else if (!/[A-Z]/.test(password)) errors.password = "Needs an uppercase letter";
    else if (!/[a-z]/.test(password)) errors.password = "Needs a lowercase letter";
    else if (!/[0-9]/.test(password)) errors.password = "Needs a number";
    else if (!/[!@#$%^&*]/.test(password)) errors.password = "Needs a special character (!@#$%^&*)";
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getPasswordStrength = () => [
    /[A-Z]/, /[a-z]/, /[0-9]/, /[!@#$%^&*]/
  ].filter(r => r.test(password)).length;

  const STRENGTH_LABEL = ["", "Weak", "Fair", "Good", "Strong"];
  const STRENGTH_COLOR = ["", "#ef4444", "#f59e0b", "#10b981", "#6366f1"];
  const strength = getPasswordStrength();

  const clearError = (field) => {
    if (validationErrors[field]) setValidationErrors(p => ({ ...p, [field]: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!validateForm()) return;
    try {
      await registerUser({ name: name.trim(), email: email.trim(), password });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 1400);
    } catch (err) {
      setError(err || "Registration failed");
    }
  };

  const FEATURES = [
    { icon: "📚", title: "50K+ Books", desc: "Vast curated library" },
    { icon: "🤖", title: "AI Assistant", desc: "Smart reading companion" },
    { icon: "🎵", title: "Playlists", desc: "Organize reading lists" },
    { icon: "⚡", title: "Instant Access", desc: "Read anywhere, anytime" },
  ];

  return (
    <div className="reg-page">
      <canvas ref={canvasRef} className="reg-canvas" aria-hidden />

      {/* ── LEFT PANEL ── */}
      <div className="reg-left">
        <div className="reg-left-inner">
          <div className="reg-logo">
            <div className="reg-logo-mark"><span>R</span></div>
            <span className="reg-logo-name">Readify</span>
          </div>
          <h1 className="reg-hero-title">
            Your next great<br />
            <span className="reg-hero-accent">read awaits.</span>
          </h1>
          <p className="reg-hero-sub">
            Join thousands of readers who discover, collect, and
            explore books with AI-powered assistance.
          </p>
          <div className="reg-features">
            {FEATURES.map(({ icon, title, desc }, i) => (
              <div className="reg-feature-card" key={i} style={{ animationDelay: `${i * 0.1}s` }}>
                <span className="reg-feature-icon">{icon}</span>
                <div>
                  <div className="reg-feature-title">{title}</div>
                  <div className="reg-feature-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="reg-deco-ring" aria-hidden><div className="reg-deco-ring-inner" /></div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="reg-right">
        <div className="reg-card">
          <div className="reg-card-header">
            <h2 className="reg-card-title">Create account</h2>
            <p className="reg-card-sub">Start your reading journey today</p>
          </div>

          {error && (
            <div className="reg-alert"><span className="reg-alert-icon">⚠</span> {error}</div>
          )}
          {success && (
            <div className="reg-success"><span>✓</span> Account created! Redirecting…</div>
          )}

          <form className="reg-form" onSubmit={handleSubmit} noValidate>
            {/* Name */}
            <div className={`reg-field${focusField === "name" ? " focused" : ""}${validationErrors.name ? " has-error" : name.length >= 3 ? " is-valid" : ""}`}>
              <label className="reg-label" htmlFor="r-name">
                <i className="fas fa-user" /> Full name
              </label>
              <input id="r-name" type="text" className="reg-input"
                placeholder="e.g. John Doe" value={name}
                onChange={e => { if (e.target.value.length <= LIMITS.name.max) { setName(e.target.value); clearError("name"); }}}
                onFocus={() => setFocusField("name")} onBlur={() => setFocusField(null)}
                maxLength={LIMITS.name.max} required />
              {validationErrors.name
                ? <span className="reg-err-msg"><i className="fas fa-exclamation-circle" /> {validationErrors.name}</span>
                : <span className="reg-char-count">{name.length}/{LIMITS.name.max}</span>}
            </div>

            {/* Email */}
            <div className={`reg-field${focusField === "email" ? " focused" : ""}${validationErrors.email ? " has-error" : email.includes("@") ? " is-valid" : ""}`}>
              <label className="reg-label" htmlFor="r-email">
                <i className="fas fa-envelope" /> Email address
              </label>
              <input id="r-email" type="email" className="reg-input"
                placeholder="you@example.com" value={email}
                onChange={e => { if (e.target.value.length <= LIMITS.email.max) { setEmail(e.target.value); clearError("email"); }}}
                onFocus={() => setFocusField("email")} onBlur={() => setFocusField(null)}
                maxLength={LIMITS.email.max} required />
              {validationErrors.email
                ? <span className="reg-err-msg"><i className="fas fa-exclamation-circle" /> {validationErrors.email}</span>
                : <span className="reg-char-count">{email.length}/{LIMITS.email.max}</span>}
            </div>

            {/* Password */}
            <div className={`reg-field${focusField === "password" ? " focused" : ""}${validationErrors.password ? " has-error" : password.length >= 8 && strength === 4 ? " is-valid" : ""}`}>
              <label className="reg-label" htmlFor="r-password">
                <i className="fas fa-lock" /> Password
              </label>
              <div className="reg-pass-wrap">
                <input id="r-password" type={showPass ? "text" : "password"} className="reg-input"
                  placeholder="Min 8 chars — Aa0!@#$%" value={password}
                  onChange={e => { if (e.target.value.length <= LIMITS.password.max) { setPassword(e.target.value); clearError("password"); }}}
                  onFocus={() => setFocusField("password")} onBlur={() => setFocusField(null)}
                  maxLength={LIMITS.password.max} required />
                <button type="button" className="reg-eye-btn" onClick={() => setShowPass(v => !v)} tabIndex={-1} aria-label="Toggle password">
                  <i className={`fas fa-eye${showPass ? "-slash" : ""}`} />
                </button>
              </div>
              {password.length > 0 && (
                <div className="reg-strength">
                  <div className="reg-strength-bar">
                    {[1,2,3,4].map(n => (
                      <div key={n} className="reg-strength-seg" style={{ background: strength >= n ? STRENGTH_COLOR[strength] : undefined }} />
                    ))}
                  </div>
                  <span className="reg-strength-lbl" style={{ color: STRENGTH_COLOR[strength] }}>{STRENGTH_LABEL[strength]}</span>
                </div>
              )}
              {password.length > 0 && (
                <div className="reg-reqs">
                  {[{ label: "A–Z", test: /[A-Z]/ }, { label: "a–z", test: /[a-z]/ }, { label: "0–9", test: /[0-9]/ }, { label: "!@#$", test: /[!@#$%^&*]/ }]
                    .map(({ label, test }) => (
                      <span key={label} className={`reg-req-pill${test.test(password) ? " met" : ""}`}>
                        {test.test(password) ? "✓ " : ""}{label}
                      </span>
                    ))}
                </div>
              )}
              {validationErrors.password
                ? <span className="reg-err-msg"><i className="fas fa-exclamation-circle" /> {validationErrors.password}</span>
                : <span className="reg-char-count">{password.length}/{LIMITS.password.max}</span>}
            </div>

            <button className="reg-submit" type="submit"
              disabled={success || Object.values(validationErrors).some(Boolean) || !name || !email || !password}>
              {success ? "✓ Done!" : "Create my account"}
              {!success && <i className="fas fa-arrow-right" />}
            </button>
          </form>

          <div className="reg-divider"><span>or</span></div>

          <button className="reg-google-btn" type="button">
            <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="18" height="18">
              <path fill="#EA4335" d="M24 9.5c3.9 0 7 1.6 9.1 3.8l6.6-6.6C34.9 3.1 29.8 1 24 1 14.9 1 6.9 6.9 3.1 14.9l7.7 5.9C12 15.1 17.5 9.5 24 9.5z"/>
              <path fill="#34A853" d="M46.5 24.5c0-1.6-.1-2.9-.4-4.1H24v8.1h12.8c-.6 3.1-2.4 5.7-5.1 7.5l7.8 6.1C43.8 38.6 46.5 32.1 46.5 24.5z"/>
              <path fill="#FBBC05" d="M10.8 29.8A14.9 14.9 0 0 1 9.5 24c0-1.4.2-2.7.5-3.9L2.3 14.2A24 24 0 0 0 0 24c0 3.8.9 7.3 2.6 10.5l8.2-4.7z"/>
              <path fill="#4285F4" d="M24 46c6.5 0 12-2.1 16-5.7l-7.8-6.1c-2.2 1.5-5 2.3-8.2 2.3-6.5 0-11.9-4.7-13.8-11.1L2.6 34.5C6.9 41.6 14.8 46 24 46z"/>
            </svg>
            Continue with Google
          </button>

          <p className="reg-signin">
            Already a member? <Link to="/login">Sign in</Link>
          </p>
          <p className="reg-back"><Link to="/app">← Back to home</Link></p>
        </div>{/* reg-card */}
      </div>{/* reg-right */}
    </div>
  );
}

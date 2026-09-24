import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loginUser } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import "../styles/auth.css";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  /* ── OTP state ── */
  const [step, setStep] = useState("credentials"); // "credentials" | "otp"
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const otpBoxRefs = useRef([]);

  const handleCredentials = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please enter email and password.");
      return;
    }
    setError("");
    try {
      // Send OTP to email via backend
      const response = await fetch('http://localhost:5000/api/otp/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.message || 'Failed to send OTP. Please try again.');
        return;
      }
      setOtpDigits(["", "", "", "", "", ""]);
      setStep("otp");
      setTimeout(() => otpBoxRefs.current[0]?.focus(), 80);
    } catch (err) {
      setError('Network error. Please try again.');
      console.error(err);
    }
  };

  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < 5) otpBoxRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpBoxRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = [...otpDigits];
    text.split("").forEach((c, i) => { next[i] = c; });
    setOtpDigits(next);
    const lastFilled = Math.min(text.length, 5);
    otpBoxRefs.current[lastFilled]?.focus();
  };

  const handleOtpVerify = async (e) => {
    e.preventDefault();
    const entered = otpDigits.join("");
    if (entered.length !== 6) {
      setError("Please enter all 6 digits.");
      return;
    }
    setError("");
    try {
      // Verify OTP with backend
      const response = await fetch('http://localhost:5000/api/otp/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: entered })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.message || 'Invalid OTP. Please try again.');
        return;
      }
      // OTP verified, now login with email and password
      const loginData = await loginUser({ email: email.trim(), password });
      login(loginData.user, loginData.token);
      // If first-time user (onboarding not completed), go to onboarding
      if (loginData.user && loginData.user.onboardingCompleted === false) {
        navigate("/onboarding");
      } else {
        navigate("/app");
      }
    } catch (err) {
      setError('Login failed. Please try again.');
      console.error(err);
      setStep("credentials");
    }
  };

  const splineRootRef = useRef(null);
  const canvasRef = useRef(null);

  /* ── Particle network canvas animation ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let animId;
    const PARTICLE_COUNT = 55;
    const CONNECTION_DIST = 130;
    const CONNECTION_DIST_SQ = CONNECTION_DIST * CONNECTION_DIST;
    const MOUSE_DIST = 100;
    const MOUSE_DIST_SQ = MOUSE_DIST * MOUSE_DIST;
    const mouse = { x: -9999, y: -9999 };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const onMouseMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    window.addEventListener("mousemove", onMouseMove);

    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      r: Math.random() * 2 + 1,
    }));

    const hexColors = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#ec4899"];

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Move & wrap particles + mouse repel
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < MOUSE_DIST_SQ) {
          const dist = Math.sqrt(distSq);
          const force = (MOUSE_DIST - dist) / MOUSE_DIST;
          p.x += (dx / dist) * force * 2;
          p.y += (dy / dist) * force * 2;
        }
      }

      // Draw connections — batched into single path per alpha group
      ctx.lineWidth = 0.8;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dSq = dx * dx + dy * dy;
          if (dSq < CONNECTION_DIST_SQ) {
            const alpha = (1 - Math.sqrt(dSq) / CONNECTION_DIST) * 0.4;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(120, 160, 255, ${alpha})`;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw dots
      ctx.globalAlpha = 0.75;
      particles.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = hexColors[i % hexColors.length];
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  /* ── Spline 3D viewer (deferred to avoid blocking initial paint) ── */
  useEffect(() => {
    let cancelled = false;

    const loadSpline = async () => {
      if (!splineRootRef.current) return;
      splineRootRef.current.innerHTML = "";

      if (!document.querySelector('script[data-spline-viewer]')) {
        const s = document.createElement("script");
        s.type = "module";
        s.src = "https://unpkg.com/@splinetool/viewer@1.12.58/build/spline-viewer.js";
        s.setAttribute("data-spline-viewer", "1");
        document.head.appendChild(s);
        await new Promise((resolve, reject) => {
          s.onload = () => resolve(true);
          s.onerror = () => reject(new Error("Failed to load Spline viewer"));
        });
      }

      if (cancelled) return;

      try {
        const el = document.createElement("spline-viewer");
        el.setAttribute("url", "https://prod.spline.design/fDzgLxxu6-GOljuf/scene.splinecode");
        el.style.width = "100%";
        el.style.height = "100%";
        splineRootRef.current.appendChild(el);
      } catch (err) { /* ignore */ }
    };

    // Defer loading so the login form + particles render first
    const timer = setTimeout(loadSpline, 800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (splineRootRef.current) splineRootRef.current.innerHTML = "";
    };
  }, []);

  return (
    <div className="login-page">
      {/* Particle network canvas */}
      <canvas ref={canvasRef} className="particle-canvas" aria-hidden></canvas>

      <div className="spline-container" aria-hidden ref={splineRootRef}></div>
      {/* Animated Background */}
      <div className="animated-background">
        <div className="aurora aurora-1"></div>
        <div className="aurora aurora-2"></div>
        <div className="aurora aurora-3"></div>
        <div className="bg-shape shape-1"></div>
        <div className="bg-shape shape-2"></div>
        <div className="bg-shape shape-3"></div>
        <div className="bg-shape shape-4"></div>
        <div className="bg-shape shape-5"></div>
        <div className="bg-shape shape-6"></div>

        <div className="floating-particle particle-1"></div>
        <div className="floating-particle particle-2"></div>
        <div className="floating-particle particle-3"></div>
        <div className="floating-particle particle-4"></div>
        <div className="floating-particle particle-5"></div>

        <div className="glow-effect glow-1"></div>
        <div className="glow-effect glow-2"></div>
        <div className="glow-effect glow-3"></div>

        <div className="wave-effect wave-1"></div>
        <div className="wave-effect wave-2"></div>
      </div>

      {/* Login Form */}
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo" aria-hidden></div>

          {step === "credentials" ? (
            <>
              <h1 className="login-title">Login</h1>
              {error && <p className="error-message">{error}</p>}

              <form className="login-form" onSubmit={handleCredentials}>
                <div className="form-group">
                  <input
                    type="email"
                    className="form-input"
                    placeholder="Email or username"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group password-group">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="form-input"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="show-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label="Toggle password"
                  >
                    <i className={`fas fa-eye${showPassword ? "-slash" : ""}`} />
                  </button>
                </div>

                <button className="login-button" type="submit">Send OTP</button>
              </form>

              <div className="social-login">
                <p className="social-text">Or continue with</p>
                <div className="social-buttons">
                  <button className="social-btn google" title="Login with Google" aria-label="Login with Google">
                    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path fill="#EA4335" d="M24 9.5c3.9 0 7 1.6 9.1 3.8l6.6-6.6C34.9 3.1 29.8 1 24 1 14.9 1 6.9 6.9 3.1 14.9l7.7 5.9C12 15.1 17.5 9.5 24 9.5z"/>
                      <path fill="#34A853" d="M46.5 24.5c0-1.6-.1-2.9-.4-4.1H24v8.1h12.8c-.6 3.1-2.4 5.7-5.1 7.5l7.8 6.1C43.8 38.6 46.5 32.1 46.5 24.5z"/>
                      <path fill="#FBBC05" d="M10.8 29.8A14.9 14.9 0 0 1 9.5 24c0-1.4.2-2.7.5-3.9L2.3 14.2A24 24 0 0 0 0 24c0 3.8.9 7.3 2.6 10.5l8.2-4.7z"/>
                      <path fill="#4285F4" d="M24 46c6.5 0 12-2.1 16-5.7l-7.8-6.1c-2.2 1.5-5 2.3-8.2 2.3-6.5 0-11.9-4.7-13.8-11.1L2.6 34.5C6.9 41.6 14.8 46 24 46z"/>
                    </svg>
                  </button>
                  <button className="social-btn facebook" title="Login with Facebook" aria-label="Login with Facebook">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path fill="#1877F2" d="M22 12.07C22 6.5 17.52 2 12 2S2 6.5 2 12.07c0 4.84 3.44 8.85 7.94 9.77v-6.9H7.9v-2.87h2.04V9.4c0-2.02 1.2-3.14 3.03-3.14.88 0 1.8.16 1.8.16v1.98h-1.02c-1.01 0-1.32.62-1.32 1.26v1.5h2.24l-.36 2.87h-1.88v6.9C18.56 20.92 22 16.91 22 12.07z"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="signup-link">
                <p>Not a member? <Link to="/register">Register here</Link></p>
              </div>
              <p className="login-back"><Link to="/app">← Back to home</Link></p>
            </>
          ) : (
            <div className="otp-container">
              <div className="otp-shield-icon" aria-hidden>🔐</div>
              <h1 className="login-title otp-title">Verify OTP</h1>
              <p className="otp-subtitle">A 6-digit code has been generated.<br />Enter it below to sign in securely.</p>

              {/* step progress */}
              <div className="otp-steps" aria-hidden>
                <div className="otp-step-dot done" />
                <div className="otp-step-line" />
                <div className="otp-step-dot active" />
                <div className="otp-step-line" />
                <div className="otp-step-dot" />
              </div>

              {error && <p className="error-message">{error}</p>}

              <form className="otp-form" onSubmit={handleOtpVerify}>
                <div className="otp-divider">
                  <div className="otp-divider-line" />
                  <span className="otp-divider-text">Enter 6-digit code</span>
                  <div className="otp-divider-line" />
                </div>

                <div className="otp-boxes" onPaste={handleOtpPaste}>
                  {otpDigits.map((d, i) => (
                    <input
                      key={i}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      className={`otp-box${d ? " filled" : ""}`}
                      value={d}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      ref={el => otpBoxRefs.current[i] = el}
                      autoComplete="one-time-code"
                    />
                  ))}
                </div>

                <button
                  className="login-button otp-verify-btn"
                  type="submit"
                  disabled={otpDigits.join("").length < 6}
                >
                  Verify &amp; Sign In
                </button>
              </form>

              <div className="otp-resend-row">
                <span>Didn&apos;t get the code?</span> Check your email inbox
              </div>

              <button
                className="otp-back-btn"
                onClick={() => { setStep("credentials"); setError(""); setOtpDigits(["", "", "", "", "", ""]); }}
              >
                ← Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

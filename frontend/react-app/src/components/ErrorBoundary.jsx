import React from "react";

/**
 * Global Error Boundary — catches uncaught React render errors and displays
 * a user-friendly error screen instead of a blank white page.
 *
 * Styled inline so it works even if CSS fails to load.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Production-safe logging — never log tokens or passwords
    console.error(
      "[ErrorBoundary] Uncaught error:",
      error?.message || error,
      "\nComponent stack:",
      errorInfo?.componentStack?.slice(0, 500) || "(unavailable)"
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#0f172a",
            color: "#e2e8f0",
            fontFamily:
              "'Inter', 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              borderRadius: "16px",
              padding: "40px 32px",
              maxWidth: "440px",
              width: "100%",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 600,
                marginBottom: "8px",
                color: "#f8fafc",
              }}
            >
              Something went wrong
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "#94a3b8",
                marginBottom: "24px",
                lineHeight: 1.5,
              }}
            >
              An unexpected error occurred. Please try again.
            </p>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={this.handleRetry}
                style={{
                  padding: "10px 24px",
                  borderRadius: "10px",
                  border: "none",
                  background: "linear-gradient(135deg, #7c5cfc, #3b82f6)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "opacity 0.2s",
                }}
                onMouseOver={(e) => (e.target.style.opacity = "0.85")}
                onMouseOut={(e) => (e.target.style.opacity = "1")}
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  padding: "10px 24px",
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#cbd5e1",
                  fontWeight: 500,
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "opacity 0.2s",
                }}
                onMouseOver={(e) => (e.target.style.opacity = "0.75")}
                onMouseOut={(e) => (e.target.style.opacity = "1")}
              >
                Reload Page
              </button>
            </div>

            {process.env.NODE_ENV !== "production" && this.state.error && (
              <details
                style={{
                  marginTop: "20px",
                  textAlign: "left",
                  fontSize: "12px",
                  color: "#64748b",
                }}
              >
                <summary style={{ cursor: "pointer", marginBottom: "8px" }}>
                  Error details
                </summary>
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    background: "rgba(0,0,0,0.3)",
                    padding: "12px",
                    borderRadius: "8px",
                    maxHeight: "200px",
                    overflow: "auto",
                  }}
                >
                  {String(this.state.error)}
                  {this.state.errorInfo?.componentStack?.slice(0, 800)}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

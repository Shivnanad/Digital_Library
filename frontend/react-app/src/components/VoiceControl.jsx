import React, { useEffect, useState, useRef } from 'react';
import { useVoice } from '../context/VoiceContext';
import '../styles/voiceControl.css';

export default function VoiceControl() {
  const { mode, transcript, interim, response, error, isRouteAllowed, micActive, dismissAssistant, manualWakeUp } = useVoice();
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [neonActive, setNeonActive] = useState(false);
  const [neonFadeOut, setNeonFadeOut] = useState(false);
  const neonTimerRef = useRef(null);
  const popupTimerRef = useRef(null);

  // ── Drag State ──
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef({ isDown: false, startX: 0, startY: 0, initX: 0, initY: 0, isDragging: false });

  // ── Popup visibility (awake/processing → show, sleeping → fade out) ──
  useEffect(() => {
    if (mode === 'awake' || mode === 'processing') {
      if (popupTimerRef.current) { clearTimeout(popupTimerRef.current); popupTimerRef.current = null; }
      setFadeOut(false);
      setVisible(true);
    } else {
      if (visible) {
        setFadeOut(true);
        popupTimerRef.current = setTimeout(() => {
          setVisible(false);
          setFadeOut(false);
        }, 400);
      }
    }
    return () => {
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    };
  }, [mode, visible]);

  // ── Neon border: ON only while AI popup is active, OFF when it goes away ──
  const neonActiveRef = useRef(false);
  useEffect(() => {
    if (mode === 'awake' || mode === 'processing') {
      if (neonTimerRef.current) { clearTimeout(neonTimerRef.current); neonTimerRef.current = null; }
      setNeonFadeOut(false);
      setNeonActive(true);
      neonActiveRef.current = true;
    } else if (neonActiveRef.current) {
      setNeonFadeOut(true);
      neonTimerRef.current = setTimeout(() => {
        setNeonActive(false);
        setNeonFadeOut(false);
        neonActiveRef.current = false;
      }, 600);
    }
    return () => {
      if (neonTimerRef.current) clearTimeout(neonTimerRef.current);
    };
  }, [mode]);

  if (!isRouteAllowed) return null;

  // ── Drag Handlers ──
  const onPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (!e.isPrimary) return;
    
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.style.transition = 'none';

    dragRef.current = {
      isDown: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      initX: pos.x,
      initY: pos.y,
      isDragging: false,
    };
  };

  const onPointerMove = (e) => {
    if (!dragRef.current.isDown || dragRef.current.pointerId !== e.pointerId) return;
    
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    
    if (!dragRef.current.isDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      dragRef.current.isDragging = true;
    }

    if (dragRef.current.isDragging) {
      setPos({
        x: dragRef.current.initX + dx,
        y: dragRef.current.initY + dy
      });
    }
  };

  const onPointerUp = (e) => {
    if (!dragRef.current.isDown || dragRef.current.pointerId !== e.pointerId) return;
    dragRef.current.isDown = false;
    
    e.currentTarget.releasePointerCapture(e.pointerId);
    e.currentTarget.style.transition = '';

    // Delay resetting isDragging so the click event (which fires right after pointerup) 
    // can be reliably intercepted and swallowed if this was a drag.
    setTimeout(() => {
      dragRef.current.isDragging = false;
    }, 100);
  };

  const handleClickWrapper = (action) => (e) => {
    if (dragRef.current.isDragging) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    action(e);
  };

  const dragProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    style: { 
      right: `calc(28px - ${pos.x}px)`, 
      bottom: `calc(28px - ${pos.y}px)`, 
      touchAction: 'none',
      userSelect: 'none'
    }
  };

  // ── Neon RGB Border Overlay — only rendered when active ──
  const neonBorder = neonActive ? (
    <div className={`readify-neon-border ${neonFadeOut ? 'fade-out' : 'active'} ${mode === 'processing' ? 'processing' : ''}`}>
      <div className="neon-edge-top"></div>
      <div className="neon-edge-bottom"></div>
      <div className="neon-edge-left"></div>
      <div className="neon-edge-right"></div>
      <div className="neon-corner neon-corner-tl"></div>
      <div className="neon-corner neon-corner-tr"></div>
      <div className="neon-corner neon-corner-bl"></div>
      <div className="neon-corner neon-corner-br"></div>
    </div>
  ) : null;

  // ── Sleeping state: Readify AI floating logo button ──
  if (!visible && mode === 'sleeping') {
    return (
      <>
        {neonBorder}
        <div
          {...dragProps}
          className={`readify-ai-fab ${micActive ? 'mic-on' : 'mic-off'}`}
          onClick={handleClickWrapper(manualWakeUp)}
          title="Drag to move, click to activate"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') manualWakeUp(); }}
        >
          <div className="fab-pulse-ring fab-ring-1"></div>
          <div className="fab-pulse-ring fab-ring-2"></div>

          <div className="fab-logo-core">
            <svg className="fab-ai-icon" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 32C8 30.3431 9.34315 29 11 29H32V7H11C9.34315 7 8 8.34315 8 10V32Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
              <path d="M8 32C8 30.3431 9.34315 29 11 29H32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
              <path d="M20 12L21.5 17L26 18.5L21.5 20L20 25L18.5 20L14 18.5L18.5 17L20 12Z" fill="currentColor" className="fab-sparkle-main" />
              <circle cx="27" cy="13" r="1.2" fill="currentColor" className="fab-sparkle-sm1" opacity="0.7" />
              <circle cx="13" cy="25" r="1" fill="currentColor" className="fab-sparkle-sm2" opacity="0.5" />
              <circle cx="28" cy="24" r="0.8" fill="currentColor" className="fab-sparkle-sm3" opacity="0.6" />
            </svg>
          </div>

          <div className="fab-status-dot"></div>

          <div className="fab-tooltip">
            <span className="fab-tooltip-text">
              {micActive ? 'Readify AI' : 'Readify AI (Mic off)'}
            </span>
            <span className="fab-tooltip-sub">
              {micActive ? 'Click or say "Hey Readify"' : 'Click to activate'}
            </span>
          </div>
        </div>
      </>
    );
  }

  // ── Awake / Processing state: full assistant UI ──
  if (!visible) return neonBorder;

  return (
    <>
      {neonBorder}
      <div 
        className={`readify-assistant ${fadeOut ? 'fade-out' : 'fade-in'}`} 
        onClick={handleClickWrapper(dismissAssistant)}
      >
        <div className={`assistant-orb ${mode === 'processing' ? 'processing' : 'listening'}`}>
          <div className="orb-ring ring-1"></div>
          <div className="orb-ring ring-2"></div>
          <div className="orb-ring ring-3"></div>
          <div className="orb-core">
            {mode === 'processing' ? (
              <div className="processing-spinner"></div>
            ) : (
              <svg viewBox="0 0 24 24" className="mic-icon" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            )}
          </div>
        </div>

        <div className="assistant-bubble">
          {response && <p className="bubble-response">{response}</p>}
          {(interim || transcript) && (
            <p className="bubble-transcript">
              {interim || transcript}
            </p>
          )}
          {error && <p className="bubble-error">{error}</p>}
        </div>

        <span className="assistant-label">
          {mode === 'processing' ? 'Thinking...' : 'Listening — tap to dismiss'}
        </span>
      </div>
    </>
  );
}

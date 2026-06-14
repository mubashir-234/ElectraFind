import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, doc, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import FeedbackModal from "../components/FeedbackModal";
import { loadGoogleMaps } from "../firebase/config";

export default function Chat() {
  const { chatId } = useParams();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [chatMeta, setChatMeta] = useState(null);
  const [isHandshakeValid, setIsHandshakeValid] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [jobCompleted, setJobCompleted] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Map states
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);   // store map in ref, not state, to avoid stale closures
  const electricianMarkerRef = useRef(null);
  const customerMarkerRef = useRef(null);
  const lastCenterRef = useRef(null);    // remember last electrician position for re-center on expand

  // ── NEW: map collapse/expand toggle ──────────────────────────────────────
  const [mapExpanded, setMapExpanded] = useState(true);

  const messagesEndRef = useRef(null);

  // ── Real-time chat & booking meta ─────────────────────────────────────────
  useEffect(() => {
    if (!currentUser || !chatId) return;

    const chatRef = doc(db, "bookings", chatId);
    const unsubscribeMeta = onSnapshot(chatRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();

        if (data.customerId !== currentUser.uid && data.electricianId !== currentUser.uid) {
          toast.error("Unauthorized access");
          navigate("/");
          return;
        }

        setChatMeta(data);

        if (data.status === "accepted" && data.chatEnabled === true) {
          setIsHandshakeValid(true);
          setJobCompleted(false);
        } else if (data.status === "completed") {
          setIsHandshakeValid(false);
          setJobCompleted(true);
          if (data.customerId === currentUser.uid && !data.feedbackSubmitted) {
            setFeedbackOpen(true);
          }
        } else {
          setIsHandshakeValid(false);
          setJobCompleted(false);
        }
      } else {
        toast.error("Booking record missing.");
        navigate("/");
      }
      setCheckingAccess(false);
    });

    const msgQuery = query(
      collection(db, "bookings", chatId, "messages"),
      orderBy("timestamp", "asc")
    );

    const unsubscribeMessages = onSnapshot(msgQuery, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubscribeMeta();
      unsubscribeMessages();
    };
  }, [chatId, currentUser, navigate]);

  // ── Initialize Google Map ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isHandshakeValid || !chatMeta?.customerLat || !chatMeta?.customerLng) return;
    // Don't re-init if already created
    if (mapInstanceRef.current) return;

    loadGoogleMaps(() => {
      if (!mapRef.current) return;

      const mapInstance = new window.google.maps.Map(mapRef.current, {
        zoom: 15,
        center: { lat: chatMeta.customerLat, lng: chatMeta.customerLng },
        mapTypeId: "roadmap",
        disableDefaultUI: false,
      });

      mapInstanceRef.current = mapInstance;

      // Customer pin (blue)
      customerMarkerRef.current = new window.google.maps.Marker({
        position: { lat: chatMeta.customerLat, lng: chatMeta.customerLng },
        map: mapInstance,
        title: "Customer Location",
        icon: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
      });

      // Electrician live marker (red) — no position yet
      electricianMarkerRef.current = new window.google.maps.Marker({
        map: mapInstance,
        title: "Electrician",
        icon: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
      });

      // Real-time electrician location
      const electricianRef = doc(db, "electricians", chatMeta.electricianId);
      const unsubLocation = onSnapshot(electricianRef, (snap) => {
        if (snap.exists()) {
          const elec = snap.data();
          if (elec.lat && elec.lng) {
            const pos = { lat: elec.lat, lng: elec.lng };
            lastCenterRef.current = pos;
            electricianMarkerRef.current?.setPosition(pos);
            mapInstanceRef.current?.panTo(pos);
          }
        }
      });

      return () => unsubLocation();
    });
  }, [isHandshakeValid, chatMeta]);

  // ── KEY FIX: trigger resize whenever the map panel is expanded ────────────
  // When mapExpanded flips to true the div goes from height:0 → full height.
  // Google Maps painted into a 0-height div shows solid black tiles.
  // Firing the 'resize' event tells Maps to repaint to the new dimensions,
  // then we re-center on the last known position (or customer location).
  useEffect(() => {
    if (!mapExpanded) return;

    // Small delay so the CSS transition/animation finishes before we measure
    const timer = setTimeout(() => {
      if (!mapInstanceRef.current) return;

      window.google?.maps?.event?.trigger(mapInstanceRef.current, "resize");

      // Re-center on electrician if we have their position, else customer
      const center =
        lastCenterRef.current ||
        (chatMeta?.customerLat && chatMeta?.customerLng
          ? { lat: chatMeta.customerLat, lng: chatMeta.customerLng }
          : null);

      if (center) {
        mapInstanceRef.current.setCenter(center);
      }
    }, 320); // matches typical CSS transition duration

    return () => clearTimeout(timer);
  }, [mapExpanded, chatMeta]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    const backupText = text;
    setText("");

    try {
      await addDoc(collection(db, "bookings", chatId, "messages"), {
        senderId: currentUser.uid,
        senderName: currentUser.displayName || userProfile?.name || "User",
        text: backupText,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      toast.error("Message delivery failed.");
      setText(backupText);
    }
  };

  const isProvider = userProfile?.role === "electrician";
  const partnerName = isProvider ? chatMeta?.customerName : chatMeta?.electricianName;

  const handleBack = () => {
    if (isProvider) {
      navigate("/electrician/dashboard");
    } else {
      navigate("/dashboard");
    }
  };

  if (checkingAccess) {
    return (
      <div style={S.pageWrapper}>
        <div style={S.waitingScreen}>
          <p style={{ color: "rgba(255,255,255,0.4)" }}>Syncing authorization logs...</p>
        </div>
      </div>
    );
  }

  if (jobCompleted && !isProvider) {
    return (
      <div style={S.pageWrapper}>
        <div style={S.waitingScreen}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 18, margin: "0 0 8px", color: "#4ade80" }}>Job Completed!</h2>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
            Please share your feedback about the service.
          </p>
        </div>
        <FeedbackModal
          isOpen={feedbackOpen}
          bookingId={chatId}
          electricianUid={chatMeta?.electricianId}
          electricianName={chatMeta?.electricianName}
          onClose={() => {
            setFeedbackOpen(false);
            navigate("/dashboard");
          }}
        />
      </div>
    );
  }

  if (jobCompleted && isProvider) {
    navigate("/electrician/dashboard", { replace: true });
    return null;
  }

  if (!isHandshakeValid) {
    return (
      <div style={S.pageWrapper}>
        <div style={S.waitingScreen}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
          <h2 style={{ fontSize: 18, margin: "0 0 8px", color: "#FACC15" }}>Awaiting Confirmation</h2>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
            Chat opens when the electrician accepts your request.
          </p>
          <button onClick={handleBack} style={{ ...S.backBtn, margin: "24px auto 0", width: "auto", padding: "0 16px", fontSize: 13 }}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.pageWrapper}>
      <div style={S.container}>
        {/* Header */}
        <div style={S.header}>
          <button onClick={handleBack} style={S.backBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <div style={{ overflow: "hidden", flex: 1 }}>
            <h2 style={{ ...S.headerTitle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {partnerName || "Connected Partner"}
            </h2>
            <p style={S.headerSub}>Ticket Ref: #{chatId?.substring(0, 8).toUpperCase()}</p>
          </div>
          <div style={S.statusDot}>●</div>
        </div>

        {/* Messages */}
        <div style={S.messageArea}>
          {messages.length === 0 ? (
            <div style={S.emptyState}>
              <div style={S.emptyIcon}>💬</div>
              <p style={S.emptyText}>No messages yet. Say hello!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === currentUser.uid;
              return (
                <div key={msg.id} style={{ ...S.row, justifyContent: isMe ? "flex-end" : "flex-start" }}>
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      ...S.bubble,
                      background: isMe ? "#FACC15" : "rgba(255,255,255,0.06)",
                      color: isMe ? "#0f0f0f" : "#fff",
                      borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    }}
                  >
                    {!isMe && <p style={S.senderLabel}>{msg.senderName}</p>}
                    <p style={S.msgText}>{msg.text}</p>
                  </motion.div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Live Tracking Map — collapsible */}
        <div style={S.mapSection}>
          {/* Map header with toggle */}
          <button
            onClick={() => setMapExpanded((v) => !v)}
            style={S.mapToggleBar}
          >
            <span style={S.mapToggleLabel}>
              <span style={{ color: "#4ade80", marginRight: 6 }}>📍</span>
              Live Location Tracking
            </span>
            <span style={{ ...S.mapToggleIcon, transform: mapExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
              ▲
            </span>
          </button>

          {/* Map container — CSS height transition so Google Maps div always exists in DOM */}
          <div
            style={{
              ...S.mapWrapper,
              height: mapExpanded ? 240 : 0,
              opacity: mapExpanded ? 1 : 0,
            }}
          >
            <div
              ref={mapRef}
              style={S.mapCanvas}
            />
          </div>
        </div>

        {/* Input */}
        <form onSubmit={handleSend} style={S.inputForm}>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your message..."
            style={S.input}
          />
          <button type="submit" disabled={!text.trim()} style={{ ...S.sendBtn, opacity: text.trim() ? 1 : 0.5 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

const S = {
  // ── Unchanged original styles ─────────────────────────────────────────────
  pageWrapper:   { height: "100vh", width: "100vw", display: "flex", justifyContent: "center", alignItems: "center", background: "#0a0a0a", padding: "0 12px", boxSizing: "border-box" },
  container:     { width: "100%", maxWidth: "460px", height: "min(780px, 92vh)", display: "flex", flexDirection: "column", background: "#111111", fontFamily: "'DM Sans', sans-serif", color: "#fff", borderRadius: "24px", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", boxShadow: "0 24px 48px rgba(0, 0, 0, 0.4)" },
  waitingScreen: { width: "100%", maxWidth: "460px", padding: "40px 24px", textAlign: "center", background: "#111111", border: "1px dashed rgba(250,204,21,0.2)", borderRadius: "24px", color: "#fff", fontFamily: "'DM Sans', sans-serif" },
  header:        { display: "flex", alignItems: "center", padding: "16px 20px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(10px)" },
  backBtn:       { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "#fff", width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginRight: 14, transition: "background 0.2s" },
  headerTitle:   { margin: 0, fontSize: 15, fontWeight: 700 },
  headerSub:     { margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" },
  statusDot:     { marginLeft: "auto", color: "#4ade80", fontSize: 12 },
  messageArea:   { flex: 1, padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, background: "#141414" },
  row:           { display: "flex", width: "100%" },
  bubble:        { maxWidth: "80%", padding: "12px 16px", fontSize: 14, lineHeight: 1.45 },
  senderLabel:   { margin: "0 0 4px", fontSize: 10, fontWeight: 800, color: "#FACC15", textTransform: "uppercase" },
  msgText:       { margin: 0, wordBreak: "break-word" },
  emptyState:    { margin: "auto", textAlign: "center", maxWidth: 280 },
  emptyIcon:     { fontSize: 32, marginBottom: 12, opacity: 0.5 },
  emptyText:     { margin: 0, fontSize: 13, color: "rgba(255,255,255,0.35)" },
  inputForm:     { display: "flex", padding: "16px", background: "#111111", borderTop: "1px solid rgba(255,255,255,0.05)" },
  input:         { flex: 1, padding: "12px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, color: "#fff", fontSize: 14, outline: "none" },
  sendBtn:       { marginLeft: 12, width: 44, height: 44, background: "#FACC15", color: "#0f0f0f", border: "none", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },

  // ── Map section styles ────────────────────────────────────────────────────
  mapSection: {
    flexShrink: 0,
    borderTop: "1px solid rgba(255,255,255,0.05)",
  },
  mapToggleBar: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 20px",
    background: "rgba(74,222,128,0.05)",
    border: "none",
    borderBottom: "1px solid rgba(74,222,128,0.12)",
    color: "#fff",
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  mapToggleLabel: {
    fontSize: 13,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
  },
  mapToggleIcon: {
    fontSize: 10,
    color: "#4ade80",
    transition: "transform 0.3s ease",
    display: "inline-block",
  },
  // overflow hidden + CSS height transition — the map div stays in the DOM
  // so Google Maps never loses its container, preventing the black tile bug
  mapWrapper: {
    overflow: "hidden",
    transition: "height 0.3s ease, opacity 0.3s ease",
    padding: "0 16px 12px",
    boxSizing: "border-box",
  },
  mapCanvas: {
    width: "100%",
    height: "100%",       // fills mapWrapper's animated height
    borderRadius: 12,
    border: "1px solid rgba(74,222,128,0.25)",
    background: "#0a0a0a",
  },
};

import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, doc, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import FeedbackModal from "../components/FeedbackModal";

export default function Chat() {
  const { chatId } = useParams();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [chatMeta, setChatMeta] = useState(null);
  const [isHandshakeValid, setIsHandshakeValid] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  // ── NEW: track completed status to show feedback modal for customers ───────
  const [jobCompleted, setJobCompleted] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const messagesEndRef = useRef(null);

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
          // ── KEY FIX: completed → show feedback for customer, not waiting screen
          setIsHandshakeValid(false);
          setJobCompleted(true);
          // Auto-open feedback modal only for customers who haven't submitted yet
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
      if (chatMeta?.electricianId) {
        navigate(`/book/${chatMeta.electricianId}`, { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (checkingAccess) {
    return (
      <div style={S.pageWrapper}>
        <div style={S.waitingScreen}>
          <p style={{ color: "rgba(255,255,255,0.4)" }}>Syncing authorization logs...</p>
        </div>
      </div>
    );
  }

  // ── Job completed → show feedback modal for customer ─────────────────────
  if (jobCompleted && !isProvider) {
    return (
      <div style={S.pageWrapper}>
        {/* Dark backdrop with a subtle "job done" message behind the modal */}
        <div style={S.waitingScreen}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 18, margin: "0 0 8px", color: "#4ade80" }}>Job Completed!</h2>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
            Please share your feedback about the service.
          </p>
        </div>

        {/* Feedback modal renders on top */}
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

  // ── Job completed → electrician just sees dashboard redirect ─────────────
  if (jobCompleted && isProvider) {
    navigate("/electrician/dashboard", { replace: true });
    return null;
  }

  // ── Awaiting confirmation (pending/declined) ──────────────────────────────
  if (!isHandshakeValid) {
    return (
      <div style={S.pageWrapper}>
        <div style={S.waitingScreen}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
          <h2 style={{ fontSize: 18, margin: "0 0 8px", color: "#FACC15" }}>Awaiting Confirmation</h2>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
            Chat opens when the electrician accepts your request.
          </p>
          <button
            onClick={handleBack}
            style={{ ...S.backBtn, margin: "24px auto 0", width: "auto", padding: "0 16px", fontSize: 13 }}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Active chat ───────────────────────────────────────────────────────────
  return (
    <div style={S.pageWrapper}>
      <div style={S.container}>
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

// ── Styles (100% identical to original — zero changes) ────────────────────────
const S = {
  pageWrapper: { height: "100vh", width: "100vw", display: "flex", justifyContent: "center", alignItems: "center", background: "#0a0a0a", padding: "0 12px", boxSizing: "border-box" },
  container: { width: "100%", maxWidth: "460px", height: "min(780px, 92vh)", display: "flex", flexDirection: "column", background: "#111111", fontFamily: "'DM Sans', sans-serif", color: "#fff", borderRadius: "24px", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", boxShadow: "0 24px 48px rgba(0, 0, 0, 0.4)" },
  waitingScreen: { width: "100%", maxWidth: "460px", padding: "40px 24px", textAlign: "center", background: "#111111", border: "1px dashed rgba(250,204,21,0.2)", borderRadius: "24px", color: "#fff", fontFamily: "'DM Sans', sans-serif" },
  header: { display: "flex", alignItems: "center", padding: "16px 20px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(10px)" },
  backBtn: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "#fff", width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginRight: 14, transition: "background 0.2s" },
  headerTitle: { margin: 0, fontSize: 15, fontWeight: 700 },
  headerSub: { margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" },
  statusDot: { marginLeft: "auto", color: "#4ade80", fontSize: 12 },
  messageArea: { flex: 1, padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, background: "#141414" },
  row: { display: "flex", width: "100%" },
  bubble: { maxWidth: "80%", padding: "12px 16px", fontSize: 14, lineHeight: 1.45 },
  senderLabel: { margin: "0 0 4px", fontSize: 10, fontWeight: 800, color: "#FACC15", textTransform: "uppercase" },
  msgText: { margin: 0, wordBreak: "break-word" },
  emptyState: { margin: "auto", textAlign: "center", maxWidth: 280 },
  emptyIcon: { fontSize: 32, marginBottom: 12, opacity: 0.5 },
  emptyText: { margin: 0, fontSize: 13, color: "rgba(255,255,255,0.35)" },
  inputForm: { display: "flex", padding: "16px", background: "#111111", borderTop: "1px solid rgba(255,255,255,0.05)" },
  input: { flex: 1, padding: "12px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, color: "#fff", fontSize: 14, outline: "none" },
  sendBtn: { marginLeft: 12, width: 44, height: 44, background: "#FACC15", color: "#0f0f0f", border: "none", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
};

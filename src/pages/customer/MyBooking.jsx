import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, orderBy, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import FeedbackModal from "../../components/FeedbackModal";
import toast from "react-hot-toast";

const statusColors = {
  pending:   { bg: "rgba(250,204,21,0.12)",  color: "#FACC15",  label: "⏳ Pending"   },
  accepted:  { bg: "rgba(59,130,246,0.12)",  color: "#60a5fa",  label: "🔵 Accepted"  },
  confirmed: { bg: "rgba(34,197,94,0.12)",   color: "#4ade80",  label: "✅ Confirmed" },
  completed: { bg: "rgba(99,102,241,0.12)",  color: "#a5b4fc",  label: "🎉 Completed" },
  cancelled: { bg: "rgba(239,68,68,0.12)",   color: "#f87171",  label: "❌ Cancelled" },
  declined:  { bg: "rgba(239,68,68,0.12)",   color: "#f87171",  label: "❌ Declined"  },
};

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] } }),
};

export default function MyBookings() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Feedback modal state
  const [feedbackModal, setFeedbackModal] = useState({
    isOpen: false,
    bookingId: null,
    electricianUid: null,
    electricianName: null,
  });

  // ── Real-time listener so completed status appears instantly ──────────────
  useEffect(() => {
    if (!currentUser?.uid) return;

    const q = query(
      collection(db, "bookings"),
      where("customerId", "==", currentUser.uid)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      let list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setBookings(list);
      setLoading(false);

      // Auto-open feedback modal for any newly completed booking without feedback
      const justCompleted = list.find(
        (b) => b.status === "completed" && !b.feedbackSubmitted && !b._feedbackPrompted
      );
      if (justCompleted) {
        setFeedbackModal({
          isOpen: true,
          bookingId: justCompleted.id,
          electricianUid: justCompleted.electricianId,
          electricianName: justCompleted.electricianName,
        });
      }
    });

    return () => unsub();
  }, [currentUser]);

  // ── Manual cancel ─────────────────────────────────────────────────────────
  async function cancelBooking(bookingId) {
    try {
      await updateDoc(doc(db, "bookings", bookingId), { status: "cancelled" });
      toast.success("Booking successfully cancelled.");
    } catch {
      toast.error("Could not modify booking record.");
    }
  }

  // ── Close feedback modal (does NOT navigate — ThankYouScreen handles that) ─
  function handleFeedbackClose() {
    setFeedbackModal({ isOpen: false, bookingId: null, electricianUid: null, electricianName: null });
  }

  return (
    <div style={styles.page}>
      {/* Feedback Modal — rendered at top level so it overlays everything */}
      <FeedbackModal
        isOpen={feedbackModal.isOpen}
        bookingId={feedbackModal.bookingId}
        electricianUid={feedbackModal.electricianUid}
        electricianName={feedbackModal.electricianName}
        onClose={handleFeedbackClose}
      />

      <div style={styles.container}>
        <motion.button
          style={styles.back}
          onClick={() => navigate("/dashboard")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileHover={{ x: -4 }}
        >
          ← Back to Dashboard
        </motion.button>

        <motion.h1
          style={styles.title}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          ⚡ My Bookings
        </motion.h1>

        {loading ? (
          <div style={styles.skeletonWrap}>
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                style={styles.skeleton}
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <motion.div style={styles.empty} variants={fadeUp} initial="hidden" animate="visible">
            <div style={{ fontSize: 52, marginBottom: 12 }}>📋</div>
            <p style={{ color: "rgba(255,255,255,0.4)", margin: 0 }}>No bookings on your record.</p>
            <motion.button
              style={styles.findBtn}
              onClick={() => navigate("/dashboard")}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
            >
              Find an Electrician
            </motion.button>
          </motion.div>
        ) : (
          <div style={styles.list}>
            {bookings.map((b, i) => {
              const st = statusColors[b.status] || statusColors.pending;
              return (
                <motion.div
                  key={b.id}
                  style={styles.card}
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  custom={i}
                  whileHover={{ borderColor: "rgba(250,204,21,0.25)" }}
                >
                  <div style={styles.cardHeader}>
                    <div>
                      <p style={styles.elName}>👷 {b.electricianName || "Professional Service"}</p>
                      <p style={styles.jobType}>{b.jobType || "General Maintenance"}</p>
                    </div>
                    <span style={{ ...styles.statusBadge, background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                  </div>

                  <div style={styles.meta}>
                    {b.address && <span>📍 {b.address}</span>}
                    {b.date && <span>📅 {b.date}{b.time ? ` at ${b.time}` : ""}</span>}
                    {b.rateOffer && <span>💰 Rs.{b.rateOffer}</span>}
                  </div>

                  {b.description && <p style={styles.desc}>{b.description}</p>}

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {/* Cancel — only for pending */}
                    {b.status === "pending" && (
                      <motion.button
                        style={styles.cancelBtn}
                        onClick={() => cancelBooking(b.id)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                      >
                        Cancel Booking
                      </motion.button>
                    )}

                    {/* Leave Feedback — completed but not yet reviewed */}
                    {b.status === "completed" && !b.feedbackSubmitted && (
                      <motion.button
                        style={styles.feedbackBtn}
                        onClick={() =>
                          setFeedbackModal({
                            isOpen: true,
                            bookingId: b.id,
                            electricianUid: b.electricianId,
                            electricianName: b.electricianName,
                          })
                        }
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.96 }}
                      >
                        ⭐ Leave Feedback
                      </motion.button>
                    )}

                    {/* Already reviewed badge */}
                    {b.status === "completed" && b.feedbackSubmitted && (
                      <span style={styles.reviewedBadge}>✅ Feedback Submitted</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f0f0f 0%, #111108 100%)",
    fontFamily: "'DM Sans', sans-serif",
    color: "#fff",
    padding: "2rem 1rem",
  },
  container: { maxWidth: 700, margin: "0 auto" },
  back: {
    background: "none", border: "none", color: "rgba(255,255,255,0.5)",
    cursor: "pointer", fontSize: 14, padding: "0 0 1rem",
    fontFamily: "inherit", display: "block",
  },
  title: { fontSize: 28, fontWeight: 800, marginBottom: "1.5rem" },
  list:  { display: "flex", flexDirection: "column", gap: 16 },
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16, padding: "1.25rem",
    transition: "border-color 0.25s",
  },
  cardHeader: {
    display: "flex", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 12, gap: 12,
  },
  elName:   { margin: 0, fontWeight: 700, fontSize: 17 },
  jobType:  { margin: "4px 0 0", fontSize: 13, color: "#FACC15" },
  statusBadge: {
    borderRadius: 100, padding: "4px 12px",
    fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0,
  },
  meta: {
    display: "flex", gap: 12, flexWrap: "wrap",
    fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 10,
  },
  desc: {
    fontSize: 14, color: "rgba(255,255,255,0.4)",
    margin: "0 0 12px", lineHeight: 1.5,
  },
  cancelBtn: {
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#f87171", borderRadius: 8, padding: "8px 16px",
    fontSize: 13, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
  },
  feedbackBtn: {
    background: "rgba(250,204,21,0.1)",
    border: "1px solid rgba(250,204,21,0.35)",
    color: "#FACC15", borderRadius: 8, padding: "8px 18px",
    fontSize: 13, fontWeight: 700, cursor: "pointer",
    fontFamily: "inherit", transition: "all 0.2s",
  },
  reviewedBadge: {
    fontSize: 12, color: "#4ade80",
    background: "rgba(74,222,128,0.08)",
    border: "1px solid rgba(74,222,128,0.2)",
    borderRadius: 8, padding: "8px 14px", fontWeight: 600,
  },
  skeletonWrap: { display: "flex", flexDirection: "column", gap: 16 },
  skeleton:    { height: 180, background: "rgba(255,255,255,0.05)", borderRadius: 16 },
  empty:       { textAlign: "center", padding: "4rem 0" },
  findBtn: {
    marginTop: 16, background: "#FACC15", border: "none",
    borderRadius: 10, padding: "12px 24px",
    fontWeight: 700, fontSize: 15, color: "#0f0f0f",
    cursor: "pointer", fontFamily: "inherit",
  },
};

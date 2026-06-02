import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { doc, updateDoc, collection, addDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

// ─── Animation Variants ───────────────────────────────────────────────────────
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.35 } },
  exit:   { opacity: 0, transition: { duration: 0.3 } },
};

const cardVariants = {
  hidden:  { opacity: 0, scale: 0.88, y: 40 },
  visible: { opacity: 1, scale: 1,    y: 0,  transition: { type: "spring", damping: 22, stiffness: 280, delay: 0.05 } },
  exit:    { opacity: 0, scale: 0.92, y: -20, transition: { duration: 0.28 } },
};

const thankYouVariants = {
  hidden:  { opacity: 0, scale: 0.7 },
  visible: { opacity: 1, scale: 1, transition: { type: "spring", damping: 18, stiffness: 240 } },
  exit:    { opacity: 0, scale: 1.1, transition: { duration: 0.4 } },
};

const staggerChild = {
  hidden:  { opacity: 0, y: 18 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: 0.1 + i * 0.08, duration: 0.38, ease: [0.22, 1, 0.36, 1] } }),
};

// ─── Star Rating Component ────────────────────────────────────────────────────
function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hover || value);
        return (
          <motion.button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            whileHover={{ scale: 1.3 }}
            whileTap={{ scale: 0.9 }}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 0,
              fontSize: 34,
              color: filled ? "#FACC15" : "rgba(255,255,255,0.12)",
              filter: filled ? "drop-shadow(0 0 6px rgba(250,204,21,0.55))" : "none",
              transition: "color 0.15s, filter 0.15s",
            }}
          >
            ★
          </motion.button>
        );
      })}
      <span style={{
        marginLeft: 8, fontSize: 13, fontWeight: 700, color: "#FACC15",
        background: "rgba(250,204,21,0.1)", padding: "4px 12px", borderRadius: 20,
      }}>
        {value} / 5
      </span>
    </div>
  );
}

// ─── Option Button Component ──────────────────────────────────────────────────
function OptionBtn({ label, emoji, selected, onClick, variant = "default" }) {
  const activeStyles = {
    default: { background: "rgba(250,204,21,0.1)", border: "1.5px solid #FACC15", color: "#FACC15" },
    danger:  { background: "rgba(239,68,68,0.1)",  border: "1.5px solid #EF4444", color: "#EF4444" },
    success: { background: "rgba(16,185,129,0.1)", border: "1.5px solid #10B981", color: "#10B981" },
  };
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.95 }}
      style={{
        flex: 1,
        padding: "13px 10px",
        background: "rgba(255,255,255,0.03)",
        border: "1.5px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        color: "rgba(255,255,255,0.65)",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "'DM Sans', sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        transition: "all 0.18s ease",
        ...(selected ? activeStyles[variant] : {}),
      }}
    >
      {emoji && <span style={{ fontSize: 22 }}>{emoji}</span>}
      <span>{label}</span>
    </motion.button>
  );
}

// ─── Thank You Screen ─────────────────────────────────────────────────────────
function ThankYouScreen({ electricianName, onDone }) {
  const [countdown, setCountdown] = useState(90);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timer); onDone(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onDone]);

  const progress = ((90 - countdown) / 90) * 100;

  return (
    <motion.div
      key="thankyou"
      variants={thankYouVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ textAlign: "center", padding: "10px 0" }}
    >
      {/* Animated checkmark burst */}
      <motion.div
        animate={{ scale: [0.8, 1.15, 1], rotate: [0, -8, 8, 0] }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        style={{ fontSize: 72, marginBottom: 4, lineHeight: 1 }}
      >
        🎉
      </motion.div>

      <motion.div
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
      >
        <h2 style={{ margin: "12px 0 4px", fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>
          Thank You!
        </h2>
      </motion.div>

      <p style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: "#FACC15" }}>
        Feedback Submitted ⚡
      </p>
      <p style={{ margin: "0 0 28px", fontSize: 13.5, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
        Your review for <strong style={{ color: "rgba(255,255,255,0.7)" }}>{electricianName || "the electrician"}</strong> has been recorded. It helps us keep quality high.
      </p>

      {/* Progress bar */}
      <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 100, height: 5, marginBottom: 12, overflow: "hidden" }}>
        <motion.div
          style={{ height: "100%", background: "#FACC15", borderRadius: 100 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.9, ease: "linear" }}
        />
      </div>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: "0 0 20px" }}>
        Returning to dashboard in {countdown}s...
      </p>

      <motion.button
        onClick={onDone}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        style={{
          padding: "13px 32px", background: "#FACC15", border: "none", borderRadius: 12,
          color: "#0f0f0f", fontWeight: 700, fontSize: 15, cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        Go to Dashboard →
      </motion.button>
    </motion.div>
  );
}

// ─── Main FeedbackModal ───────────────────────────────────────────────────────
export default function FeedbackModal({ isOpen, bookingId, electricianUid, electricianName, onClose }) {
  const navigate = useNavigate();
  const [step, setStep] = useState("form"); // "form" | "thankyou"
  const [rating, setRating] = useState(0);
  const [extraMoney, setExtraMoney] = useState(null); // "yes" | "no"
  const [behaviour, setBehaviour] = useState(null);   // "good" | "normal" | "bad"
  const [submitting, setSubmitting] = useState(false);

  // Reset state each time modal opens
  useEffect(() => {
    if (isOpen) {
      setStep("form");
      setRating(0);
      setExtraMoney(null);
      setBehaviour(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  const handleDone = () => {
    if (onClose) onClose();
    navigate("/dashboard");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (rating === 0)       return toast.error("Please rate the electrician!");
    if (!extraMoney)        return toast.error("Please answer the extra money question.");
    if (!behaviour)         return toast.error("Please select the electrician's behaviour.");

    setSubmitting(true);
    try {
      // 1. Save feedback review doc
      await addDoc(collection(db, "reviews"), {
        bookingId,
        electricianUid,
        rating,
        askedExtraMoney: extraMoney === "yes",
        behaviour,
        createdAt: serverTimestamp(),
      });

      // 2. Update booking with feedbackSubmitted flag
      if (bookingId) {
        await updateDoc(doc(db, "bookings", bookingId), {
          feedbackSubmitted: true,
          feedback: {
            rating,
            askedExtraMoney: extraMoney === "yes",
            behaviour,
            submittedAt: serverTimestamp(),
          },
        });
      }

      // 3. Recalculate electrician average rating
      if (electricianUid) {
        const q = query(collection(db, "reviews"), where("electricianUid", "==", electricianUid));
        const snap = await getDocs(q);
        let total = 0;
        snap.forEach((d) => { total += d.data().rating || 0; });
        const avg = parseFloat((total / snap.size).toFixed(1));

        const elecQ = query(collection(db, "electricians"), where("uid", "==", electricianUid));
        const elecSnap = await getDocs(elecQ);
        if (!elecSnap.empty) {
          await updateDoc(doc(db, "electricians", elecSnap.docs[0].id), {
            averageRating: avg,
            totalReviews: snap.size,
          });
        }
      }

      setStep("thankyou");
    } catch (err) {
      console.error("Feedback submission error:", err);
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="backdrop"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={S.backdrop}
        >
          <motion.div
            key="card"
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={S.card}
          >
            <AnimatePresence mode="wait">

              {/* ── FORM STEP ─────────────────────────────────────────── */}
              {step === "form" && (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
                  
                  {/* Header */}
                  <motion.div custom={0} variants={staggerChild} initial="hidden" animate="visible" style={S.header}>
                    <div style={S.iconRing}>⚡</div>
                    <h3 style={S.title}>Rate Your Experience</h3>
                    <p style={S.subtitle}>
                      Help keep ElectraFind quality high — your feedback matters.
                    </p>
                  </motion.div>

                  <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>

                    {/* Q1 — Star Rating */}
                    <motion.div custom={1} variants={staggerChild} initial="hidden" animate="visible" style={S.section}>
                      <label style={S.label}>
                        <span style={S.qNum}>01</span>
                        Rate the electrician's work
                      </label>
                      <div style={S.sectionBody}>
                        <StarRating value={rating} onChange={setRating} />
                      </div>
                    </motion.div>

                    {/* Q2 — Extra money */}
                    <motion.div custom={2} variants={staggerChild} initial="hidden" animate="visible" style={S.section}>
                      <label style={S.label}>
                        <span style={S.qNum}>02</span>
                        Did the electrician ask for extra money?
                      </label>
                      <div style={{ display: "flex", gap: 10 }}>
                        <OptionBtn
                          label="Yes" emoji="⚠️"
                          selected={extraMoney === "yes"}
                          onClick={() => setExtraMoney("yes")}
                          variant="danger"
                        />
                        <OptionBtn
                          label="No" emoji="✅"
                          selected={extraMoney === "no"}
                          onClick={() => setExtraMoney("no")}
                          variant="success"
                        />
                      </div>
                    </motion.div>

                    {/* Q3 — Behaviour */}
                    <motion.div custom={3} variants={staggerChild} initial="hidden" animate="visible" style={S.section}>
                      <label style={S.label}>
                        <span style={S.qNum}>03</span>
                        What was the electrician's behaviour?
                      </label>
                      <div style={{ display: "flex", gap: 10 }}>
                        <OptionBtn label="Good"   emoji="😊" selected={behaviour === "good"}   onClick={() => setBehaviour("good")}   variant="success" />
                        <OptionBtn label="Normal" emoji="😐" selected={behaviour === "normal"} onClick={() => setBehaviour("normal")} variant="default" />
                        <OptionBtn label="Bad"    emoji="😠" selected={behaviour === "bad"}    onClick={() => setBehaviour("bad")}    variant="danger"  />
                      </div>
                    </motion.div>

                    {/* Submit */}
                    <motion.div custom={4} variants={staggerChild} initial="hidden" animate="visible">
                      <motion.button
                        type="submit"
                        disabled={submitting}
                        whileHover={{ scale: submitting ? 1 : 1.02 }}
                        whileTap={{ scale: submitting ? 1 : 0.97 }}
                        style={{ ...S.submitBtn, opacity: submitting ? 0.7 : 1 }}
                      >
                        {submitting ? "Submitting..." : "Submit Feedback ⚡"}
                      </motion.button>
                    </motion.div>

                  </form>
                </motion.div>
              )}

              {/* ── THANK YOU STEP ────────────────────────────────────── */}
              {step === "thankyou" && (
                <ThankYouScreen
                  key="thankyou"
                  electricianName={electricianName}
                  onDone={handleDone}
                />
              )}

            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  backdrop: {
    position: "fixed", inset: 0,
    background: "rgba(8, 8, 10, 0.88)",
    backdropFilter: "blur(10px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 9999, padding: 16,
  },
  card: {
    width: "100%", maxWidth: 420,
    background: "linear-gradient(160deg, #131318 0%, #0e0e13 100%)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 24,
    padding: "28px 28px 28px",
    boxShadow: "0 28px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(250,204,21,0.04)",
    color: "#fff",
    fontFamily: "'DM Sans', sans-serif",
    overflowY: "auto",
    maxHeight: "92vh",
  },
  header: { textAlign: "center", marginBottom: 24 },
  iconRing: {
    width: 56, height: 56, borderRadius: "50%",
    background: "rgba(250,204,21,0.08)",
    border: "1px solid rgba(250,204,21,0.2)",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontSize: 26, marginBottom: 12,
  },
  title: { margin: "0 0 6px", fontSize: 21, fontWeight: 800, letterSpacing: "-0.3px" },
  subtitle: { margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 },

  section: { display: "flex", flexDirection: "column", gap: 10 },
  sectionBody: {
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 14, padding: "14px 16px",
  },
  label: {
    fontSize: 13.5, fontWeight: 700,
    color: "rgba(255,255,255,0.75)",
    display: "flex", alignItems: "center", gap: 10,
  },
  qNum: {
    fontSize: 10, fontWeight: 800, color: "#FACC15",
    background: "rgba(250,204,21,0.1)",
    padding: "3px 7px", borderRadius: 6, letterSpacing: 1,
  },
  submitBtn: {
    width: "100%", padding: "15px",
    background: "#FACC15", border: "none", borderRadius: 14,
    color: "#0f0f0f", fontSize: 15, fontWeight: 800,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
    letterSpacing: "-0.2px",
  },
};

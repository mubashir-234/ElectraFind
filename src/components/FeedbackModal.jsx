// src/components/FeedbackModal.jsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import toast from "react-hot-toast";

// ─── Step definitions ────────────────────────────────────────────────────────
const STEPS = ["extra_charge", "behaviour", "rating"];

const behaviourOptions = [
  { id: "professional",  label: "Professional",    icon: "💼" },
  { id: "friendly",     label: "Friendly",         icon: "😊" },
  { id: "punctual",     label: "On Time",          icon: "⏱️" },
  { id: "skilled",      label: "Highly Skilled",   icon: "🔧" },
  { id: "rude",         label: "Rude",             icon: "😠" },
  { id: "late",         label: "Late Arrival",     icon: "⌛" },
  { id: "unprepared",   label: "Unprepared",       icon: "❓" },
  { id: "overpriced",   label: "Overpriced",       icon: "💸" },
];

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center:        { x: 0, opacity: 1 },
  exit:  (dir) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

const FeedbackModal = ({ isOpen, bookingId, electricianUid, electricianName, onClose }) => {
  const [step, setStep]                   = useState(0);
  const [direction, setDirection]         = useState(1);
  const [extraCharge, setExtraCharge]     = useState(null); // true | false
  const [selectedBehaviours, setSelected] = useState([]);
  const [rating, setRating]               = useState(0);
  const [hoveredStar, setHoveredStar]     = useState(0);
  const [comment, setComment]             = useState("");
  const [submitting, setSubmitting]       = useState(false);

  if (!isOpen) return null;

  // ── helpers ──────────────────────────────────────────────────────────────
  const go = (delta) => {
    setDirection(delta);
    setStep((s) => s + delta);
  };

  const toggleBehaviour = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const canContinue = () => {
    if (step === 0) return extraCharge !== null;
    if (step === 1) return selectedBehaviours.length > 0;
    if (step === 2) return rating > 0;
    return false;
  };

  const handleSubmit = async () => {
    if (!bookingId || !electricianUid || rating === 0) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, "bookings", bookingId), {
        feedbackRating:      rating,
        feedbackComment:     comment,
        feedbackBehaviours:  selectedBehaviours,
        feedbackExtraCharge: extraCharge,
        feedbackSubmitted:   true,
        feedbackAt:          serverTimestamp(),
      });

      const elecSnap = await getDoc(doc(db, "electricians", electricianUid));
      const prev     = elecSnap.data() || {};
      const prevTotal   = prev.totalReviews  || 0;
      const prevRating  = prev.rating        || 0;
      const newAvg      = parseFloat(
        ((prevRating * prevTotal + rating) / (prevTotal + 1)).toFixed(2)
      );

      await updateDoc(doc(db, "electricians", electricianUid), {
        rating:       newAvg,
        totalReviews: prevTotal + 1,
      });

      toast.success("Thank you for your feedback! 🎉");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  // ── step labels ──────────────────────────────────────────────────────────
  const stepLabel = ["Extra Charge", "Behaviour", "Your Rating"];

  return (
    <div style={S.overlay}>
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit   ={{ opacity: 0, scale: 0.9,  y: 20 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        style={S.card}
      >
        {/* ── Header ── */}
        <div style={S.header}>
          <div style={S.avatarCircle}>
            {electricianName?.[0]?.toUpperCase() || "E"}
          </div>
          <div>
            <p style={S.headerTitle}>Rate your experience</p>
            <p style={S.headerSub}>with {electricianName}</p>
          </div>
        </div>

        {/* ── Progress dots ── */}
        <div style={S.dots}>
          {STEPS.map((_, i) => (
            <motion.div
              key={i}
              animate={{
                width:      i === step ? 28 : 8,
                background: i <= step ? "#FACC15" : "rgba(255,255,255,0.15)",
              }}
              transition={{ duration: 0.35 }}
              style={S.dot}
            />
          ))}
        </div>
        <p style={S.stepLabel}>{stepLabel[step]}</p>

        {/* ── Slide content ── */}
        <div style={{ overflow: "hidden", minHeight: 260 }}>
          <AnimatePresence custom={direction} mode="wait">
            {/* STEP 0 – Extra charge */}
            {step === 0 && (
              <motion.div
                key="step0"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: "easeInOut" }}
                style={S.stepContent}
              >
                <p style={S.question}>
                  Did the electrician ask for <span style={S.accent}>extra money</span> beyond the agreed rate?
                </p>
                <div style={S.choiceRow}>
                  <motion.button
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    onClick={() => setExtraCharge(true)}
                    style={{
                      ...S.choiceBtn,
                      ...(extraCharge === true ? S.choiceActive : {}),
                    }}
                  >
                    <span style={S.choiceIcon}>💰</span>
                    <span>Yes, they did</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    onClick={() => setExtraCharge(false)}
                    style={{
                      ...S.choiceBtn,
                      ...(extraCharge === false ? S.choiceGoodActive : {}),
                    }}
                  >
                    <span style={S.choiceIcon}>✅</span>
                    <span>No, all good</span>
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* STEP 1 – Behaviour */}
            {step === 1 && (
              <motion.div
                key="step1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: "easeInOut" }}
                style={S.stepContent}
              >
                <p style={S.question}>How would you describe the electrician's behaviour?</p>
                <div style={S.tagsGrid}>
                  {behaviourOptions.map((opt) => {
                    const active = selectedBehaviours.includes(opt.id);
                    return (
                      <motion.button
                        key={opt.id}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.94 }}
                        onClick={() => toggleBehaviour(opt.id)}
                        style={{ ...S.tag, ...(active ? S.tagActive : {}) }}
                      >
                        <span>{opt.icon}</span>
                        <span>{opt.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP 2 – Star rating + comment */}
            {step === 2 && (
              <motion.div
                key="step2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: "easeInOut" }}
                style={S.stepContent}
              >
                <p style={S.question}>How would you rate the overall service?</p>
                <div style={S.stars}>
                  {[1, 2, 3, 4, 5].map((star) => {
                    const filled = star <= (hoveredStar || rating);
                    return (
                      <motion.button
                        key={star}
                        whileHover={{ scale: 1.25 }}
                        whileTap={{ scale: 0.9 }}
                        onMouseEnter={() => setHoveredStar(star)}
                        onMouseLeave={() => setHoveredStar(0)}
                        onClick={() => setRating(star)}
                        style={{ ...S.star, color: filled ? "#FACC15" : "#333" }}
                      >
                        ★
                      </motion.button>
                    );
                  })}
                </div>
                {rating > 0 && (
                  <motion.p
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={S.ratingLabel}
                  >
                    {["", "Poor", "Fair", "Good", "Great", "Excellent!"][rating]}
                  </motion.p>
                )}
                <textarea
                  placeholder="Write a comment (optional)..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  style={S.textarea}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Actions ── */}
        <div style={S.actions}>
          {step > 0 && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => go(-1)}
              style={S.backBtn}
            >
              ← Back
            </motion.button>
          )}

          {step < STEPS.length - 1 ? (
            <motion.button
              whileTap={{ scale: canContinue() ? 0.96 : 1 }}
              onClick={() => canContinue() && go(1)}
              disabled={!canContinue()}
              style={{ ...S.nextBtn, opacity: canContinue() ? 1 : 0.35 }}
            >
              Continue →
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: canContinue() && !submitting ? 0.96 : 1 }}
              onClick={handleSubmit}
              disabled={!canContinue() || submitting}
              style={{ ...S.nextBtn, opacity: canContinue() && !submitting ? 1 : 0.35 }}
            >
              {submitting ? "Submitting..." : "Submit Feedback ✓"}
            </motion.button>
          )}
        </div>

        <button onClick={onClose} style={S.skipBtn}>
          Skip for now
        </button>
      </motion.div>
    </div>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = {
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.88)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 3000,
    backdropFilter: "blur(6px)",
    padding: "0 16px",
  },
  card: {
    background: "#111",
    borderRadius: 24,
    width: "100%", maxWidth: 420,
    border: "1px solid rgba(255,255,255,0.08)",
    padding: "28px 28px 24px",
    boxShadow: "0 32px 64px rgba(0,0,0,0.5)",
    fontFamily: "'DM Sans', sans-serif",
    color: "#fff",
  },

  // header
  header: { display: "flex", alignItems: "center", gap: 14, marginBottom: 24 },
  avatarCircle: {
    width: 48, height: 48, borderRadius: "50%",
    background: "linear-gradient(135deg,#FACC15,#f59e0b)",
    color: "#000", fontWeight: 800, fontSize: 20,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  headerTitle: { margin: 0, fontWeight: 700, fontSize: 16 },
  headerSub:   { margin: "3px 0 0", fontSize: 13, color: "rgba(255,255,255,0.45)" },

  // progress
  dots:      { display: "flex", gap: 6, marginBottom: 8 },
  dot:       { height: 8, borderRadius: 4, transition: "all 0.35s" },
  stepLabel: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#FACC15", marginBottom: 20 },

  // step wrapper
  stepContent: { padding: "0 2px 20px" },
  question:    { fontSize: 17, fontWeight: 600, lineHeight: 1.45, marginBottom: 20, color: "#f0f0f0" },
  accent:      { color: "#FACC15" },

  // step 0 – yes/no
  choiceRow: { display: "flex", gap: 12 },
  choiceBtn: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
    gap: 8, padding: "18px 12px",
    background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.1)",
    borderRadius: 16, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    transition: "all 0.2s",
  },
  choiceActive: {
    background: "rgba(239,68,68,0.12)", border: "1.5px solid #ef4444", color: "#f87171",
  },
  choiceGoodActive: {
    background: "rgba(74,222,128,0.12)", border: "1.5px solid #4ade80", color: "#4ade80",
  },
  choiceIcon: { fontSize: 28 },

  // step 1 – behaviour tags
  tagsGrid: { display: "flex", flexWrap: "wrap", gap: 10 },
  tag: {
    display: "flex", alignItems: "center", gap: 6,
    padding: "9px 14px", borderRadius: 100,
    background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.75)", cursor: "pointer", fontSize: 13, fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    transition: "all 0.2s",
  },
  tagActive: {
    background: "rgba(250,204,21,0.12)", border: "1.5px solid #FACC15", color: "#FACC15",
  },

  // step 2 – stars
  stars: { display: "flex", justifyContent: "center", gap: 6, marginBottom: 6 },
  star:  { background: "none", border: "none", fontSize: 44, cursor: "pointer", transition: "color 0.15s, transform 0.15s" },
  ratingLabel: { textAlign: "center", fontSize: 14, fontWeight: 700, color: "#FACC15", marginBottom: 16 },
  textarea: {
    width: "100%", height: 90, background: "rgba(255,255,255,0.04)",
    border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: 14,
    color: "#fff", padding: "12px 14px", fontSize: 14,
    resize: "none", outline: "none", fontFamily: "'DM Sans', sans-serif",
    boxSizing: "border-box",
  },

  // nav buttons
  actions: { display: "flex", gap: 10, marginTop: 4 },
  backBtn: {
    flex: "0 0 auto", padding: "13px 20px",
    background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.6)", borderRadius: 14, cursor: "pointer",
    fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
  },
  nextBtn: {
    flex: 1, padding: "14px 0",
    background: "#FACC15", border: "none",
    color: "#000", borderRadius: 14, cursor: "pointer",
    fontSize: 15, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
    transition: "opacity 0.2s",
  },
  skipBtn: {
    width: "100%", marginTop: 12, padding: "10px 0",
    background: "transparent", border: "none",
    color: "rgba(255,255,255,0.3)", cursor: "pointer",
    fontSize: 13, fontFamily: "'DM Sans', sans-serif",
  },
};

export default FeedbackModal;

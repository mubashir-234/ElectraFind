import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../firebase/config";
import { collection, addDoc, doc, getDocs, query, where, updateDoc } from "firebase/firestore";
import toast from "react-hot-toast";

export default function WorkCompletedModal({ isOpen, bookingId, electricianUid, electricianName, onClose }) {
  const [step, setStep] = useState(1); // 1: Celebration, 2: Questionnaire
  const [behavior, setBehavior] = useState(""); // "excellent", "polite", "unprofessional"
  const [extraMoney, setExtraMoney] = useState(""); // "yes", "no"
  const [textFeedback, setTextFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCalculateAndSubmit = async () => {
    if (!behavior || !extraMoney) {
      toast.error("Please complete all parameters to update the operational ledger!");
      return;
    }

    setSubmitting(true);
    try {
      // 1. ALGORITHMIC RATING CALCULATOR MATRIX
      let calculatedRating = 5;

      if (behavior === "unprofessional") calculatedRating -= 2;
      else if (behavior === "average") calculatedRating -= 1;

      if (extraMoney === "yes") calculatedRating -= 2;

      // Ensure rating never drops below 1 star
      if (calculatedRating < 1) calculatedRating = 1;

      // 2. SAVE PERFORMANCE METRICS TO FIRESTORE
      await addDoc(collection(db, "reviews"), {
        bookingId,
        electricianUid,
        behavior,
        chargedExtra: extraMoney,
        comment: textFeedback || "No additional text log provided.",
        rating: calculatedRating,
        createdAt: new Date()
      });

      // 3. AGGREGATE RE-CALCULATION FOR THE ELECTRICIAN NODE
      const q = query(collection(db, "reviews"), where("electricianUid", "==", electricianUid));
      const querySnapshot = await getDocs(q);
      
      let totalStars = 0;
      let reviewCount = querySnapshot.size;

      querySnapshot.forEach((doc) => {
        totalStars += doc.data().rating;
      });

      const dynamicAverage = parseFloat((totalStars / reviewCount).toFixed(1));

      // 4. UPDATE THE ELECTRICIAN PROFILE SYSTEM
      const electQuery = query(collection(db, "electricians"), where("uid", "==", electricianUid));
      const electSnapshot = await getDocs(electQuery);

      if (!electSnapshot.empty) {
        const electDocRef = doc(db, "electricians", electSnapshot.docs[0].id);
        await updateDoc(electDocRef, {
          averageRating: dynamicAverage,
          totalReviews: reviewCount
        });
      }

      toast.success(`Metrics compiled! Rating assigned: ${calculatedRating} ★`, { id: "metric-toast" });
      onClose();
    } catch (err) {
      console.error("Audit processing failed: ", err);
      toast.error("Failed to commit compliance metrics.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          style={styles.overlay}
        >
          <motion.div 
            initial={{ scale: 0.9, y: 40 }} 
            animate={{ scale: 1, y: 0 }} 
            exit={{ scale: 0.9, y: 40 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            style={styles.modalCard}
          >
            
            {/* STEP 1: CONGRATULATIONS CELEBRATION CARD */}
            {step === 1 && (
              <div style={{ textAlign: "center", padding: "20px 10px" }}>
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2, repeatDelay: 1 }}
                  style={styles.celebrationIcon}
                >
                  🎉
                </motion.div>
                <h2 style={styles.mainTitle}>Congratulations!</h2>
                <h3 style={{ color: "#10B981", margin: "4px 0 12px", fontSize: 20, fontWeight: 700 }}>Your Job is Safely Done!</h3>
                <p style={styles.description}>
                  The operational circuit is complete. Let's run a quick performance audit on <strong>{electricianName}</strong> to secure marketplace standard protocols.
                </p>
                <button onClick={() => setStep(2)} style={styles.primaryBtn}>
                  Launch Quality Audit Node →
                </button>
              </div>
            )}

            {/* STEP 2: PREMIUM SYSTEM QUESTIONNAIRE FORM */}
            {step === 2 && (
              <div>
                <div style={{ marginBottom: 20 }}>
                  <span style={styles.auditBadge}>Compliance Questionnaire</span>
                  <h3 style={{ margin: "6px 0 0", fontSize: 18, fontWeight: 800 }}>Performance Audit Ledger</h3>
                </div>

                {/* QUESTION 1: BEHAVIOR PARAMETER */}
                <div style={styles.questionSegment}>
                  <label style={styles.fieldLabel}>1. How was the technician's professional behavioral conduct?</label>
                  <div style={styles.optionGrid}>
                    {["Excellent & Polite", "Average", "Unprofessional"].map((opt) => {
                      const val = opt.split(" ")[0].toLowerCase();
                      return (
                        <button
                          key={opt} type="button"
                          onClick={() => setBehavior(val)}
                          style={{...styles.selectorBtn, ...(behavior === val ? styles.activeSelect : {})}}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* QUESTION 2: EXTRA CASH CHECKS */}
                <div style={styles.questionSegment}>
                  <label style={styles.fieldLabel}>2. Did the technician demand unquoted extra money outside the invoice?</label>
                  <div style={styles.optionGrid}>
                    <button
                      type="button" onClick={() => setExtraMoney("yes")}
                      style={{...styles.selectorBtn, ...(extraMoney === "yes" ? styles.activeDangerSelect : {})}}
                    >
                      ⚠️ Yes, they requested extra
                    </button>
                    <button
                      type="button" onClick={() => setExtraMoney("no")}
                      style={{...styles.selectorBtn, ...(extraMoney === "no" ? styles.activeSuccessSelect : {})}}
                    >
                      ✅ No, standard pricing kept
                    </button>
                  </div>
                </div>

                {/* OPTIONAL FIELD COMMENT */}
                <div style={styles.questionSegment}>
                  <label style={styles.fieldLabel}>3. Additional operational log notes (Optional)</label>
                  <textarea 
                    placeholder="Provide any specific engineering or structural feedback context..."
                    rows={2} value={textFeedback}
                    onChange={(e) => setTextFeedback(e.target.value)}
                    style={styles.textInput}
                  />
                </div>

                <button 
                  onClick={handleCalculateAndSubmit} 
                  disabled={submitting} 
                  style={styles.submitAuditBtn}
                >
                  {submitting ? "Calculating Trust Score Metrics..." : "Compile & Submit Final Rating"}
                </button>
              </div>
            )}

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const styles = {
  overlay: { position: "fixed", inset: 0, background: "rgba(10,10,11,0.92)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 20 },
  modalCard: { width: "100%", maxWidth: 460, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: 32, color: "#fff", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 20px 50px rgba(0,0,0,0.6)", boxSizing: "border-box" },
  
  celebrationIcon: { fontSize: 64, marginBottom: 12 },
  mainTitle: { margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "-0.5px" },
  description: { color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: "1.6", marginBottom: 24 },
  primaryBtn: { width: "100%", padding: "14px", background: "#FACC15", border: "none", borderRadius: 12, color: "#0f0f0f", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  
  auditBadge: { fontSize: 10, background: "rgba(16,185,129,0.1)", color: "#10B981", padding: "3px 8px", borderRadius: 20, fontWeight: 800, textTransform: "uppercase" },
  questionSegment: { marginBottom: 20 },
  fieldLabel: { display: "block", fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 600, marginBottom: 8, lineHeight: "1.4" },
  optionGrid: { display: "flex", gap: 8, flexWrap: "wrap" },
  selectorBtn: { flex: 1, minWidth: "120px", padding: "11px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s ease" },
  
  activeSelect: { background: "rgba(250,204,21,0.08)", border: "1px solid #FACC15", color: "#FACC15" },
  activeSuccessSelect: { background: "rgba(16,185,129,0.08)", border: "1px solid #10B981", color: "#10B981" },
  activeDangerSelect: { background: "rgba(239,68,68,0.08)", border: "1px solid #EF4444", color: "#EF4444" },
  
  textInput: { width: "100%", padding: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", resize: "none", fontFamily: "inherit", boxSizing: "border-box" },
  submitAuditBtn: { width: "100%", padding: "14px", background: "#10B981", border: "none", borderRadius: 12, color: "#0f0f0f", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 10 }
};
import React, { useState } from "react";
import { motion } from "framer-motion";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 }
};

const modalVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", duration: 0.45 } },
  exit: { opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.2 } }
};

// CRITICAL FIX: We accept 'onClose' here. 
// We do NOT call 'onDone' anywhere in this file to prevent the crash entirely.
export default function LocationModal({ onClose }) {
  const { currentUser } = useAuth();
  const [locationInput, setLocationInput] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSaveLocation(e) {
    e.preventDefault();
    if (!locationInput.trim()) {
      return toast.error("Please enter a valid area, street, or city!");
    }

    setSaving(true);
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        location: locationInput.trim(),
        locationConfiguredAt: new Date().toISOString()
      });

      toast.success("🎯 Location verified!");
      
      // Safe execution check
      if (onClose) {
        onClose();
      } else {
        console.warn("LocationModal: onClose function prop was not provided.");
      }
    } catch (error) {
      console.error("Location saving trace error:", error);
      toast.error("Failed to map coordinates. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // FIXED: handleSkip now safely references onClose with a fallback handler
  function handleSkip() {
    toast.success("Proceeding with default zone mapping.");
    if (onClose) {
      onClose();
    } else {
      // Fallback if no function prop was passed at all so it NEVER throws a TypeError
      console.log("Modal closed via fallback step.");
    }
  }

  return (
    <motion.div 
      style={S.overlay} 
      variants={overlayVariants} 
      initial="hidden" 
      animate="visible" 
      exit="hidden"
    >
      <motion.div 
        style={S.modal} 
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <div style={S.headerContainer}>
          <span style={{ fontSize: 32 }}>📍</span>
          <h2 style={S.title}>Configure Service Zone</h2>
          <p style={S.subtitle}>
            Specify your home area to access matching local booking pipelines and operators.
          </p>
        </div>

        <form onSubmit={handleSaveLocation} style={S.form}>
          <input
            type="text"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            placeholder="e.g. Downtown, Phase 5, Clifton"
            disabled={saving}
            style={S.input}
          />

          <div style={S.actionRow}>
            <button type="button" onClick={handleSkip} disabled={saving} style={S.skipBtn}>
              Skip for now
            </button>
            <button type="submit" disabled={saving} style={S.submitBtn}>
              {saving ? "Saving Zone..." : "Save & Launch"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

const S = {
  overlay: { position: "fixed", inset: 0, background: "rgba(3, 3, 5, 0.85)", backdropFilter: "blur(8px)", zIndex: 9999, display: "flex", alignItems: "center", justifycenter: "center", padding: "1rem" },
  modal: { width: "100%", maxWidth: 420, background: "#0c0c12", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 24, padding: "2rem", boxShadow: "0 20px 40px rgba(0,0,0,0.5)", margin: "auto" },
  headerContainer: { textAlign: "center", marginBottom: "1.75rem" },
  title: { margin: "12px 0 6px 0", fontSize: 21, fontWeight: 800, color: "#fff" },
  subtitle: { margin: 0, fontSize: 13, color: "rgba(255, 255, 255, 0.45)", lineHeight: 1.5 },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  input: { background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 12, padding: "12px 14px", color: "#fff", fontSize: 14, outline: "none" },
  actionRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 12 },
  skipBtn: { background: "transparent", border: "none", color: "rgba(255, 255, 255, 0.4)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  submitBtn: { background: "#4ade80", border: "none", color: "#000", padding: "12px 20px", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }
};
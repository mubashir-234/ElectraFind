import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config"; 
import toast from "react-hot-toast";

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Login() {
  // ✅ FIX 1: Single useAuth() call — all values in one place, no duplicates
  const { currentUser, signup, signupElectrician, login, loginWithGoogle } = useAuth();

  const [mode, setMode] = useState("login"); 
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // ✅ FIX 2: role default changed to "customer" to match what AuthContext saves in Firestore
  const [role, setRole] = useState("customer"); // "customer" or "electrician"
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("check");
  const [isPaisaAnimating, setIsPaisaAnimating] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // Unified post-auth role check router logic
  const handleUserRouteCheck = async (authUser) => {
    try {
      if (!authUser) return;
      const uid = authUser.uid;

      // 1. Check if a document matching this UID exists in electricians collection
      const electricianQuery = query(collection(db, "electricians"), where("uid", "==", uid));
      const electricianSnap = await getDocs(electricianQuery);
      
      if (!electricianSnap.empty) {
        toast.success("Welcome back, Partner! ⚡");
        navigate("/electrician/dashboard", { replace: true });
        return;
      }

      // 2. Check users collection for role field
      const userQuery = query(collection(db, "users"), where("uid", "==", uid));
      const userSnap = await getDocs(userQuery);
      
      if (!userSnap.empty) {
        const userData = userSnap.docs[0].data();
        if (userData?.role === "electrician") {
          toast.success("Welcome back, Partner! ⚡");
          navigate("/electrician/dashboard", { replace: true });
          return;
        }
        toast.success("Logged in successfully!");
        navigate("/dashboard", { replace: true });
        return;
      }

      // 3. Fallback: read local role state
      if (role === "electrician") {
        navigate("/electrician/dashboard", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }

    } catch (err) {
      console.error("Routing failed, forcing fallback: ", err);
      navigate(role === "electrician" ? "/electrician/dashboard" : "/dashboard", { replace: true });
    }
  };

 const handleSubmit = async (e) => {
  e.preventDefault();
  if (!email || !password) {
    return toast.error("Please fill in all standard credentials.");
  }
  
  setLoading(true);
  try {
    if (mode === "login") {
      const { profile } = await login(email, password);
      
      if (profile && profile.role === "electrician") {
        navigate("/electrician/dashboard");
      } else {
        navigate("/dashboard");
      }
      toast.success("Logged in successfully!");
    } else {
      // Signup logic remains same
      if (!name || !address) {
        setLoading(false);
        return toast.error("Please complete all onboarding parameters.");
      }
      if (role === "electrician") {
        await signupElectrician(email, password, {
          name,
          address,
          paymentMethod,
          role: "electrician",
          available: false,
          online: false,
          rating: 5,
          bio: ""
        });
        toast.success("Professional electrician account activated successfully!");
        navigate("/electrician/dashboard");
      } else {
        await signup(email, password, name);
        toast.success("Welcome to ElectraFind!");
        navigate("/dashboard");
      }
    }
  } catch (err) {
    console.error("Login Error:", err);
    
    // Better error messages
    if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
      toast.error("Incorrect email or password. Please try again.");
    } else if (err.code === "auth/user-not-found") {
      toast.error("No account found with this email. Please sign up first.");
    } else if (err.code === "auth/invalid-email") {
      toast.error("Please enter a valid email address.");
    } else {
      toast.error("Login failed. Please check your credentials.");
    }
  } finally {
    setLoading(false);
  }
};

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await loginWithGoogle();
      // ✅ FIX 4: loginWithGoogle returns { result, profile } — read result.result.user
      if (result && result.result && result.result.user) {
        await handleUserRouteCheck(result.result.user);
      } else {
        toast.success("Signed in with Google!");
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      toast.error("Google authentication aborted.");
    } finally {
      setLoading(false);
    }
  };

  const handleEasyPaisaClick = () => {
    setIsPaisaAnimating(true);
    toast("EasyPaisa integration will come soon! ⚡ Mobile wallet nodes compiling.", {
      icon: '🚀',
      style: {
        borderRadius: '12px',
        background: '#1e293b',
        color: '#fff',
        border: '1px solid #10b981'
      },
    });
    setTimeout(() => setIsPaisaAnimating(false), 600);
  };

  return (
    <div style={styles.page}>
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            style={styles.loadingOverlay}
          >
            <div style={{ textAlign: "center" }}>
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                style={styles.boltSpinner}
              >
                ⚡
              </motion.div>
              <p style={styles.loadingText}>Authenticating session...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div style={styles.formContainer} initial="hidden" animate="visible" variants={fadeUp}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>ElectraFind Gateway</h2>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: "4px 0 0" }}>
            {mode === "login" ? "Sign in to connect with professionals" : "Register your user profile node"}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <>
              {/* Role selector */}
              <div style={styles.toggleContainer}>
                <button
                  type="button"
                  onClick={() => setRole("customer")}
                  style={{...styles.toggleBtn, ...(role === "customer" ? styles.toggleActive : {})}}
                >
                  Standard User
                </button>
                <button
                  type="button"
                  onClick={() => setRole("electrician")}
                  style={{...styles.toggleBtn, ...(role === "electrician" ? styles.toggleActive : {})}}
                >
                  Electrician Pro
                </button>
              </div>

              <input 
                type="text" placeholder="Full Name" required value={name}
                onChange={(e) => setName(e.target.value)} style={styles.input} 
              />
            </>
          )}

          <input 
            type="email" placeholder="Email Address" required value={email}
            onChange={(e) => setEmail(e.target.value)} style={styles.input} 
          />
          <input 
            type="password" placeholder="Password" required value={password}
            onChange={(e) => setPassword(e.target.value)} style={styles.input} 
          />

          {mode === "signup" && (
            <>
              <input 
                type="text" placeholder="Physical Operational Address" required value={address}
                onChange={(e) => setAddress(e.target.value)} style={styles.input} 
              />

              <div style={{ marginBottom: 14 }}>
                <label style={styles.inputLabel}>Preferred Payment Archetype</label>
                <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("check")}
                    style={{...styles.paySelector, ...(paymentMethod === "check" ? styles.paySelectorActive : {})}}
                  >
                    🏦 Bank Check
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setPaymentMethod("easypaisa"); handleEasyPaisaClick(); }} 
                    style={{...styles.paySelector, ...(paymentMethod === "easypaisa" ? styles.paySelectorActiveGrid : {})}}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ marginRight: 8, flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10" fill="#10B981" />
                      <path d="M7 12h10M12 7v10" stroke="#0F0F0F" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                    EasyPaisa
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {paymentMethod === "easypaisa" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ overflow: "hidden" }}
                  >
                    <motion.div 
                      onClick={handleEasyPaisaClick}
                      animate={isPaisaAnimating ? { scale: [1, 0.96, 1.02, 1], rotate: [0, -1, 1, 0] } : {}}
                      transition={{ duration: 0.4 }}
                      style={styles.paisaPromoCard}
                    >
                      <div style={styles.paisaLogoBadge}>EasyPaisa Pipeline</div>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Status Configuration Option:</span>
                      <div style={{ fontSize: 13, color: "#10b981", fontWeight: 700, margin: "2px 0 0" }}>
                        ⚡ Micro-transaction Node Development Phase
                      </div>
                      <div style={styles.paisaClickHint}>Click interface panel for component parameters insight</div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          <button type="submit" style={styles.submitBtn}>
            {mode === "login" ? "Sign In →" : "Register Account ⚡"}
          </button>
        </form>

        <div style={styles.divider}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>OR</span>
          <div style={styles.dividerLine} />
        </div>

        <button onClick={handleGoogleLogin} style={styles.googleBtn}>
          <svg style={styles.googleIcon} viewBox="0 0 24 24" width="18" height="18">
            <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.107C18.29 1.445 15.46 0 12.24 0 5.58 0 0 5.37 0 12s5.58 12 12.24 12c6.96 0 11.57-4.83 11.57-11.74 0-.79-.085-1.393-.188-1.975H12.24z"/>
          </svg>
          <span>Google Access Link</span>
        </button>

        <p style={{ textAlign: "center", margin: 0, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
          {mode === "login" ? "New to the grid? " : "Already registered? "}
          <span 
            style={{ color: "#FACC15", cursor: "pointer", fontWeight: 700 }}
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Create Account" : "Access Console"}
          </span>
        </p>
      </motion.div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#0f0f0f", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'DM Sans', sans-serif", color: "#fff" },
  formContainer: { width: "100%", maxWidth: 400, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 24, padding: 32 },
  input: { width: "100%", padding: "13px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 15, marginBottom: 12, outline: "none", fontFamily: "inherit" },
  
  toggleContainer: { display: "flex", background: "rgba(255,255,255,0.04)", padding: 4, borderRadius: 12, marginBottom: 16, border: "1px solid rgba(255,255,255,0.06)" },
  toggleBtn: { flex: 1, padding: "10px", background: "transparent", border: "none", borderRadius: 9, color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" },
  toggleActive: { background: "rgba(255,255,255,0.08)", color: "#FACC15", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" },
  
  inputLabel: { fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" },
  paySelector: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" },
  paySelectorActive: { border: "1px solid rgba(250,204,21,0.4)", background: "rgba(250,204,21,0.05)", color: "#FACC15" },
  paySelectorActiveGrid: { border: "1px solid rgba(16,185,129,0.4)", background: "rgba(16,185,129,0.05)", color: "#10b981" },
  
  paisaPromoCard: { background: "linear-gradient(135deg, rgba(16,185,129,0.03) 0%, rgba(5,150,105,0.08) 100%)", border: "1px dashed rgba(16,185,129,0.25)", borderRadius: 14, padding: "14px 16px", marginBottom: 16, cursor: "pointer", position: "relative", userSelect: "none" },
  paisaLogoBadge: { position: "absolute", top: 12, right: 14, fontSize: 10, background: "#10b981", color: "#0f0f0f", padding: "2px 8px", borderRadius: 20, fontWeight: 800, textTransform: "uppercase" },
  paisaClickHint: { marginTop: 8, fontSize: 11, fontStyle: "italic", color: "rgba(16,185,129,0.7)", textAlign: "right" },

  submitBtn: { width: "100%", padding: "14px", background: "#FACC15", border: "none", borderRadius: 12, color: "#0f0f0f", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 4 },
  divider: { display: "flex", alignItems: "center", gap: 12, margin: "20px 0" },
  dividerLine: { flex: 1, height: 1, background: "rgba(255,255,255,0.1)" },
  dividerText: { color: "rgba(255,255,255,0.3)", fontSize: 13 },
  
  googleBtn: { width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, cursor: "pointer", color: "#fff", fontSize: 15, fontWeight: 500, marginBottom: 20, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 },
  googleIcon: { flexShrink: 0 },
  
  loadingOverlay: { position: "fixed", inset: 0, background: "rgba(10,10,11,0.95)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)" },
  boltSpinner: { fontSize: 44, width: 75, height: 75, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(250,204,21,0.1)", borderRadius: "50%", border: "2px solid #FACC15", margin: "0 auto 16px" },
  loadingText: { margin: 0, fontSize: 14, color: "rgba(255,255,255,0.6)", fontWeight: 500 }
};

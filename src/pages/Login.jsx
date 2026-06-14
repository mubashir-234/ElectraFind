import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { loadGoogleMaps } from "../firebase/config";
import toast from "react-hot-toast";

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Login() {
  const { signup, signupElectrician, login, loginWithGoogle } = useAuth();

  const [mode, setMode] = useState("login"); 
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("check");
  const [isPaisaAnimating, setIsPaisaAnimating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Google Location Data (only for signup)
  const [locationData, setLocationData] = useState({
    location: "",
    lat: null,
    lng: null,
    city: "",
    area: ""
  });

  const autocompleteRef = useRef(null);
  const navigate = useNavigate();

  // Load Google Places Autocomplete ONLY in Signup Mode
  useEffect(() => {
    if (mode !== "signup") {
      if (autocompleteRef.current) {
        autocompleteRef.current = null;
      }
      return;
    }

    loadGoogleMaps(() => {
      const input = document.getElementById("location-autocomplete");
      if (!input) return;

      autocompleteRef.current = new window.google.maps.places.Autocomplete(input, {
        types: ["geocode"],
        componentRestrictions: { country: "pk" }
      });

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current.getPlace();
        if (!place?.geometry) return;

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const fullAddress = place.formatted_address || "";

        let city = "";
        let area = "";
        place.address_components?.forEach(comp => {
          if (comp.types.includes("locality")) city = comp.long_name;
          if (comp.types.includes("sublocality") || comp.types.includes("neighborhood")) area = comp.long_name;
        });

        setLocationData({
          location: fullAddress,
          lat,
          lng,
          city: city || "",
          area: area || ""
        });
        setAddress(fullAddress);
      });
    });

    return () => {
      if (autocompleteRef.current) {
        autocompleteRef.current = null;
      }
    };
  }, [mode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Please fill in all credentials.");

    setLoading(true);
    try {
      if (mode === "login") {
        const { profile } = await login(email, password);
        navigate(profile?.role === "electrician" ? "/electrician/dashboard" : "/dashboard");
        toast.success("Logged in successfully!");
      } else {
        // Signup
        if (!name || !address) return toast.error("Please complete all fields.");

        const signupData = {
          name,
          location: locationData.location || address,
          lat: locationData.lat,
          lng: locationData.lng,
          city: locationData.city,
          area: locationData.area,
          paymentMethod,
          rating: 5,
          bio: ""
        };

        if (role === "electrician") {
          await signupElectrician(email, password, { ...signupData, role: "electrician" });
          toast.success("Electrician account created successfully!");
          navigate("/electrician/dashboard");
        } else {
          await signup(email, password, name);
          toast.success("Welcome to ElectraFind!");
          navigate("/dashboard");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Operation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Your existing Google Login and EasyPaisa handlers remain unchanged
  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await loginWithGoogle();
      toast.success("Signed in with Google!");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error("Google authentication aborted.");
    } finally {
      setLoading(false);
    }
  };

  const handleEasyPaisaClick = () => {
    setIsPaisaAnimating(true);
    toast("EasyPaisa integration coming soon!", { icon: '🚀' });
    setTimeout(() => setIsPaisaAnimating(false), 600);
  };

  return (
    <div style={styles.page}>
      <AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={styles.loadingOverlay}>
            <div style={{ textAlign: "center" }}>
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} style={styles.boltSpinner}>⚡</motion.div>
              <p style={styles.loadingText}>Processing your request...</p>
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
              <div style={styles.toggleContainer}>
                <button type="button" onClick={() => setRole("customer")} style={{...styles.toggleBtn, ...(role === "customer" ? styles.toggleActive : {})}}>Standard User</button>
                <button type="button" onClick={() => setRole("electrician")} style={{...styles.toggleBtn, ...(role === "electrician" ? styles.toggleActive : {})}}>Electrician Pro</button>
              </div>

              <input type="text" placeholder="Full Name" required value={name} onChange={(e) => setName(e.target.value)} style={styles.input} />
            </>
          )}

          <input type="email" placeholder="Email Address" required value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} />
          <input type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} />

          {mode === "signup" && (
            <>
              {/* Google Location Autocomplete - ONLY visible in signup */}
              <input 
                id="location-autocomplete"
                type="text" 
                placeholder="Type your location (e.g. Unit, Gulshan, Karachi...)" 
                required 
                value={address} 
                onChange={(e) => setAddress(e.target.value)} 
                style={styles.input} 
              />

              <div style={{ marginBottom: 14 }}>
                <label style={styles.inputLabel}>Preferred Payment Archetype</label>
                <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                  <button type="button" onClick={() => setPaymentMethod("check")} style={{...styles.paySelector, ...(paymentMethod === "check" ? styles.paySelectorActive : {})}}>🏦 Bank Check</button>
                  <button type="button" onClick={() => { setPaymentMethod("easypaisa"); handleEasyPaisaClick(); }} style={{...styles.paySelector, ...(paymentMethod === "easypaisa" ? styles.paySelectorActiveGrid : {})}}>EasyPaisa</button>
                </div>
              </div>
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
          <span style={{ color: "#FACC15", cursor: "pointer", fontWeight: 700 }} onClick={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "Create Account" : "Access Console"}
          </span>
        </p>
      </motion.div>
    </div>
  );
}

// Keep your original styles (unchanged)
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
import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { loadGoogleMaps } from "../../firebase/config";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }
};

const categories = [
  { label: "Wiring & Rewiring", icon: "🔌" },
  { label: "Panel Upgrade",     icon: "⚡" },
  { label: "Lighting Setup",    icon: "💡" },
  { label: "AC Installation",   icon: "❄️"  },
  { label: "Generator",        icon: "🔋" },
  { label: "Emergency Fix",    icon: "🚨" },
];

export default function UserDashboard() {
  const { currentUser, logout, userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [electricians, setElectricians] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [userLat, setUserLat] = useState(null);
  const [userLng, setUserLng] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState("");
  const [roleChecking, setRoleChecking] = useState(true);

  const autocompleteRef = useRef(null);

  // Role Guard (unchanged)
  useEffect(() => {
    async function verifyUserRole() {
      if (!currentUser) return;
      const incomingRole = location.state?.registeredRole;
      if (incomingRole === "electrician") {
        navigate("/electrician/dashboard", { replace: true });
        return;
      }
      if (userProfile?.role === "electrician") {
        navigate("/electrician/dashboard", { replace: true });
        return;
      }
      setRoleChecking(false);
    }
    verifyUserRole();
  }, [currentUser, userProfile, navigate, location.state]);

  // Load Google Places Autocomplete
  useEffect(() => {
    loadGoogleMaps(() => {
      const input = document.getElementById("google-location-input");
      if (!input) return;

      autocompleteRef.current = new window.google.maps.places.Autocomplete(input, {
        types: ["geocode"],
        componentRestrictions: { country: "pk" }
      });

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current.getPlace();
        if (place.geometry) {
          setUserLat(place.geometry.location.lat());
          setUserLng(place.geometry.location.lng());
          setLocationInput(place.formatted_address);
        }
      });
    });
  }, []);

  // Fetch Electricians
  useEffect(() => {
    if (roleChecking) return;
    let isMounted = true;
    async function fetchElectricians() {
      try {
        const snap = await getDocs(collection(db, "electricians"));
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (isMounted) {
          setElectricians(data);
          setFiltered(data);
        }
      } catch (e) {
        toast.error("Failed to load registered service professionals.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchElectricians();
    return () => { isMounted = false; };
  }, [roleChecking]);

  // Filtering (with distance if location selected)
  useEffect(() => {
    const searchNormalized = search.trim().toLowerCase();
    const locationNormalized = locationInput.trim().toLowerCase();

    let result = electricians.filter((e) => {
      const nameMatch = (e.name || "").toLowerCase().includes(searchNormalized);
      const skillMatch = (e.specialty || "").toLowerCase().includes(searchNormalized);
      const locMatch = (e.location || "").toLowerCase().includes(locationNormalized);
      const categoryMatch = selectedCat ? (e.specialty === selectedCat) : true;
      return (nameMatch || skillMatch) && locMatch && categoryMatch;
    });

    // Distance sorting if user location is set
    if (userLat && userLng) {
      result = result.map(el => {
        if (el.lat && el.lng) {
          const dist = getDistance(userLat, userLng, el.lat, el.lng);
          return { ...el, distance: dist };
        }
        return el;
      }).sort((a, b) => (a.distance || 999) - (b.distance || 999));
    }

    setFiltered(result);
  }, [search, locationInput, selectedCat, electricians, userLat, userLng]);

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  async function handleLogout() {
    try {
      await logout();
      navigate("/");
    } catch {
      toast.error("Sign out transaction aborted.");
    }
  }

  if (roleChecking || !currentUser) {
    return <div style={styles.page}><div style={styles.body}><h2 style={{...styles.sectionTitle, textAlign: "center", paddingTop: "5rem"}}>Verifying credential permissions...</h2></div></div>;
  }

  return (
    <div style={styles.page}>
      <motion.nav style={styles.nav} initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div onClick={() => navigate("/dashboard")} style={{ ...styles.navLogo, cursor: "pointer" }}>
          <span style={{ fontSize: 22 }}>⚡</span>
          <span style={styles.logoText}>ElectraFind</span>
        </div>
        <div style={styles.navRight}>
          <span style={styles.navUser}>
            {currentUser?.photoURL ? <img src={currentUser.photoURL} alt="" style={styles.avatar} /> : <div style={styles.avatarFallback}>{currentUser?.displayName?.[0] || currentUser?.email?.[0] || "U"}</div>}
            <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {currentUser?.displayName || currentUser?.email || "Authenticated User"}
            </span>
          </span>
          <button style={styles.logoutBtn} onClick={handleLogout}>Sign Out</button>
        </div>
      </motion.nav>

      <div style={styles.body}>
        <motion.div style={styles.hero} variants={fadeUp} initial="hidden" animate="visible" custom={0}>
          <h1 style={styles.heroTitle}>Find a Trusted Electrician<br /><span style={styles.heroAccent}>Near You</span></h1>
          <p style={styles.heroSub}>Book certified technicians for residential, commercial, or rapid deployment tasks.</p>

          <div style={styles.searchBar}>
            <div style={styles.searchField}>
              <span style={styles.searchIcon}>🔍</span>
              <input style={styles.searchInput} placeholder="Search by name or skill..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div style={styles.searchDivider} />
            <div style={styles.searchField}>
              <span style={styles.searchIcon}>📍</span>
              <input 
                id="google-location-input"
                style={styles.searchInput} 
                placeholder="Enter your location (Google Autocomplete)..." 
                value={locationInput} 
                onChange={(e) => setLocationInput(e.target.value)} 
              />
            </div>
            <button style={styles.searchBtn}>Search</button>
          </div>
        </motion.div>

        {/* Rest of your original code remains 100% unchanged */}
        <motion.div style={styles.cats} variants={fadeUp} initial="hidden" animate="visible" custom={1}>
          {categories.map((c) => (
            <motion.button key={c.label} style={{ ...styles.catBtn, ...(selectedCat === c.label ? styles.catActive : {}) }} onClick={() => setSelectedCat(selectedCat === c.label ? "" : c.label)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
              {c.icon} {c.label}
            </motion.button>
          ))}
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
          <h2 style={styles.sectionTitle}>
            {loading ? "Discovering profile nodes..." : `${filtered.length} Electrician${filtered.length !== 1 ? "s" : ""} Found`}
          </h2>
        </motion.div>

        {loading ? (
          <div style={styles.loadingGrid}>
            {[...Array(4)].map((_, i) => <motion.div key={i} style={styles.skeleton} animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div style={styles.empty} variants={fadeUp} initial="hidden" animate="visible">
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
            <p style={{ color: "rgba(255,255,255,0.4)", margin: 0 }}>No electricians match your specifications.</p>
          </motion.div>
        ) : (
          <div style={styles.grid}>
            {filtered.map((el, i) => (
              <motion.div key={el.id} style={styles.card} variants={fadeUp} initial="hidden" animate="visible" custom={i} whileHover={{ scale: 1.025, borderColor: "rgba(250,204,21,0.4)" }}>
                <div style={styles.cardTop}>
                  <div style={styles.cardAvatar}>
                    {el.photoURL ? <img src={el.photoURL} alt={el.name} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : <span style={{ fontSize: 22 }}>👷</span>}
                  </div>
                  <div style={{ overflow: "hidden", flex: 1 }}>
                    <p style={{ ...styles.cardName, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{el.name || "Electrician"}</p>
                    <p style={styles.cardSpec}>{el.specialty || "General Expert"}</p>
                  </div>
                  <div style={styles.cardRating}>⭐ {el.rating || "New"}</div>
                </div>
                <div style={styles.cardMeta}>
                  <span style={styles.metaTag}>📍 {el.location}</span>
                  {el.distance && <span style={{...styles.metaTag, background: "#4ade80", color: "#000"}}>{el.distance.toFixed(1)} km</span>}
                  <span style={styles.metaTag}>💰 Rs.{el.ratePerHour || "N/A"}/hr</span>
                  <span style={{ ...styles.metaTag, ...(el.available ? styles.metaAvail : styles.metaBusy) }}>
                    {el.available ? "✅ Available" : "🔴 Busy"}
                  </span>
                </div>
                <p style={styles.cardBio}>{el.bio || "Experienced technical engineer equipped for all diagnostic and maintenance workflows."}</p>
                <motion.button style={{ ...styles.bookBtn, background: el.available ? "#FACC15" : "rgba(255,255,255,0.05)", color: el.available ? "#0f0f0f" : "rgba(255,255,255,0.3)", border: el.available ? "none" : "1px solid rgba(255,255,255,0.08)", cursor: el.available ? "pointer" : "not-allowed" }} disabled={!el.available} onClick={() => navigate(`/book/${el.id}`)} whileHover={el.available ? { scale: 1.03 } : {}} whileTap={el.available ? { scale: 0.97 } : {}}>
                  {el.available ? "View Profile & Book →" : "Offline / Unavailable"}
                </motion.button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "linear-gradient(135deg, #0f0f0f 0%, #111108 100%)", fontFamily: "'DM Sans', sans-serif", color: "#fff" },
  nav: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 2rem", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(250,204,21,0.1)", position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)" },
  navLogo: { display: "flex", alignItems: "center", gap: 8 },
  logoText: { fontSize: 20, fontWeight: 700, color: "#FACC15" },
  navRight: { display: "flex", alignItems: "center", gap: 16 },
  navUser: { display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.7)", fontSize: 14 },
  avatar: { width: 30, height: 30, borderRadius: "50%", objectFit: "cover" },
  avatarFallback: { width: 30, height: 30, borderRadius: "50%", background: "#FACC15", color: "#0f0f0f", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 },
  logoutBtn: { background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontFamily: "inherit" },
  body: { padding: "0 2rem 4rem", maxWidth: 1100, margin: "0 auto" },
  hero: { textAlign: "center", padding: "4rem 0 2rem" },
  heroTitle: { fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 800, lineHeight: 1.15, margin: "0 0 1rem" },
  heroAccent: { color: "#FACC15" },
  heroSub: { color: "rgba(255,255,255,0.5)", fontSize: 16, marginBottom: "2rem" },
  searchBar: { display: "flex", alignItems: "center", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(250,204,21,0.2)", borderRadius: 16, padding: "6px 6px 6px 0", maxWidth: 700, margin: "0 auto", flexWrap: "wrap", gap: 0 },
  searchField: { display: "flex", alignItems: "center", flex: 1, padding: "0 16px", minWidth: 160 },
  searchIcon: { fontSize: 16, marginRight: 8, opacity: 0.6 },
  searchInput: { background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 15, width: "100%", fontFamily: "inherit", padding: "10px 0" },
  searchDivider: { width: 1, height: 32, background: "rgba(255,255,255,0.12)", flexShrink: 0 },
  searchBtn: { background: "#FACC15", border: "none", borderRadius: 12, padding: "12px 24px", fontWeight: 700, fontSize: 15, color: "#0f0f0f", cursor: "pointer", fontFamily: "inherit", margin: "0 0 0 8px", flexShrink: 0 },
  cats: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", margin: "1.5rem 0" },
  catBtn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 100, padding: "8px 16px", color: "rgba(255,255,255,0.7)", fontSize: 13, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" },
  catActive: { background: "rgba(250,204,21,0.15)", border: "1px solid #FACC15", color: "#FACC15" },
  sectionTitle: { fontSize: 18, fontWeight: 600, color: "rgba(255,255,255,0.7)", margin: "1rem 0 1.5rem" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 },
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "1.25rem", transition: "all 0.25s ease", cursor: "default" },
  cardTop: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12 },
  cardAvatar: { width: 48, height: 48, borderRadius: "50%", background: "rgba(250,204,21,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" },
  cardName: { margin: 0, fontWeight: 700, fontSize: 16 },
  cardSpec: { margin: 0, fontSize: 13, color: "#FACC15", opacity: 0.8 },
  cardRating: { marginLeft: "auto", fontSize: 13, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap" },
  cardMeta: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 },
  metaTag: { background: "rgba(34,197,94,0.12)", borderRadius: 6, padding: "3px 8px", fontSize: 12, color: "#4ade80" },
  metaAvail: { background: "rgba(34,197,94,0.12)", color: "#4ade80" },
  metaBusy: { background: "rgba(239,68,68,0.12)", color: "#f87171" },
  cardBio: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 14, lineHeight: 1.5 },
  bookBtn: { width: "100%", padding: "10px 0", borderRadius: 10, fontWeight: 700, fontSize: 14, fontFamily: "inherit" },
  loadingGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 },
  skeleton: { height: 240, background: "rgba(255,255,255,0.05)", borderRadius: 18 },
  empty: { textAlign: "center", padding: "4rem 0" },
};
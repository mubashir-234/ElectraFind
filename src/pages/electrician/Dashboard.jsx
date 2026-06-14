import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { 
  collection, doc, getDoc, updateDoc, onSnapshot, serverTimestamp, 
  query, where, increment 
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

export default function ElectricianDashboard() {
  const { currentUser, logout, userProfile, setElectricianOnline } = useAuth();
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeBooking, setActiveBooking] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [selectedArrivalTime, setSelectedArrivalTime] = useState(30);
  const [totalIncome, setTotalIncome] = useState(0);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [watchId, setWatchId] = useState(null);
const [showChat, setShowChat] = useState(false);
  // Role Verification
  useEffect(() => {
    async function verifyElectrician() {
      if (!currentUser?.uid) return;
      try {
        const elecSnap = await getDoc(doc(db, "electricians", currentUser.uid));
        if (!elecSnap.exists()) {
          navigate("/dashboard");
          return;
        }
        await setElectricianOnline(currentUser.uid, true);
        setIsVerified(true);
      } catch (err) {
        navigate("/");
      }
    }
    verifyElectrician();
  }, [currentUser]);

  // Real-time Bookings
  useEffect(() => {
    if (!isVerified || !currentUser?.uid) return;

    const q = query(collection(db, "bookings"), where("electricianId", "==", currentUser.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      setActiveBooking(all.find(b => b.status === "accepted") || null);
      setRequests(all.filter(b => b.status === "pending"));
      
      const completed = all.filter(b => b.status === "completed");
      setHistory(completed);

      const income = completed.reduce((sum, job) => sum + (job.rateOffer || 0), 0);
      setTotalIncome(income);
    });

    return () => unsub();
  }, [currentUser, isVerified]);

  // Live Location Sharing
  const toggleLiveLocation = async () => {
    if (!activeBooking) return toast.error("No active booking found");

    if (isSharingLocation) {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      setIsSharingLocation(false);
      toast.success("Live tracking stopped");
      return;
    }

    if (!navigator.geolocation) return toast.error("Geolocation not supported");

    const id = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        await updateDoc(doc(db, "electricians", currentUser.uid), {
          lat: latitude,
          lng: longitude,
          lastLocationUpdate: serverTimestamp()
        });
      },
      () => toast.error("Failed to get location"),
      { enableHighAccuracy: true }
    );

    setWatchId(id);
    setIsSharingLocation(true);
    toast.success("✅ Live tracking started!");
  };

  const handleAccept = async (bookingId) => {
    try {
      await updateDoc(doc(db, "bookings", bookingId), {
        status: "accepted",
        acceptedAt: serverTimestamp(),
        chatEnabled: true,
        estimatedArrival: selectedArrivalTime
      });
      toast.success(`Request Accepted! ETA: ${selectedArrivalTime} mins`);
    } catch (err) {
      toast.error("Failed to accept request");
    }
  };

  const handleDecline = async (bookingId) => {
    try {
      await updateDoc(doc(db, "bookings", bookingId), { status: "declined" });
      toast.success("Request Declined");
    } catch (err) {
      toast.error("Failed to decline request");
    }
  };

  const handleWorkCompleted = async (bookingId, amount) => {
  try {
    await updateDoc(doc(db, "bookings", bookingId), {
      status: "completed",
      completedAt: serverTimestamp(),
      feedbackSubmitted: false,     // ← This was missing
    });

    // Update electrician's total income
    await updateDoc(doc(db, "electricians", currentUser.uid), {
      totalIncome: increment(amount)
    });

    toast.success(`Job Completed Successfully! ₹${amount} Added`);

    // Clean up active booking (keeps UI smooth)
    setActiveBooking(null);

  } catch (err) {
    console.error(err);
    toast.error("Failed to complete job");
  }
};

  const handleLogout = async () => {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    await setElectricianOnline(currentUser.uid, false);
    await logout();
    navigate("/");
  };

  if (!isVerified) {
    return <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>Verifying Account...</div>;
  }

  return (
    <div style={styles.container}>
      <nav style={styles.nav}>
        <div style={styles.logo}>
          <span style={{ fontSize: 28 }}>⚡</span>
          <span style={styles.logoText}>ElectraFind</span>
        </div>
        <div style={styles.navRight}>
          <div style={styles.userInfo}>
            <div style={styles.avatar}>{userProfile?.name?.[0] || "E"}</div>
            <div>
              <p style={styles.name}>{userProfile?.name}</p>
              <p style={styles.status}>🟢 Online</p>
            </div>
          </div>
          <div style={styles.incomeBox}>💰 ₹{totalIncome}</div>
          <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
        </div>
      </nav>

      <div style={styles.main}>
        {/* Sidebar - History */}
        <div style={styles.sidebar}>
          <h3 style={styles.sidebarTitle}>📜 Job History</h3>
          {history.length === 0 ? (
            <p style={styles.emptyText}>No completed jobs yet</p>
          ) : (
            history.map((job) => (
              <motion.div key={job.id} style={styles.historyCard} whileHover={{ scale: 1.02 }}>
                <p style={styles.historyName}>{job.customerName}</p>
                <p style={styles.historyIssue}>{job.description?.substring(0, 55)}...</p>
                <span style={styles.historyStatus}>₹{job.rateOffer}</span>
              </motion.div>
            ))
          )}
        </div>

        {/* Main Content */}
        <div style={styles.content}>
          <h2 style={styles.pageTitle}>Service Control Center</h2>

          {/* Active Booking */}
          {activeBooking && (
            <div style={styles.activeBookingCard}>
              <div style={styles.activeHeader}>
                <strong>ONGOING JOB</strong>
                <span style={styles.amount}>₹{activeBooking.rateOffer}</span>
              </div>
              <p style={{ fontSize: 17, fontWeight: 600, margin: "10px 0" }}>
                {activeBooking.customerName}
              </p>
              <p style={styles.issue}>{activeBooking.description}</p>

              <div style={styles.locationCard}>
                <h4 style={{ margin: "0 0 12px 0", color: "#4ade80" }}>📍 Live Location Sharing</h4>
                <p style={{ fontSize: 14, color: "#aaa", marginBottom: 16 }}>
                  Share your real-time location so the customer can track your movement.
                </p>
                <button 
                  onClick={toggleLiveLocation}
                  style={{ ...styles.completeBtn, background: isSharingLocation ? "#ef4444" : "#3b82f6", marginBottom: 12 }}
                >
                  {isSharingLocation ? "⏹ STOP LIVE TRACKING" : "🚀 START LIVE TRACKING"}
                </button>
              </div>

              <button onClick={() => handleWorkCompleted(activeBooking.id, activeBooking.rateOffer)} style={styles.completeBtn}>
                ✅ Mark Job as Completed
              </button>
            </div>
          )}

          {/* Incoming Requests - FULLY FIXED */}
          <h3 style={styles.sectionTitle}>📥 Incoming Requests</h3>

          <AnimatePresence>
            {requests.length === 0 ? (
              <div style={styles.noRequests}>
                <div style={{ fontSize: 60 }}>📭</div>
                <p>No new requests at the moment</p>
              </div>
            ) : (
              requests.map((req, i) => (
                <motion.div 
                  key={req.id} 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: i * 0.08 }} 
                  style={styles.requestCard}
                >
                  <div style={styles.requestHeader}>
                    <div>
                      <h4>{req.customerName}</h4>
                      <p style={styles.time}>
                        {new Date(req.createdAt?.seconds * 1000 || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span style={styles.amount}>₹{req.rateOffer}</span>
                  </div>

                  <p style={styles.issue}>{req.description}</p>

                  <div style={{ marginTop: 16 }}>
                    <label style={{ fontSize: 13, color: "#aaa", display: "block", marginBottom: 8 }}>
                      Estimated Arrival (minutes)
                    </label>
                    <input
                      type="number"
                      value={selectedArrivalTime}
                      onChange={(e) => setSelectedArrivalTime(Number(e.target.value))}
                      style={styles.etaInput}
                    />
                    <button onClick={() => handleAccept(req.id)} style={styles.acceptBtn}>
                      Accept & Set ETA
                    </button>
                  </div>

                  <button onClick={() => handleDecline(req.id)} style={styles.declineBtn}>
                    Decline Request
                  </button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Chat Panel */}
        <AnimatePresence>
          {activeBooking && (
            <motion.div 
              initial={{ x: 400, opacity: 0 }} 
              animate={{ x: 0, opacity: 1 }} 
              exit={{ x: 400, opacity: 0 }} 
              style={styles.chatPanel}
            >
              <div style={styles.chatHeader}>
                <h3>💬 Live Chat</h3>
                <button onClick={() => setShowChat(!showChat)} style={styles.toggleChatBtn}>
                  {showChat ? "Hide" : "Open"}
                </button>
              </div>

              {showChat ? (
                <iframe src={`/chat/${activeBooking.id}`} style={styles.chatFrame} title="Live Chat" />
              ) : (
                <div style={styles.chatPrompt}>
                  <p>Chat with {activeBooking.customerName}</p>
                  <button onClick={() => setShowChat(true)} style={styles.openChatBtn}>
                    Open Live Chat
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Styles (Your Original Design Preserved)
const styles = {
  container: { minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "'DM Sans', sans-serif" },
  nav: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 2.5rem", background: "rgba(17,17,17,0.98)", borderBottom: "1px solid rgba(250,204,21,0.15)", position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)" },
  logo: { display: "flex", alignItems: "center", gap: 12, fontSize: 26, fontWeight: 800 },
  logoText: { color: "#FACC15" },
  navRight: { display: "flex", alignItems: "center", gap: 20 },
  userInfo: { display: "flex", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: "50%", background: "#FACC15", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18 },
  name: { margin: 0, fontWeight: 600 },
  status: { margin: 0, fontSize: 13, color: "#4ade80" },
  incomeBox: { background: "rgba(74,222,128,0.1)", color: "#4ade80", padding: "8px 18px", borderRadius: 12, fontWeight: 700, border: "1px solid rgba(74,222,128,0.2)" },
  logoutBtn: { padding: "9px 20px", background: "#ef4444", border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 600 },

  main: { display: "grid", gridTemplateColumns: "300px 1fr 380px", height: "calc(100vh - 78px)", overflow: "hidden" },
  sidebar: { background: "#111", padding: "2rem 1.5rem", borderRight: "1px solid #222", overflowY: "auto" },
  sidebarTitle: { margin: "0 0 1.5rem", color: "#aaa", fontSize: 15, fontWeight: 600, textTransform: "uppercase" },
  historyCard: { background: "#1a1a1a", padding: 18, borderRadius: 16, marginBottom: 14, border: "1px solid #222" },
  historyName: { margin: "0 0 6px", fontWeight: 700 },
  historyIssue: { fontSize: 13.5, color: "#888", marginBottom: 10, lineHeight: 1.4 },
  historyStatus: { fontSize: 13, padding: "4px 12px", background: "#222", borderRadius: 20, color: "#4ade80", fontWeight: 600 },
  emptyText: { color: "#666", textAlign: "center", marginTop: "auto", padding: "3rem 1rem" },

  content: { padding: "2.5rem", overflowY: "auto" },
  pageTitle: { fontSize: 28, fontWeight: 800, marginBottom: "2rem" },
  sectionTitle: { margin: "2.5rem 0 1.5rem", color: "#aaa", fontSize: 16, fontWeight: 600 },
  
  activeBookingCard: { background: "linear-gradient(145deg, #1a2a1f, #111)", border: "1px solid #4ade80", borderRadius: 20, padding: "2rem", marginBottom: "2.5rem" },
  activeHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, fontSize: 15, color: "#4ade80", fontWeight: 700 },
  issue: { fontSize: 15.5, lineHeight: 1.6, color: "#ddd", marginBottom: 20 },

  locationCard: {
    background: "rgba(59, 130, 246, 0.1)",
    border: "1px solid rgba(59, 130, 246, 0.3)",
    borderRadius: 16,
    padding: "18px",
    margin: "15px 0 20px 0"
  },

  requestCard: { background: "#161616", border: "1px solid rgba(250,204,21,0.3)", borderRadius: 20, padding: "2rem", marginBottom: "2rem" },
  requestHeader: { display: "flex", justifyContent: "space-between", marginBottom: 20 },
  time: { fontSize: 13.5, color: "#888", marginTop: 4 },
  amount: { background: "#FACC15", color: "#000", padding: "8px 18px", borderRadius: 30, fontWeight: 700 },

  etaInput: { width: "100%", padding: "14px", background: "#222", border: "1px solid #444", borderRadius: 12, color: "#fff", marginBottom: 16 },
  acceptBtn: { width: "100%", padding: "15px", background: "#052e16", color: "#4ade80", border: "1px solid #4ade80", borderRadius: 14, fontWeight: 700, cursor: "pointer" },
  declineBtn: { width: "100%", padding: "15px", background: "#450a0a", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 14, fontWeight: 600, cursor: "pointer", marginTop: 12 },
  completeBtn: { width: "100%", padding: "16px", background: "#10b981", color: "#000", border: "none", borderRadius: 14, fontWeight: 700, cursor: "pointer", marginTop: 12 },

  chatPanel: { background: "#111", borderLeft: "1px solid #222", padding: "1.5rem", display: "flex", flexDirection: "column" },
  chatHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #222" },
  toggleChatBtn: { padding: "8px 18px", background: "#FACC15", color: "#000", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer" },
  chatFrame: { flex: 1, border: "none", borderRadius: 16, background: "#0a0a0a" },
  chatPrompt: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "#888" },
  openChatBtn: { marginTop: 20, padding: "14px 32px", background: "#FACC15", color: "#000", border: "none", borderRadius: 14, fontWeight: 700 }
};
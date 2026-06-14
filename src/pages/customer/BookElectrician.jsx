import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, addDoc, collection, onSnapshot, updateDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { loadGoogleMaps } from "../../firebase/config";

export default function BookElectrician() {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [electrician, setElectrician] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offerAmount, setOfferAmount] = useState("");
  const [description, setDescription] = useState("");
  const [bookingId, setBookingId] = useState(null);
  const [bookingData, setBookingData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  // Google Maps
  const [map, setMap] = useState(null);
  const mapRef = useRef(null);

  // Customer Location (for booking)
  const [userLat, setUserLat] = useState(null);
  const [userLng, setUserLng] = useState(null);
  const [userAddress, setUserAddress] = useState("");

  // Fetch Electrician
  useEffect(() => {
    async function fetchElectrician() {
      try {
        const snap = await getDoc(doc(db, "electricians", id));
        if (snap.exists()) setElectrician({ id: snap.id, ...snap.data() });
      } catch {
        toast.error("Failed to load electrician.");
      } finally {
        setLoading(false);
      }
    }
    fetchElectrician();
  }, [id]);

  // Auto-detect Customer Location (optional - can be manual too)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLat(position.coords.latitude);
          setUserLng(position.coords.longitude);
        },
        () => toast.info("Please allow location access for better tracking")
      );
    }
  }, []);

  // Check for existing active booking
  useEffect(() => {
    if (!currentUser?.uid || !id) return;

    async function checkExistingBooking() {
      try {
        const q = query(
          collection(db, "bookings"),
          where("customerId", "==", currentUser.uid)
        );
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const docs = snap.docs.filter(d => 
            d.data().status === "accepted" || d.data().status === "pending"
          );
          if (docs.length > 0) {
            setBookingId(docs[0].id);
          }
        }
      } catch (err) {
        console.log("Checking for existing booking:", err);
      }
    }
    checkExistingBooking();
  }, [currentUser, id]);

  // Real-time Booking Listener
  useEffect(() => {
    if (!bookingId) return;

    const unsub = onSnapshot(doc(db, "bookings", bookingId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setBookingData(data);

        if (data.status === "accepted" && data.estimatedArrival) {
          const arrivalMinutes = data.estimatedArrival;
          const setTime = data.estimatedArrivalSetAt?.toDate?.() || new Date();
          const endTime = new Date(setTime.getTime() + arrivalMinutes * 60000);
          startCountdown(endTime);
        }
      }
    });

    return () => unsub();
  }, [bookingId]);

  const startCountdown = (endTime) => {
    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((endTime - now) / 1000);

      if (diff <= 0) {
        setTimeLeft(0);
        clearInterval(interval);
        toast.error("Estimated time exceeded.");
      } else {
        setTimeLeft(diff);
      }
    }, 1000);

    return () => clearInterval(interval);
  };

  // Initialize Map when booking is accepted
  useEffect(() => {
    if (bookingData?.status === "accepted" && bookingData.customerLat && bookingData.customerLng) {
      loadGoogleMaps(() => {
        if (!mapRef.current) return;

        const mapInstance = new window.google.maps.Map(mapRef.current, {
          zoom: 16,
          center: { lat: bookingData.customerLat, lng: bookingData.customerLng },
          mapTypeId: "roadmap",
        });

        setMap(mapInstance);

        // Customer Location Pin
        new window.google.maps.Marker({
          position: { lat: bookingData.customerLat, lng: bookingData.customerLng },
          map: mapInstance,
          title: "Your Location",
          icon: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
        });

        // Electrician Location (if available)
        if (bookingData.electricianLat && bookingData.electricianLng) {
          new window.google.maps.Marker({
            position: { lat: bookingData.electricianLat, lng: bookingData.electricianLng },
            map: mapInstance,
            title: "Electrician",
            icon: "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
          });
        }
      });
    }
  }, [bookingData]);

  const handleRequest = async (e) => {
    e.preventDefault();
    const parsedAmount = parseFloat(offerAmount);

    if (isNaN(parsedAmount) || parsedAmount < 200 || parsedAmount > 6000) {
      toast.error("Budget must be between Rs. 200 - 6000");
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "bookings"), {
        customerId: currentUser.uid,
        customerName: currentUser.displayName || currentUser.email,
        customerLat: userLat,
        customerLng: userLng,
        customerAddress: userAddress || "Location captured",
        electricianId: electrician.id,
        electricianName: electrician.name,
        rateOffer: parsedAmount,
        description,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setBookingId(docRef.id);
      toast.success("Request sent to electrician!");
    } catch {
      toast.error("Failed to send request.");
    }
  };

  const formatTime = (seconds) => {
    if (!seconds) return "00:00";
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const handleOpenChat = () => {
    if (bookingId) {
      navigate(`/chat/${bookingId}`);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Service Request</h1>

        {electrician && (
          <div style={styles.elCard}>
            <div style={styles.elAvatar}>👷</div>
            <div>
              <h3 style={styles.elName}>{electrician.name}</h3>
              <p style={styles.elSpec}>{electrician.specialty}</p>
              <div style={styles.elMeta}>
                <span>📍 {electrician.location}</span>
                <span>⭐ {electrician.rating || "New"}</span>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Booking Form */}
          {!bookingId && (
            <motion.div variants={fadeUp} initial="hidden" animate="visible" style={styles.formCard}>
              <form onSubmit={handleRequest}>
                <div style={{ marginBottom: 16 }}>
                  <label style={styles.label}>Budget Offer (Rs.)</label>
                  <input 
                    type="number" 
                    required 
                    placeholder="1500" 
                    value={offerAmount} 
                    onChange={(e) => setOfferAmount(e.target.value)} 
                    style={styles.input} 
                  />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={styles.label}>Describe the Issue</label>
                  <textarea 
                    required 
                    placeholder="Fan not working, short circuit..." 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    style={styles.textarea} 
                  />
                </div>
                <button type="submit" style={styles.submitBtn}>Send Request ⚡</button>
              </form>
            </motion.div>
          )}

          {/* Pending Status */}
          {bookingData?.status === "pending" && (
            <motion.div variants={fadeUp} style={styles.statusCard}>
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2 }} style={styles.radarIcon}>📡</motion.div>
              <h2>Waiting for Electrician Response...</h2>
              <p style={{ color: "rgba(255,255,255,0.5)", marginTop: 12 }}>You will be notified once they accept.</p>
            </motion.div>
          )}

          {/* Accepted + Live Tracking */}
          {bookingData?.status === "accepted" && (
            <motion.div variants={fadeUp} style={styles.successCard}>
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: 3, duration: 0.8 }} style={{ fontSize: 70, marginBottom: 10 }}>🎉</motion.div>
              
              <h2 style={{ color: "#4ade80", marginBottom: 8 }}>Request Accepted!</h2>
              <p><strong>{bookingData.electricianName}</strong> is on the way</p>

              {timeLeft !== null && (
                <div style={styles.timerContainer}>
                  <p style={styles.timerLabel}>Estimated Arrival</p>
                  <motion.div 
                    style={styles.timer} 
                    animate={{ scale: timeLeft < 300 ? [1, 1.08, 1] : 1 }} 
                    transition={{ repeat: Infinity, duration: 1.2 }}
                  >
                    {formatTime(timeLeft)}
                  </motion.div>
                  <p style={styles.timerSub}>minutes remaining</p>
                </div>
              )}

              {/* Google Map */}
              <div style={{ margin: "25px 0" }}>
                <h3 style={{ marginBottom: 10, color: "#4ade80" }}>Live Tracking Map</h3>
                <div 
                  ref={mapRef} 
                  style={{ 
                    height: "380px", 
                    borderRadius: 16, 
                    border: "2px solid #4ade80",
                    background: "#111" 
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 25 }}>
                <button onClick={handleOpenChat} style={styles.chatBtn}>
                  💬 Open Live Chat
                </button>
                <button onClick={() => navigate("/dashboard")} style={styles.backBtn}>
                  ← Back to Dashboard
                </button>
              </div>
            </motion.div>
          )}

          {/* Declined */}
          {bookingData?.status === "declined" && (
            <motion.div variants={fadeUp} style={styles.failCard}>
              <div style={{ fontSize: 70 }}>😔</div>
              <h2 style={{ color: "#f87171" }}>Request Declined</h2>
              <button onClick={() => navigate("/dashboard")} style={styles.submitBtn}>Find Another Electrician</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };

const styles = {
  page: { minHeight: "100vh", background: "#0f0f0f", color: "#fff", fontFamily: "'DM Sans', sans-serif", padding: "40px 20px" },
  container: { maxWidth: 520, margin: "0 auto" },
  title: { fontSize: 28, fontWeight: 800, textAlign: "center", marginBottom: 30 },
  elCard: { display: "flex", gap: 16, alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(250,204,21,0.2)", borderRadius: 16, padding: "1.25rem", marginBottom: 30 },
  elAvatar: { width: 70, height: 70, borderRadius: "50%", background: "rgba(250,204,21,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 },
  elName: { margin: 0, fontSize: 20, fontWeight: 700 },
  elSpec: { margin: "4px 0 6px", color: "#FACC15", fontSize: 15 },
  elMeta: { display: "flex", gap: 16, fontSize: 14, color: "rgba(255,255,255,0.6)" },

  formCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 28 },
  label: { display: "block", fontSize: 14, marginBottom: 8, color: "rgba(255,255,255,0.6)" },
  input: { width: "100%", padding: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 16 },
  textarea: { width: "100%", height: 110, padding: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", resize: "none", fontSize: 16 },

  submitBtn: { width: "100%", padding: 16, background: "#FACC15", color: "#000", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: "pointer" },

  statusCard: { textAlign: "center", padding: "4rem 2rem", background: "rgba(255,255,255,0.03)", borderRadius: 20 },

  successCard: { textAlign: "center", padding: "3rem 2rem", background: "rgba(16,185,129,0.1)", border: "1px solid #4ade80", borderRadius: 20 },
  timerContainer: { margin: "25px 0", padding: "20px", background: "rgba(0,0,0,0.3)", borderRadius: 16 },
  timerLabel: { color: "#aaa", marginBottom: 8 },
  timer: { fontSize: 52, fontWeight: 800, color: "#4ade80", fontFamily: "monospace" },
  timerSub: { color: "#aaa", marginTop: 6 },

  chatBtn: { flex: 1, padding: 16, background: "#4ade80", color: "#000", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: "pointer" },
  backBtn: { flex: 1, padding: 16, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 12, fontWeight: 600, cursor: "pointer" },

  failCard: { textAlign: "center", padding: "4rem 2rem", background: "rgba(239,68,68,0.1)", border: "1px solid #f87171", borderRadius: 20 }
};
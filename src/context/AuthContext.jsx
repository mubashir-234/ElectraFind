import React, { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, googleProvider, db } from "../firebase/config";

const AuthContext = createContext();

export function useAuth() { 
  return useContext(AuthContext); 
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function saveUserToFirestore(user, extraData = {}) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    
    let profileData = null;

    if (!userSnap.exists()) {
      profileData = {
        uid: user.uid,
        name: user.displayName || extraData.name || "User",
        email: user.email,
        photoURL: user.photoURL || "",
        // ✅ FIX: Always default to "customer" for regular users, never "user"
        role: extraData.role || "customer",
        createdAt: serverTimestamp(),
        ...extraData,
      };
      
      if (profileData.password) delete profileData.password;

      await setDoc(userRef, profileData);

      if (profileData.role === "electrician") {
        const elecRef = doc(db, "electricians", user.uid);
        await setDoc(elecRef, {
          uid: user.uid,
          name: profileData.name,
          email: profileData.email,
          photoURL: profileData.photoURL,
          online: false,
          available: false,
          specialty: extraData.specialty || "",
          location: extraData.location || "",
          ratePerHour: extraData.ratePerHour || "",
          experience: extraData.experience || "",
          bio: extraData.bio || "",
          createdAt: profileData.createdAt
        });
      }
    } else {
      const existingData = userSnap.data();
      profileData = { ...existingData };

      if (extraData.location || extraData.lat) {
        const structuralUpdates = {
          location: extraData.location,
          lat: extraData.lat,
          lng: extraData.lng,
          city: extraData.city || existingData.city || "",
          area: extraData.area || existingData.area || ""
        };
        
        await updateDoc(userRef, structuralUpdates);
        profileData = { ...profileData, ...structuralUpdates };

        if (existingData.role === "electrician") {
          await updateDoc(doc(db, "electricians", user.uid), structuralUpdates);
        }
      }
    }

    setUserProfile(profileData);
    return profileData;
  }

  // ✅ FIX: signup explicitly passes role: "customer" — never ambiguous
  async function signup(email, password, name) {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName: name });
    const profile = await saveUserToFirestore(result.user, { name, role: "customer" });
    return { result, profile };
  }

  // ✅ signupElectrician explicitly passes role: "electrician" — always consistent
  async function signupElectrician(email, password, formData) {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName: formData.name });
    
    const profile = await saveUserToFirestore(result.user, {
      role: "electrician",
      online: false,
      available: false,
      ...formData
    });
    
    return { result, profile };
  }

  async function login(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, "users", result.user.uid));
    
    let profile = null;
    if (snap.exists()) {
      profile = snap.data();
      setUserProfile(profile);
    }
    return { result, profile };
  } catch (error) {
    console.error("Login failed:", error);
    throw error; // Let the component handle the error message
  }
}

  async function loginWithGoogle(selectedRole = "customer") {
    const result = await signInWithPopup(auth, googleProvider);
    
    const checkSnap = await getDoc(doc(db, "users", result.user.uid));
    // ✅ FIX: Existing users keep their stored role; new Google users default to "customer"
    const finalRole = checkSnap.exists() ? (checkSnap.data().role || selectedRole) : selectedRole;
    
    const profile = await saveUserToFirestore(result.user, { role: finalRole });
    return { result, profile };
  }

  async function setElectricianOnline(uid, isOnline) {
    const statusPayload = { online: isOnline, available: isOnline };
    await updateDoc(doc(db, "electricians", uid), statusPayload);
    await updateDoc(doc(db, "users", uid), statusPayload);
    
    setUserProfile((prev) => (prev ? { ...prev, ...statusPayload } : null));
  }

  async function saveLocationToFirestore(uid, locationData) {
    await updateDoc(doc(db, "users", uid), locationData);
    
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists() && snap.data().role === "electrician") {
      await updateDoc(doc(db, "electricians", uid), locationData);
    }
    
    setUserProfile((prev) => (prev ? { ...prev, ...locationData } : null));
  }

  async function logout() {
    if (currentUser && userProfile?.role === "electrician") {
      try {
        await setElectricianOnline(currentUser.uid, false);
      } catch (err) {
        console.error("Failed to unset online status during session termination: ", err);
      }
    }
    setUserProfile(null);
    return signOut(auth);
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists()) {
            const fetchedProfile = snap.data();
            setUserProfile(fetchedProfile);
          }
        } catch (error) {
          console.error("Error matching profile details:", error);
        }
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const value = {
    currentUser,
    userProfile,
    signup,
    signupElectrician,
    login,
    loginWithGoogle,
    logout,
    setElectricianOnline,
    saveLocationToFirestore,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

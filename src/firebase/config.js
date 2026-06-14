import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCZz4TN0qEXOZZyEUQf1cLEj3fTgvF-8J8",
  authDomain: "electrafind-87abc.firebaseapp.com",
  projectId: "electrafind-87abc",
  storageBucket: "electrafind-87abc.firebasestorage.app",
  messagingSenderId: "324731272406",
  appId: "1:324731272406:web:d63352e3e6497f9ac49d77"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// ─── Google Maps Loader ───────────────────────────────────────────────────────
// Singleton promise stored on window so it survives Vite HMR module re-runs.
// The Maps JS API "callback=" parameter guarantees window.google.maps.Map is a
// real constructor before we resolve — fixing "Map is not a constructor".
export const loadGoogleMaps = (callback) => {
  // 1. Already fully loaded → call back immediately
  if (
    typeof window.google !== "undefined" &&
    window.google.maps &&
    typeof window.google.maps.Map === "function"
  ) {
    callback();
    return;
  }

  // 2. Script already injected (loading in progress) → queue the callback
  if (window.__mapsPromise__) {
    window.__mapsPromise__.then(callback).catch(() => {});
    return;
  }

  // 3. First call → inject the script exactly once
  window.__mapsPromise__ = new Promise((resolve, reject) => {
    // Safety: if Maps somehow loaded between checks
    if (
      typeof window.google !== "undefined" &&
      window.google.maps &&
      typeof window.google.maps.Map === "function"
    ) {
      resolve();
      return;
    }

    // The Maps API will call this global function when it is 100% ready
    window.__googleMapsReady__ = () => {
      resolve();
      delete window.__googleMapsReady__;
    };

    const script = document.createElement("script");
    script.src =
      "https://maps.googleapis.com/maps/api/js" +
      "?key=AIzaSyA_z0QBC3bFYpVrHbzc2iP4af03IC9o_bc" +
      "&libraries=places" +
      "&callback=__googleMapsReady__";
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      delete window.__mapsPromise__;
      reject(new Error("Google Maps script failed to load"));
    };
    document.head.appendChild(script);
  });

  window.__mapsPromise__.then(callback).catch(() => {
    console.error("Google Maps could not be loaded.");
  });
};

export default app;

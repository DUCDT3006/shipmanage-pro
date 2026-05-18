/**
 * Firebase Integration & Cloud Database Sync V2.0 (Firestore Version)
 */

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAoAhYpcijQZ0Wgs8ZwtMmcyWX3-pf7jmQ",
  authDomain: "shipmanagevgt.firebaseapp.com",
  projectId: "shipmanagevgt",
  storageBucket: "shipmanagevgt.firebasestorage.app",
  messagingSenderId: "266936765184",
  appId: "1:266936765184:web:52abed9b1caa12ffaec1e5",
  measurementId: "G-P5N1346GZS"
};

let db = null;
let isFirebaseInitialized = false;

function initFirebase() {
    try {
        if (typeof firebase !== 'undefined') {
            firebase.initializeApp(firebaseConfig);
            if (typeof firebase.analytics === 'function') {
                firebase.analytics();
            }
            db = firebase.firestore();
            isFirebaseInitialized = true;
            console.log("Firebase Firestore initialized successfully!");
            setupFirebaseSync();
        } else {
            console.warn("Firebase SDK is not loaded. Working in local-only mode.");
            updateServerStatus('offline', 'Ngoại tuyến (Lưu cục bộ)');
        }
    } catch (e) {
        console.error("Failed to initialize Firebase:", e);
        updateServerStatus('error', 'Lỗi kết nối Firebase');
    }
}

// Helper to update premium UI status indicator
function updateServerStatus(status, text) {
    const container = document.querySelector('.server-status');
    if (!container) return;
    
    let dotColor = '#10b981'; // Green (Online / Synced)
    let pulseClass = '';
    
    if (status === 'connecting') {
        dotColor = '#f59e0b'; // Amber (Connecting)
        pulseClass = 'animation: pulse 1s infinite alternate;';
    } else if (status === 'error' || status === 'offline') {
        dotColor = '#ef4444'; // Red (Offline)
    }
    
    container.innerHTML = `
        <span class="status-dot" style="
            background-color: ${dotColor}; 
            box-shadow: 0 0 10px ${dotColor}; 
            display: inline-block; 
            width: 8px; 
            height: 8px; 
            border-radius: 50%; 
            margin-right: 6px; 
            vertical-align: middle;
            ${pulseClass}
        "></span>
        <span style="font-size: 0.85rem; font-weight: 500;">${text}</span>
    `;
}

// Two-way synchronization with Firebase Firestore
function setupFirebaseSync() {
    if (!db) return;
    
    // We store the state in a single document 'state' in a collection 'shipmanage'
    const docRef = db.collection('shipmanage').doc('state');
    
    updateServerStatus('connecting', 'Đang tải dữ liệu đám mây...');

    // 1. Listen for updates in Firestore
    docRef.onSnapshot((doc) => {
        if (doc.exists) {
            const cloudState = doc.data();
            console.log("Received state update from Firebase Firestore.");
            
            // Update local state in AppData
            AppData.state = cloudState;
            
            // Persist to localStorage as a cache
            localStorage.setItem(DB_KEY, JSON.stringify(cloudState));
            
            // If the main application is already initialized and rendered, refresh the current view
            if (typeof app !== 'undefined' && app.currentView) {
                app.navigate(app.currentView);
            }
            
            updateServerStatus('online', 'Đã đồng bộ đám mây');
        } else {
            // First time use: Firestore is empty, upload local storage state to Firebase
            console.log("Firestore has no existing data. Uploading local state as backup.");
            if (AppData.state) {
                docRef.set(AppData.state)
                    .then(() => {
                        updateServerStatus('online', 'Đã đồng bộ đám mây');
                    })
                    .catch((err) => {
                        console.error("Error setting initial state in Firestore:", err);
                        if (err.code === 'permission-denied') {
                            updateServerStatus('error', 'Lỗi phân quyền (Chưa bật Rules)');
                        } else {
                            updateServerStatus('error', 'Lỗi đồng bộ (Offline)');
                        }
                    });
            }
        }
    }, (error) => {
        console.error("Firebase Firestore subscription error:", error);
        if (error.code === 'permission-denied') {
            updateServerStatus('error', 'Lỗi phân quyền (Chưa bật Rules)');
        } else {
            updateServerStatus('error', 'Lỗi đồng bộ (Offline)');
        }
    });

    // 2. Intercept AppData.save() to push updates to Firestore
    const originalSave = AppData.save;
    AppData.save = function() {
        // Run original save to localStorage (keeps it lightning fast)
        originalSave.call(AppData);
        
        // Push state to Firebase in background
        if (isFirebaseInitialized && db) {
            updateServerStatus('connecting', 'Đang lưu đám mây...');
            docRef.set(AppData.state)
                .then(() => {
                    updateServerStatus('online', 'Đã đồng bộ đám mây');
                })
                .catch((err) => {
                    console.error("Failed to save to Firebase Firestore:", err);
                    if (err.code === 'permission-denied') {
                        updateServerStatus('error', 'Lỗi phân quyền (Chưa bật Rules)');
                    } else {
                        updateServerStatus('error', 'Lỗi lưu dữ liệu (Offline)');
                    }
                });
        }
    };
}

// Auto-run initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Add CSS keyframes for connecting status indicator pulsing
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes pulse {
            from { transform: scale(1); opacity: 0.6; }
            to { transform: scale(1.3); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    // Initialize Firebase
    initFirebase();
});

// Firebase Configuration
const firebaseConfig = {
  projectId: "wedding-rsvp-data-2026",
  appId: "1:670163167459:web:a37db38802c62d92c07dd6",
  storageBucket: "wedding-rsvp-data-2026.firebasestorage.app",
  apiKey: "AIzaSyBbDYpdwCiQDwekiAokqSa_3KgmU81rdTI",
  authDomain: "wedding-rsvp-data-2026.firebaseapp.com",
  messagingSenderId: "670163167459",
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Admin Credentials
const ADMIN_USER = "rumesh";
const ADMIN_PASS = "2026";

// State Management
let guests = JSON.parse(localStorage.getItem("wedding_guests")) || [];
let selectedGuests = new Set();
const invitationMessage =
  "Hi! We're so excited to invite you to our wedding. Please find all the details and RSVP here: ";
const basePath = window.location.href.split(/\/guestmanagement(\.html)?/i)[0];
const BASE_URL = basePath + "/index.html";

// Undo / Redo Management
const MAX_HISTORY = 5;
let undoStack = [];
let redoStack = [];

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById("undoBtn");
  const redoBtn = document.getElementById("redoBtn");
  
  if (undoBtn) {
    undoBtn.disabled = undoStack.length === 0;
    undoBtn.title = `Undo (${undoStack.length})`;
  }
  if (redoBtn) {
    redoBtn.disabled = redoStack.length === 0;
    redoBtn.title = `Redo (${redoStack.length})`;
  }
}

function saveState() {
  // Deep copy current guests
  undoStack.push(JSON.parse(JSON.stringify(guests)));
  if (undoStack.length > MAX_HISTORY) {
    undoStack.shift();
  }
  redoStack = [];
  updateUndoRedoButtons();
}

async function applyState(targetState) {
  const currentState = JSON.parse(JSON.stringify(guests));
  
  const guestsToDelete = [];
  const guestsToUpdate = [];

  // Create frequency maps to handle identical duplicates and guests without phone numbers safely
  const targetCount = new Map();
  for (const g of targetState) {
    const key = JSON.stringify(g);
    targetCount.set(key, (targetCount.get(key) || 0) + 1);
  }

  const currentCount = new Map();
  for (const g of currentState) {
    const key = JSON.stringify(g);
    currentCount.set(key, (currentCount.get(key) || 0) + 1);
  }

  // Find deletions (items in current that are missing or reduced in target)
  for (const [key, count] of currentCount.entries()) {
    const tCount = targetCount.get(key) || 0;
    if (count > tCount) {
      const diff = count - tCount;
      const guestObj = JSON.parse(key);
      for (let i = 0; i < diff; i++) {
        guestsToDelete.push(guestObj);
      }
    }
  }

  // Find additions/modifications (items in target that are missing or reduced in current)
  for (const [key, count] of targetCount.entries()) {
    const cCount = currentCount.get(key) || 0;
    if (count > cCount) {
      const diff = count - cCount;
      const guestObj = JSON.parse(key);
      for (let i = 0; i < diff; i++) {
        guestsToUpdate.push(guestObj);
      }
    }
  }
  
  try {
    // Sync to Firebase
    if (guestsToDelete.length > 0) {
      await batchDeleteFirebaseGuests(guestsToDelete);
    }
    if (guestsToUpdate.length > 0) {
      await batchUpdateFirebaseGuests(guestsToUpdate);
    }

    // Apply state locally
    guests = targetState;
    saveAndRender();
    updateUndoRedoButtons();
  } catch (err) {
    console.error("Firebase sync error during undo/redo:", err);
    showAlert(`Failed to sync undo/redo state to Firebase: ${err.message}`, "Sync Error", "times-circle");
    // Do not apply state locally if Firebase fails to avoid local-remote desync
  }
}

// DOM Elements
const loginScreen = document.getElementById("loginScreen");
const dashboard = document.getElementById("adminDashboard");
const loginForm = document.getElementById("loginForm");
const errorDisplay = document.getElementById("loginError");
const guestTableBody = document.getElementById("guestTableBody");
const guestModal = document.getElementById("guestModal");
const guestForm = document.getElementById("guestForm");
let editingIndex = -1;
const alertModal = document.getElementById("alertModal");
const alertMessage = document.getElementById("alertMessage");
const closeAlertBtn = document.getElementById("closeAlertModal");

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  checkSession();
  checkLocalRSVPs();
  renderGuests();
  updateUndoRedoButtons();
  
  // Undo/Redo Listeners
  const undoBtn = document.getElementById("undoBtn");
  if (undoBtn) {
    undoBtn.addEventListener("click", async () => {
      if (undoStack.length > 0) {
        // Save current to redo
        redoStack.push(JSON.parse(JSON.stringify(guests)));
        
        // Pop and apply target
        const targetState = undoStack.pop();
        
        undoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        undoBtn.disabled = true;
        
        try {
          await applyState(targetState);
        } catch(e) {
          console.error("Undo error:", e);
        } finally {
          undoBtn.innerHTML = '<i class="fas fa-undo"></i>';
          updateUndoRedoButtons();
        }
      }
    });
  }

  const redoBtn = document.getElementById("redoBtn");
  if (redoBtn) {
    redoBtn.addEventListener("click", async () => {
      if (redoStack.length > 0) {
        // Save current to undo
        undoStack.push(JSON.parse(JSON.stringify(guests)));
        
        // Pop and apply target
        const targetState = redoStack.pop();
        
        redoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        redoBtn.disabled = true;
        
        try {
          await applyState(targetState);
        } catch(e) {
          console.error("Redo error:", e);
        } finally {
          redoBtn.innerHTML = '<i class="fas fa-redo"></i>';
          updateUndoRedoButtons();
        }
      }
    });
  }
});

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem("admin_theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    updateThemeIcon(true);
  }
}

function toggleDarkMode() {
  const isDark = document.body.classList.toggle("dark-mode");
  localStorage.setItem("admin_theme", isDark ? "dark" : "light");
  updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
  const icon = document.querySelector("#darkModeToggle i");
  if (icon) {
    icon.className = isDark ? "fas fa-sun" : "fas fa-moon";
  }
}

document
  .getElementById("darkModeToggle")
  .addEventListener("click", toggleDarkMode);

// Real-time update when localStorage changes
window.addEventListener("storage", (e) => {
  if (e.key === "weddingRSVPs" || e.key === "wedding_guests") {
    const freshGuests =
      JSON.parse(localStorage.getItem("wedding_guests")) || [];
    // Only update if data actually changed to avoid loops
    if (JSON.stringify(freshGuests) !== JSON.stringify(guests)) {
      guests = freshGuests;
      checkLocalRSVPs();
      renderGuests();
    }
  }
});

// Real-time update from Firebase Firestore
db.collection("weddingRSVPs").onSnapshot((snapshot) => {
  let updated = false;
  snapshot.docChanges().forEach((change) => {
    const data = change.doc.data();
    const phone = formatPhone(data.phone || "");
    const targetName = (data.name || "").toLowerCase().trim();

    let guestIndex = -1;
    if (phone) {
      guestIndex = guests.findIndex((g) => formatPhone(g.number) === phone);
    } else if (targetName) {
      guestIndex = guests.findIndex((g) => (g.name || "").toLowerCase().trim() === targetName);
    }

    if (change.type === "added" || change.type === "modified") {
      const updatedGuest = {
        name: data.name || "",
        number: data.phone || "",
        type: data.type || "single",
        category: data.category || "civilian",
        plus: data.plus || 0,
        sent: data.sent || false,
        rsvp: data.status || "Pending",
        note: data.note || "",
        order: data.order !== undefined ? data.order : 999999
      };

      if (guestIndex !== -1) {
        const currentGuest = guests[guestIndex];
        if (JSON.stringify(currentGuest) !== JSON.stringify(updatedGuest)) {
          guests[guestIndex] = updatedGuest;
          updated = true;
        }
      } else {
        guests.push(updatedGuest);
        updated = true;
      }
    } else if (change.type === "removed") {
      if (guestIndex !== -1) {
        guests.splice(guestIndex, 1);
        updated = true;
      }
    }
  });

  if (updated) {
    // Ensure guests are consistently ordered across devices
    guests.sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 999999;
      const orderB = b.order !== undefined ? b.order : 999999;
      if (orderA === orderB) {
        return (a.name || "").localeCompare(b.name || "");
      }
      return orderA - orderB;
    });
    localStorage.setItem("wedding_guests", JSON.stringify(guests));
    renderGuests();
  }
});

// Auto-merge local RSVPs for instant feedback
function checkLocalRSVPs() {
  const localRSVPs = JSON.parse(localStorage.getItem("weddingRSVPs")) || [];
  if (localRSVPs.length === 0) return;

  let updated = false;
  localRSVPs.forEach((rsvp) => {
    const phone = formatPhone(rsvp.phone || "");
    // Match by phone first, fallback to Name
    let guestIndex = -1;
    if (phone) {
      guestIndex = guests.findIndex((g) => formatPhone(g.number) === phone);
    }

    if (guestIndex === -1 && rsvp.name) {
      guestIndex = guests.findIndex(
        (g) => g.name.toLowerCase() === rsvp.name.toLowerCase(),
      );
    }

    if (guestIndex !== -1) {
      // Update if status or note changed
      if (
        guests[guestIndex].rsvp !== rsvp.status ||
        guests[guestIndex].note !== rsvp.note
      ) {
        guests[guestIndex].rsvp = rsvp.status;
        guests[guestIndex].note = rsvp.note || "";
        updated = true;
      }
    }
  });

  if (updated) {
    localStorage.setItem("wedding_guests", JSON.stringify(guests));
  }
}

// Authentication
loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const user = document.getElementById("username").value;
  const pass = document.getElementById("password").value;

  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    sessionStorage.setItem("admin_logged_in", "true");
    showDashboard();
  } else {
    errorDisplay.innerText = "Invalid credentials. Please try again.";
  }
});

function checkSession() {
  if (sessionStorage.getItem("admin_logged_in") === "true") {
    showDashboard();
  }
}

function showDashboard() {
  loginScreen.classList.add("hidden");
  dashboard.classList.remove("hidden");
  renderGuests();
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem("admin_logged_in");
  location.reload();
});

// Guest Management
let searchQuery = "";
let currentSortColumn = null;
let isAscending = true;

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.toLowerCase();
      renderGuests();
    });
  }

  const sortStatusBtn = document.getElementById("sortStatusBtn");
  if (sortStatusBtn) {
    sortStatusBtn.addEventListener("click", () => {
      if (currentSortColumn === 'sent') isAscending = !isAscending;
      else { currentSortColumn = 'sent'; isAscending = true; }
      renderGuests();
    });
  }

  const sortRsvpBtn = document.getElementById("sortRsvpBtn");
  if (sortRsvpBtn) {
    sortRsvpBtn.addEventListener("click", () => {
      if (currentSortColumn === 'rsvp') isAscending = !isAscending;
      else { currentSortColumn = 'rsvp'; isAscending = true; }
      renderGuests();
    });
  }
});

function renderGuests() {
  guestTableBody.innerHTML = "";
  selectedGuests.clear(); // Clear selections on re-render to prevent stale indices
  const selectAllCb = document.getElementById("selectAllGuests");
  if(selectAllCb) selectAllCb.checked = false;
  if(typeof updateBatchUI === "function") updateBatchUI();
  let sentCount = 0;
  let totalHeadcount = 0;
  let attendingCount = 0;
  let pendingCount = 0;
  let notAttendingCount = 0;

  guests.forEach((guest) => {
    if (guest.sent) sentCount++;

    // Calculate headcount for this invitation
    let guestHeadcount =
      guest.type === "mrmrs" ? 2 : 1 + parseInt(guest.plus || 0);
    totalHeadcount += guestHeadcount;

    // Use default if missing
    if (!guest.rsvp) guest.rsvp = "Pending";

    if (guest.rsvp === "Attending") {
      attendingCount += guestHeadcount;
    } else if (guest.rsvp === "Not Attending") {
      notAttendingCount += guestHeadcount;
    } else {
      pendingCount += guestHeadcount;
    }
  });

  let guestsToRender = guests.map((guest, index) => ({ guest, index }));

  if (currentSortColumn) {
    guestsToRender.sort((a, b) => {
      let valA, valB;
      if (currentSortColumn === 'sent') {
        valA = a.guest.sent ? 1 : 0;
        valB = b.guest.sent ? 1 : 0;
      } else if (currentSortColumn === 'rsvp') {
        valA = a.guest.rsvp || "Pending";
        valB = b.guest.rsvp || "Pending";
      }
      
      if (valA < valB) return isAscending ? -1 : 1;
      if (valA > valB) return isAscending ? 1 : -1;
      return 0;
    });
  }

  const sortStatusIcon = document.querySelector("#sortStatusBtn i");
  if (sortStatusIcon) {
    sortStatusIcon.className = currentSortColumn === 'sent' 
      ? (isAscending ? "fas fa-sort-up" : "fas fa-sort-down") 
      : "fas fa-sort";
    sortStatusIcon.style.color = currentSortColumn === 'sent' ? "var(--mocha)" : "var(--grey)";
  }

  const sortRsvpIcon = document.querySelector("#sortRsvpBtn i");
  if (sortRsvpIcon) {
    sortRsvpIcon.className = currentSortColumn === 'rsvp' 
      ? (isAscending ? "fas fa-sort-up" : "fas fa-sort-down") 
      : "fas fa-sort";
    sortRsvpIcon.style.color = currentSortColumn === 'rsvp' ? "var(--mocha)" : "var(--grey)";
  }

  guestsToRender.forEach(({ guest, index }) => {
    // Search filter logic
    if (searchQuery) {
        const catStr = guest.category || "civilian";
        const searchStr = `${guest.name} ${guest.number} ${guest.type} ${catStr}`.toLowerCase();
        if (!searchStr.includes(searchQuery)) {
            return; // Skip rendering this row
        }
    }

    const row = document.createElement("tr");
    row.innerHTML = `
            <td data-label="#"><input type="checkbox" class="guest-checkbox" value="${index}" ${selectedGuests.has(index) ? 'checked' : ''}> <span class="row-num">${index + 1}</span></td>
            <td data-label="Name"><strong>${guest.name}</strong></td>
            <td data-label="Category">${renderCategoryBadge(guest.category)}</td>
            <td data-label="WhatsApp">${guest.number}</td>
            <td data-label="Invitation">${renderPlusInfo(guest)}</td>
            <td data-label="Send">
                <a href="${generateWALink(guest)}" 
                   target="_blank" 
                   class="btn-wa">
                    <i class="fab fa-whatsapp"></i> Send
                </a>
            </td>
            <td data-label="Sent">
                <i class="fas fa-check-circle status-icon ${guest.sent ? "active" : ""}" 
                   onclick="toggleStatus(${index})"></i>
            </td>
            <td data-label="RSVP">
                <div class="rsvp-cell">
                    <span class="rsvp-pill pill-${guest.rsvp.toLowerCase().replace(" ", "-")}">
                        ${guest.rsvp}
                    </span>
                    ${guest.note ? `<i class="fas fa-comment-dots guest-msg-icon" title="Message: ${guest.note.replace(/"/g, "&quot;")}"></i>` : ""}
                </div>
            </td>
            <td data-label="Actions">
                ${guest.note && guest.note.trim() !== "" ? `<button onclick="viewGuestMessage(${index})" class="btn-msg" title="View Message"><i class="fas fa-envelope"></i></button>` : ""}
                <button onclick="copyGuestLink(${index}, this)" class="btn-copy" title="Copy Invitation Link"><i class="fas fa-link"></i></button>
                <button onclick="editGuest(${index})" class="btn-edit"><i class="fas fa-pencil-alt"></i></button>
                <button onclick="deleteGuest(${index})" class="btn-danger"><i class="fas fa-trash-alt"></i></button>
                <span id="success-mark-${index}" style="display: none; color: #2ecc71; margin-left: 10px; font-size: 1.2rem; vertical-align: middle;"><i class="fas fa-check-circle"></i></span>
            </td>
        `;
    guestTableBody.appendChild(row);
  });

  // Update Stats
  document.getElementById("totalGuests").innerText = totalHeadcount;
  document.getElementById("sentCount").innerText = sentCount;
  document.getElementById("attendingCount").innerText = attendingCount;
  document.getElementById("pendingCount").innerText = pendingCount;
  document.getElementById("notAttendingCount").innerText = notAttendingCount;
}

function formatPhone(num) {
  if (!num) return "";
  let cleaned = String(num).replace(/\D/g, ""); // Remove non-numbers
  // If it starts with 0 and is 10 digits (local format), convert to 94
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "94" + cleaned.substring(1);
  }
  return cleaned;
}

// Actions
document.getElementById("openAddModal").onclick = () => {
  editingIndex = -1;
  document.getElementById("modalTitle").innerText = "Add New Guest";
  document.getElementById("saveGuestBtn").innerText = "Save Guest";
  guestForm.reset();
  togglePlusInput("single");
  guestModal.classList.add("active");
};

// WhatsApp Number Input Filtering
document
  .getElementById("whatsappNumber")
  .addEventListener("input", function (e) {
    this.value = this.value.replace(/[^\d+]/g, "");
  });

// Toggle Plus Count based on Type
document.querySelectorAll('input[name="inviteType"]').forEach((radio) => {
  radio.addEventListener("change", (e) => togglePlusInput(e.target.value));
});

function togglePlusInput(type) {
  const container = document.getElementById("plusCountContainer");
  if (type === "single" || type === "family") {
    container.style.display = "block";
  } else {
    container.style.display = "none";
  }
}

function getInvitationText(guest) {
  const encodedName = encodeURIComponent(guest.name).replace(/%20/g, "+");
  const encodedPhone = encodeURIComponent(guest.number).replace(/%20/g, "+");
  const personalizedUrl = `${BASE_URL}?g_name=${encodedName}&g_phone=${encodedPhone}`;

  const sparkle = "\u{2728}";
  const ring = "\u{1F48D}";
  const heart = "\u{2764}\u{FE0F}";
  const cheers = "\u{1F942}";
  const flower = "\u{1F338}";
  const down = "\u{1F447}";
  const dove = "\u{1F54A}\u{FE0F}";

  let dressCodeMsg = "";
  if (guest.category === "army") dressCodeMsg = "Dress Code: Army No 1";
  else if (guest.category === "navy") dressCodeMsg = "Dress Code: Navy No 2";
  else if (guest.category === "airforce")
    dressCodeMsg = "Dress Code: Air Force No 3";
  else dressCodeMsg = "Dress Code: National / Formal";

  return `${sparkle} A Beautiful Journey Begins ${sparkle}
Dear ${guest.name},
Together with our families, we,
Shashika & Rumesh, joyfully invite
you to share in our happiness as we
unite in marriage. ${ring}${heart}
Your presence and blessings would
mean the world to us as we step
into this new chapter of our lives.
${cheers}${flower}
${dressCodeMsg}
Please click the link below to view
your personalized invitation:
${down}${down}${down}
${personalizedUrl}
We look forward to celebrating this
special day with you! ${dove}${sparkle}
With Love,
Shashika & Rumesh`;
}

function generateWALink(guest) {
  const fullMsg = getInvitationText(guest);
  return `https://wa.me/${formatPhone(guest.number)}?text=${encodeURIComponent(fullMsg)}`;
}

window.copyGuestLink = (index, btn) => {
  const guest = guests[index];
  const fullMsg = getInvitationText(guest);

  // Modern Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(fullMsg)
      .then(() => {
        showCopySuccess(btn);
      })
      .catch((err) => {
        console.error("Clipboard API failed, using fallback", err);
        fallbackCopyTextToClipboard(fullMsg, btn);
      });
  } else {
    fallbackCopyTextToClipboard(fullMsg, btn);
  }
};

function renderPlusInfo(guest) {
  const plusCount = guest.plus || 0;
  if (guest.type === "mrmrs")
    return `<span class="type-tag tag-mrmrs">Mr & Mrs +${plusCount}</span>`;
  if (guest.type === "family")
    return `<span class="type-tag tag-family">Family +${plusCount}</span>`;
  return `<span class="type-tag tag-single">Single +${plusCount}</span>`;
}

function renderCategoryBadge(cat) {
  const categories = {
    army: "Army",
    navy: "Navy",
    airforce: "Airforce",
    civilian: "Civilian",
  };
  const label = categories[cat] || "Civilian";
  return `<span class="cat-badge badge-${cat || "civilian"}">${label}</span>`;
}

window.viewGuestMessage = (index) => {
  const guest = guests[index];
  if (!guest.note) return;

  document.getElementById("alertTitle").innerText = "Guest Message";
  document.getElementById("alertIconContainer").innerHTML =
    '<i class="fas fa-envelope"></i>';
  alertMessage.innerHTML = `<strong>Message from ${guest.name}:</strong><br><br>${guest.note.replace(/\n/g, "<br>")}`;
  alertModal.classList.add("active");
};

document.getElementById("closeGuestModal").onclick = () =>
  guestModal.classList.remove("active");

window.editGuest = (index) => {
  editingIndex = index;
  const guest = guests[index];

  // Set UI
  document.getElementById("modalTitle").innerText = "Edit Guest Details";
  document.getElementById("saveGuestBtn").innerText = "Update Guest";

  // Populate Fields
  document.getElementById("guestName").value = guest.name;
  document.getElementById("whatsappNumber").value = guest.number;

  // Set Radio Buttons
  const typeRadio = document.querySelector(
    `input[name="inviteType"][value="${guest.type}"]`,
  );
  if (typeRadio) {
    typeRadio.checked = true;
    togglePlusInput(guest.type);
  }

  const catRadio = document.querySelector(
    `input[name="guestCategory"][value="${guest.category || "civilian"}"]`,
  );
  if (catRadio) catRadio.checked = true;

  document.getElementById("plusCount").value = guest.plus || 0;

  guestModal.classList.add("active");
};

// Alert Logic
function showAlert(msg, title = "Notification", icon = "exclamation-circle") {
  document.getElementById("alertTitle").innerText = title;
  document.getElementById("alertIconContainer").innerHTML =
    `<i class="fas fa-${icon}"></i>`;
  alertMessage.innerHTML = msg;
  alertModal.classList.add("active");
}

closeAlertBtn.onclick = () => alertModal.classList.remove("active");

// Firebase Update Helpers
async function updateFirebaseGuest(guest) {
  try {
    const snapshot = await db.collection("weddingRSVPs").get();
    let docId = null;
    const targetPhone = formatPhone(guest.number);
    const targetName = (guest.name || "").toLowerCase().trim();

    let localIndex = -1;
    if (targetPhone) {
      localIndex = guests.findIndex((g) => formatPhone(g.number) === targetPhone);
    } else {
      localIndex = guests.findIndex((g) => (g.name || "").toLowerCase().trim() === targetName);
    }
    const orderVal = localIndex !== -1 ? localIndex : 999999;

    snapshot.forEach((doc) => {
      const docData = doc.data();
      const docPhone = formatPhone(docData.phone);
      const docName = (docData.name || "").toLowerCase().trim();

      if (targetPhone && docPhone === targetPhone) {
        docId = doc.id;
      } else if (!targetPhone && !docPhone && targetName && docName === targetName) {
        docId = doc.id;
      }
    });

    const personalizedUrl = `${BASE_URL}?g_name=${encodeURIComponent(guest.name || "")}&g_phone=${encodeURIComponent(guest.number || "")}`;

    const rsvpData = {
      name: guest.name || "",
      phone: guest.number || "",
      status: guest.rsvp || "Pending",
      note: guest.note || "",
      timestamp: new Date().toLocaleString(),
      category: guest.category || "civilian",
      type: guest.type || "single",
      plus: guest.plus || 0,
      sent: guest.sent || false,
      personalizedUrl: personalizedUrl,
      order: orderVal,
    };

    if (docId) {
      await db.collection("weddingRSVPs").doc(docId).update(rsvpData);
    } else {
      await db.collection("weddingRSVPs").add(rsvpData);
    }
  } catch (err) {
    console.error("Firebase update error:", err);
  }
}

async function batchUpdateFirebaseGuests(guestList) {
  try {
    const snapshot = await db.collection("weddingRSVPs").get();
    const dbDocs = [];
    snapshot.forEach((doc) => {
      dbDocs.push({ id: doc.id, data: doc.data() });
    });

    const chunks = [];
    for (let i = 0; i < guestList.length; i += 400) {
      chunks.push(guestList.slice(i, i + 400));
    }

    for (const chunk of chunks) {
      const batch = db.batch();
      const batchOperations = new Map();

      for (const guest of chunk) {
        let docId = null;
        const targetPhone = formatPhone(String(guest.number || ""));
        const targetName = String(guest.name || "").toLowerCase().trim();

        let localIndex = -1;
        if (targetPhone) {
          localIndex = guests.findIndex((g) => formatPhone(g.number) === targetPhone);
        } else {
          localIndex = guests.findIndex((g) => (g.name || "").toLowerCase().trim() === targetName);
        }
        const orderVal = localIndex !== -1 ? localIndex : 999999;

        for (const doc of dbDocs) {
          const docData = doc.data;
          const docPhone = formatPhone(String(docData.phone || ""));
          const docName = String(docData.name || "").toLowerCase().trim();

          if (targetPhone && docPhone === targetPhone) {
            docId = doc.id;
            break;
          } else if (!targetPhone && !docPhone && targetName && docName === targetName) {
            docId = doc.id;
            break;
          }
        }

        const personalizedUrl = `${BASE_URL}?g_name=${encodeURIComponent(String(guest.name || ""))}&g_phone=${encodeURIComponent(String(guest.number || ""))}`;

        const rsvpData = {
          name: guest.name || "",
          phone: guest.number || "",
          status: guest.rsvp || "Pending",
          note: guest.note || "",
          timestamp: new Date().toLocaleString(),
          category: guest.category || "civilian",
          type: guest.type || "single",
          plus: guest.plus || 0,
          sent: guest.sent || false,
          personalizedUrl: personalizedUrl,
          order: orderVal,
        };

        if (docId) {
          const existingOp = batchOperations.get(docId);
          if (existingOp && existingOp.type === 'set') {
            // Update the data of the pending 'set' operation
            batchOperations.set(docId, { type: 'set', ref: existingOp.ref, data: rsvpData });
          } else {
            // Queue an 'update' operation
            batchOperations.set(docId, { type: 'update', ref: db.collection("weddingRSVPs").doc(docId), data: rsvpData });
          }

          // Keep dbDocs up to date for subsequent guests in this chunk
          const existingDoc = dbDocs.find(d => d.id === docId);
          if (existingDoc) {
            existingDoc.data = rsvpData;
          }
        } else {
          const newDocRef = db.collection("weddingRSVPs").doc();
          batchOperations.set(newDocRef.id, { type: 'set', ref: newDocRef, data: rsvpData });
          dbDocs.push({ id: newDocRef.id, data: rsvpData });
        }
      }

      // Apply all deduplicated operations to the batch
      for (const [id, op] of batchOperations.entries()) {
        if (op.type === 'update') {
          batch.update(op.ref, op.data);
        } else {
          batch.set(op.ref, op.data);
        }
      }

      await batch.commit();
    }
  } catch (err) {
    console.error("Firebase batch update error:", err);
    throw err; // Re-throw so the caller can catch it and show UI feedback
  }
}

async function deleteFirebaseGuest(guest) {
  try {
    const snapshot = await db.collection("weddingRSVPs").get();
    let docId = null;
    const targetPhone = formatPhone(guest.number);
    const targetName = (guest.name || "").toLowerCase().trim();

    snapshot.forEach((doc) => {
      const docData = doc.data();
      const docPhone = formatPhone(docData.phone);
      const docName = (docData.name || "").toLowerCase().trim();

      if (targetPhone && docPhone === targetPhone) {
        docId = doc.id;
      } else if (!targetPhone && !docPhone && targetName && docName === targetName) {
        docId = doc.id;
      }
    });

    if (docId) {
      await db.collection("weddingRSVPs").doc(docId).delete();
    }
  } catch (err) {
    console.error("Firebase delete error:", err);
  }
}

async function batchDeleteFirebaseGuests(guestList) {
  try {
    const snapshot = await db.collection("weddingRSVPs").get();
    const dbDocs = [];
    snapshot.forEach((doc) => {
      dbDocs.push({ id: doc.id, data: doc.data() });
    });

    const chunks = [];
    for (let i = 0; i < guestList.length; i += 400) {
      chunks.push(guestList.slice(i, i + 400));
    }

    for (const chunk of chunks) {
      const batch = db.batch();
      const docsToDelete = new Set();

      for (const guest of chunk) {
        let docId = null;
        const targetPhone = formatPhone(String(guest.number || ""));
        const targetName = String(guest.name || "").toLowerCase().trim();

        for (const doc of dbDocs) {
          const docData = doc.data;
          const docPhone = formatPhone(String(docData.phone || ""));
          const docName = String(docData.name || "").toLowerCase().trim();

          if (targetPhone && docPhone === targetPhone) {
            docId = doc.id;
            break;
          } else if (!targetPhone && !docPhone && targetName && docName === targetName) {
            docId = doc.id;
            break;
          }
        }

        if (docId) {
          docsToDelete.add(docId);
        }
      }

      for (const id of docsToDelete) {
        batch.delete(db.collection("weddingRSVPs").doc(id));
      }

      await batch.commit();
    }
  } catch (err) {
    console.error("Firebase batch delete error:", err);
    throw err; // Re-throw so caller can handle it
  }
}

function showRowSuccess(index) {
  const mark = document.getElementById(`success-mark-${index}`);
  if (mark) {
    mark.style.display = "inline-block";
    setTimeout(() => {
      mark.style.display = "none";
    }, 3000);
  }
}

guestForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("guestName").value;
  const number = document.getElementById("whatsappNumber").value;



  const type = document.querySelector('input[name="inviteType"]:checked').value;
  const category = document.querySelector(
    'input[name="guestCategory"]:checked',
  ).value;
  const plus =
    type === "single" ? document.getElementById("plusCount").value : 0;

  // Duplicate Check - Only if number changed
  const formattedNum = formatPhone(number);
  const existingGuest = guests.find(
    (g, i) => formatPhone(g.number) === formattedNum && i !== editingIndex,
  );

  if (existingGuest) {
    showAlert(
      `The number <strong>${number}</strong> is already registered to <strong>${existingGuest.name}</strong> in your list.`,
      "Number is Already Added",
      "exclamation-circle",
    );
    return;
  }

  const guestData = {
    name,
    number,
    type,
    category,
    plus,
    sent: editingIndex >= 0 ? guests[editingIndex].sent : false,
    rsvp: editingIndex >= 0 ? guests[editingIndex].rsvp : "Pending",
  };

  const submitBtn = document.getElementById("saveGuestBtn");
  const originalText = submitBtn.innerText;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  submitBtn.disabled = true;

  saveState();

  try {
    let savedIndex = editingIndex;
    if (editingIndex >= 0) {
      guests[editingIndex] = guestData;
      await updateFirebaseGuest(guestData);
    } else {
      guests.push(guestData);
      savedIndex = guests.length - 1;
      await updateFirebaseGuest(guestData);
    }

    saveAndRender();
    showRowSuccess(savedIndex);

    guestForm.reset();
    guestModal.classList.remove("active");
  } catch (err) {
    showAlert("Failed to save to Firebase.", "Error", "times-circle");
  } finally {
    submitBtn.innerText = originalText;
    submitBtn.disabled = false;
  }
});

window.toggleStatus = async (index) => {
  saveState();
  guests[index].sent = !guests[index].sent;
  await updateFirebaseGuest(guests[index]);
  saveAndRender();
  showRowSuccess(index);
};

window.deleteGuest = async (index) => {
  if (confirm("Are you sure you want to remove this guest?")) {
    saveState();
    const deletedGuest = guests[index];
    guests.splice(index, 1);
    await deleteFirebaseGuest(deletedGuest);
    saveAndRender();
  }
};

function showCopySuccess(btn) {
  const originalContent = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-check"></i>';
  btn.classList.add("copy-success");

  setTimeout(() => {
    btn.innerHTML = originalContent;
    btn.classList.remove("copy-success");
  }, 2000);
}

function fallbackCopyTextToClipboard(text, btn) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  // Ensure the textarea is not visible or interfering with layout
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand("copy");
    if (successful) showCopySuccess(btn);
  } catch (err) {
    console.error("Fallback: Oops, unable to copy", err);
    alert(
      "Could not copy link. Please manually copy the URL from your address bar.",
    );
  }

  document.body.removeChild(textArea);
}

// Sync RSVPs from Cloud
let pendingSyncUpdates = [];

document.getElementById("syncRSVPBtn").onclick = () => syncRSVPs();
document.getElementById("cancelSyncBtn").onclick = () => {
  document.getElementById("syncConfirmModal").classList.remove("active");
  pendingSyncUpdates = [];
};
document.getElementById("approveSyncBtn").onclick = () => approveAndApplySync();

async function syncRSVPs() {
  const btn = document.getElementById("syncRSVPBtn");
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching...';
  btn.disabled = true;

  try {
    const querySnapshot = await db.collection("weddingRSVPs").get();
    const newGuests = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      newGuests.push({
        name: data.name || "",
        number: data.phone || "",
        type: data.type || "single",
        category: data.category || "civilian",
        plus: data.plus || 0,
        sent: data.sent || false,
        rsvp: data.status || "Pending",
        note: data.note || ""
      });
    });

    if (JSON.stringify(guests) !== JSON.stringify(newGuests)) {
      pendingSyncUpdates = newGuests;
      // Show confirmation modal
      const summaryText = document.getElementById("syncSummaryText");
      summaryText.innerHTML = `Found differences between the local list and the database.<br><br>
                Do you want to sync and overwrite local data with the database? <br>
                <em>A backup of your current list will be saved automatically before merging to prevent data loss.</em>`;

      document.getElementById("syncConfirmModal").classList.add("active");
    } else {
      showAlert(
        "No differences found in the database. Everything is up to date!",
        "Sync Complete",
        "check-circle",
      );
    }
  } catch (err) {
    console.error("Sync Error:", err);
    showAlert(
      "Failed to connect to Firebase. Please check your internet connection.",
      "Sync Error",
      "times-circle",
    );
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

function approveAndApplySync() {
  // 1. Create Backup and Save State
  localStorage.setItem("wedding_guests_backup", JSON.stringify(guests));
  saveState();

  // 2. Apply Updates
  guests = pendingSyncUpdates;

  // 3. Save and Render
  saveAndRender();

  // 4. Close Modal and Notify
  document.getElementById("syncConfirmModal").classList.remove("active");
  pendingSyncUpdates = [];
  showAlert(
    "Guest list successfully synchronized with the database!",
    "Sync Successful",
    "check-circle",
  );
}

// Excel Export
document.getElementById("exportExcelBtn").addEventListener("click", () => {
  if (guests.length === 0) {
    alert("There are no guests to export.");
    return;
  }

  // 1. Calculate Stats for Summary Sheet
  let totalHeadcount = 0;
  let attendingCount = 0;
  let pendingCount = 0;
  let notAttendingCount = 0;
  let sentCount = 0;

  guests.forEach((guest) => {
    if (guest.sent) sentCount++;
    let guestHeadcount =
      guest.type === "mrmrs" ? 2 : 1 + parseInt(guest.plus || 0);
    totalHeadcount += guestHeadcount;
    if (guest.rsvp === "Attending") attendingCount += guestHeadcount;
    else if (guest.rsvp === "Not Attending")
      notAttendingCount += guestHeadcount;
    else pendingCount += guestHeadcount;
  });

  const summaryData = [
    ["Wedding Guest List - Dashboard Summary"],
    ["Generated on:", new Date().toLocaleString()],
    [],
    ["Metric", "Count"],
    ["Total Guests (Headcount)", totalHeadcount],
    ["Invitations Sent", sentCount],
    ["Attending (Headcount)", attendingCount],
    ["Pending (Headcount)", pendingCount],
    ["Not Attending (Headcount)", notAttendingCount],
    [],
    ["Total Invitations (Cards)", guests.length],
  ];

  // 2. Prepare Detailed Guest Data
  const dataForExport = guests.map((guest, index) => {
    let plusDisplay = "";
    const plusCount = guest.plus || 0;
    if (guest.type === "family") plusDisplay = `Family +${plusCount}`;
    else if (guest.type === "mrmrs") plusDisplay = `Mr & Mrs +${plusCount}`;
    else plusDisplay = `Single +${plusCount}`;

    return {
      "#": index + 1,
      "Guest Name": guest.name,
      Category: guest.category?.toUpperCase() || "CIVILIAN",
      "WhatsApp Number": guest.number,
      "Invitation Type": plusDisplay,
      "Invitation Status": guest.sent ? "Sent" : "Pending",
      "RSVP Response": guest.rsvp || "Pending",
      "Message to Bride & Groom": guest.note || "",
    };
  });

  // 3. Create workbook and add sheets
  const workbook = XLSX.utils.book_new();

  // Summary Sheet
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  // Guests Sheet
  const guestSheet = XLSX.utils.json_to_sheet(dataForExport);
  XLSX.utils.book_append_sheet(workbook, guestSheet, "Guest List");

  // Fix column widths for Guest List
  const maxWidths = [
    { wch: 5 }, // #
    { wch: 30 }, // Name
    { wch: 15 }, // Category
    { wch: 20 }, // Number
    { wch: 20 }, // Type
    { wch: 20 }, // Status
    { wch: 20 }, // RSVP
    { wch: 50 }, // Note
  ];
  guestSheet["!cols"] = maxWidths;

  // Trigger download
  XLSX.writeFile(workbook, "Wedding_Guest_List.xlsx");
});

function saveAndRender() {
  localStorage.setItem("wedding_guests", JSON.stringify(guests));
  renderGuests();
}

// Excel Import
document.getElementById("importExcelBtn").addEventListener("click", () => {
  document.getElementById("importExcelFile").click();
});

document.getElementById("importExcelFile").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const btn = document.getElementById("importExcelBtn");
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing...';
  btn.disabled = true;

  const reader = new FileReader();
  reader.onload = async (event) => {
    saveState();
    try {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      // Look for "Guest List" sheet or use the first sheet
      const sheetName = workbook.SheetNames.includes("Guest List")
        ? "Guest List"
        : workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const importedData = XLSX.utils.sheet_to_json(sheet);

      let addedCount = 0;
      let updatedCount = 0;
      const guestsToUpdate = [];

      for (const row of importedData) {
        // Map columns
        const name = row["Guest Name"] || "";
        const numberRaw = row["WhatsApp Number"] || "";
        const number = String(numberRaw).trim();

        // Skip completely blank rows
        if (!name && !number) continue;

        const categoryStr = String(row["Category"] || "civilian")
          .toLowerCase()
          .trim();
        const category = ["army", "navy", "airforce"].includes(categoryStr)
          ? categoryStr
          : "civilian";

        const typeStr = String(row["Invitation Type"] || "");
        let type = "single";
        let plus = 0;
        const typeStrLow = typeStr.toLowerCase().trim();

        if (typeStrLow.includes("mr & mrs") || typeStrLow === "mrmrs") {
          type = "mrmrs";
          const plusMatch = typeStr.match(/\+(\d+)/);
          if (plusMatch) plus = parseInt(plusMatch[1]);
        } else if (typeStrLow.includes("family")) {
          type = "family";
          const plusMatch = typeStr.match(/\+(\d+)/);
          if (plusMatch) plus = parseInt(plusMatch[1]);
        } else {
          type = "single";
          const plusMatch = typeStr.match(/\+(\d+)/);
          if (plusMatch) plus = parseInt(plusMatch[1]);
        }

        const sent = row["Invitation Status"] === "Sent";
        const rsvp = row["RSVP Response"] || "Pending";
        const note = row["Message to Bride & Groom"] || "";

        const formattedNum = number ? formatPhone(number) : "";

        // Check if existing. Match by number if present, otherwise by name.
        let existingIndex = -1;
        if (formattedNum) {
          existingIndex = guests.findIndex(
            (g) => g.number && formatPhone(g.number) === formattedNum,
          );
        } else if (name) {
          existingIndex = guests.findIndex(
            (g) => g.name.toLowerCase().trim() === name.toLowerCase().trim(),
          );
        }

        const guestData = {
          name,
          number,
          type,
          category,
          plus,
          sent,
          rsvp,
          note,
        };

        if (existingIndex !== -1) {
          guests[existingIndex] = guestData;
          updatedCount++;
        } else {
          guests.push(guestData);
          addedCount++;
        }
        
        // Add to batch list
        guestsToUpdate.push(guestData);
      }

      if (guestsToUpdate.length > 0) {
        try {
          await batchUpdateFirebaseGuests(guestsToUpdate);
          saveAndRender();
          showAlert(
            `Import Successful!<br><br>Added: ${addedCount}<br>Updated: ${updatedCount}`,
            "Import Complete",
            "check-circle",
          );
        } catch (syncErr) {
          console.error("Batch update failed during import:", syncErr);
          showAlert(`Failed to sync imported data to Firebase: ${syncErr.message}`, "Sync Error", "times-circle");
        }
      } else {
        saveAndRender();
        showAlert(
          `Import Successful!<br><br>No new guests to add.`,
          "Import Complete",
          "check-circle",
        );
      }
    } catch (error) {
      console.error("Import error:", error);
      showAlert(
        "Failed to import data. Please ensure the file is a valid Excel sheet with the correct template.",
        "Import Error",
        "times-circle",
      );
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
      e.target.value = ""; // Reset input
    }
  };

  reader.onerror = () => {
    showAlert("Failed to read the file.", "Read Error", "times-circle");
    btn.innerHTML = originalText;
    btn.disabled = false;
    e.target.value = ""; // Reset input
  };

  reader.readAsArrayBuffer(file);
});

// --- BATCH OPERATIONS LOGIC ---

const batchFabContainer = document.getElementById("batchFabContainer");
const batchFabBtn = document.getElementById("batchFabBtn");
const batchSelectedCount = document.getElementById("batchSelectedCount");
const batchActionsModal = document.getElementById("batchActionsModal");
const batchEditForm = document.getElementById("batchEditForm");
const closeBatchModalBtn = document.getElementById("closeBatchModal");
const batchDeleteBtn = document.getElementById("batchDeleteBtn");
const selectAllGuestsCb = document.getElementById("selectAllGuests");

// Event delegation for table checkboxes
document.getElementById("guestTable").addEventListener("change", (e) => {
  if (e.target.classList.contains("guest-checkbox")) {
    const index = parseInt(e.target.value);
    if (e.target.checked) {
      selectedGuests.add(index);
    } else {
      selectedGuests.delete(index);
    }
    updateBatchUI();
  } else if (e.target.id === "selectAllGuests") {
    const isChecked = e.target.checked;
    const checkboxes = document.querySelectorAll(".guest-checkbox");
    checkboxes.forEach((cb) => {
      cb.checked = isChecked;
      const index = parseInt(cb.value);
      if (isChecked) selectedGuests.add(index);
      else selectedGuests.delete(index);
    });
    updateBatchUI();
  }
});

function updateBatchUI() {
  const totalRendered = document.querySelectorAll(".guest-checkbox").length;
  if (selectAllGuestsCb) {
    if (totalRendered > 0 && selectedGuests.size === totalRendered) {
      selectAllGuestsCb.checked = true;
    } else {
      selectAllGuestsCb.checked = false;
    }
  }

  if (selectedGuests.size > 0) {
    if(batchSelectedCount) batchSelectedCount.innerText = selectedGuests.size;
    if(batchFabContainer) batchFabContainer.classList.remove("hidden");
  } else {
    if(batchFabContainer) batchFabContainer.classList.add("hidden");
  }
}

// Open Batch Edit Modal
if(batchFabBtn) {
  batchFabBtn.addEventListener("click", () => {
    // Reset form to default (unchanged)
    batchEditForm.reset();
    document.getElementById("batchPlusCountContainer").style.display = "none";
    batchActionsModal.classList.add("active");
  });
}

// Toggle plus count input for batch edit
document.querySelectorAll('input[name="batchInviteType"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    const val = e.target.value;
    const container = document.getElementById("batchPlusCountContainer");
    if (val === "single" || val === "family") {
      container.style.display = "block";
    } else {
      container.style.display = "none";
    }
  });
});

if(closeBatchModalBtn) {
  closeBatchModalBtn.addEventListener("click", () => {
    batchActionsModal.classList.remove("active");
  });
}

// Apply Batch Edits
if(batchEditForm) {
  batchEditForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if(selectedGuests.size === 0) return;

    const newType = document.querySelector('input[name="batchInviteType"]:checked').value;
    const newPlus = document.getElementById("batchPlusCount").value;
    const newCategory = document.querySelector('input[name="batchGuestCategory"]:checked').value;
    const newSentStatus = document.getElementById("batchSentStatus").value;

    const submitBtn = document.getElementById("saveBatchBtn");
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying...';
    submitBtn.disabled = true;

    saveState();

    try {
      const guestsToUpdate = [];

      for (const index of selectedGuests) {
        let changed = false;
        let guest = guests[index];
        
        if (newType !== "unchanged") {
          guest.type = newType;
          if (newType === "single" || newType === "family") {
            guest.plus = newPlus;
          } else {
            guest.plus = 0;
          }
          changed = true;
        }
        
        if (newCategory !== "unchanged") {
          guest.category = newCategory;
          changed = true;
        }
        
        if (newSentStatus !== "unchanged") {
          guest.sent = (newSentStatus === "sent");
          changed = true;
        }

        if (changed) {
          guestsToUpdate.push(guest);
        }
      }

      if (guestsToUpdate.length > 0) {
        await batchUpdateFirebaseGuests(guestsToUpdate);
      }

      const updateCount = selectedGuests.size;
      saveAndRender();
      batchActionsModal.classList.remove("active");
      showAlert(`Successfully updated ${updateCount} guest(s).`, "Batch Edit Complete", "check-circle");
    } catch (err) {
      console.error("Batch update error:", err);
      showAlert("An error occurred during batch update.", "Error", "times-circle");
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });
}

// Batch Delete
if(batchDeleteBtn) {
  batchDeleteBtn.addEventListener("click", () => {
    if(selectedGuests.size === 0) return;
    
    const deleteModal = document.getElementById("deleteConfirmModal");
    const deleteText = document.getElementById("deleteConfirmText");
    deleteText.innerText = `Are you sure you want to permanently delete ${selectedGuests.size} selected guest(s)?`;
    deleteModal.classList.add("active");
  });

  const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
  const approveDeleteBtn = document.getElementById("approveDeleteBtn");

  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", () => {
      document.getElementById("deleteConfirmModal").classList.remove("active");
    });
  }

  if (approveDeleteBtn) {
    approveDeleteBtn.addEventListener("click", async () => {
      document.getElementById("deleteConfirmModal").classList.remove("active");

      saveState();
      const originalText = batchDeleteBtn.innerHTML;
      batchDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
      batchDeleteBtn.disabled = true;

      try {
        const deleteCount = selectedGuests.size;
        // Sort indices descending to avoid shifting issues when splicing
        const indicesToDelete = Array.from(selectedGuests).sort((a, b) => b - a);
        
        const guestsToDelete = [];
        for (const index of indicesToDelete) {
          guestsToDelete.push(guests[index]);
          guests.splice(index, 1);
        }

        if (guestsToDelete.length > 0) {
          await batchDeleteFirebaseGuests(guestsToDelete);
        }

        saveAndRender();
        batchActionsModal.classList.remove("active");
        showAlert(`Successfully deleted ${deleteCount} guest(s).`, "Batch Delete Complete", "check-circle");
      } catch (err) {
        console.error("Batch delete error:", err);
        showAlert("An error occurred during batch deletion.", "Error", "times-circle");
      } finally {
        batchDeleteBtn.innerHTML = originalText;
        batchDeleteBtn.disabled = false;
      }
    });
  }
}

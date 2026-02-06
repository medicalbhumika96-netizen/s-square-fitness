const firebaseConfig = {
  apiKey: "AIzaSyA86S_0I4A35DB26Z2RHL0QUMbDYFBzge4",
  authDomain: "fir-square-fitness.firebaseapp.com",
  projectId: "fir-square-fitness",
  storageBucket: "fir-square-fitness.firebasestorage.app",
  messagingSenderId: "1046572126467",
  appId: "1:1046572126467:web:f1ef5423b6dce3102dd936"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

console.log("Firebase project:", firebase.app().options.projectId);


// 🔗 FORM ELEMENT BINDS (VERY IMPORTANT)
const mUser = document.getElementById("mUser");
const mName = document.getElementById("mName");
const mPass = document.getElementById("mPass");
const mExpiry = document.getElementById("mExpiry");
const mTrainer = document.getElementById("mTrainer");
const mPlan = document.getElementById("mPlan");
const adminMsg = document.getElementById("adminMsg");
const memberTable = document.getElementById("memberTable");

/***********************
  GLOBAL STATE
************************/
let currentMember = null;
let adminLoggedIn = false;

/***********************
  MEMBER LOGIN
************************/
async function memberLogin() {
  const user = memberUser.value.trim();
  const pass = memberPass.value.trim();
  memberMsg.innerText = "Checking...";

  if (!user || !pass) {
    memberMsg.innerText = "Enter ID & Password";
    return;
  }

  try {
    const doc = await db.collection("members").doc(user).get();

    if (!doc.exists || doc.data().password !== pass) {
      memberMsg.innerText = "Invalid login";
      return;
    }

    currentMember = { id: user, ...doc.data() };

    memberSection.style.display = "flex";
    publicSite.style.display = "none";
    memberCard.style.display = "none";
    adminLoginCard.style.display = "none";

    memberName.innerText = currentMember.name;
    mExpiry.innerText = "Expiry: " + currentMember.expiry;

    mFeeStatus.innerText =
      new Date(currentMember.expiry) >= new Date()
        ? "Active"
        : "Expired";

    loadMemberAttendance();
  } catch (err) {
    console.error(err);
    memberMsg.innerText = "Login error";
  }
}

/***********************
  ADMIN LOGIN
************************/
function adminLoginUI() {
  if (adminPass.value !== "admin123") {
    adminLoginMsg.innerText = "Wrong password";
    return;
  }

  adminLoggedIn = true;
  adminSection.style.display = "flex";
  publicSite.style.display = "none";
  memberCard.style.display = "none";
  adminLoginCard.style.display = "none";

  loadDashboard();
  loadMembers();
}

/***********************
  ADMIN NAVIGATION
************************/
function showAdminTab(tab) {
  document
    .querySelectorAll(".admin-tab")
    .forEach(t => (t.style.display = "none"));

  if (tab === "dashboard") dashboardTab.style.display = "block";
  if (tab === "members") membersTab.style.display = "block";
  if (tab === "attendance") attendanceTab.style.display = "block";

  if (tab === "attendance") loadAttendance();
}


async function addMember(e) {
  e.preventDefault();

  if (
    !mUser.value.trim() ||
    !mName.value.trim() ||
    !mPass.value.trim() ||   // ✅ ADD THIS
    !mExpiry.value ||
    !mTrainer.value ||
    !mPlan.value
  ) {
    adminMsg.innerText = "❌ All fields required";
    return;
  }

  await db.collection("members").doc(mUser.value.trim()).set({
    name: mName.value.trim(),
    password: mPass.value.trim(),
    expiry: mExpiry.value,
    trainer: mTrainer.value,
    plan: mPlan.value,
    created: firebase.firestore.FieldValue.serverTimestamp()
  });

  adminMsg.innerText = "✅ Member Added";

  mUser.value = "";
  mName.value = "";
  mPass.value = "";
  mExpiry.value = "";
  mTrainer.value = "";
  mPlan.value = "";

  loadMembers();
}


/***********************
  LOAD MEMBERS
************************/
async function loadMembers() {
  memberTable.innerHTML = "<tr><td colspan='5'>Loading...</td></tr>";

  try {
    const snap = await db.collection("members").get();

    if (snap.empty) {
      memberTable.innerHTML =
        "<tr><td colspan='5'>No members</td></tr>";
      return;
    }

    memberTable.innerHTML = "";
    snap.forEach(doc => {
      const m = doc.data();
      memberTable.innerHTML += `
        <tr>
          <td>${doc.id}</td>
          <td>${m.name}</td>
          <td>${m.trainer}</td>
          <td>${m.expiry}</td>
          <td>-</td>
        </tr>`;
    });
  } catch (err) {
    console.error(err);
    memberTable.innerHTML =
      "<tr><td colspan='5'>Error loading</td></tr>";
  }
}

/***********************
  DASHBOARD STATS
************************/
async function loadDashboard() {
  const snap = await db.collection("members").get();
  totalMembers.innerText = snap.size;

  let active = 0,
    expired = 0;

  snap.forEach(d =>
    new Date(d.data().expiry) >= new Date() ? active++ : expired++
  );

  activeFees.innerText = active;
  expiredFees.innerText = expired;
}

/***********************
  🔥 QR / LOGIN ATTENDANCE
************************/
async function confirmAttendance(memberId, password) {
  try {
    const memberRef = db.collection("members").doc(memberId);
    const doc = await memberRef.get();

    if (!doc.exists || doc.data().password !== password) {
      alert("Invalid credentials");
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    // 🔒 Duplicate block
    const check = await db
      .collection("attendance")
      .where("memberId", "==", memberId)
      .where("date", "==", today)
      .get();

    if (!check.empty) {
      alert("Attendance already marked today");
      return;
    }

    await db.collection("attendance").add({
      memberId,
      name: doc.data().name,
      date: today,
      time: new Date().toLocaleTimeString(),
      method: "QR",
      created: firebase.firestore.FieldValue.serverTimestamp(),
    });

    alert("Attendance marked successfully ✅");
  } catch (err) {
    console.error(err);
    alert("Attendance error");
  }
}

/***********************
  ADMIN ATTENDANCE TABLE
************************/
async function loadAttendance() {
  const table = attendanceTable;
  table.innerHTML = "<tr><td colspan='5'>Loading...</td></tr>";

  const date = attDate.value;
  const method = attMethod.value;

  let query = db.collection("attendance");

  if (date) query = query.where("date", "==", date);
  if (method) query = query.where("method", "==", method);

  try {
    const snap = await query
      .orderBy("created", "desc")
      .get();

    if (snap.empty) {
      table.innerHTML =
        "<tr><td colspan='5'>No records</td></tr>";
      return;
    }

    table.innerHTML = "";
    snap.forEach(doc => {
      const d = doc.data();
      table.innerHTML += `
        <tr>
          <td>${d.memberId}</td>
          <td>${d.name}</td>
          <td>${d.date}</td>
          <td>${d.time}</td>
          <td>${d.method}</td>
        </tr>`;
    });
  } catch (err) {
    console.error(err);
    table.innerHTML =
      "<tr><td colspan='5'>Error loading</td></tr>";
  }
}

/***********************
  MEMBER ATTENDANCE
************************/
async function loadMemberAttendance() {
  const snap = await db
    .collection("attendance")
    .where("memberId", "==", currentMember.id)
    .get();

  mAttendance.innerText = snap.size + " days";
}

/***********************
  LOGOUTS
************************/
function memberLogout() {
  location.reload();
}

function adminLogout() {
  location.reload();
}

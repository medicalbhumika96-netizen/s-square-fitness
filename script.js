/***********************
  🔥 FIREBASE CONFIG
************************/
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

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
    .forEach((t) => (t.style.display = "none"));

  if (tab === "dashboard") dashboardTab.style.display = "block";
  if (tab === "members") membersTab.style.display = "block";
  if (tab === "attendance") attendanceTab.style.display = "block";

  if (tab === "attendance") loadAttendance();
}

/***********************
  ADD MEMBER
************************/
async function addMember(e) {
  e.preventDefault();

  await db.collection("members").doc(mUser.value).set({
    name: mName.value,
    password: mPass.value,
    expiry: mExpiry.value,
    trainer: mTrainer.value,
    plan: mPlan.value,
  });

  adminMsg.innerText = "Member Added";
  loadMembers();
}

/***********************
  LOAD MEMBERS
************************/
async function loadMembers() {
  memberTable.innerHTML = "";
  const snap = await db.collection("members").get();

  snap.forEach((doc) => {
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
}

/***********************
  DASHBOARD STATS
************************/
async function loadDashboard() {
  const snap = await db.collection("members").get();
  totalMembers.innerText = snap.size;

  let active = 0,
    expired = 0;
  snap.forEach((d) =>
    new Date(d.data().expiry) >= new Date() ? active++ : expired++
  );

  activeFees.innerText = active;
  expiredFees.innerText = expired;
}

/***********************
  🔥 QR / LOGIN ATTENDANCE
************************/
async function confirmAttendance(memberId, password) {
  const memberRef = db.collection("members").doc(memberId);
  const doc = await memberRef.get();

  if (!doc.exists || doc.data().password !== password) {
    alert("Invalid credentials");
    return;
  }

  const today = new Date().toLocaleDateString();

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

  // ✅ Save attendance
  await db.collection("attendance").add({
    memberId,
    name: doc.data().name,
    date: today,
    time: new Date().toLocaleTimeString(),
    method: "QR",
    created: firebase.firestore.FieldValue.serverTimestamp(),
  });

  alert("Attendance marked successfully ✅");
}

/***********************
  ADMIN ATTENDANCE TABLE
************************/
async function loadAttendance() {
  attendanceTable.innerHTML = "";

  let query = db.collection("attendance").orderBy("created", "desc");

  const date = attDate.value;
  const method = attMethod.value;

  if (date) query = query.where("date", "==", new Date(date).toLocaleDateString());
  if (method) query = query.where("method", "==", method);

  const snap = await query.get();

  if (snap.empty) {
    attendanceTable.innerHTML =
      "<tr><td colspan='5'>No records</td></tr>";
    return;
  }

  snap.forEach((d) => {
    const a = d.data();
    attendanceTable.innerHTML += `
      <tr>
        <td>${a.memberId}</td>
        <td>${a.name}</td>
        <td>${a.date}</td>
        <td>${a.time}</td>
        <td>${a.method}</td>
      </tr>`;
  });
}

/***********************
  MEMBER ATTENDANCE %
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

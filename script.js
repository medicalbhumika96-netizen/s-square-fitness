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
const isDesktop = window.matchMedia("(pointer: fine)").matches;

/***********************
  GLOBAL STATE
************************/
let currentMember = null;
let adminLoggedIn = false;

if(localStorage.getItem("adminLoggedIn") !== "true"){
  document.getElementById("adminSection").style.display = "none";
}

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
async function loadAttendance(){
  const dateInput = document.getElementById("attDate").value;
  const method = document.getElementById("attMethod").value;
  const tbody = document.getElementById("attendanceTable");

  if(!dateInput){
    alert("Please select date");
    return;
  }

  tbody.innerHTML = `<tr><td colspan="5">Loading...</td></tr>`;

  // 📅 Date range
  const start = new Date(dateInput);
  start.setHours(0,0,0,0);

  const end = new Date(dateInput);
  end.setHours(23,59,59,999);

  try{
    let queryRef = db.collection("attendance")
      .where("timestamp", ">=", start)
      .where("timestamp", "<=", end);

    // 🎯 Method filter (optional)
    if(method){
      queryRef = queryRef.where("method", "==", method);
    }

    const snap = await queryRef.get();

    if(snap.empty){
      tbody.innerHTML = `<tr><td colspan="5">No attendance found</td></tr>`;
      return;
    }

    tbody.innerHTML = "";

    snap.forEach(doc=>{
      const a = doc.data();
      const t = a.timestamp.toDate();

      const row = `
        <tr>
          <td>${a.user || a.memberId}</td>
          <td>${a.name}</td>
          <td>${t.toLocaleDateString()}</td>
          <td>${t.toLocaleTimeString()}</td>
          <td>${a.method}</td>
        </tr>
      `;
      tbody.innerHTML += row;
    });

  }catch(err){
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="5">Error loading attendance</td></tr>`;
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
const scrollTopBtn = document.getElementById("scrollTopBtn");

window.addEventListener("scroll", () => {
  if(window.scrollY > 300){
    scrollTopBtn.style.display = "block";
  }else{
    scrollTopBtn.style.display = "none";
  }
});

scrollTopBtn.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});
// 3D hover tilt effect
const tiltCards = document.querySelectorAll(
  ".about-card, .plan-card, .trainer-card, .box"
);

if(isDesktop){
  const tiltCards = document.querySelectorAll(
    ".about-card, .plan-card, .trainer-card, .box"
  );

  tiltCards.forEach(card => {
    card.addEventListener("mousemove", e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = -(y - centerY) / 25;
      const rotateY = (x - centerX) / 25;

      card.style.transform =
        `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "none";
    });
  });
}
document.querySelectorAll(
  ".about-card, .plan-card, .trainer-card, .box"
).forEach(card => {
  card.addEventListener("touchstart", () => {
    card.classList.add("tap-active");
  });

  card.addEventListener("touchend", () => {
    setTimeout(() => {
      card.classList.remove("tap-active");
    }, 200);
  });
});
// Mouse glow effect on about section
const aboutSection = document.querySelector(".about-pro");

if(aboutSection){
  aboutSection.addEventListener("mousemove", e => {
    const x = e.clientX;
    const y = e.clientY;

    aboutSection.style.background = `
      radial-gradient(
        600px at ${x}px ${y}px,
        rgba(0,230,195,0.12),
        #0f1720 70%
      )
    `;
  });

  aboutSection.addEventListener("mouseleave", () => {
    aboutSection.style.background = "#0f1720";
  });
}
// Ripple effect on buttons
document.querySelectorAll("button, .btn").forEach(btn => {
  btn.addEventListener("click", function(e){
    const circle = document.createElement("span");
    const diameter = Math.max(this.clientWidth, this.clientHeight);
    const radius = diameter / 2;

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${e.clientX - this.offsetLeft - radius}px`;
    circle.style.top = `${e.clientY - this.offsetTop - radius}px`;
    circle.classList.add("ripple");

    const ripple = this.querySelector(".ripple");
    if(ripple) ripple.remove();

    this.appendChild(circle);
  });
});
// Trainer focus effect
const trainers = document.querySelectorAll(".trainer-card");

trainers.forEach(card => {
  card.addEventListener("mouseenter", () => {
    trainers.forEach(c => c.style.opacity = "0.4");
    card.style.opacity = "1";
    card.style.transform += " scale(1.05)";
  });

  card.addEventListener("mouseleave", () => {
    trainers.forEach(c => {
      c.style.opacity = "1";
      c.style.transform = "scale(1)";
    });
  });
});

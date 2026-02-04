/* ======================
   FIREBASE INIT
====================== */
const firebaseConfig = {
  apiKey: "AIzaSyA86S_0IA435DB26Z2RHLQUMbDYFBzge4",
  authDomain: "fir-square-fitness.firebaseapp.com",
  projectId: "fir-square-fitness",
  storageBucket: "fir-square-fitness.firebasestorage.app",
  messagingSenderId: "1046572126467",
  appId: "1:1046572126467:web:f1ef5423b6dce3102dd936"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

/* ======================
   GLOBAL STATE
====================== */
let members = [];
let currentMember = null;
let attendanceChart = null;

/* ======================
   BMI
====================== */
function calcBMI(){
  const w = +weight.value;
  const h = +height.value / 100;
  if(!w || !h){
    bmiResult.innerText = "Enter valid values";
    return;
  }
  const bmi = (w / (h*h)).toFixed(1);
  const status =
    bmi < 18.5 ? "Underweight" :
    bmi < 25 ? "Normal" :
    bmi < 30 ? "Overweight" : "Obese";
  bmiResult.innerText = `BMI: ${bmi} (${status})`;
}

/* ======================
   JOIN FORM
====================== */
function customerJoin(){
  const msg =
`New Gym Enquiry
Name: ${name.value}
Phone: ${phone.value}
Plan: ${plan.value}`;

  window.open(
    `https://wa.me/918003929804?text=${encodeURIComponent(msg)}`,
    "_blank"
  );
}

/* ======================
   MEMBER LOGIN
====================== */
async function memberLogin(){
  memberMsg.innerText = "Checking...";

  const id = memberUser.value.trim();
  const pass = memberPass.value.trim();

  if(!id || !pass){
    memberMsg.innerText = "Enter ID & Password";
    return;
  }

  try{
    const doc = await db.collection("members").doc(id).get();

    if(!doc.exists || doc.data().password !== pass){
      memberMsg.innerText = "Invalid login";
      return;
    }

    currentMember = { user:id, ...doc.data() };
    localStorage.setItem("currentMember", JSON.stringify(currentMember));

    // Hide public & login
    document.getElementById("publicSite").style.display = "none";
    document.querySelector(".section-panel").style.display = "none";
    document.getElementById("adminSection").style.display = "none";

    // Show member panel
    document.getElementById("memberSection").style.display = "flex";

    loadMemberDashboard();
    showMemberTab("mdashboard");

  }catch(err){
    console.error(err);
    memberMsg.innerText = "Login error";
  }
}

/* ======================
   MEMBER DASHBOARD
====================== */
async function loadMemberDashboard(){
  memberName.innerText = currentMember.name;
  mExpiry.innerText = "Valid till: " + currentMember.expiry;

  const active = new Date(currentMember.expiry) >= new Date();
  mFeeStatus.innerText = active ? "🟢 Active" : "🔴 Expired";

  const snap = await db.collection("attendance")
    .where("user","==",currentMember.user)
    .get();

  const percent = snap.size === 0 ? 0 : Math.min(100, snap.size * 4);
  mAttendance.innerText = percent + "%";

  renderAttendanceChart();
}

/* ======================
   MEMBER TABS
====================== */
function showMemberTab(tab){
  document.querySelectorAll(".member-tab").forEach(t=>{
    t.style.display = "none";
  });
  document.getElementById(tab).style.display = "block";
}

/* ======================
   ATTENDANCE CHART
====================== */
async function renderAttendanceChart(){
  const canvas = document.getElementById("attendanceChart");
  if(!canvas) return;

  const snap = await db.collection("attendance")
    .where("user","==",currentMember.user)
    .get();

  const map = {};
  snap.forEach(d=>{
    const date = d.data().date;
    map[date] = (map[date] || 0) + 1;
  });

  if(attendanceChart) attendanceChart.destroy();

  attendanceChart = new Chart(canvas,{
    type:"bar",
    data:{
      labels:Object.keys(map),
      datasets:[{
        label:"Days Present",
        data:Object.values(map),
        backgroundColor:"#00ffd5"
      }]
    }
  });
}

/* ======================
   RENEW FEE
====================== */
function renewFee(){
  const msg =
`Hello 👋
I want to renew my gym membership.

Member ID: ${currentMember.user}
Plan: ${currentMember.plan}
Expiry: ${currentMember.expiry}`;

  window.open(
    `https://wa.me/918003929804?text=${encodeURIComponent(msg)}`,
    "_blank"
  );
}

/* ======================
   CHAT TRAINER
====================== */
function chatTrainer(){
  window.open(
    "https://wa.me/918003929804?text=Hi Trainer, I need guidance",
    "_blank"
  );
}

/* ======================
   DIET PLAN (ADMIN UPLOAD → MEMBER VIEW)
====================== */
async function openDiet(){
  const doc = await db.collection("dietPlans")
    .doc(currentMember.user).get();

  if(!doc.exists){
    alert("Diet plan not assigned");
    return;
  }
  window.open(doc.data().pdfUrl,"_blank");
}

/* ======================
   ADMIN LOGIN
====================== */
function adminLoginUI(){
  if(adminPass.value !== "admin123"){
    adminLoginMsg.innerText = "Wrong password";
    return;
  }

  document.getElementById("publicSite").style.display = "none";
  document.querySelector(".section-panel").style.display = "none";

  adminSection.style.display = "flex";
  showAdminTab("dashboard");

  loadMembersFromDB();
}

/* ======================
   ADMIN TABS
====================== */
function showAdminTab(tab){
  ["dashboard","members"].forEach(t=>{
    document.getElementById(t+"Tab").style.display =
      t === tab ? "block" : "none";
  });
}

/* ======================
   LOAD MEMBERS
====================== */
async function loadMembersFromDB(){
  members = [];
  const snap = await db.collection("members").get();
  snap.forEach(doc=>{
    members.push({ user: doc.id, ...doc.data() });
  });
  renderMemberTable();
  updateAnalytics();
}

/* ======================
   ADD MEMBER
====================== */
async function addMember(e){
  e.preventDefault();

  if(!mUser.value || !mName.value || !mPass.value || !mExpiry.value){
    adminMsg.innerText = "Fill all fields";
    return;
  }

  await db.collection("members").doc(mUser.value).set({
    name: mName.value,
    password: mPass.value,
    expiry: mExpiry.value,
    trainer: mTrainer.value,
    plan: mPlan.value,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  adminMsg.innerText = "✅ Member added";
  mUser.value = mName.value = mPass.value = mExpiry.value = "";

  loadMembersFromDB();
}

/* ======================
   MEMBER TABLE
====================== */
function renderMemberTable(){
  memberTable.innerHTML = "";

  members.forEach(m=>{
    const expired = new Date(m.expiry) < new Date();

    memberTable.innerHTML += `
      <tr>
        <td>${m.user}</td>
        <td>${m.name}</td>
        <td>${m.trainer}</td>
        <td>
          <span class="badge ${expired?'expired':'active'}">
            ${m.expiry}
          </span>
        </td>
        <td>
          <button onclick="manualReminder('${m.user}')">📲</button>
          <button onclick="deleteMember('${m.user}')">❌</button>
        </td>
      </tr>
    `;
  });
}

/* ======================
   REMINDER
====================== */
function manualReminder(id){
  const m = members.find(x=>x.user===id);
  if(!m) return;

  const msg =
`Hello ${m.name} 👋
Your gym membership expires on ${m.expiry}.
Please renew your fees 💪`;

  window.open(
    `https://wa.me/918003929804?text=${encodeURIComponent(msg)}`,
    "_blank"
  );
}

/* ======================
   DELETE MEMBER
====================== */
async function deleteMember(id){
  await db.collection("members").doc(id).delete();
  loadMembersFromDB();
}

/* ======================
   ANALYTICS
====================== */
function updateAnalytics(){
  totalMembers.innerText = members.length;
  const active = members.filter(
    m => new Date(m.expiry) >= new Date()
  ).length;
  activeFees.innerText = active;
  expiredFees.innerText = members.length - active;
}

function loadDemoAttendance(){
  const count = localStorage.getItem("attendance") || 0;
  document.getElementById("mAttendance").innerText =
    Math.min(100, count * 5) + "%";
}
loadDemoAttendance();


async function loadAttendance(){
  const table = document.getElementById("attendanceTable");
  table.innerHTML = "<tr><td colspan='5'>Loading...</td></tr>";

  let query = db.collection("attendance").orderBy("time","desc");

  const dateVal = document.getElementById("attDate")?.value;
  const methodVal = document.getElementById("attMethod")?.value;

  const snap = await query.get();
  table.innerHTML = "";

  snap.forEach(doc=>{
    const d = doc.data();

    const dateObj = d.time.toDate();
    const dateStr = dateObj.toLocaleDateString();
    const timeStr = dateObj.toLocaleTimeString();

    if(dateVal && dateStr !== new Date(dateVal).toLocaleDateString()) return;
    if(methodVal && d.method !== methodVal) return;

    table.innerHTML += `
      <tr>
        <td>${d.user}</td>
        <td>${d.name}</td>
        <td>${dateStr}</td>
        <td>${timeStr}</td>
        <td>
          <span class="badge ${d.method === "QR" ? "active" : "expired"}">
            ${d.method}
          </span>
        </td>
      </tr>
    `;
  });

  if(table.innerHTML === ""){
    table.innerHTML = "<tr><td colspan='5'>No records found</td></tr>";
  }
}

/* ======================
   LOGOUT
====================== */
function memberLogout(){ 
  localStorage.clear();
  location.reload(); 
}
function adminLogout(){ location.reload(); }

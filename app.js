

const firebaseConfig = {
  apiKey: "AIzaSyAdc9STb-EImui0DGhuteY8okGKWAMnpJE",
  authDomain: "machinerepairlogsapp.firebaseapp.com",
  projectId: "machinerepairlogsapp",
  storageBucket: "machinerepairlogsapp.firebasestorage.app",
  messagingSenderId: "933593286710",
  appId: "1:933593286710:web:b257aa07e4a2a7d0cc7097",
  measurementId: "G-BXNYDQ56KC"
};

// Init Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Auto-fill current date and time
const now = new Date();
const logDate = document.getElementById("logDate");
const logTime = document.getElementById("logTime");
const supervisorName = document.getElementById("supervisorName");

logDate.value = now.toISOString().split("T")[0]; // format: YYYY-MM-DD

// Format time like HH:MM
const hours = String(now.getHours()).padStart(2, '0');
const minutes = String(now.getMinutes()).padStart(2, '0');
logTime.value = `${hours}:${minutes}`;

// Auto-fill supervisor name from browser memory
const savedSupervisorName = localStorage.getItem('supervisorName');
const savedShiftType = localStorage.getItem('shiftType');

if (savedSupervisorName) {
  supervisorName.value = savedSupervisorName;
}

if (savedShiftType) {
  const shiftTypeSelect = document.getElementById("shiftType");
  shiftTypeSelect.value = savedShiftType;
}

// Save supervisor name to browser memory when user types
supervisorName.addEventListener('input', () => {
  if (supervisorName.value.trim()) {
    localStorage.setItem('supervisorName', supervisorName.value.trim());
  }
});

// Save shift type to browser memory when user selects
const shiftTypeSelect = document.getElementById("shiftType");
shiftTypeSelect.addEventListener('change', () => {
  if (shiftTypeSelect.value) {
    localStorage.setItem('shiftType', shiftTypeSelect.value);
  }
});

// Clear session button functionality
document.getElementById("clearSession").onclick = () => {
  if (confirm("Clear current supervisor session? This will reset the supervisor name and shift type.")) {
    localStorage.removeItem('supervisorName');
    localStorage.removeItem('shiftType');
    supervisorName.value = '';
    shiftTypeSelect.value = '';
    supervisorName.focus(); // Focus on supervisor name field for new entry
    alert("Session cleared. Please enter new supervisor information.");
  }
};
const problemCodes = ["NRM", "NWO", "XWO", "TSS", "STD", "BND", "TNS", "BST", "EDG", "WIV", "BKS", "TNT", "CLR", "ELE", "ZEM", "MFR", "BUR", "CAM", "CFL", "CRB", "EIT", "MTE", "MTF", "STP", "TIM", "MTR", "PSB", "HED", "SHOP", "SPG", ];



for (let i = 1; i <= 74; i++) { // Change to 69 later
  const row = document.createElement("tr");

  const cell1 = document.createElement("td");
  cell1.className = "border px-2 py-1 font-bold";
  cell1.textContent = `#${i}`;

  const statusCell = document.createElement("td");
  statusCell.className = "border px-2 py-1";
  const runBtn = document.createElement("button");
  runBtn.textContent = "Running";
  runBtn.className = "bg-green-400 px-2 py-1 rounded text-white mr-1";
  const stopBtn = document.createElement("button");
  stopBtn.textContent = "Stopped";
  stopBtn.className = "bg-red-400 px-2 py-1 rounded text-white";

  statusCell.append(runBtn, stopBtn);

  const problemCell = document.createElement("td");
  problemCell.className = "border px-2 py-1";
  const select = document.createElement("select");
  select.className = "border p-1 rounded w-full";
  select.innerHTML = `<option value="">None</option>` +
    problemCodes.map(p => `<option value="${p}">${p}</option>`).join("");
  problemCell.appendChild(select);

  row.append(cell1, statusCell, problemCell);
  machineRows.appendChild(row);

  runBtn.onclick = () => {
    runBtn.classList.add("bg-green-700");
    stopBtn.classList.remove("bg-red-700");
    select.disabled = true;
    select.value = "";
  };

  stopBtn.onclick = () => {
    stopBtn.classList.add("bg-red-700");
    runBtn.classList.remove("bg-green-700");
    select.disabled = false;
  };
}

document.getElementById("saveLogs").onclick = () => {
  
  const time = document.getElementById("logTime").value;
  const date = document.getElementById("logDate").value;
  const supervisorName = document.getElementById("supervisorName").value;
  const shiftType = document.getElementById("shiftType").value;
  
  if (!time || !date) {
    alert("Please select date and time.");
    return;
  }
  
  if (!supervisorName || !shiftType) {
    alert("Please fill in supervisor name and shift type.");
    return;
  }

  const rows = document.querySelectorAll("#machineRows tr");
  const logs = [];

  rows.forEach((row, i) => {
    const machineNum = i + 1;
    const isRunning = row.querySelector("button:nth-child(1)").classList.contains("bg-green-700");
    const isStopped = row.querySelector("button:nth-child(2)").classList.contains("bg-red-700");
    const problem = row.querySelector("select").value;

    if (isRunning || isStopped) {
      logs.push({
        machine: machineNum,
        status: isRunning ? "Running" : "Stopped",
        problem: isStopped ? problem : "",
        timestamp: `${date} ${time}`,
        supervisorName: supervisorName,
        shiftType: shiftType
      });
    }
  });

  // 🔽 This is the new Firebase save code
  logs.forEach(log => {
  db.collection("supervisorLogs").add(log)
    .then(() => console.log(`✅ Saved machine #${log.machine}`))
    .catch(error => console.error("❌ Error saving log:", error));
});

alert("✅ Saved " + logs.length + " log(s) to Firebase!");
  // TODO: Save to Firebase
};

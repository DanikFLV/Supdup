const firebaseConfig = {
  apiKey: "AIzaSyAdc9STb-EImui0DGhuteY8okGKWAMnpJE",
  authDomain: "machinerepairlogsapp.firebaseapp.com",
  projectId: "machinerepairlogsapp",
  storageBucket: "machinerepairlogsapp.firebasestorage.app",
  messagingSenderId: "933593286710",
  appId: "1:933593286710:web:b257aa07e4a2a7d0cc7097",
  measurementId: "G-BXNYDQ56KC"
};

// Check if Firebase is already initialized to avoid duplicate initialization
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

const container = document.getElementById("timelineContainer");
const dateInput = document.getElementById("logDate");
const shiftFilter = document.getElementById("shiftFilter");
const loadBtn = document.getElementById("loadBtn");

let lastTimelineData = null;
let lastUsedShift = null;
let supervisorData = null; // Store supervisor information
// Auto-fill today's date
const today = new Date().toISOString().split("T")[0];
dateInput.value = today;

loadBtn.onclick = () => {
  const selectedDate = dateInput.value;
  const selectedShift = shiftFilter.value;
  if (!selectedDate) return alert("Select a date first.");

  loadLogs(selectedDate, selectedShift);
};

// Auto-reload when shift filter changes
shiftFilter.onchange = () => {
  const selectedDate = dateInput.value;
  const selectedShift = shiftFilter.value;
  if (selectedDate && lastTimelineData) {
    // If we already have data loaded, just re-render with new shift filter
    loadLogs(selectedDate, selectedShift);
  }
};

function loadLogs(date, shift) {
  container.innerHTML = "Loading...";
  
  console.log(`Loading logs for date: ${date}, shift: ${shift}`);
  lastUsedShift = shift; // Store the shift used for this load

  // Create more flexible date range queries
  const startDate = `${date} 00:00:00`;
  const endDate = `${date} 23:59:59`;
  
  console.log(`Querying from ${startDate} to ${endDate}`);

  db.collection("supervisorLogs")
    .where("timestamp", ">=", startDate)
    .where("timestamp", "<=", endDate)
    .get()
    .then(snapshot => {
      console.log(`Found ${snapshot.size} documents with date range query`);
      
      // If no results with detailed timestamp, try broader query
      if (snapshot.size === 0) {
        console.log("No results with timestamp range, trying broader date query...");
        return db.collection("supervisorLogs").get();
      }
      return Promise.resolve(snapshot);
    })
    .then(snapshot => {
      console.log(`Processing ${snapshot.size} documents for date filtering`);
      const data = {};
      let processedCount = 0;
      supervisorData = null; // Reset supervisor data

      snapshot.forEach(doc => {
        const log = doc.data();
        console.log("Processing log:", log);
        
        const { machine, status, problem, timestamp, supervisorName, shiftType, productionProficiency } = log;
        
        // Extract supervisor information from first valid log
        if (!supervisorData && supervisorName && timestamp.split(" ")[0] === date) {
          supervisorData = {
            supervisorName,
            shiftType,
            productionProficiency
          };
        }
        
        // Validate required fields
        if (!machine || !status || !timestamp) {
          console.warn("Skipping invalid log entry:", log);
          return;
        }
        
        // Parse machine number - handle both string and number types
        const machineNum = parseInt(machine);
        if (isNaN(machineNum)) {
          console.warn("Invalid machine number:", machine);
          return;
        }
        
        const [logDate, logTime] = timestamp.split(" ");
        if (!logTime) {
          console.warn("Invalid timestamp format:", timestamp);
          return;
        }
        
        // Additional date filter for broader query results
        if (logDate !== date) {
          console.log(`Skipping log from different date: ${logDate} vs ${date}`);
          return;
        }
        
        if (!data[machineNum]) data[machineNum] = [];

        // Shift filter - Fixed logic
        const hour = parseInt(logTime.split(":")[0]);
        console.log(`Checking time ${logTime} (hour: ${hour}) for shift ${shift}`);
        
        if (shift === "1" && (hour < 6 || hour >= 18)) {
          console.log(`Filtered out ${logTime} - outside shift 1 hours (6AM-6PM)`);
          return; // Shift 1: 6AM-6PM
        }
        if (shift === "2" && (hour >= 6 && hour < 18)) {
          console.log(`Filtered out ${logTime} - inside day hours for shift 2`);
          return;  // Shift 2: 6PM-6AM (overnight) - exclude day hours
        }
        // If shift === "all", don't filter anything
        
        console.log(`Including ${logTime} for shift ${shift}`);

        data[machineNum].push({ time: logTime, status, problem: problem || "" });
        processedCount++;
        console.log(`Added log for machine ${machineNum} at ${logTime}: ${status}`);
      });

      console.log(`Processed ${processedCount} logs out of ${snapshot.size} documents`);
      console.log("Final processed data:", data);
      
      // Debug: Show sample of all documents for troubleshooting
      if (snapshot.size > 0 && processedCount === 0) {
        console.log("❌ Found documents but none were processed. Sample documents:");
        snapshot.docs.slice(0, 3).forEach((doc, index) => {
          console.log(`Document ${index + 1}:`, doc.data());
        });
      }
      
      // ✅ Store for export
      lastTimelineData = data;

      // Display supervisor information
      if (supervisorData && supervisorData.supervisorName) {
        displaySupervisorInfo(supervisorData);
      } else {
        // Hide supervisor info if no supervisor data found
        const supervisorInfoDiv = document.getElementById("supervisorInfo");
        if (supervisorInfoDiv) {
          supervisorInfoDiv.classList.add("hidden");
        }
      }

      if (Object.keys(data).length === 0) {
        container.innerHTML = `<div class="text-center text-gray-500 py-8">No data found for ${date}. Make sure you have saved some logs first.</div>`;
      } else {
        renderTimeline(data, shift); // Pass the shift parameter to renderTimeline
      }
    })
    .catch(err => {
      console.error("Error loading timeline data:", err);
      container.innerHTML = `<div class="text-center text-red-500 py-8">Failed to load data: ${err.message}</div>`;
    });
}

function displaySupervisorInfo(data) {
  const supervisorInfoDiv = document.getElementById("supervisorInfo");
  const supervisorNameSpan = document.getElementById("displaySupervisorName");
  const shiftTypeSpan = document.getElementById("displayShiftType");
  const productionProficiencySpan = document.getElementById("displayProductionProficiency");
  
  // Check if all required elements exist
  if (!supervisorInfoDiv || !supervisorNameSpan || !shiftTypeSpan || !productionProficiencySpan) {
    console.warn("Supervisor info elements not found in DOM");
    return;
  }
  
  if (data && data.supervisorName) {
    supervisorNameSpan.textContent = data.supervisorName;
    shiftTypeSpan.textContent = data.shiftType || "N/A";
    
    if (data.productionProficiency !== null && data.productionProficiency !== undefined && data.productionProficiency !== "") {
      productionProficiencySpan.textContent = `${data.productionProficiency}%`;
      // Add color coding based on proficiency level
      if (data.productionProficiency >= 90) {
        productionProficiencySpan.className = "ml-2 text-green-600 font-bold text-lg";
      } else if (data.productionProficiency >= 75) {
        productionProficiencySpan.className = "ml-2 text-yellow-600 font-bold text-lg";
      } else {
        productionProficiencySpan.className = "ml-2 text-red-600 font-bold text-lg";
      }
    } else {
      productionProficiencySpan.textContent = "N/A";
      productionProficiencySpan.className = "ml-2 text-gray-500 font-bold text-lg";
    }
    
    supervisorInfoDiv.classList.remove("hidden");
  } else {
    supervisorInfoDiv.classList.add("hidden");
  }
}

function renderTimeline(machineLogs, shift) {
  container.innerHTML = ""; // Clear

  // Generate time blocks based on the passed shift parameter (not the current filter value)
  const currentShift = shift || shiftFilter.value;
  const timeBlocks = [];
  
  if (currentShift === "1") {
    // Shift 1: 6:00 AM to 6:00 PM
    for (let hour = 6; hour <= 18; hour++) {
      timeBlocks.push(`${String(hour).padStart(2, "0")}:00`);
      if (hour !== 18) timeBlocks.push(`${String(hour).padStart(2, "0")}:30`);
    }
  } else if (currentShift === "2") {
    // Shift 2: 6:00 PM to 6:00 AM (next day)
    // Evening hours (18:00 - 23:30)
    for (let hour = 18; hour <= 23; hour++) {
      timeBlocks.push(`${String(hour).padStart(2, "0")}:00`);
      if (hour !== 23) timeBlocks.push(`${String(hour).padStart(2, "0")}:30`);
    }
    // Early morning hours (00:00 - 05:30)
    for (let hour = 0; hour <= 5; hour++) {
      timeBlocks.push(`${String(hour).padStart(2, "0")}:00`);
      if (hour !== 5) timeBlocks.push(`${String(hour).padStart(2, "0")}:30`);
    }
  } else {
    // All shifts: Show full 24 hours
    for (let hour = 0; hour <= 23; hour++) {
      timeBlocks.push(`${String(hour).padStart(2, "0")}:00`);
      if (hour !== 23) timeBlocks.push(`${String(hour).padStart(2, "0")}:30`);
    }
  }

  console.log(`Rendering timeline for shift ${currentShift} with ${timeBlocks.length} time blocks`);

  // ✅ Add timeline header (time labels)
  const headerRow = document.createElement("div");
  headerRow.className = "flex items-center mb-1 sticky top-0 bg-white shadow-md z-20 border-b border-gray-200 py-2";

  const emptyLabel = document.createElement("div");
  emptyLabel.className = "w-16 font-bold text-sm"; // leave space where machine # goes
  emptyLabel.textContent = "Machine";
  headerRow.appendChild(emptyLabel);

  const timeGrid = document.createElement("div");
  // Dynamic grid columns based on number of time blocks
  const gridCols = timeBlocks.length;
  timeGrid.className = `grid gap-0.5 flex-1 text-xs text-center text-gray-700 font-medium`;
  timeGrid.style.gridTemplateColumns = `repeat(${gridCols}, minmax(24px, 1fr))`;

  timeBlocks.forEach(time => {
    const timeLabel = document.createElement("div");
    timeLabel.textContent = time;
    timeGrid.appendChild(timeLabel);
  });

  headerRow.appendChild(timeGrid);
  
  // Add uptime header
  const uptimeHeader = document.createElement("div");
  uptimeHeader.className = "w-16 font-bold text-xs text-center";
  uptimeHeader.textContent = "Uptime";
  headerRow.appendChild(uptimeHeader);
  
  container.appendChild(headerRow);
  
  
  
for (let i = 1; i <= 74; i++) {
  const row = document.createElement("div");
  row.className = "flex items-center border-b border-gray-300 py-1";

  const label = document.createElement("div");
  label.className = "w-16 font-bold text-sm text-right pr-2";
  label.textContent = `#${i}`;

  const timeline = document.createElement("div");
  timeline.className = "relative flex-1 flex";

  const logs = machineLogs[i] || [];
  logs.sort((a, b) => a.time.localeCompare(b.time));

  // Debug logging for machines with data
  if (i === 1 && logs.length > 0) {
    console.log(`Machine ${i} has ${logs.length} logs:`, logs);
  }

  // 👇 Track uptime - simplified approach
  let runningBlocks = 0;
  let totalBlocks = 0;

  // Create a map of time blocks to their closest logs
  const blockToLog = {};
  
  logs.forEach(log => {
    const logTime = log.time;
    const [logHour, logMin] = logTime.split(':').map(Number);
    const logMinutes = logHour * 60 + logMin;
    
    // Find the closest time block
    let closestBlock = null;
    let closestDistance = Infinity;
    
    timeBlocks.forEach(block => {
      const [blockHour, blockMin] = block.split(':').map(Number);
      const blockMinutes = blockHour * 60 + blockMin;
      const distance = Math.abs(logMinutes - blockMinutes);
      
      // Only consider blocks within 15 minutes
      if (distance <= 15 && distance < closestDistance) {
        closestDistance = distance;
        closestBlock = block;
      }
    });
    
    if (closestBlock) {
      blockToLog[closestBlock] = log;
    }
  });

  // Count uptime using the mapped blocks
  timeBlocks.forEach(block => {
    const log = blockToLog[block];
    if (log) {
      totalBlocks++;
      if (log.status === "Running") runningBlocks++;
    }
  });

  // 👇 Create uptime label
  const uptime = totalBlocks > 0 ? Math.round((runningBlocks / totalBlocks) * 100) : 0;
  const uptimeLabel = document.createElement("div");
  uptimeLabel.className = "text-xs text-right pr-2 w-16";
  uptimeLabel.textContent = `${uptime}%`;

  // 👇 Optional color indicator
  if (uptime >= 90) {
    uptimeLabel.classList.add("text-green-600", "font-bold");
  } else if (uptime >= 75) {
    uptimeLabel.classList.add("text-yellow-600", "font-semibold");
  } else {
    uptimeLabel.classList.add("text-red-600", "font-semibold");
  }

  // ⬇️ Timeline rendering logic starts here
  let currentState = "No Data";
  let currentProblem = "";
  let stateStart = 0;

  for (let b = 0; b <= timeBlocks.length; b++) {
    const time = timeBlocks[b];
    // Use the same mapping approach for timeline rendering
    const log = blockToLog[time];
    const isEnd = b === timeBlocks.length;

    if (log || isEnd) {
      const newState = log?.status || currentState;
      const newProblem = log?.problem || "";

      if (b > stateStart && (log || isEnd)) {
        const span = b - stateStart;
        if (span > 0) {
          const bar = document.createElement("div");
          bar.className = "text-xs h-6 flex items-center justify-center text-white rounded-sm mr-0.5 relative group";

          bar.style.width = `calc(${span} * (100% / ${timeBlocks.length}) - 1px)`;

          if (currentState === "Stopped") {
            bar.textContent = currentProblem || "Stopped";
          }

          // Tooltip container
          const tooltip = document.createElement("div");
          tooltip.className =
            "absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-xs bg-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none z-10";
          tooltip.textContent = `${currentState}${currentProblem ? ` (${currentProblem})` : ""} — ${timeBlocks[stateStart]}`;
          bar.appendChild(tooltip);

          if (currentState === "Running") {
            bar.classList.add("bg-green-500");
          } else if (currentState === "Stopped") {
            bar.classList.add("bg-red-500");
          } else {
            bar.classList.add("bg-gray-300", "text-gray-400");
          }

          timeline.appendChild(bar);
        }

        stateStart = b;
        currentState = newState;
        currentProblem = newProblem;
      }
    }
  }
    row.append(label, timeline, uptimeLabel);
    container.appendChild(row);
  }


document.getElementById("exportBtn").onclick = () => {
  if (!lastTimelineData) return alert("Load a timeline first.");

  const csvRows = [];
  const currentShift = lastUsedShift || shiftFilter.value; // Use the shift that was used to load the data
  const timeBlocks = [];
  
  // Add supervisor information header if available
  if (supervisorData && supervisorData.supervisorName) {
    csvRows.push([`Supervisor: ${supervisorData.supervisorName}`]);
    csvRows.push([`Shift Type: ${supervisorData.shiftType || 'N/A'}`]);
    if (supervisorData.productionProficiency !== null && supervisorData.productionProficiency !== undefined) {
      csvRows.push([`Production Proficiency: ${supervisorData.productionProficiency}%`]);
    }
    csvRows.push([`Date: ${dateInput.value}`]);
    csvRows.push([]); // Empty row for spacing
  }
  
  // Generate same time blocks as used in rendering
  if (currentShift === "1") {
    // Shift 1: 6:00 AM to 6:00 PM
    for (let hour = 6; hour <= 18; hour++) {
      timeBlocks.push(`${String(hour).padStart(2, "0")}:00`);
      if (hour !== 18) timeBlocks.push(`${String(hour).padStart(2, "0")}:30`);
    }
  } else if (currentShift === "2") {
    // Shift 2: 6:00 PM to 6:00 AM (next day)
    for (let hour = 18; hour <= 23; hour++) {
      timeBlocks.push(`${String(hour).padStart(2, "0")}:00`);
      if (hour !== 23) timeBlocks.push(`${String(hour).padStart(2, "0")}:30`);
    }
    for (let hour = 0; hour <= 5; hour++) {
      timeBlocks.push(`${String(hour).padStart(2, "0")}:00`);
      if (hour !== 5) timeBlocks.push(`${String(hour).padStart(2, "0")}:30`);
    }
  } else {
    // All shifts: Show full 24 hours
    for (let hour = 0; hour <= 23; hour++) {
      timeBlocks.push(`${String(hour).padStart(2, "0")}:00`);
      if (hour !== 23) timeBlocks.push(`${String(hour).padStart(2, "0")}:30`);
    }
  }

  // Header row
  csvRows.push(["Machine", ...timeBlocks]);

  for (let i = 1; i <= 74; i++) {
    const logs = lastTimelineData[i] || [];
    const logMap = {};

    logs.forEach(log => {
      const time = log.time.slice(0, 5);
      logMap[time] = log;
    });

    const row = [`#${i}`];
    timeBlocks.forEach(time => {
      const log = logMap[time];
      if (log) {
        row.push(log.status === "Running" ? "Running" : `Stopped (${log.problem})`);
      } else {
        row.push("No Data");
      }
    });

    csvRows.push(row);
  }

  // Create CSV string
  const csvContent = csvRows.map(row => row.join(",")).join("\n");

  // Trigger download
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `machine-timeline-${dateInput.value}.csv`;
  link.click();
};
}

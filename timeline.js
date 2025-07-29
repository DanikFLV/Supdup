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
  if (selectedDate) {
    // Always reload when shift changes, regardless of existing data
    loadLogs(selectedDate, selectedShift);
  }
};

function loadLogs(date, shift) {
  container.innerHTML = "Loading...";
  
  console.log(`🔄 Loading logs for date: ${date}, shift: ${shift}`);
  console.log(`🔄 Shift filter dropdown value: ${shiftFilter.value}`);
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

      snapshot.forEach(doc => {
        const log = doc.data();
        console.log("Processing log:", log);
        
        const { machine, status, problem, timestamp, supervisorName, shiftType } = log;
        
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

        data[machineNum].push({ 
          time: logTime, 
          status, 
          problem: problem || "",
          supervisorName: supervisorName || "Unknown",
          shiftType: shiftType || "Unknown"
        });
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

function renderTimeline(machineLogs, shift) {
  container.innerHTML = ""; // Clear

  // Generate time blocks based on the passed shift parameter (not the current filter value)
  const currentShift = shift || shiftFilter.value;
  console.log(`🎨 renderTimeline called with shift: ${shift}, using: ${currentShift}`);
  console.log(`🎨 shiftFilter.value is: ${shiftFilter.value}`);
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

  // ✅ Add supervisor information summary
  const supervisorInfo = new Set();
  const shiftInfo = new Set();
  
  // Collect all unique supervisors and shifts from the data
  Object.values(machineLogs).forEach(machineData => {
    machineData.forEach(log => {
      if (log.supervisorName) supervisorInfo.add(log.supervisorName);
      if (log.shiftType) shiftInfo.add(log.shiftType);
    });
  });

  if (supervisorInfo.size > 0 || shiftInfo.size > 0) {
    const infoRow = document.createElement("div");
    infoRow.className = "bg-blue-50 border border-blue-200 rounded p-3 mb-3 text-sm";
    
    let infoText = '';
    if (supervisorInfo.size > 0) {
      infoText += `👤 Supervisors: ${Array.from(supervisorInfo).join(', ')}`;
    }
    if (shiftInfo.size > 0) {
      if (infoText) infoText += ' | ';
      infoText += `🔄 Shifts: ${Array.from(shiftInfo).join(', ')}`;
    }
    
    infoRow.textContent = infoText;
    container.appendChild(infoRow);
  }

  // ✅ Add timeline header (time labels)
  const headerRow = document.createElement("div");
  headerRow.className = "flex min-w-[1500px] items-center mb-1 sticky top-0 bg-white shadow-md z-20 border-b border-gray-200 py-2 px-2";

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
  row.className = "flex min-w-[1500px] items-center border-b border-gray-300 py-1 px-2";

  const label = document.createElement("div");
  label.className = "w-16 font-bold text-sm text-right pr-2";
  label.textContent = `#${i}`;

  // The timeline is now a grid, aligned with the header
  const timeline = document.createElement("div");
  const gridCols = timeBlocks.length;
  timeline.className = `grid gap-0.5 flex-1`;
  timeline.style.gridTemplateColumns = `repeat(${gridCols}, minmax(24px, 1fr))`;

  const logs = machineLogs[i] || [];
  logs.sort((a, b) => a.time.localeCompare(b.time));

  // Create a map of time blocks to their closest logs
  const blockToLog = {};
  logs.forEach(log => {
    const logTime = log.time;
    const [logHour, logMin] = logTime.split(':').map(Number);
    const logMinutes = logHour * 60 + logMin;
    
    let closestBlock = null;
    let closestDistance = Infinity;
    
    timeBlocks.forEach(block => {
      const [blockHour, blockMin] = block.split(':').map(Number);
      const blockMinutes = blockHour * 60 + blockMin;
      const distance = Math.abs(logMinutes - blockMinutes);
      
      if (distance < 30 && distance < closestDistance) { // Use < 30, not <=
        closestDistance = distance;
        closestBlock = block;
      }
    });
    
    if (closestBlock) {
      // If a log is closer to a block than a previous log, it overwrites it.
      // This ensures the block gets the status from the log closest in time.
      blockToLog[closestBlock] = log;
    }
  });

  // Uptime calculation needs to be smarter
  let runningBlocks = 0;
  let totalActiveBlocks = 0;
  let lastKnownStatusForUptime = "No Data";

  timeBlocks.forEach(block => {
      const log = blockToLog[block];
      if (log) {
          lastKnownStatusForUptime = log.status;
      }
      
      // Only count towards uptime if we have actual data for the period
      if (lastKnownStatusForUptime !== "No Data") {
          totalActiveBlocks++;
          if (lastKnownStatusForUptime === "Running") {
              runningBlocks++;
          }
      }
  });

  const uptime = totalActiveBlocks > 0 ? Math.round((runningBlocks / totalActiveBlocks) * 100) : 0;
  const uptimeLabel = document.createElement("div");
  uptimeLabel.className = "text-xs text-right pr-2 w-16";
  uptimeLabel.textContent = `${uptime}%`;
  if (uptime >= 90) uptimeLabel.classList.add("text-green-600", "font-bold");
  else if (uptime >= 75) uptimeLabel.classList.add("text-yellow-600", "font-semibold");
  else if (uptime > 0) uptimeLabel.classList.add("text-red-600", "font-semibold");
  else uptimeLabel.classList.add("text-gray-500");


  // New, simplified rendering logic
  let currentStatusForBlock = "No Data";
  let currentProblemForBlock = "";
  let currentSupervisorForBlock = "";
  let currentShiftTypeForBlock = "";

  timeBlocks.forEach(blockTime => {
    const logAtBlock = blockToLog[blockTime];
    // If there's a log for this block, update the status.
    // This status will now persist for subsequent blocks until a new log is found.
    if (logAtBlock) {
      currentStatusForBlock = logAtBlock.status;
      currentProblemForBlock = logAtBlock.problem || "";
      currentSupervisorForBlock = logAtBlock.supervisorName || "";
      currentShiftTypeForBlock = logAtBlock.shiftType || "";
    }

    const bar = document.createElement("div");
    // Add flex properties to center the text content
    bar.className = "h-6 rounded-sm relative group flex items-center justify-center text-white text-xs overflow-hidden";

    // Create a separate span for the text content, so it doesn't interfere with the tooltip
    const textSpan = document.createElement("span");

    if (currentStatusForBlock === "Running") {
      bar.classList.add("bg-green-500");
    } else if (currentStatusForBlock === "Stopped") {
      bar.classList.add("bg-red-500");
      textSpan.textContent = currentProblemForBlock || 'Stopped';
    } else {
      bar.classList.add("bg-gray-200"); // A neutral, visible "No Data" color
    }
    
    bar.appendChild(textSpan); // Add the text span to the bar

    const tooltip = document.createElement("div");
    tooltip.className = "absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-xs bg-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none z-10 w-max max-w-xs";
    
    let tooltipText = `${blockTime} - ${currentStatusForBlock}`;
    if (currentProblemForBlock) tooltipText += ` (${currentProblemForBlock})`;
    if (currentSupervisorForBlock) tooltipText += `\nSupervisor: ${currentSupervisorForBlock}`;
    if (currentShiftTypeForBlock) tooltipText += `\nShift: ${currentShiftTypeForBlock}`;
    
    tooltip.style.whiteSpace = 'pre-line'; // Allow line breaks
    tooltip.textContent = tooltipText;
    bar.appendChild(tooltip);

    timeline.appendChild(bar);
  });

  row.append(label, timeline, uptimeLabel);
  container.appendChild(row);
}


document.getElementById("exportBtn").onclick = () => {
  if (!lastTimelineData) return alert("Load a timeline first.");

  const csvRows = [];
  const currentShift = lastUsedShift || shiftFilter.value; // Use the shift that was used to load the data
  const timeBlocks = [];
  
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

document.getElementById("exportImageBtn").onclick = () => {
  const wrapper = document.getElementById("timelineWrapper");
  if (!wrapper) return alert("Timeline not loaded.");

  html2canvas(wrapper).then(canvas => {
    const link = document.createElement("a");
    link.download = `timeline-${dateInput.value}.png`;
    link.href = canvas.toDataURL();
    link.click();
  });
};

document.getElementById("exportPdfBtn").onclick = async () => {
  const wrapper = document.getElementById("timelineWrapper");
  if (!wrapper) return alert("Timeline not loaded.");

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });

  // Function to capture a specific range of machines
  const captureSection = async (startMachine, endMachine, pageTitle) => {
    // Temporarily hide machines outside the range
    const allRows = wrapper.querySelectorAll('[class*="flex min-w-"][class*="items-center border-b"]');
    const header = wrapper.querySelector('[class*="sticky top-0"]');
    
    // Hide all machine rows first
    allRows.forEach((row, index) => {
      if (index === 0) return; // Skip header row
      const machineNumber = index; // Row index corresponds to machine number
      if (machineNumber < startMachine || machineNumber > endMachine) {
        row.style.display = 'none';
      } else {
        row.style.display = 'flex';
      }
    });

    // Capture this section
    const canvas = await html2canvas(wrapper, { 
      scale: 1.2,
      useCORS: true,
      allowTaint: false
    });
    
    const imgData = canvas.toDataURL("image/png");
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    const ratio = Math.min(pdfWidth / imgWidth, (pdfHeight - 20) / imgHeight); // Leave space for title
    const scaledWidth = imgWidth * ratio;
    const scaledHeight = imgHeight * ratio;
    
    const x = (pdfWidth - scaledWidth) / 2;
    const y = 15; // Start below title
    
    // Add title
    pdf.setFontSize(16);
    pdf.text(pageTitle, pdfWidth / 2, 10, { align: 'center' });
    
    pdf.addImage(imgData, "PNG", x, y, scaledWidth, scaledHeight);
    
    // Restore all rows visibility
    allRows.forEach(row => {
      row.style.display = 'flex';
    });
  };

  try {
    // Page 1: Machines 1-40
    await captureSection(1, 40, `Timeline ${dateInput.value} - Machines 1-40`);
    
    // Add new page
    pdf.addPage();
    
    // Page 2: Machines 41-74
    await captureSection(41, 74, `Timeline ${dateInput.value} - Machines 41-74`);
    
    pdf.save(`timeline-${dateInput.value}.pdf`);
  } catch (error) {
    console.error('PDF export error:', error);
    alert('Error creating PDF. Please try again.');
  }
};
}


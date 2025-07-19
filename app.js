let db;

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('taskTrackerDB', 1);

    request.onupgradeneeded = (event) => {
      db = event.target.result;
      const taskStore = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
      taskStore.createIndex('by_dueDate', 'dateDue', { unique: false });
      taskStore.createIndex('by_priority', 'priority', { unique: false });
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve();
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
};


const TaskDB = {
  addTask(task) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tasks', 'readwrite');
      const store = tx.objectStore('tasks');
      const request = store.add(task);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  getAllTasks() {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tasks', 'readonly');
      const store = tx.objectStore('tasks');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  updateTask(task) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tasks', 'readwrite');
      const store = tx.objectStore('tasks');
      const request = store.put(task);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  deleteTask(id) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tasks', 'readwrite');
      const store = tx.objectStore('tasks');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },
};

// Render Tasks
const renderTasks = () => {
  TaskDB.getAllTasks().then(tasks => {
    const taskList = document.getElementById('task-list');
    taskList.innerHTML = '';

    tasks.forEach(task => {
  const li = document.createElement('li');
  li.classList.add('task-item');
  
  // Adjust transparency and text decoration if done
  if (task.done) {
    li.style.opacity = '0.5';
  }

  const header = document.createElement('div');
  header.classList.add('task-header');
  // Display spent time without seconds
  const spentMs = parseActualTime(task.actualTime);
  // Round up any seconds to the next whole minute for display
  const totalMinutes = Math.ceil(spentMs / 60000);
  const spentH = Math.floor(totalMinutes / 60);
  const spentM = totalMinutes % 60;
  const spentStr = `${spentH}h ${spentM}m`;
  header.textContent = `${task.done ? '❌ ' : ''}${task.title} [${task.priority}] - Due: ${task.dateDue}${task.estTime ? ' - Est: ' + task.estTime : ''} - Spent: ${spentStr}`;

  const drawer = document.createElement('div');
  drawer.classList.add('task-drawer');

  const infoDiv = document.createElement('div');
  infoDiv.textContent = task.info || "No additional info.";

  // Done button
const doneBtn = document.createElement('button');
doneBtn.textContent = task.done ? 'Mark as Not Done' : 'Mark as Done';

doneBtn.addEventListener('click', () => {
  task.done = !task.done;
  TaskDB.updateTask(task);

  // Update UI without re-rendering the entire task list
  li.style.opacity = task.done ? '0.5' : '1';
  const spentMs2 = parseActualTime(task.actualTime);
  // Round up seconds to the next minute for spent display
  const totalMinutes2 = Math.ceil(spentMs2 / 60000);
  const spentH2 = Math.floor(totalMinutes2 / 60);
  const spentM2 = totalMinutes2 % 60;
  const spentStr2 = `${spentH2}h ${spentM2}m`;
  header.textContent = `${task.done ? '❌ ' : ''}${task.title} [${task.priority}] - Due: ${task.dateDue}${task.estTime ? ' - Est: ' + task.estTime : ''} - Spent: ${spentStr2}`;
  // restore header timer toggle button after replacing textContent
  header.appendChild(headerTimerBtn);
  doneBtn.textContent = task.done ? 'Mark as Not Done' : 'Mark as Done';
});

  // Timer Display and buttons (existing logic)
  const timerDisplay = document.createElement('div');
  timerDisplay.classList.add('timer-display');
  timerDisplay.textContent = `Task Time: ${task.actualTime || '0h 0m 0s'}`;

  const startBtn = document.createElement('button');
  startBtn.textContent = 'Start Timer';
  const endBtn = document.createElement('button');
  endBtn.textContent = 'End Timer';
  // Header timer toggle button (start/stop)
  const headerTimerBtn = document.createElement('button');
  headerTimerBtn.classList.add('header-timer-btn', 'start');
  headerTimerBtn.textContent = '▶️';
  headerTimerBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (startBtn.disabled) {
      endBtn.click();
    } else {
      startBtn.click();
    }
  });

  // Helper: recalc & display rounded-up spent time in the header
  function updateHeaderSpent() {
    // Compute total spent: stored actualTime plus any running elapsed
    let ms = parseActualTime(task.actualTime);
    if (startTime) {
      ms += Date.now() - startTime;
    }
    const mins = Math.ceil(ms / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    header.textContent = `${task.done ? '❌ ' : ''}${task.title} [${task.priority}] - Due: ${task.dateDue}`
      + `${task.estTime ? ' - Est: ' + task.estTime : ''}`
      + ` - Spent: ${h}h ${m}m`;
    header.appendChild(headerTimerBtn);
  }

  let timerInterval;
  let startTime;

  startBtn.addEventListener('click', () => {
    startTime = Date.now();
    startBtn.disabled = true;
    endBtn.disabled = false;
    timerInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      timerDisplay.textContent = `Task Time: ${formatTime(elapsed + parseActualTime(task.actualTime))}`;
    }, 1000);
    // update header button to stop state
    headerTimerBtn.classList.replace('start', 'stop');
    headerTimerBtn.textContent = '⏹️';
  });

  endBtn.addEventListener('click', () => {
    if (startTime) {
      const elapsed = Date.now() - startTime;
      clearInterval(timerInterval);
      // stop live accumulation so header uses only stored time
      startTime = null;
      task.actualTime = formatTime(elapsed + parseActualTime(task.actualTime));
      timerDisplay.textContent = `Task Time: ${task.actualTime}`;
      TaskDB.updateTask(task);
      startBtn.disabled = false;
      endBtn.disabled = true;
      // update header button to start state
      headerTimerBtn.classList.replace('stop', 'start');
      headerTimerBtn.textContent = '▶️';
      // update spent total in header on stop
      updateHeaderSpent();
    }
  });

  endBtn.disabled = true;

  drawer.appendChild(infoDiv);
  drawer.appendChild(timerDisplay);
  drawer.appendChild(startBtn);
  drawer.appendChild(endBtn);
  // Edit timer button to adjust recorded time manually
  const editTimerBtn = document.createElement('button');
  editTimerBtn.textContent = 'Edit Timer';
  drawer.appendChild(editTimerBtn);
  drawer.appendChild(doneBtn);

  // attach header timer button before toggling drawer on click
  header.appendChild(headerTimerBtn);
  header.addEventListener('click', () => {
    drawer.classList.toggle('open');
  });

  // Edit-Mode: adjust actualTime text with save/cancel
  editTimerBtn.addEventListener('click', () => {
    timerDisplay.style.display = 'none';
    startBtn.style.display = 'none';
    endBtn.style.display = 'none';
    editTimerBtn.style.display = 'none';
    doneBtn.style.display = 'none';

    const editContainer = document.createElement('div');
    editContainer.classList.add('timer-edit-container');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = task.actualTime;
    editContainer.appendChild(input);
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    editContainer.appendChild(saveBtn);
    editContainer.appendChild(cancelBtn);
    drawer.appendChild(editContainer);

    // Save new timer value
    saveBtn.addEventListener('click', () => {
      const val = input.value.trim();
      if (!/^\d+h\s+\d+m\s+\d+s$/.test(val)) {
        alert('Invalid format. Use "Xh Ym Zs"');
        return;
      }
      task.actualTime = val;
      TaskDB.updateTask(task).then(() => {
        timerDisplay.textContent = `Task Time: ${task.actualTime}`;
        updateHeaderSpent();
        drawer.removeChild(editContainer);
        timerDisplay.style.display = '';
        startBtn.style.display = '';
        endBtn.style.display = '';
        editTimerBtn.style.display = '';
        doneBtn.style.display = '';
      });
    });

    // Cancel edit
    cancelBtn.addEventListener('click', () => {
      drawer.removeChild(editContainer);
      timerDisplay.style.display = '';
      startBtn.style.display = '';
      endBtn.style.display = '';
      editTimerBtn.style.display = '';
      doneBtn.style.display = '';
    });
  });

  li.appendChild(header);
  li.appendChild(drawer);
  taskList.appendChild(li);
});

  });
};

// Helper: Convert milliseconds to hh:mm:ss format
const formatTime = (milliseconds) => {
  let totalSeconds = Math.floor(milliseconds / 1000);
  let hours = Math.floor(totalSeconds / 3600);
  let minutes = Math.floor((totalSeconds % 3600) / 60);
  let seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
};

// Helper: Parse the actualTime string back into milliseconds
const parseActualTime = (timeStr) => {
  if (!timeStr) return 0;
  const matches = timeStr.match(/(\d+)h\s*(\d+)m\s*(\d+)s/);
  if (!matches) return 0; // if unexpected format, return 0
  const [_, hours, minutes, seconds] = matches.map(Number);
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
};

// Handle form submission
// Handle form submission
document.getElementById('task-form').addEventListener('submit', e => {
  e.preventDefault();

  // Parse estimated time (minutes) into hours/minutes string
  const rawEst = document.getElementById('task-est-time').value;
  let estTime = '';
  if (rawEst) {
    const totalMins = parseInt(rawEst, 10);
    const eh = Math.floor(totalMins / 60);
    const em = totalMins % 60;
    estTime = `${eh}h ${em}m`;
  }

  const newTask = {
    title: document.getElementById('task-title').value,
    priority: document.getElementById('task-priority').value,
    dateCreated: new Date().toISOString(),
    dateDue: document.getElementById('task-date-due').value,
    estTime,
    actualTime: "0h 0m 0s",
    info: document.getElementById('task-info').value,
    done: false,
  };
  TaskDB.addTask(newTask).then(() => {
    renderTasks(); // Refresh list
    document.getElementById('task-form').reset();
  });
});

// Initialize DB and render tasks
initDB().then(() => {
  renderTasks();
});



// Darkmode toggle functionality
const darkModeToggle = document.getElementById('dark-mode-toggle');
darkModeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
});
// Load dark mode preference from localStorage
if (localStorage.getItem('darkMode') === 'true') {
  document.body.classList.add('dark-mode');
}

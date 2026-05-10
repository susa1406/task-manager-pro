const SUPABASE_URL = "https://blydoffpyipdehzghmvo.supabase.co";
const SUPABASE_KEY = "sb_publishable_F96_tbCWplxJQL7T7gAG9A_QhXP96jN";

// ✅ SUPABASE CLIENT
let currentUser = null;
let channel = null;
const { createClient } = window.supabase;
const client = createClient(SUPABASE_URL, SUPABASE_KEY);

client.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    currentUser = null;
    window.location.href = "login.html";
  }
});

// DOM
const taskInput = document.getElementById("taskInput");
const taskList  = document.getElementById("taskList");

// ─────────────────────────────────────────────
// 📊 PROGRESS BAR
// ─────────────────────────────────────────────
function updateProgress(tasks) {
  const bar     = document.getElementById("progressBar");
  const label   = document.getElementById("progressPercent");
  if (!bar || !label || !tasks || tasks.length === 0) {
    if (bar)   bar.style.width = "0%";
    if (label) label.textContent = "0%";
    return;
  }
  const done = tasks.filter((t) => t.completed).length;
  const pct  = Math.round((done / tasks.length) * 100);
  bar.style.width      = pct + "%";
  label.textContent    = pct + "%";
}

// ─────────────────────────────────────────────
// 👤 LOAD USER PROFILE
// ─────────────────────────────────────────────
async function loadUserProfile() {
  const { data: { user } } = await client.auth.getUser();
  if (!user) { window.location.href = "login.html"; return; }

  document.getElementById("userName").innerText =
    user.user_metadata.full_name || user.email;

  const avatar = document.getElementById("userAvatar");
  if (avatar) {
    avatar.src = user.user_metadata.avatar_url || "https://via.placeholder.com/40";
  }
}

// ─────────────────────────────────────────────
// 🧠 GET CURRENT USER
// ─────────────────────────────────────────────
async function getUser() {
  if (currentUser) return currentUser;
  const { data, error } = await client.auth.getUser();
  if (error) { console.error("Auth Error:", error); return null; }
  currentUser = data.user;
  return currentUser;
}

// ─────────────────────────────────────────────
// 🔐 PROTECT PAGE
// ─────────────────────────────────────────────
async function protectPage() {
  const user = await getUser();
  if (!user) window.location.href = "login.html";
}

// ─────────────────────────────────────────────
// 📥 LOAD TASKS
// ─────────────────────────────────────────────
async function loadTasks() {
  const user = await getUser();
  if (!user) return;

  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("id", { ascending: false });

  if (error) { console.error("Load Error:", error); return; }

  renderTasks(data || []);
  checkReminders(data || []);
  updateProgress(data || []);
}

// ─────────────────────────────────────────────
// 🎯 FILTER TASKS
// ─────────────────────────────────────────────
async function filterTasks(status) {
  const user = await getUser();
  if (!user) return;

  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .eq("completed", status)
    .order("id", { ascending: false });

  if (error) { console.error("Filter Error:", error); return; }

  renderTasks(data || []);
  updateProgress(data || []);
}

// ─────────────────────────────────────────────
// 🧱 RENDER TASKS  (JARVIS styled)
// ─────────────────────────────────────────────
function renderTasks(tasks) {
  taskList.innerHTML = "";

  if (!tasks || tasks.length === 0) {
    // CSS :empty handles the "no tasks" message via ::after
    return;
  }

  tasks.forEach((task, index) => {
    const li = document.createElement("li");

    // Stagger slide-in animation
    li.style.animationDelay = `${index * 0.05}s`;

    const dirId  = String(index + 1).padStart(3, "0");
    const isDone = task.completed;

    li.innerHTML = `
      <div class="task-content">
        <div class="task-id">DIR-${dirId} &middot; ${isDone ? "COMPLETE" : "PENDING"}</div>
        <span class="${isDone ? "completed" : ""}">${task.title}</span>
        ${
          task.due_date
            ? `<small class="due-date">⏱ TARGET: ${new Date(task.due_date).toLocaleString()}</small>`
            : ""
        }
      </div>
      <div>
        <button onclick="toggleTask(${task.id}, ${isDone})">
          ${isDone ? "REOPEN" : "CONFIRM"}
        </button>
        <button onclick="deleteTask(${task.id})" style="border-color:rgba(255,61,61,0.3);color:var(--red)">
          ABORT
        </button>
      </div>
    `;

    taskList.appendChild(li);
  });
}

// ─────────────────────────────────────────────
// ⏰ REMINDERS
// ─────────────────────────────────────────────
function checkReminders(tasks) {
  const now = new Date();
  tasks.forEach((task) => {
    if (!task.due_date || task.completed) return;
    const diff = new Date(task.due_date) - now;
    if (diff > 0 && diff < 300000) showNotification(task.title);
  });
}

function showNotification(taskTitle) {
  if (Notification.permission === "granted") {
    new Notification("⚡ DIRECTIVE ALERT — J.A.R.V.I.S.", { body: taskTitle });
  }
}

// ─────────────────────────────────────────────
// ➕ ADD TASK
// ─────────────────────────────────────────────
async function addTask() {
  const title   = taskInput.value.trim();
  const dueDate = document.getElementById("dueDate")?.value;

  if (!title) return;

  const user = await getUser();
  if (!user) { console.warn("User not logged in"); return; }

  const { error } = await client.from("tasks").insert([{
    title,
    completed: false,
    user_id:   user.id,
    due_date:  dueDate || null,
  }]);

  if (error) { console.error("Insert Error:", error); return; }

  taskInput.value = "";
  if (document.getElementById("dueDate")) {
    document.getElementById("dueDate").value = "";
  }

  loadTasks();
}

// ─────────────────────────────────────────────
// 🔄 TOGGLE TASK
// ─────────────────────────────────────────────
async function toggleTask(id, currentStatus) {
  const { error } = await client
    .from("tasks")
    .update({ completed: !currentStatus })
    .eq("id", id);

  if (error) console.error("Update Error:", error);
  loadTasks();
}

// ─────────────────────────────────────────────
// ❌ DELETE TASK
// ─────────────────────────────────────────────
async function deleteTask(id) {
  const { error } = await client.from("tasks").delete().eq("id", id);
  if (error) console.error("Delete Error:", error);
  loadTasks();
}

// ─────────────────────────────────────────────
// 🔓 LOGOUT
// ─────────────────────────────────────────────
async function logout() {
  currentUser = null;
  await client.auth.signOut();
  window.location.href = "login.html";
}

// ─────────────────────────────────────────────
// ⚡ INIT
// ─────────────────────────────────────────────
(async () => {
  await protectPage();
  await loadUserProfile();
  await loadTasks();

  if (Notification.permission !== "granted") {
    Notification.requestPermission();
  }

  const user = await getUser();
  if (!user) return;

  // 🔥 REALTIME
  if (channel) client.removeChannel(channel);

  channel = client
    .channel("tasks-realtime")
    .on(
      "postgres_changes",
      {
        event:  "*",
        schema: "public",
        table:  "tasks",
        filter: `user_id=eq.${user.id}`,
      },
      (payload) => {
        console.log("⚡ Realtime directive update:", payload);
        loadTasks();
      }
    )
    .subscribe();
})();

// 🌍 GLOBAL FUNCTIONS
window.addTask    = addTask;
window.deleteTask = deleteTask;
window.toggleTask = toggleTask;
window.filterTasks = filterTasks;
window.loadTasks  = loadTasks;
window.logout     = logout;

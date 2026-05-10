const SUPABASE_URL = "https://blydoffpyipdehzghmvo.supabase.co";
const SUPABASE_KEY = "sb_publishable_F96_tbCWplxJQL7T7gAG9A_QhXP96jN";

// ✅ SUPABASE CLIENT
// 🔥 SUPABASE CONFIG
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
const taskList = document.getElementById("taskList");

// 👤 LOAD USER PROFILE
async function loadUserProfile() {
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  document.getElementById("userName").innerText =
    user.user_metadata.full_name || user.email;

  document.getElementById("userAvatar").src =
    user.user_metadata.avatar_url || "https://via.placeholder.com/40";
}

// 🧠 GET CURRENT USER
async function getUser() {
  if (currentUser) return currentUser;

  const { data, error } = await client.auth.getUser();

  if (error) {
    console.error("Auth Error:", error);
    return null;
  }

  currentUser = data.user;
  return currentUser;
}

// 🔐 PROTECT PAGE (IMPORTANT FIX)
async function protectPage() {
  const user = await getUser();

  if (!user) {
    window.location.href = "login.html";
  }
}

// 📥 LOAD TASKS (USER BASED)
async function loadTasks() {
  const user = await getUser();
  if (!user) return;

  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("id", { ascending: false });

  if (error) {
    console.error("Load Error:", error);
    return;
  }

  renderTasks(data || []);
  checkReminders(data || []);
}

// 🎯 FILTER TASKS
async function filterTasks(status) {
  const user = await getUser();
  if (!user) return;

  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .eq("completed", status)
    .order("id", { ascending: false });

  if (error) {
    console.error("Filter Error:", error);
    return;
  }

  renderTasks(data || []);
}

// 🧱 RENDER
function renderTasks(tasks) {
  taskList.innerHTML = "";

  if (!tasks || tasks.length === 0) {
    taskList.innerHTML = "<p>No tasks found</p>";
    return;
  }

  tasks.forEach((task) => {
    const li = document.createElement("li");

    li.innerHTML = `
      <div class="task-content">

  <span style="text-decoration:${task.completed ? "line-through" : "none"}">
    ${task.title}
  </span>

  ${
    task.due_date
      ? `<small class="due-date">
          ⏰ ${new Date(task.due_date).toLocaleString()}
        </small>`
      : ""
  }

     </div>

      <div>
        <button onclick="toggleTask(${task.id}, ${task.completed})">
          ${task.completed ? "Undo" : "Done"}
        </button>

        <button onclick="deleteTask(${task.id})" style="background:red">
          Delete
        </button>
      </div>
    `;

    taskList.appendChild(li);
  });
}

function checkReminders(tasks) {
  const now = new Date();

  tasks.forEach((task) => {
    if (!task.due_date || task.completed) return;

    const due = new Date(task.due_date);

    const diff = due - now;

    // reminder within 5 mins
    if (diff > 0 && diff < 300000) {
      showNotification(task.title);
    }
  });
}

function showNotification(taskTitle) {
  if (Notification.permission === "granted") {
    new Notification("⏰ Task Reminder", {
      body: taskTitle,
    });
  }
}

async function addTask() {
  const title = taskInput.value.trim();
  const dueDate = document.getElementById("dueDate").value;

  if (!title) return;

  const user = await getUser();

  if (!user) {
    console.warn("User not logged in");
    return;
  }

  const { error } = await client.from("tasks").insert([
    {
      title,
      completed: false,
      user_id: user.id,
      due_date: dueDate || null,
    },
  ]);

  if (error) {
    console.error("Insert Error:", error);
    return;
  }

  taskInput.value = "";
  document.getElementById("dueDate").value = "";

  loadTasks();
}

// 🔄 TOGGLE TASK
async function toggleTask(id, currentStatus) {
  const { error } = await client
    .from("tasks")
    .update({ completed: !currentStatus })
    .eq("id", id);

  if (error) console.error("Update Error:", error);

  loadTasks(); // 🔥 instant UI update
}

// ❌ DELETE TASK
async function deleteTask(id) {
  const { error } = await client.from("tasks").delete().eq("id", id);

  if (error) console.error("Delete Error:", error);
  loadTasks();
}

async function logout() {
  currentUser = null;
  await client.auth.signOut();
  window.location.href = "login.html";
}

// ⚡ REALTIME (AUTO REFRESH)

(async () => {
  await protectPage();
  await loadUserProfile();
  await loadTasks();
  if (Notification.permission !== "granted") {
    Notification.requestPermission();
  }

  // 🔥 ADD HERE (RIGHT AFTER loadTasks)
  const user = await getUser();

  if (channel) {
    client.removeChannel(channel);
  }

  channel = client
    .channel("tasks-realtime")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "tasks",
        filter: `user_id=eq.${user.id}`,
      },
      (payload) => {
        console.log("Realtime change:", payload);
        loadTasks();
      },
    )
    .subscribe();
})();

// 🌍 GLOBAL FUNCTIONS
window.addTask = addTask;
window.deleteTask = deleteTask;
window.toggleTask = toggleTask;
window.filterTasks = filterTasks;
window.loadTasks = loadTasks;
window.logout = logout;

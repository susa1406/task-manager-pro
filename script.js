// 🔥 SUPABASE CONFIG (FINAL)
const SUPABASE_URL = "https://blydoffpyipdehzghmvo.supabase.co";
const SUPABASE_KEY = "sb_publishable_F96_tbCWplxJQL7T7gAG9A_QhXP96jN";

// ✅ SUPABASE CLIENT
// 🔥 SUPABASE CONFIG
const { createClient } = window.supabase;
const client = createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM
const taskInput = document.getElementById("taskInput");
const taskList = document.getElementById("taskList");

// 🧠 GET CURRENT USER
async function getUser() {
  const { data, error } = await client.auth.getUser();

  if (error) {
    console.error("Auth Error:", error);
    return null;
  }

  return data.user;
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

  tasks.forEach(task => {
    const li = document.createElement("li");

    li.innerHTML = `
      <span style="text-decoration:${task.completed ? "line-through" : "none"}">
        ${task.title}
      </span>

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

// ➕ ADD TASK (FIXED - no alert now)
async function addTask() {
  const title = taskInput.value.trim();
  if (!title) return;

  const user = await getUser();

  if (!user) {
    console.warn("User not logged in");
    return; // ❌ removed annoying alert
  }

  const { error } = await client.from("tasks").insert([
    {
      title,
      completed: false,
      user_id: user.id
    }
  ]);

  if (error) {
    console.error("Insert Error:", error);
    return;
  }

  taskInput.value = "";
}

// 🔄 TOGGLE TASK
async function toggleTask(id, currentStatus) {
  const { error } = await client
    .from("tasks")
    .update({ completed: !currentStatus })
    .eq("id", id);

  if (error) console.error("Update Error:", error);
}

// ❌ DELETE TASK
async function deleteTask(id) {
  const { error } = await client
    .from("tasks")
    .delete()
    .eq("id", id);

  if (error) console.error("Delete Error:", error);
}

// 🚪 LOGOUT
async function logout() {
  await client.auth.signOut();
  window.location.href = "login.html";
}

// ⚡ REALTIME (AUTO REFRESH)
client
  .channel("tasks-realtime")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "tasks" },
    () => loadTasks()
  )
  .subscribe();

// 🚀 INIT (IMPORTANT ORDER)
(async () => {
  await protectPage(); // 🔐 check login first
  await loadTasks();   // then load data
})();

// 🌍 GLOBAL FUNCTIONS
window.addTask = addTask;
window.deleteTask = deleteTask;
window.toggleTask = toggleTask;
window.filterTasks = filterTasks;
window.loadTasks = loadTasks;
window.logout = logout;
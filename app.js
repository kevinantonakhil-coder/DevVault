const STORAGE_KEY = "devvault-state-v1";
const APP_VERSION = "1.0.0";

const DEFAULT_STATE = {
  theme: "dark",
  accent: "violet",
  githubUsername: "",
  dateFormat: "YYYY-MM-DD",
  timeFormat: "24h",
  projects: [],
  tasks: [],
  activity: [],
  goals: {
    dailyMinutes: 90,
    weeklyTasks: 8,
  },
  timer: {
    minutes: 25,
    remainingSeconds: 25 * 60,
    isRunning: false,
  },
  currentPage: "dashboard",
  searchQuery: "",
};

const STATUS_OPTIONS = ["Planning", "In Progress", "Paused", "Completed"];
const PROJECT_CATEGORIES = [
  "Web Development",
  "Python",
  "Arduino",
  "ESP32",
  "AI",
  "Other",
];

const toolDefinitions = [
  {
    title: "JSON Formatter",
    type: "json",
    description: "Pretty print or validate JSON payloads locally in the browser.",
    inputLabel: "JSON input",
    actionLabel: "Format JSON",
  },
  {
    title: "Base64 Encoder",
    type: "base64-encode",
    description: "Convert plain text into a Base64 payload.",
    inputLabel: "Text input",
    actionLabel: "Encode",
  },
  {
    title: "Base64 Decoder",
    type: "base64-decode",
    description: "Decode Base64 back into readable text.",
    inputLabel: "Base64 input",
    actionLabel: "Decode",
  },
  {
    title: "URL Encoder",
    type: "url-encode",
    description: "Encode URLs safely for web requests.",
    inputLabel: "Text input",
    actionLabel: "Encode",
  },
  {
    title: "URL Decoder",
    type: "url-decode",
    description: "Decode URL-encoded content back to plain text.",
    inputLabel: "Encoded text",
    actionLabel: "Decode",
  },
  {
    title: "UUID Generator",
    type: "uuid",
    description: "Generate a cryptographically secure UUID v4 value.",
    inputLabel: "Generated UUID",
    actionLabel: "Generate",
    noInput: true,
  },
  {
    title: "Text Analysis",
    type: "stats",
    description: "Count characters, words, and lines in a block of text.",
    inputLabel: "Text input",
    actionLabel: "Analyze",
  },
  {
    title: "Unix Timestamp Converter",
    type: "timestamp",
    description: "Convert between UNIX timestamps and readable dates.",
    inputLabel: "Timestamp or date",
    actionLabel: "Convert",
  },
  {
    title: "Color Picker",
    type: "color",
    description: "Convert between HEX, RGB, and HSL values using a live color input.",
    inputLabel: "Color value",
    actionLabel: "Apply",
  },
];

let state = null;
let chartRefs = {};
let timerInterval = null;
let currentProjectId = null;
let currentPage = "dashboard";

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  state = loadState();
  bindStaticEvents();
  applyTheme(state.theme);
  updateThemeControl();
  populateProjectOptions();
  renderAll();
  setPage(state.currentPage || "dashboard");
  if (window.lucide) {
    lucide.createIcons();
  }
}

function bindStaticEvents() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.title = button.querySelector(".nav-label").textContent.trim();
    button.addEventListener("click", () => {
      const page = button.dataset.page;
      setPage(page);
      if (page === "project-detail" && currentProjectId) {
        setPage("project-detail");
      }
    });
  });

  const sidebar = document.getElementById("sidebar");
  const sidebarToggle = document.getElementById("sidebarToggle");
  const appShell = document.querySelector(".app-shell");
  const isCompactNavigation = () => window.matchMedia("(max-width: 980px)").matches;

  const syncSidebarState = () => {
    if (isCompactNavigation()) {
      sidebar.classList.remove("open");
      appShell.classList.remove("sidebar-collapsed");
      sidebarToggle.setAttribute("aria-expanded", "false");
    } else {
      sidebar.classList.remove("open");
      sidebarToggle.setAttribute("aria-expanded", String(!appShell.classList.contains("sidebar-collapsed")));
    }
  };

  sidebarToggle.setAttribute("aria-expanded", String(!isCompactNavigation()));
  sidebarToggle.addEventListener("click", () => {
    if (isCompactNavigation()) {
      sidebarToggle.setAttribute("aria-expanded", String(sidebar.classList.toggle("open")));
      return;
    }

    const isCollapsed = appShell.classList.toggle("sidebar-collapsed");
    sidebarToggle.setAttribute("aria-expanded", String(!isCollapsed));
  });
  window.addEventListener("resize", syncSidebarState);

  document.getElementById("themeToggle").addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme(state.theme);
    saveState();
    if (state.currentPage === "dashboard") renderDashboardCharts();
  });

  document.getElementById("globalSearch").addEventListener("input", (event) => {
    state.searchQuery = event.target.value.trim();
    saveState();
    if (state.currentPage === "projects") {
      renderProjects();
    }
    if (state.currentPage === "tasks") {
      renderTasks();
    }
    if (state.currentPage === "dashboard") {
      renderDashboard();
    }
  });

  document.getElementById("projectSearch").addEventListener("input", renderProjects);
  document.getElementById("projectStatusFilter").addEventListener("change", renderProjects);
  document.getElementById("projectCategoryFilter").addEventListener("change", renderProjects);
  document.getElementById("projectPriorityFilter").addEventListener("change", renderProjects);
  document.getElementById("projectSort").addEventListener("change", renderProjects);
  document.getElementById("taskSearch").addEventListener("input", renderTasks);
  document.getElementById("taskStatusFilter").addEventListener("change", renderTasks);
  document.getElementById("taskPriorityFilter").addEventListener("change", renderTasks);
  document.getElementById("taskSort").addEventListener("change", renderTasks);

  document.getElementById("addProjectButton").addEventListener("click", () => openProjectModal());
  document.getElementById("addTaskButton").addEventListener("click", () => openTaskModal());
  document.getElementById("projectForm").addEventListener("submit", handleProjectSubmit);
  document.getElementById("taskForm").addEventListener("submit", handleTaskSubmit);
  document.getElementById("activityForm").addEventListener("submit", handleActivitySubmit);

  document.getElementById("saveGoalsButton").addEventListener("click", saveGoals);
  document.getElementById("startTimerButton").addEventListener("click", startTimer);
  document.getElementById("pauseTimerButton").addEventListener("click", pauseTimer);
  document.getElementById("resetTimerButton").addEventListener("click", resetTimer);
  document.getElementById("timerMinutes").addEventListener("change", handleTimerMinutesChange);

  document.getElementById("themeSetting").addEventListener("change", (event) => {
    state.theme = event.target.checked ? "dark" : "light";
    applyTheme(state.theme);
    saveState();
    if (state.currentPage === "dashboard") renderDashboardCharts();
  });

  document.getElementById("accentSelect").addEventListener("change", (event) => {
    state.accent = event.target.value;
    applyAccent(state.accent);
    saveState();
    if (state.currentPage === "dashboard") renderDashboardCharts();
  });

  document.getElementById("dateDisplaySelect").addEventListener("change", (event) => {
    state.dateFormat = event.target.value;
    saveState();
    renderAll();
  });

  document.getElementById("timeDisplaySelect").addEventListener("change", (event) => {
    state.timeFormat = event.target.value;
    saveState();
    renderAll();
  });

  document.getElementById("githubPrefInput").addEventListener("change", (event) => {
    state.githubUsername = event.target.value.trim();
    saveState();
    renderGitHubExplorer();
  });

  document.getElementById("githubSearchButton").addEventListener("click", searchGitHubUser);
  document.getElementById("githubUsername").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      searchGitHubUser();
    }
  });

  document.getElementById("exportDataButton").addEventListener("click", exportDataFile);
  document.getElementById("backupDataButton").addEventListener("click", downloadBackup);
  document.getElementById("importDataInput").addEventListener("change", handleImportData);
  document.getElementById("clearDataButton").addEventListener("click", clearAllData);

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.closeModal));
  });

  document.querySelectorAll("[data-open-form]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.openForm;
      if (type === "project") {
        openProjectModal();
      }
      if (type === "task") {
        openTaskModal();
      }
    });
  });

  document.querySelectorAll("[data-page-target]").forEach((button) => {
    button.addEventListener("click", () => setPage(button.dataset.pageTarget));
  });

  document.addEventListener("click", handleDocumentClicks);
}

function handleDocumentClicks(event) {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  const { action, projectId, taskId, repoName, repoUrl } = actionButton.dataset;

  if (action === "open-project") {
    currentProjectId = projectId;
    setPage("project-detail");
  }

  if (action === "edit-project") {
    openProjectModal(projectId);
  }

  if (action === "delete-project") {
    deleteProject(projectId);
  }

  if (action === "archive-project") {
    archiveProject(projectId);
  }

  if (action === "toggle-project-favorite") {
    toggleProjectFavorite(projectId);
  }

  if (action === "edit-task") {
    openTaskModal(taskId);
  }

  if (action === "delete-task") {
    deleteTask(taskId);
  }

  if (action === "toggle-task") {
    toggleTask(taskId);
  }

  if (action === "view-task-project") {
    currentProjectId = projectId;
    setPage("project-detail");
  }

  if (action === "save-repo-to-project") {
    saveRepoToProject(projectId, repoUrl, repoName);
  }

  if (action === "clear-repo-url") {
    const project = findProject(projectId);
    if (project) {
      project.githubUrl = "";
      project.updatedAt = new Date().toISOString();
      saveState();
      renderAll();
    }
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_STATE),
      ...parsed,
      goals: { ...DEFAULT_STATE.goals, ...(parsed.goals || {}) },
      timer: { ...DEFAULT_STATE.timer, ...(parsed.timer || {}) },
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      activity: Array.isArray(parsed.activity) ? parsed.activity : [],
    };
  } catch (error) {
    console.warn("Failed to load stored data, using defaults.", error);
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.getElementById("themeSetting").checked = theme === "dark";
  document.getElementById("themeToggle").innerHTML = `<span data-lucide="${theme === "dark" ? "sun" : "moon"}"></span>`;
  if (window.lucide) {
    lucide.createIcons();
  }
}

function applyAccent(accent) {
  const accentMap = {
    violet: "#8b5cf6",
    cyan: "#22d3ee",
    emerald: "#34d399",
    amber: "#f59e0b",
  };
  const color = accentMap[accent] || accentMap.violet;
  document.documentElement.style.setProperty("--accent", color);
  document.documentElement.style.setProperty("--accent-soft", hexToRgba(color, 0.18));
}

function updateThemeControl() {
  document.getElementById("themeSetting").checked = state.theme === "dark";
  document.getElementById("accentSelect").value = state.accent;
  document.getElementById("dateDisplaySelect").value = state.dateFormat;
  document.getElementById("timeDisplaySelect").value = state.timeFormat;
  document.getElementById("githubPrefInput").value = state.githubUsername;
  document.getElementById("dailyGoalInput").value = state.goals.dailyMinutes;
  document.getElementById("weeklyGoalInput").value = state.goals.weeklyTasks;
  document.getElementById("timerMinutes").value = state.timer.minutes || 25;
  document.getElementById("appVersion").textContent = APP_VERSION;
  document.getElementById("githubUsername").value = state.githubUsername || "";
  document.getElementById("sessionDate").value = toISODate(new Date());
}

function setPage(pageName) {
  currentPage = pageName;
  state.currentPage = pageName;
  saveState();
  document.querySelectorAll(".page").forEach((section) => {
    section.classList.toggle("active", section.dataset.page === pageName);
  });
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === pageName);
  });

  document.getElementById("pageTitle").textContent = pageLabels[pageName] || "Dashboard";
  document.querySelector(".sidebar").classList.remove("open");
  if (window.matchMedia("(max-width: 980px)").matches) {
    document.getElementById("sidebarToggle").setAttribute("aria-expanded", "false");
  }

  if (pageName === "project-detail" && currentProjectId) {
    renderProjectDetailPage();
  }

  if (pageName === "dashboard") renderDashboard();
  if (pageName === "projects") renderProjects();
  if (pageName === "tasks") renderTasks();
  if (pageName === "kanban") renderKanban();
  if (pageName === "github") renderGitHubExplorer();
  if (pageName === "tools") renderTools();
  if (pageName === "goals") renderGoals();
  if (pageName === "activity") renderActivityHistory();
  if (pageName === "settings") renderSettings();
}

const pageLabels = {
  dashboard: "Dashboard",
  projects: "Projects",
  "project-detail": "Project Details",
  tasks: "Tasks",
  kanban: "Kanban Board",
  github: "GitHub Explorer",
  tools: "Developer Toolkit",
  goals: "Goals & Productivity",
  activity: "Activity History",
  settings: "Settings",
};

function renderAll() {
  applyAccent(state.accent);
  updateThemeControl();
  renderDashboard();
  renderProjects();
  renderTasks();
  renderKanban();
  renderGitHubExplorer();
  renderTools();
  renderGoals();
  renderActivityHistory();
  renderSettings();
  renderProjectDetailPage();
  populateProjectOptions();
  if (window.lucide) {
    lucide.createIcons();
  }
}

function renderDashboard() {
  const stats = getDashboardStats();
  const statsGrid = document.getElementById("statsGrid");
  statsGrid.innerHTML = [
    { label: "Total projects", value: stats.totalProjects, icon: "folder" },
    { label: "Completed projects", value: stats.completedProjects, icon: "check-circle" },
    { label: "Open tasks", value: stats.openTasks, icon: "clipboard-check" },
    { label: "Tasks completed this week", value: stats.tasksCompletedThisWeek, icon: "calendar-check-2" },
    { label: "Current streak", value: `${stats.currentStreak} days`, icon: "flame" },
    { label: "Pinned projects", value: stats.favoriteProjects, icon: "star" },
  ]
    .map(
      (card) => `
        <div class="stat-card">
          <div class="stat-top">
            <span class="stat-label">${escapeHtml(card.label)}</span>
            <span class="stat-icon"><span data-lucide="${card.icon}"></span></span>
          </div>
          <div class="stat-value">${card.value}</div>
          <div class="stat-subtext">${escapeHtml(getStatSubtext(card.label))}</div>
        </div>
      `
    )
    .join("");

  const recentProjects = getFilteredProjects({ favorite: true, limit: 4 });
  const recentProjectsList = document.getElementById("recentProjectsList");
  recentProjectsList.innerHTML = recentProjects.length
    ? recentProjects
        .map(
          (project) => `
            <div class="list-row">
              <div>
                <strong>${escapeHtml(project.name)}</strong>
                <small>${escapeHtml(project.category)} · ${escapeHtml(project.status)}</small>
              </div>
              <button class="small-button" type="button" data-action="open-project" data-project-id="${project.id}">Open</button>
            </div>
          `
        )
        .join("")
    : `<div class="empty-state">
        <p>${state.projects.length ? "Pin a project to keep it handy here." : "Create your first project to start organizing your work."}</p>
        <div class="button-row">
          ${state.projects.length
            ? '<button class="secondary-button" type="button" data-page-target="projects">Browse projects</button>'
            : '<button class="primary-button" type="button" data-open-form="project">Create project</button>'}
        </div>
      </div>`;

  const upcoming = getUpcomingProjects();
  document.getElementById("upcomingDeadlines").innerHTML = upcoming.length
    ? upcoming
        .map(
          (project) => `
            <div class="list-row">
              <div>
                <strong>${escapeHtml(project.name)}</strong>
                <small>${escapeHtml(formatDate(project.deadline))}</small>
              </div>
              <span class="badge ${priorityClass(project.priority)}">${escapeHtml(project.priority)}</span>
            </div>
          `
        )
        .join("")
    : `<div class="empty-state">
        <p>No upcoming deadlines yet. Add a deadline to any project to see it here.</p>
        <div class="button-row"><button class="secondary-button" type="button" data-open-form="project">Add a project deadline</button></div>
      </div>`;

  const activityFeed = document.getElementById("activityFeed");
  const feedItems = state.activity.slice().reverse().slice(0, 5);
  activityFeed.innerHTML = feedItems.length
    ? feedItems
        .map(
          (item) => `
            <div class="list-row">
              <div>
                <strong>${escapeHtml(item.title || item.type)}</strong>
                <small>${escapeHtml(item.note || "Activity recorded")}</small>
              </div>
              <small>${escapeHtml(formatShortDate(item.date))}</small>
            </div>
          `
        )
        .join("")
    : `<div class="empty-state">
        <p>No activity logged yet. Record a coding session to build your activity history.</p>
        <div class="button-row"><button class="secondary-button" type="button" data-page-target="goals">Log a coding session</button></div>
      </div>`;

  renderDashboardCharts();
  if (window.lucide) lucide.createIcons();
}

function renderDashboardCharts() {
  const labels = getLastNDays(7);
  const completionCounts = labels.map((day) =>
    state.tasks.filter(
      (task) => task.completed && toISODate(new Date(task.completedAt)) === day
    ).length
  );

  const statusCounts = STATUS_OPTIONS.map((status) =>
    state.projects.filter((project) => project.status === status).length
  );

  const weeklyCanvas = document.getElementById("weeklyChart");
  const statusCanvas = document.getElementById("statusChart");
  const weeklyHasData = completionCounts.some((count) => count > 0);
  const statusHasData = statusCounts.some((count) => count > 0);
  const chartTextColor = getComputedStyle(document.documentElement).getPropertyValue("--muted").trim();
  const chartGridColor = getComputedStyle(document.documentElement).getPropertyValue("--border").trim();

  if (chartRefs.weekly) chartRefs.weekly.destroy();
  if (chartRefs.status) chartRefs.status.destroy();
  chartRefs.weekly = null;
  chartRefs.status = null;
  weeklyCanvas.hidden = !weeklyHasData;
  statusCanvas.hidden = !statusHasData;
  document.querySelector('[data-chart-empty="weekly"]').hidden = weeklyHasData;
  document.querySelector('[data-chart-empty="status"]').hidden = statusHasData;

  if (weeklyHasData) chartRefs.weekly = new Chart(weeklyCanvas, {
    type: "line",
    data: {
      labels: labels.map((day) => formatSimpleDay(day)),
      datasets: [
        {
          label: "Completed tasks",
          data: completionCounts,
          borderColor: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
          backgroundColor: hexToRgba(getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(), 0.16),
          tension: 0.2,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { titleColor: chartTextColor, bodyColor: chartTextColor },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: chartTextColor } },
        y: {
          beginAtZero: true,
          ticks: { precision: 0, color: chartTextColor },
          grid: { color: chartGridColor },
        },
      },
    },
  });

  if (statusHasData) chartRefs.status = new Chart(statusCanvas, {
    type: "doughnut",
    data: {
      labels: STATUS_OPTIONS,
      datasets: [
        {
          data: statusCounts,
          backgroundColor: [
            "#94a3b8",
            "#22d3ee",
            "#fbbf24",
            "#34d399",
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: chartTextColor, padding: 16, usePointStyle: true },
        },
      },
    },
  });
}

function renderProjects() {
  const container = document.getElementById("projectsList");
  const filtered = getFilteredProjects();

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state">No projects match your filters. Create a new project or change the search.</div>`;
    return;
  }

  container.innerHTML = filtered
    .map(
      (project) => `
        <article class="project-card">
          <div class="project-card-header">
            <div>
              <div class="project-card-title">${escapeHtml(project.name)}</div>
              <small class="muted">${escapeHtml(project.category)}</small>
            </div>
            <button class="icon-button" type="button" data-action="toggle-project-favorite" data-project-id="${project.id}" aria-label="Toggle favorite">
              <span data-lucide="${project.favorite ? "star" : "star"}"></span>
            </button>
          </div>
          <div class="project-card-row">
            <span class="badge ${statusClass(project.status)}">${escapeHtml(project.status)}</span>
            <span class="badge ${priorityClass(project.priority)}">${escapeHtml(project.priority)}</span>
          </div>
          <p class="muted">${escapeHtml(project.description || "No project description available.")}</p>
          <div class="meta-row">
            <span class="muted">Start: ${escapeHtml(formatDate(project.startDate))}</span>
            <span class="muted">Due: ${escapeHtml(formatDate(project.deadline))}</span>
          </div>
          <div>
            <div class="project-card-row">
              <span class="muted">Progress</span>
              <strong>${projectProgress(project)}%</strong>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width: ${projectProgress(project)}%"></div></div>
          </div>
          <div class="project-card-row">
            <button class="small-button" type="button" data-action="open-project" data-project-id="${project.id}">View details</button>
            <button class="small-button" type="button" data-action="edit-project" data-project-id="${project.id}">Edit</button>
            <button class="small-button" type="button" data-action="archive-project" data-project-id="${project.id}">Archive</button>
            <button class="small-button" type="button" data-action="delete-project" data-project-id="${project.id}">Delete</button>
          </div>
        </article>
      `
    )
    .join("");

  if (window.lucide) {
    lucide.createIcons();
  }
}

function renderProjectDetailPage() {
  const detailContainer = document.getElementById("projectDetailPage");
  const project = findProject(currentProjectId) || state.projects[0];

  if (!project) {
    detailContainer.innerHTML = `<div class="empty-state">Select a project to view details.</div>`;
    return;
  }

  const tasks = getTasksForProject(project.id);
  const progress = projectProgress(project);

  detailContainer.innerHTML = `
    <div class="project-detail-card">
      <div class="project-detail-header">
        <div>
          <h2>${escapeHtml(project.name)}</h2>
          <div class="project-detail-meta">
            <span class="badge ${statusClass(project.status)}">${escapeHtml(project.status)}</span>
            <span class="badge ${priorityClass(project.priority)}">${escapeHtml(project.priority)}</span>
            <span>${escapeHtml(project.category)}</span>
            ${project.favorite ? '<span>Favorite</span>' : ""}
          </div>
        </div>
        <div class="button-row">
          <button class="small-button" type="button" data-action="edit-project" data-project-id="${project.id}">Edit</button>
          <button class="small-button" type="button" data-action="delete-project" data-project-id="${project.id}">Delete</button>
        </div>
      </div>
      <p>${escapeHtml(project.description || "No description provided.")}</p>
      <div class="project-detail-meta">
        <span>Start: ${escapeHtml(formatDate(project.startDate))}</span>
        <span>Deadline: ${escapeHtml(formatDate(project.deadline))}</span>
        <span>Tasks: ${tasks.length}</span>
        <span>Progress: ${progress}%</span>
      </div>
      <div class="progress-bar" style="margin-top: 1rem;"><div class="progress-fill" style="width: ${progress}%"></div></div>
      ${project.githubUrl ? `<div class="button-row" style="margin-top:1rem"><a class="primary-button" href="${escapeAttribute(project.githubUrl)}" target="_blank" rel="noreferrer">Open GitHub</a></div>` : ""}
    </div>

    <div class="panel">
      <div class="panel-header">
        <h2>Tasks in this project</h2>
        <button class="primary-button" type="button" data-open-form="task">Add task</button>
      </div>
      ${tasks.length ? tasks.map(taskToMarkup).join("") : `<div class="empty-state">No tasks for this project yet.</div>` }
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function renderTasks() {
  const listElement = document.getElementById("tasksList");
  const filtered = getFilteredTasks();

  if (!filtered.length) {
    listElement.innerHTML = `<div class="empty-state">No tasks match the current search or filter.</div>`;
    return;
  }

  listElement.innerHTML = filtered.map(taskToMarkup).join("");
}

function renderKanban() {
  const board = document.getElementById("kanbanBoard");
  const columns = [
    { key: "todo", label: "To Do" },
    { key: "inprogress", label: "In Progress" },
    { key: "done", label: "Done" },
  ];

  board.innerHTML = columns
    .map(
      (column) => `
        <div class="kanban-column" data-column-status="${column.key}">
          <div class="kanban-column-header">
            <h3>${column.label}</h3>
            <span class="badge">${getTasksByStatus(column.key).length}</span>
          </div>
          ${getTasksByStatus(column.key)
            .map(
              (task) => `
                <div class="task-card" draggable="true" data-task-card-id="${task.id}">
                  <div class="task-card-header">
                    <strong>${escapeHtml(task.title)}</strong>
                    <span class="badge ${priorityClass(task.priority)}">${escapeHtml(task.priority)}</span>
                  </div>
                  <div class="muted">${escapeHtml(task.description || "No description")}</div>
                  <div class="task-meta">
                    <span>${escapeHtml(getProjectName(task.projectId))}</span>
                    <span>${escapeHtml(formatDate(task.dueDate))}</span>
                  </div>
                  <div class="button-row" style="margin-top:0.8rem;">
                    <button class="small-button" type="button" data-action="toggle-task" data-task-id="${task.id}">${task.completed ? "Reopen" : "Done"}</button>
                    <button class="small-button" type="button" data-action="edit-task" data-task-id="${task.id}">Edit</button>
                    <button class="small-button" type="button" data-action="delete-task" data-task-id="${task.id}">Delete</button>
                  </div>
                </div>
              `
            )
            .join("") || '<div class="empty-state">No tasks here.</div>'}
        </div>
      `
    )
    .join("");

  board.querySelectorAll(".task-card").forEach((card) => {
    card.addEventListener("dragstart", () => {
      card.classList.add("dragging");
      card.dataset.draggedTask = card.dataset.taskCardId;
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      delete card.dataset.draggedTask;
    });
  });

  board.querySelectorAll(".kanban-column").forEach((column) => {
    column.addEventListener("dragover", (event) => {
      event.preventDefault();
    });
    column.addEventListener("drop", (event) => {
      event.preventDefault();
      const draggedId = document.querySelector(".task-card.dragging")?.dataset.taskCardId;
      if (!draggedId) return;
      const task = findTask(draggedId);
      if (task) {
        task.status = column.dataset.columnStatus;
        if (task.status === "done") task.completed = true; else task.completed = false;
        task.updatedAt = new Date().toISOString();
        saveState();
        renderTasks();
        renderKanban();
        renderDashboard();
      }
    });
  });
}

function renderGitHubExplorer() {
  const container = document.getElementById("githubRepoList");
  const status = document.getElementById("githubStatus");
  const username = document.getElementById("githubUsername");
  username.value = state.githubUsername || "";

  if (!state.githubUsername) {
    container.innerHTML = '<div class="empty-state">Enter a GitHub username to search public repositories.</div>';
    status.textContent = "No username set yet.";
    return;
  }

  if (!state.githubResults || !Array.isArray(state.githubResults)) {
    status.textContent = "Ready to search.";
    return;
  }

  status.textContent = state.githubStatus || "Search complete.";

  if (!state.githubResults.length) {
    container.innerHTML = '<div class="empty-state">No public repositories found for this user.</div>';
    return;
  }

  container.innerHTML = state.githubResults
    .map(
      (repo) => `
        <article class="repo-card">
          <div>
            <h3>${escapeHtml(repo.name)}</h3>
            <p class="muted">${escapeHtml(repo.description || "No description provided.")}</p>
          </div>
          <div class="repo-stats">
            <span>⭐ ${repo.stargazers_count}</span>
            <span>🍴 ${repo.forks_count}</span>
            <span>🧠 ${escapeHtml(repo.language || "Unknown")}</span>
          </div>
          <div class="repo-stats">
            <span>Updated ${escapeHtml(formatDate(repo.updated_at))}</span>
          </div>
          <div class="button-row">
            <a class="small-button" href="${escapeAttribute(repo.html_url)}" target="_blank" rel="noreferrer">View</a>
            <button class="small-button" type="button" data-action="save-repo-to-project" data-project-id="${getProjectForRepoSave() || ""}" data-repo-url="${escapeAttribute(repo.html_url)}" data-repo-name="${escapeAttribute(repo.name)}">Save to project</button>
          </div>
        </article>
      `
    )
    .join("");

  const projectSelect = document.createElement("select");
  projectSelect.innerHTML = `<option value="">Choose project</option>${state.projects
    .filter((project) => !project.archived)
    .map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`)
    .join("")}`;
  const existing = document.querySelector("#githubProjectSelect");
  if (existing) existing.remove();
  const wrapper = document.createElement("div");
  wrapper.className = "field-group";
  wrapper.innerHTML = '<label for="githubProjectSelect">Save repo to</label>';
  projectSelect.id = "githubProjectSelect";
  wrapper.appendChild(projectSelect);
  const panel = document.querySelector(".github-panel");
  if (panel && panel.querySelector("#githubProjectSelect") === null) {
    panel.appendChild(wrapper);
  }

  projectSelect.addEventListener("change", (event) => {
    state.gitHubSelectedProjectId = event.target.value;
    saveState();
  });

  if (state.gitHubSelectedProjectId) {
    projectSelect.value = state.gitHubSelectedProjectId;
  }
}

function renderTools() {
  const toolsGrid = document.getElementById("toolsGrid");
  toolsGrid.innerHTML = toolDefinitions
    .map(
      (tool) => `
        <div class="tool-card" data-tool-type="${tool.type}">
          <h3>${escapeHtml(tool.title)}</h3>
          <p class="muted">${escapeHtml(tool.description)}</p>
          <div class="field-group">
            <label>${escapeHtml(tool.inputLabel)}</label>
            <textarea data-tool-input="${tool.type}" ${tool.noInput ? "hidden" : ""} placeholder="${escapeHtml(tool.inputLabel)}"></textarea>
            ${tool.type === "color" ? '<input type="color" data-tool-color="color" />' : ""}
          </div>
          <div class="button-row">
            <button class="primary-button" type="button" data-tool-run="${tool.type}">${escapeHtml(tool.actionLabel)}</button>
            <button class="secondary-button" type="button" data-tool-copy="${tool.type}">Copy</button>
          </div>
          <div class="output-box" data-tool-output="${tool.type}">${tool.type === "uuid" ? "" : "Ready"}</div>
        </div>
      `
    )
    .join("");

  document.querySelectorAll("[data-tool-run]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.toolRun;
      runTool(type);
    });
  });

  document.querySelectorAll("[data-tool-copy]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.toolCopy;
      copyToolOutput(type);
    });
  });
}

function renderGoals() {
  const goals = state.goals;
  document.getElementById("dailyGoalInput").value = goals.dailyMinutes;
  document.getElementById("weeklyGoalInput").value = goals.weeklyTasks;
  const summary = document.getElementById("goalSummary");
  const dailyProgress = getDailyProgress();
  const weeklyProgress = getWeeklyTaskProgress();

  summary.innerHTML = `
    <div>
      <strong>Daily coding goal</strong>
      <div class="progress-bar" style="margin-top:0.5rem;"><div class="progress-fill" style="width: ${Math.min(dailyProgress.percent, 100)}%"></div></div>
      <div class="muted" style="margin-top:0.5rem;">${dailyProgress.minutes} / ${goals.dailyMinutes} minutes</div>
    </div>
    <div style="margin-top:1rem;">
      <strong>Weekly task goal</strong>
      <div class="progress-bar" style="margin-top:0.5rem;"><div class="progress-fill" style="width: ${Math.min(weeklyProgress.percent, 100)}%"></div></div>
      <div class="muted" style="margin-top:0.5rem;">${weeklyProgress.completed} / ${goals.weeklyTasks} tasks completed</div>
    </div>
  `;

  const achievements = getAchievements();
  const achievementList = document.getElementById("achievementList");
  achievementList.innerHTML = achievements
    .map(
      (achievement) => `
        <div class="achievement-item">
          <div class="icon"><span data-lucide="${achievement.icon}"></span></div>
          <div>
            <strong>${escapeHtml(achievement.title)}</strong>
            <div class="muted">${escapeHtml(achievement.description)}</div>
          </div>
        </div>
      `
    )
    .join("");

  if (window.lucide) lucide.createIcons();
}

function renderActivityHistory() {
  const container = document.getElementById("activityHistory");
  const sorted = state.activity.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  container.innerHTML = sorted.length
    ? sorted
        .map(
          (entry) => `
            <div class="activity-entry">
              <div>
                <strong>${escapeHtml(entry.title || entry.type)}</strong>
                <div class="muted">${escapeHtml(entry.note || "Recorded session")}</div>
              </div>
              <div class="align-right">
                <div>${escapeHtml(formatDate(entry.date))}</div>
                <small class="muted">${entry.minutes || 0} min</small>
              </div>
            </div>
          `
        )
        .join("")
    : `<div class="empty-state">No coding sessions recorded yet.</div>`;
}

function renderSettings() {
  document.getElementById("themeSetting").checked = state.theme === "dark";
  document.getElementById("accentSelect").value = state.accent;
  document.getElementById("dateDisplaySelect").value = state.dateFormat;
  document.getElementById("timeDisplaySelect").value = state.timeFormat;
  document.getElementById("githubPrefInput").value = state.githubUsername;
}

function getDashboardStats() {
  const totalProjects = state.projects.filter((project) => !project.archived).length;
  const completedProjects = state.projects.filter((project) => !project.archived && project.status === "Completed").length;
  const openTasks = state.tasks.filter((task) => !task.completed).length;
  const tasksCompletedThisWeek = state.tasks.filter((task) => task.completed && isWithinDays(task.completedAt, 7)).length;
  const currentStreak = getCurrentStreak();
  const favoriteProjects = state.projects.filter((project) => project.favorite && !project.archived).length;

  return { totalProjects, completedProjects, openTasks, tasksCompletedThisWeek, currentStreak, favoriteProjects };
}

function getCurrentStreak() {
  const uniqueDates = [...new Set(state.activity.filter((item) => Number(item.minutes) > 0).map((item) => toISODate(new Date(item.date))))].sort().reverse();
  if (!uniqueDates.length) return 0;
  let streak = 0;
  let cursor = new Date();
  while (uniqueDates.includes(toISODate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getLastNDays(n) {
  const result = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    result.push(toISODate(date));
  }
  return result;
}

function getStatSubtext(label) {
  switch (label) {
    case "Total projects":
      return "All active projects";
    case "Completed projects":
      return "Finished and shipped";
    case "Open tasks":
      return "Still in progress";
    case "Tasks completed this week":
      return "This 7-day window";
    case "Current streak":
      return "Recorded activity days";
    case "Pinned projects":
      return "Favorites on dashboard";
    default:
      return "Updated automatically";
  }
}

function getFilteredProjects(options = {}) {
  const projectSearchInput = document.getElementById("projectSearch");
  const projectStatusInput = document.getElementById("projectStatusFilter");
  const projectCategoryInput = document.getElementById("projectCategoryFilter");
  const projectPriorityInput = document.getElementById("projectPriorityFilter");
  const projectSortInput = document.getElementById("projectSort");

  const searchValue = options.search ?? state.searchQuery ?? projectSearchInput?.value ?? "";
  const search = String(searchValue).toLowerCase();
  const status = options.status ?? projectStatusInput?.value ?? "all";
  const category = options.category ?? projectCategoryInput?.value ?? "all";
  const priority = options.priority ?? projectPriorityInput?.value ?? "all";
  const sort = options.sort ?? projectSortInput?.value ?? "updated";
  const favoritesOnly = options.favorite ?? false;
  const limit = options.limit || 0;

  let rows = state.projects.filter((project) => !project.archived);

  if (favoritesOnly) rows = rows.filter((project) => project.favorite);
  if (search) rows = rows.filter((project) => `${project.name} ${project.description} ${project.category}`.toLowerCase().includes(search));
  if (status !== "all") rows = rows.filter((project) => project.status === status);
  if (category !== "all") rows = rows.filter((project) => project.category === category);
  if (priority !== "all") rows = rows.filter((project) => project.priority === priority);

  rows.sort((a, b) => {
    if (sort === "deadline") {
      return compareDates(a.deadline, b.deadline);
    }
    if (sort === "name") {
      return a.name.localeCompare(b.name);
    }
    return new Date(b.updatedAt || b.startDate || Date.now()) - new Date(a.updatedAt || a.startDate || Date.now());
  });

  if (limit) rows = rows.slice(0, limit);
  return rows;
}

function getFilteredTasks() {
  const search = (document.getElementById("taskSearch")?.value || state.searchQuery || "").toLowerCase();
  const status = document.getElementById("taskStatusFilter")?.value || "all";
  const priority = document.getElementById("taskPriorityFilter")?.value || "all";
  const sort = document.getElementById("taskSort")?.value || "updated";

  let rows = [...state.tasks];
  if (search) rows = rows.filter((task) => `${task.title} ${task.description} ${task.projectName || ""}`.toLowerCase().includes(search));
  if (status !== "all") rows = rows.filter((task) => task.status === status);
  if (priority !== "all") rows = rows.filter((task) => task.priority === priority);

  rows.sort((a, b) => {
    if (sort === "due") return compareDates(a.dueDate, b.dueDate);
    if (sort === "priority") return priorityWeight(b.priority) - priorityWeight(a.priority);
    if (sort === "title") return a.title.localeCompare(b.title);
    return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
  });

  return rows;
}

function taskToMarkup(task) {
  const projectName = getProjectName(task.projectId);
  return `
    <article class="task-item">
      <div class="task-main-row">
        <div>
          <header>
            <input class="checkbox" type="checkbox" data-action="toggle-task" data-task-id="${task.id}" ${task.completed ? "checked" : ""} aria-label="Toggle task ${escapeHtml(task.title)}" />
            <h3>${escapeHtml(task.title)}</h3>
          </header>
          <div class="description">${escapeHtml(task.description || "No description provided.")}</div>
        </div>
        <span class="badge ${priorityClass(task.priority)}">${escapeHtml(task.priority)}</span>
      </div>
      <div class="task-meta">
        <span>${escapeHtml(task.statusLabel || statusLabel(task.status))}</span>
        <span>${escapeHtml(projectName || "Unassigned")}</span>
        <span>${escapeHtml(formatDate(task.dueDate))}</span>
      </div>
      <div class="task-card-actions" style="margin-top: 0.9rem;">
        <div class="button-row">
          <button class="small-button" type="button" data-action="edit-task" data-task-id="${task.id}">Edit</button>
          <button class="small-button" type="button" data-action="delete-task" data-task-id="${task.id}">Delete</button>
          ${task.projectId ? `<button class="small-button" type="button" data-action="view-task-project" data-project-id="${task.projectId}">Project</button>` : ""}
        </div>
      </div>
    </article>
  `;
}

function getTasksByStatus(status) {
  return getFilteredTasks().filter((task) => task.status === status);
}

function findTask(taskId) {
  return state.tasks.find((task) => task.id === taskId);
}

function findProject(projectId) {
  return state.projects.find((project) => project.id === projectId);
}

function getTasksForProject(projectId) {
  return state.tasks.filter((task) => task.projectId === projectId);
}

function generateId(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function openProjectModal(projectId = "") {
  const form = document.getElementById("projectForm");
  form.reset();
  document.getElementById("projectId").value = projectId;
  if (projectId) {
    const project = findProject(projectId);
    if (!project) return;
    document.getElementById("projectModalTitle").textContent = "Edit project";
    document.getElementById("projectName").value = project.name;
    document.getElementById("projectDescription").value = project.description || "";
    document.getElementById("projectCategory").value = project.category;
    document.getElementById("projectStatus").value = project.status;
    document.getElementById("projectPriority").value = project.priority;
    document.getElementById("projectStartDate").value = project.startDate || "";
    document.getElementById("projectDeadline").value = project.deadline || "";
    document.getElementById("projectGithubUrl").value = project.githubUrl || "";
    document.getElementById("projectFavorite").checked = !!project.favorite;
  } else {
    document.getElementById("projectModalTitle").textContent = "New project";
    document.getElementById("projectCategory").value = PROJECT_CATEGORIES[0];
    document.getElementById("projectStatus").value = "Planning";
    document.getElementById("projectPriority").value = "Medium";
    document.getElementById("projectStartDate").value = toISODate(new Date());
    document.getElementById("projectFavorite").checked = false;
  }
  document.getElementById("projectModal").classList.remove("hidden");
  document.getElementById("projectModal").setAttribute("aria-hidden", "false");
}

function openTaskModal(taskId = "") {
  const form = document.getElementById("taskForm");
  form.reset();
  document.getElementById("taskId").value = taskId;
  populateProjectOptions();

  if (taskId) {
    const task = findTask(taskId);
    if (!task) return;
    document.getElementById("taskModalTitle").textContent = "Edit task";
    document.getElementById("taskTitle").value = task.title;
    document.getElementById("taskDescription").value = task.description || "";
    document.getElementById("taskProject").value = task.projectId || "";
    document.getElementById("taskPriority").value = task.priority;
    document.getElementById("taskStatus").value = task.status;
    document.getElementById("taskDueDate").value = task.dueDate || "";
  } else {
    document.getElementById("taskModalTitle").textContent = "New task";
    const selected = state.projects[0]?.id || "";
    document.getElementById("taskProject").value = selected;
    document.getElementById("taskPriority").value = "Medium";
    document.getElementById("taskStatus").value = "todo";
    document.getElementById("taskDueDate").value = "";
  }
  document.getElementById("taskModal").classList.remove("hidden");
  document.getElementById("taskModal").setAttribute("aria-hidden", "false");
}

function closeModal(type) {
  document.getElementById(`${type}Modal`).classList.add("hidden");
  document.getElementById(`${type}Modal`).setAttribute("aria-hidden", "true");
}

function handleProjectSubmit(event) {
  event.preventDefault();
  const id = document.getElementById("projectId").value;
  const name = document.getElementById("projectName").value.trim();
  if (!name) {
    alert("Project name is required.");
    return;
  }

  const payload = {
    name,
    description: document.getElementById("projectDescription").value.trim(),
    category: document.getElementById("projectCategory").value,
    status: document.getElementById("projectStatus").value,
    priority: document.getElementById("projectPriority").value,
    startDate: document.getElementById("projectStartDate").value,
    deadline: document.getElementById("projectDeadline").value,
    githubUrl: document.getElementById("projectGithubUrl").value.trim(),
    favorite: document.getElementById("projectFavorite").checked,
  };

  if (id) {
    const index = state.projects.findIndex((project) => project.id === id);
    if (index >= 0) {
      state.projects[index] = { ...state.projects[index], ...payload, updatedAt: new Date().toISOString() };
    }
  } else {
    state.projects.unshift({
      id: generateId("project"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: false,
      ...payload,
    });
  }

  saveState();
  renderAll();
  closeModal("project");
  setPage("projects");
}

function handleTaskSubmit(event) {
  event.preventDefault();
  const id = document.getElementById("taskId").value;
  const title = document.getElementById("taskTitle").value.trim();
  if (!title) {
    alert("Task title is required.");
    return;
  }

  const payload = {
    title,
    description: document.getElementById("taskDescription").value.trim(),
    projectId: document.getElementById("taskProject").value || "",
    priority: document.getElementById("taskPriority").value,
    status: document.getElementById("taskStatus").value,
    dueDate: document.getElementById("taskDueDate").value,
    completed: document.getElementById("taskStatus").value === "done",
  };

  if (id) {
    const index = state.tasks.findIndex((task) => task.id === id);
    if (index >= 0) {
      state.tasks[index] = {
        ...state.tasks[index],
        ...payload,
        completed: payload.status === "done",
        updatedAt: new Date().toISOString(),
      };
      if (payload.status === "done" && !state.tasks[index].completedAt) state.tasks[index].completedAt = new Date().toISOString();
      if (payload.status !== "done") delete state.tasks[index].completedAt;
    }
  } else {
    const task = {
      id: generateId("task"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: payload.status === "done" ? new Date().toISOString() : null,
      ...payload,
    };
    state.tasks.unshift(task);
  }

  saveState();
  renderAll();
  closeModal("task");
  setPage("tasks");
}

function handleActivitySubmit(event) {
  event.preventDefault();
  const date = document.getElementById("sessionDate").value || toISODate(new Date());
  const minutes = Number(document.getElementById("sessionMinutes").value);
  const note = document.getElementById("sessionNote").value.trim();

  if (!minutes || Number.isNaN(minutes) || minutes <= 0) {
    alert("Please add a valid session length in minutes.");
    return;
  }

  const entry = {
    id: generateId("activity"),
    date,
    minutes,
    note,
    title: "Coding session",
    type: "coding-session",
  };

  state.activity.push(entry);
  state.timer.minutes = minutes;
  state.timer.remainingSeconds = minutes * 60;
  saveState();
  document.getElementById("activityForm").reset();
  document.getElementById("sessionDate").value = toISODate(new Date());
  renderAll();
  setPage("goals");
}

function deleteProject(projectId) {
  if (!window.confirm("Delete this project? This action cannot be undone.")) return;
  state.projects = state.projects.filter((project) => project.id !== projectId);
  state.tasks = state.tasks.filter((task) => task.projectId !== projectId);
  saveState();
  renderAll();
}

function archiveProject(projectId) {
  const project = findProject(projectId);
  if (!project) return;
  project.archived = true;
  project.updatedAt = new Date().toISOString();
  saveState();
  renderAll();
}

function toggleProjectFavorite(projectId) {
  const project = findProject(projectId);
  if (!project) return;
  project.favorite = !project.favorite;
  project.updatedAt = new Date().toISOString();
  saveState();
  renderAll();
}

function deleteTask(taskId) {
  if (!window.confirm("Delete this task?")) return;
  state.tasks = state.tasks.filter((task) => task.id !== taskId);
  saveState();
  renderAll();
}

function toggleTask(taskId) {
  const task = findTask(taskId);
  if (!task) return;
  task.completed = !task.completed;
  task.status = task.completed ? "done" : "todo";
  task.updatedAt = new Date().toISOString();
  task.completedAt = task.completed ? new Date().toISOString() : null;
  saveState();
  renderAll();
}

function searchGitHubUser() {
  const username = (document.getElementById("githubUsername").value || state.githubUsername || "").trim();
  if (!username) {
    document.getElementById("githubStatus").textContent = "Please enter a GitHub username.";
    return;
  }

  state.githubUsername = username;
  state.githubStatus = "Loading repositories...";
  saveState();
  renderGitHubExplorer();

  fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100`, {
    headers: { Accept: "application/vnd.github+json" },
  })
    .then(async (response) => {
      if (!response.ok) {
        const message = response.status === 404
          ? "User not found. Check the username and try again."
          : response.status === 403
            ? "GitHub API rate limit reached. Try again later or use a different username."
            : `Request failed with status ${response.status}.`;
        state.githubStatus = message;
        state.githubResults = [];
        saveState();
        renderGitHubExplorer();
        return;
      }

      const data = await response.json();
      state.githubResults = Array.isArray(data) ? data : [];
      state.githubStatus = `Loaded ${state.githubResults.length} public repositories.`;
      saveState();
      renderGitHubExplorer();
    })
    .catch((error) => {
      console.error(error);
      state.githubStatus = "Network error while loading repository data.";
      state.githubResults = [];
      saveState();
      renderGitHubExplorer();
    });
}

function saveRepoToProject(projectId, repoUrl, repoName) {
  const project = findProject(projectId || state.gitHubSelectedProjectId);
  if (!project) {
    alert("Choose a project before saving a repository.");
    return;
  }
  project.githubUrl = repoUrl;
  project.updatedAt = new Date().toISOString();
  if (repoName) project.name = project.name || repoName;
  saveState();
  renderAll();
}

function populateProjectOptions() {
  const projectSelects = [document.getElementById("taskProject")];
  projectSelects.forEach((select) => {
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">Unassigned</option>' + state.projects
      .filter((project) => !project.archived)
      .map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`)
      .join("");
    if (currentValue) {
      select.value = currentValue;
    }
  });
}

function saveGoals() {
  const dailyMinutes = Number(document.getElementById("dailyGoalInput").value);
  const weeklyTasks = Number(document.getElementById("weeklyGoalInput").value);
  state.goals.dailyMinutes = Number.isFinite(dailyMinutes) && dailyMinutes >= 0 ? dailyMinutes : DEFAULT_STATE.goals.dailyMinutes;
  state.goals.weeklyTasks = Number.isFinite(weeklyTasks) && weeklyTasks >= 0 ? weeklyTasks : DEFAULT_STATE.goals.weeklyTasks;
  saveState();
  renderGoals();
}

function startTimer() {
  if (timerInterval) return;
  const minutesValue = Number(document.getElementById("timerMinutes").value) || 25;
  state.timer.minutes = minutesValue;
  state.timer.remainingSeconds = state.timer.minutes * 60;
  state.timer.isRunning = true;
  timerInterval = setInterval(() => {
    if (state.timer.remainingSeconds > 0) {
      state.timer.remainingSeconds -= 1;
      renderTimer();
      return;
    }
    pauseTimer();
    alert("Focus session complete. Great work.");
  }, 1000);
  renderTimer();
}

function pauseTimer() {
  state.timer.isRunning = false;
  clearInterval(timerInterval);
  timerInterval = null;
  saveState();
}

function resetTimer() {
  pauseTimer();
  const minutes = Number(document.getElementById("timerMinutes").value) || state.timer.minutes || 25;
  state.timer.minutes = minutes;
  state.timer.remainingSeconds = minutes * 60;
  renderTimer();
}

function handleTimerMinutesChange() {
  const minutes = Number(document.getElementById("timerMinutes").value) || 25;
  state.timer.minutes = minutes;
  state.timer.remainingSeconds = minutes * 60;
  renderTimer();
}

function renderTimer() {
  const display = document.getElementById("timerDisplay");
  if (!display) return;
  const totalSeconds = Math.max(0, state.timer.remainingSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  display.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getDailyProgress() {
  const today = toISODate(new Date());
  const todayMinutes = state.activity
    .filter((entry) => entry.date === today)
    .reduce((sum, entry) => sum + Number(entry.minutes || 0), 0);
  return {
    minutes: todayMinutes,
    percent: Math.min((todayMinutes / Math.max(state.goals.dailyMinutes, 1)) * 100, 100),
  };
}

function getWeeklyTaskProgress() {
  const completedThisWeek = state.tasks.filter((task) => task.completed && isWithinDays(task.completedAt, 7)).length;
  const percent = Math.min((completedThisWeek / Math.max(state.goals.weeklyTasks, 1)) * 100, 100);
  return { completed: completedThisWeek, percent };
}

function getAchievements() {
  const projects = state.projects.filter((project) => !project.archived).length;
  const completedTasks = state.tasks.filter((task) => task.completed).length;
  const streak = getCurrentStreak();
  const badges = [
    {
      icon: "folder-open",
      title: "Project starter",
      description: projects >= 1 ? "You have at least one active project." : "Create your first project.",
      unlocked: projects >= 1,
    },
    {
      icon: "check-circle",
      title: "Task finisher",
      description: completedTasks >= 5 ? "You have completed five tasks." : `Complete ${Math.max(5 - completedTasks, 0)} more tasks.`,
      unlocked: completedTasks >= 5,
    },
    {
      icon: "flame",
      title: "Consistency streak",
      description: streak >= 3 ? `Your current streak is ${streak} days.` : `Reach a 3-day streak to unlock this badge.`,
      unlocked: streak >= 3,
    },
  ];

  return badges;
}

function exportDataFile() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `devvault-backup-${toISODate(new Date())}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadBackup() {
  exportDataFile();
}

async function handleImportData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const confirmed = window.confirm("This will replace your current local data. Continue?");
  if (!confirmed) {
    event.target.value = "";
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const merged = {
      ...structuredClone(DEFAULT_STATE),
      ...parsed,
      goals: { ...DEFAULT_STATE.goals, ...(parsed.goals || {}) },
      timer: { ...DEFAULT_STATE.timer, ...(parsed.timer || {}) },
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      activity: Array.isArray(parsed.activity) ? parsed.activity : [],
    };
    state = merged;
    saveState();
    renderAll();
    setPage(state.currentPage || "dashboard");
  } catch (error) {
    alert("The selected file could not be imported. Please choose a valid DevVault JSON export.");
  } finally {
    event.target.value = "";
  }
}

function clearAllData() {
  const confirmed = window.confirm("This will erase all local DevVault data from this browser. Continue?");
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  state = structuredClone(DEFAULT_STATE);
  initApp();
}

function runTool(type) {
  const outputEl = document.querySelector(`[data-tool-output="${type}"]`);
  if (!outputEl) return;

  if (type === "json") {
    try {
      const raw = document.querySelector(`[data-tool-input="${type}"]`).value.trim();
      outputEl.textContent = JSON.stringify(JSON.parse(raw), null, 2);
    } catch (error) {
      outputEl.textContent = "Invalid JSON: " + error.message;
    }
    return;
  }

  if (type === "base64-encode") {
    const text = document.querySelector(`[data-tool-input="${type}"]`).value;
    outputEl.textContent = btoa(unescape(encodeURIComponent(text)));
    return;
  }

  if (type === "base64-decode") {
    const text = document.querySelector(`[data-tool-input="${type}"]`).value;
    try {
      outputEl.textContent = decodeURIComponent(escape(atob(text)));
    } catch (error) {
      outputEl.textContent = "Invalid Base64 input.";
    }
    return;
  }

  if (type === "url-encode") {
    outputEl.textContent = encodeURIComponent(document.querySelector(`[data-tool-input="${type}"]`).value);
    return;
  }

  if (type === "url-decode") {
    try {
      outputEl.textContent = decodeURIComponent(document.querySelector(`[data-tool-input="${type}"]`).value);
    } catch (error) {
      if (!(error instanceof URIError)) throw error;
      outputEl.textContent = "Invalid URL-encoded input.";
    }
    return;
  }

  if (type === "uuid") {
    outputEl.textContent = crypto.randomUUID();
    return;
  }

  if (type === "stats") {
    const text = document.querySelector(`[data-tool-input="${type}"]`).value;
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text ? text.split(/\r\n|\n|\r/).length : 0;
    outputEl.textContent = `Characters: ${chars}\nWords: ${words}\nLines: ${lines}`;
    return;
  }

  if (type === "timestamp") {
    const value = document.querySelector(`[data-tool-input="${type}"]`).value.trim();
    if (/^\d+$/.test(value)) {
      const date = new Date(Number(value) * 1000);
      outputEl.textContent = Number.isNaN(date.getTime()) ? "Invalid timestamp or date." : date.toString();
    } else {
      const date = new Date(value);
      outputEl.textContent = Number.isNaN(date.getTime())
        ? "Invalid timestamp or date."
        : String(Math.floor(date.getTime() / 1000));
    }
    return;
  }

  if (type === "color") {
    let result = "";
    const inputEl = document.querySelector(`[data-tool-input="${type}"]`);
    const colorPicker = document.querySelector(`[data-tool-color="color"]`);
    let colorValue = inputEl.value.trim();
    if (!colorValue) {
      colorValue = colorPicker.value;
    }
    const normalized = colorValue.startsWith("#") ? colorValue : `#${colorValue}`;
    if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      outputEl.textContent = "Invalid color value.";
      return;
    }

    const rgb = hexToRgb(normalized);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    result = `${normalized}\nRGB(${rgb.r}, ${rgb.g}, ${rgb.b})\nHSL(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    outputEl.textContent = result;
    colorPicker.value = normalized;
    inputEl.value = normalized;
  }
}

function copyToolOutput(type) {
  const outputEl = document.querySelector(`[data-tool-output="${type}"]`);
  if (!outputEl) return;
  const text = outputEl.textContent.trim();
  if (!text || text === "Ready") {
    return;
  }
  navigator.clipboard.writeText(text).catch(() => {
    console.warn("Clipboard copy failed.");
  });
}

function getProjectName(projectId) {
  const project = findProject(projectId);
  if (!project) return "Unassigned";
  return project.name;
}

function statusClass(status) {
  const map = {
    Planning: "status-planning",
    "In Progress": "status-in-progress",
    Paused: "status-paused",
    Completed: "status-completed",
  };
  return map[status] || "status-planning";
}

function priorityClass(priority) {
  const map = {
    Low: "priority-low",
    Medium: "priority-medium",
    High: "priority-high",
    Critical: "priority-critical",
  };
  return map[priority] || "priority-medium";
}

function priorityWeight(priority) {
  return { Low: 1, Medium: 2, High: 3, Critical: 4 }[priority] || 2;
}

function statusLabel(status) {
  return {
    todo: "To Do",
    inprogress: "In Progress",
    done: "Done",
  }[status] || "To Do";
}

function projectProgress(project) {
  const tasks = getTasksForProject(project.id);
  if (!tasks.length) return 0;
  const completed = tasks.filter((task) => task.completed).length;
  return Math.round((completed / tasks.length) * 100);
}

function getUpcomingProjects() {
  return state.projects
    .filter((project) => !project.archived && project.deadline)
    .sort((a, b) => compareDates(a.deadline, b.deadline))
    .slice(0, 4);
}

function compareDates(first, second) {
  if (!first && !second) return 0;
  if (!first) return 1;
  if (!second) return -1;
  return new Date(first) - new Date(second);
}

function formatDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  if (state.dateFormat === "MM/DD/YYYY") return new Intl.DateTimeFormat("en-US").format(date);
  if (state.dateFormat === "DD/MM/YYYY") return new Intl.DateTimeFormat("en-GB").format(date);
  return new Intl.DateTimeFormat("en-CA").format(date);
}

function formatShortDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function formatSimpleDay(value) {
  if (!value) return "";
  const date = new Date(value + "T00:00:00");
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function isWithinDays(value, days) {
  if (!value) return false;
  const diff = Date.now() - new Date(value).getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function toISODate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function hexToRgba(hex, alpha) {
  const safe = hex.replace("#", "");
  const bigint = Number.parseInt(safe, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexToRgb(hex) {
  const safe = hex.replace("#", "");
  const bigint = Number.parseInt(safe, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const diff = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = diff === 0 ? 0 : diff / (1 - Math.abs(2 * l - 1));

  if (diff) {
    switch (max) {
      case rn:
        h = ((gn - bn) / diff) % 6;
        break;
      case gn:
        h = (bn - rn) / diff + 2;
        break;
      default:
        h = (rn - gn) / diff + 4;
    }
  }

  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

function getProjectForRepoSave() {
  const selected = document.getElementById("githubProjectSelect")?.value || state.gitHubSelectedProjectId || "";
  return selected;
}

window.addEventListener("beforeunload", () => {
  pauseTimer();
});

window.addEventListener("load", () => {
  renderTimer();
});

function initializeDefaultData() {
  state = structuredClone(DEFAULT_STATE);
  saveState();
  renderAll();
}

if (!localStorage.getItem(STORAGE_KEY)) {
  initializeDefaultData();
}

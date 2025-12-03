// ==== Constants & helpers ====

const STORAGE_KEYS = {
  QUESTS: "microquest_quests",
  HABITS: "microquest_habits",
};

const LEVEL_XP = 200;

const DEFAULT_HABITS = [
  {
    id: "habit-study",
    name: "Study 30 minutes",
    description: "Focused work on classes, reading, or practice problems.",
    completions: [],
  },
  {
    id: "habit-move",
    name: "Move your body",
    description: "Walk, stretch, gym, or any light exercise.",
    completions: [],
  },
  {
    id: "habit-water",
    name: "Drink water",
    description: "Refill and finish a full bottle of water.",
    completions: [],
  },
  {
    id: "habit-sleep",
    name: "Sleep before 1am",
    description: "Shut screens and get some decent rest.",
    completions: [],
  },
];

function getTodayKey() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatDateForDisplay(dateStr) {
  if (!dateStr) return "No due date";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function isSameDay(dateStr1, dateStr2) {
  return dateStr1 === dateStr2;
}

function dateDiffInDays(a, b) {
  const date1 = new Date(a);
  const date2 = new Date(b);
  const ms = date2 - date1;
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// ==== Quest storage / utility ====

function loadQuests() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.QUESTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to load quests:", err);
    return [];
  }
}

function saveQuests(quests) {
  try {
    localStorage.setItem(STORAGE_KEYS.QUESTS, JSON.stringify(quests));
  } catch (err) {
    console.error("Failed to save quests:", err);
  }
}

function createQuestFromForm(form) {
  const title = form.title.value.trim();
  if (!title) return null;

  const category = form.category.value || "General";
  const dueDate = form.dueDate.value || null;
  const difficulty = parseInt(form.difficulty.value || "1", 10);
  const xp = parseInt(form.xp.value || "25", 10);
  const description = form.description.value.trim();

  const quest = {
    id: `q_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    title,
    category,
    dueDate,
    difficulty: Number.isNaN(difficulty) ? 1 : difficulty,
    xp: Number.isNaN(xp) ? 25 : xp,
    status: "todo", // todo | doing | done
    description,
  };

  return quest;
}

function calculateStatsFromQuests(quests) {
  const total = quests.length;
  const completed = quests.filter((q) => q.status === "done").length;
  const active = total - completed;
  const totalXp = quests
    .filter((q) => q.status === "done")
    .reduce((sum, q) => sum + (q.xp || 0), 0);

  const level = Math.floor(totalXp / LEVEL_XP) + 1;
  const currentLevelXp = totalXp % LEVEL_XP;
  const nextLevelXp = LEVEL_XP;

  return {
    total,
    completed,
    active,
    totalXp,
    level,
    currentLevelXp,
    nextLevelXp,
  };
}

function updateQuestStatus(id, newStatus) {
  const quests = loadQuests();
  const idx = quests.findIndex((q) => q.id === id);
  if (idx === -1) return;
  quests[idx].status = newStatus;
  saveQuests(quests);
}

function deleteQuest(id) {
  const quests = loadQuests().filter((q) => q.id !== id);
  saveQuests(quests);
}

// build history: key = YYYY-MM-DD -> count of completed quests
function buildCompletionHistory(quests) {
  const history = {};
  quests
    .filter((q) => q.status === "done" && q.dueDate)
    .forEach((q) => {
      const key = q.dueDate;
      history[key] = (history[key] || 0) + 1;
    });
  return history;
}

// ==== Habit storage / utility ====

function loadHabits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HABITS);
    if (!raw) {
      // deep copy default habits
      return DEFAULT_HABITS.map((h) => ({
        id: h.id,
        name: h.name,
        description: h.description,
        completions: [],
      }));
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("Not an array");
    // ensure completions arrays
    return parsed.map((h) => ({
      ...h,
      completions: Array.isArray(h.completions) ? h.completions : [],
    }));
  } catch (err) {
    console.error("Failed to load habits:", err);
    return DEFAULT_HABITS.map((h) => ({
      id: h.id,
      name: h.name,
      description: h.description,
      completions: [],
    }));
  }
}

function saveHabits(habits) {
  try {
    localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(habits));
  } catch (err) {
    console.error("Failed to save habits:", err);
  }
}

function calculateHabitStreak(habit, todayKey) {
  const set = new Set(habit.completions || []);
  let streak = 0;
  let cursor = todayKey;

  while (set.has(cursor)) {
    streak += 1;
    const d = new Date(cursor);
    d.setDate(d.getDate() - 1);
    cursor = d.toISOString().slice(0, 10);
  }

  return streak;
}

function completionsInLastDays(habit, days) {
  const today = getTodayKey();
  return (habit.completions || []).filter((dateStr) => {
    const diff = dateDiffInDays(
      dateStr,
      today
    ); /* how many days from completion to today */
    return diff >= 0 && diff < days;
  }).length;
}

// ==== Dashboard page ====

function initDashboardPage() {
  const quests = loadQuests();
  const stats = calculateStatsFromQuests(quests);
  const today = new Date();

  const todayDateEl = document.getElementById("today-date");
  if (todayDateEl) {
    todayDateEl.textContent = today.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  // Stats
  const levelEl = document.getElementById("level-value");
  const xpValueEl = document.getElementById("xp-value");
  const xpBarInner = document.getElementById("xp-bar-inner");
  const totalQuestsEl = document.getElementById("total-quests");
  const completedQuestsEl = document.getElementById("completed-quests");
  const activeQuestsEl = document.getElementById("active-quests");

  if (levelEl) levelEl.textContent = stats.level;
  if (xpValueEl)
    xpValueEl.textContent = `${stats.currentLevelXp} / ${stats.nextLevelXp}`;
  if (xpBarInner) {
    const percent =
      stats.nextLevelXp > 0
        ? Math.min(
            100,
            Math.round((stats.currentLevelXp / stats.nextLevelXp) * 100)
          )
        : 0;
    xpBarInner.style.width = `${percent}%`;
  }

  if (totalQuestsEl) totalQuestsEl.textContent = stats.total;
  if (completedQuestsEl) completedQuestsEl.textContent = stats.completed;
  if (activeQuestsEl) activeQuestsEl.textContent = stats.active;

  // Today's quests
  renderTodayQuests(quests);

  // Random quest button
  const randomBtn = document.getElementById("random-quest-btn");
  if (randomBtn) {
    randomBtn.addEventListener("click", () => {
      const questsFresh = loadQuests();
      showRandomQuest(questsFresh);
    });
  }

  // Chart
  renderCompletionChart(quests);
}

function renderTodayQuests(quests) {
  const listEl = document.getElementById("today-quest-list");
  const emptyEl = document.getElementById("today-quest-empty");

  if (!listEl) return;
  listEl.innerHTML = "";

  const todayKey = getTodayKey();
  const dueToday = quests.filter(
    (q) => q.dueDate && isSameDay(q.dueDate, todayKey)
  );

  if (dueToday.length === 0) {
    if (emptyEl) emptyEl.hidden = false;
    return;
  }

  if (emptyEl) emptyEl.hidden = true;

  dueToday.forEach((q) => {
    const li = document.createElement("li");
    li.textContent = q.title;
    listEl.appendChild(li);
  });
}

function showRandomQuest(quests) {
  const displayEl = document.getElementById("random-quest-display");
  if (!displayEl) return;

  const pending = quests.filter((q) => q.status !== "done");
  if (pending.length === 0) {
    displayEl.hidden = false;
    displayEl.textContent = "You have no pending quests. Nice work!";
    return;
  }

  const choice = pending[Math.floor(Math.random() * pending.length)];
  displayEl.hidden = false;
  displayEl.textContent = `${choice.title} (${choice.category}) – due ${formatDateForDisplay(
    choice.dueDate
  )}`;
}

function renderCompletionChart(quests) {
  const canvas = document.getElementById("completionChart");
  const fallback = document.getElementById("chart-fallback");
  if (!canvas || typeof Chart === "undefined") {
    if (fallback) fallback.hidden = false;
    return;
  }

  const history = buildCompletionHistory(quests);
  const today = new Date();
  const labels = [];
  const data = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    labels.push(
      d.toLocaleDateString(undefined, { weekday: "short" }) // e.g., Mon
    );
    data.push(history[key] || 0);
  }

  const hasData = data.some((v) => v > 0);
  if (!hasData && fallback) {
    fallback.hidden = false;
  }

  new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Completed quests",
          data,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          ticks: {
            precision: 0,
          },
          beginAtZero: true,
        },
      },
    },
  });
}

// ==== Quest Board page ====

function initQuestsPage() {
  const form = document.getElementById("quest-form");
  if (form) {
    form.addEventListener("submit", (evt) => {
      evt.preventDefault();
      const quest = createQuestFromForm(form);
      if (!quest) return;
      const quests = loadQuests();
      quests.push(quest);
      saveQuests(quests);
      form.reset();
      renderQuestBoard();
    });
  }

  // Render existing quests
  renderQuestBoard();
  initSortableColumns();
}

function renderQuestBoard() {
  const quests = loadQuests();
  const containers = {
    todo: document.getElementById("todo-column"),
    doing: document.getElementById("doing-column"),
    done: document.getElementById("done-column"),
  };

  Object.values(containers).forEach((el) => {
    if (el) el.innerHTML = "";
  });

  quests.forEach((q) => {
    const column = containers[q.status] || containers.todo;
    if (!column) return;

    const card = document.createElement("article");
    card.className = "quest-card";
    card.dataset.id = q.id;

    const diffLabel = "★".repeat(q.difficulty || 1);
    const isToday = q.dueDate && isSameDay(q.dueDate, getTodayKey());
    const isOverdue =
      q.dueDate && dateDiffInDays(q.dueDate, getTodayKey()) < 0;

    card.innerHTML = `
      <div class="quest-title-row">
        <div class="quest-title">${q.title}</div>
        <span class="quest-tag">${q.category}</span>
      </div>
      <div class="quest-meta">
        <span class="badge-difficulty">Difficulty ${q.difficulty || 1} (${diffLabel})</span>
        <span class="badge-xp">${q.xp || 25} XP</span>
        <span>
          Due: <span class="${
            isOverdue
              ? "badge-overdue"
              : isToday
              ? "badge-due-today"
              : ""
          }">${formatDateForDisplay(q.dueDate)}</span>
        </span>
      </div>
      ${
        q.description
          ? `<p class="quest-notes">${q.description}</p>`
          : ""
      }
      <div class="quest-actions">
        <div class="quest-actions-left">
          <button type="button" class="btn-chip" data-action="set-status" data-status="todo">To do</button>
          <button type="button" class="btn-chip" data-action="set-status" data-status="doing">Doing</button>
          <button type="button" class="btn-chip" data-action="set-status" data-status="done">Done</button>
        </div>
        <div class="quest-actions-right">
          <button type="button" class="btn-chip btn-chip-danger" data-action="delete">Delete</button>
        </div>
      </div>
    `;

    column.appendChild(card);
  });

  // Event delegation for buttons
  const board = document.querySelector(".quest-board");
  if (board && !board.dataset.listenersAttached) {
    board.addEventListener("click", (evt) => {
      const btn = evt.target.closest("button[data-action]");
      if (!btn) return;
      const card = evt.target.closest(".quest-card");
      if (!card) return;
      const id = card.dataset.id;
      const action = btn.dataset.action;

      if (action === "set-status") {
        const status = btn.dataset.status;
        updateQuestStatus(id, status);
        renderQuestBoard();
      } else if (action === "delete") {
        deleteQuest(id);
        renderQuestBoard();
      }
    });

    board.dataset.listenersAttached = "true";
  }
}

function initSortableColumns() {
  if (typeof Sortable === "undefined") return;

  const statuses = ["todo", "doing", "done"];

  statuses.forEach((status) => {
    const listEl = document.querySelector(
      `[data-status-column="${status}"] .quest-list`
    );
    if (!listEl || listEl.dataset.sortableApplied === "true") return;

    Sortable.create(listEl, {
      group: "quests",
      animation: 150,
      onEnd: (evt) => {
        const item = evt.item;
        const id = item.dataset.id;
        const parentColumn = item.closest("[data-status-column]");
        if (!parentColumn) return;
        const newStatus = parentColumn.dataset.statusColumn || status;
        updateQuestStatus(id, newStatus);
      },
    });

    listEl.dataset.sortableApplied = "true";
  });
}

// ==== Habits page ====

function initHabitsPage() {
  const grid = document.getElementById("habit-grid");
  if (!grid) return;

  let habits = loadHabits();
  renderHabitGrid(grid, habits);
  renderHabitChart(habits);
}

function renderHabitGrid(grid, habits) {
  grid.innerHTML = "";
  const todayKey = getTodayKey();

  habits.forEach((habit) => {
    const card = document.createElement("article");
    card.className = "habit-card";
    card.dataset.id = habit.id;

    const streak = calculateHabitStreak(habit, todayKey);
    const total = (habit.completions || []).length;
    const lastDone =
      habit.completions && habit.completions.length
        ? habit.completions[habit.completions.length - 1]
        : null;

    const lastDoneDisplay = lastDone
      ? new Date(lastDone).toLocaleDateString()
      : "Not yet";

    card.innerHTML = `
      <div class="habit-header">
        <h2>${habit.name}</h2>
      </div>
      <p class="habit-description">${habit.description}</p>
      <div class="habit-stats">
        <span class="${streak > 0 ? "habit-streak-strong" : ""}">
          Streak: ${streak} day${streak === 1 ? "" : "s"}
        </span>
        <span>Total: ${total}</span>
      </div>
      <div class="habit-footer">
        <span class="habit-date">Last done: ${lastDoneDisplay}</span>
        <button type="button" class="btn-habit" data-action="habit-today">
          Mark today
        </button>
      </div>
    `;

    grid.appendChild(card);
  });

  // event delegation
  if (!grid.dataset.listenersAttached) {
    grid.addEventListener("click", (evt) => {
      const btn = evt.target.closest("button[data-action='habit-today']");
      if (!btn) return;
      const card = evt.target.closest(".habit-card");
      if (!card) return;

      const id = card.dataset.id;
      const todayKey = getTodayKey();

      let habits = loadHabits();
      const idx = habits.findIndex((h) => h.id === id);
      if (idx === -1) return;
      const completions = new Set(habits[idx].completions || []);
      if (!completions.has(todayKey)) {
        completions.add(todayKey);
        habits[idx].completions = Array.from(completions).sort();
        saveHabits(habits);
        renderHabitGrid(grid, habits);
        renderHabitChart(habits);
      }
    });

    grid.dataset.listenersAttached = "true";
  }
}

function renderHabitChart(habits) {
  const canvas = document.getElementById("habitChart");
  const fallback = document.getElementById("habit-chart-fallback");
  if (!canvas || typeof Chart === "undefined") {
    if (fallback) fallback.hidden = false;
    return;
  }

  const labels = habits.map((h) => h.name);
  const data = habits.map((h) => completionsInLastDays(h, 7));
  const hasData = data.some((v) => v > 0);

  if (!hasData && fallback) {
    fallback.hidden = false;
  } else if (fallback) {
    fallback.hidden = true;
  }

  new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Completions (last 7 days)",
          data,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          ticks: {
            precision: 0,
          },
          beginAtZero: true,
        },
      },
    },
  });
}

// ==== Init by page ====

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  if (page === "dashboard") {
    initDashboardPage();
  } else if (page === "quests") {
    initQuestsPage();
  } else if (page === "habits") {
    initHabitsPage();
  }
});

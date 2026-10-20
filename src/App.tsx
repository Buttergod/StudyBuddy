import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Command,
  Download,
  Flame,
  House,
  Lightbulb,
  Moon,
  NotebookPen,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Sun,
  Target,
  TimerReset,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import "./App.css";

type Tab = "today" | "focus" | "notes" | "cards" | "progress";
type Task = {
  id: string;
  title: string;
  subject: string;
  minutes: number;
  done: boolean;
};
type Note = {
  id: string;
  title: string;
  body: string;
  subject: string;
  updatedAt: string;
};
type Flashcard = {
  id: string;
  front: string;
  back: string;
  subject: string;
  mastered: boolean;
};
type StudyState = {
  tasks: Task[];
  notes: Note[];
  cards: Flashcard[];
  focusMinutes: number;
  streak: number;
  weekMinutes: number[];
  lastStudyDate: string;
  weekStartDate: string;
};

const STORAGE_KEY = "studybuddy-state-v1";
const dayIndex = (new Date().getDay() + 6) % 7;
const tabItems: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "today", label: "Today", icon: House },
  { id: "focus", label: "Focus room", icon: Target },
  { id: "notes", label: "Notes", icon: NotebookPen },
  { id: "cards", label: "Flashcards", icon: Brain },
  { id: "progress", label: "Progress", icon: BarChart3 },
];
const emptyWeek = () => Array.from({ length: 7 }, () => 0);
const starterState: StudyState = {
  tasks: [
    {
      id: "task-1",
      title: "Review cell structure notes",
      subject: "Biology",
      minutes: 25,
      done: false,
    },
    {
      id: "task-2",
      title: "Practice derivatives: set 4",
      subject: "Calculus",
      minutes: 35,
      done: false,
    },
    {
      id: "task-3",
      title: "Outline chapter 6 response",
      subject: "Literature",
      minutes: 20,
      done: true,
    },
    {
      id: "task-4",
      title: "Revisit photosynthesis cards",
      subject: "Biology",
      minutes: 15,
      done: false,
    },
  ],
  notes: [
    {
      id: "note-1",
      title: "Cell membranes",
      subject: "Biology",
      body: "The phospholipid bilayer is selectively permeable. Small nonpolar molecules cross by diffusion; ions and larger molecules need transport proteins.\n\nOsmosis is the movement of water toward the higher solute concentration.",
      updatedAt: "Today",
    },
    {
      id: "note-2",
      title: "Derivative rules",
      subject: "Calculus",
      body: "Power rule: bring the exponent down, then subtract one.\n\nProduct rule: first times derivative of second, plus second times derivative of first.",
      updatedAt: "Yesterday",
    },
  ],
  cards: [
    {
      id: "card-1",
      front: "What is the role of the mitochondrion?",
      back: "It produces most of the cell's ATP through cellular respiration.",
      subject: "Biology",
      mastered: false,
    },
    {
      id: "card-2",
      front: "What is the derivative of xⁿ?",
      back: "n · xⁿ⁻¹ (the power rule)",
      subject: "Calculus",
      mastered: false,
    },
    {
      id: "card-3",
      front: "What does selectively permeable mean?",
      back: "A membrane allows some substances to pass through while restricting others.",
      subject: "Biology",
      mastered: false,
    },
  ],
  focusMinutes: 0,
  streak: 0,
  weekMinutes: emptyWeek(),
  lastStudyDate: "",
  weekStartDate: "",
};

function dateStamp(date: Date) {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
}

function weekStartStamp(date = new Date()) {
  const monday = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - ((date.getDay() + 6) % 7),
  );
  return dateStamp(monday);
}

function loadStudyState(): StudyState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return starterState;
    const value = JSON.parse(saved) as Partial<StudyState>;
    const weekStartDate =
      typeof value.weekStartDate === "string" ? value.weekStartDate : "";
    const isCurrentWeek = weekStartDate === weekStartStamp();
    const weekMinutes =
      isCurrentWeek &&
      Array.isArray(value.weekMinutes) &&
      value.weekMinutes.length === 7
        ? value.weekMinutes
        : emptyWeek();
    return {
      tasks: Array.isArray(value.tasks) ? value.tasks : starterState.tasks,
      notes: Array.isArray(value.notes) ? value.notes : starterState.notes,
      cards: Array.isArray(value.cards) ? value.cards : starterState.cards,
      focusMinutes:
        typeof value.focusMinutes === "number" ? value.focusMinutes : 0,
      streak: typeof value.streak === "number" ? value.streak : 0,
      weekMinutes,
      lastStudyDate:
        typeof value.lastStudyDate === "string" ? value.lastStudyDate : "",
      weekStartDate: isCurrentWeek ? weekStartDate : weekStartStamp(),
    };
  } catch {
    return starterState;
  }
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function App() {
  const [study, setStudy] = useState<StudyState>(loadStudyState);
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("studybuddy-theme") === "dark",
  );
  const [toast, setToast] = useState("");
  const [undoAction, setUndoAction] = useState<{
    id: string;
    done: boolean;
  } | null>(null);
  const [taskInput, setTaskInput] = useState("");
  const [taskSubject, setTaskSubject] = useState("Biology");
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [noteQuery, setNoteQuery] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState("note-1");
  const [saveStatus, setSaveStatus] = useState("Saved on this device");
  const [cardIndex, setCardIndex] = useState(0);
  const [cardRevealed, setCardRevealed] = useState(false);
  const [newCardFront, setNewCardFront] = useState("");
  const [newCardBack, setNewCardBack] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const secondsLeftRef = useRef(25 * 60);
  const [focusDuration, setFocusDuration] = useState(25);
  const [timerRunning, setTimerRunning] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const paletteRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(study));
      setSaveStatus("Saved on this device");
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [study]);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    localStorage.setItem("studybuddy-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => {
      const remaining = secondsLeftRef.current;
      if (remaining <= 1) {
        window.clearInterval(interval);
        secondsLeftRef.current = 0;
        setSecondsLeft(0);
        setTimerRunning(false);
        setStudy((current) => {
          const startOfWeek = weekStartStamp();
          const weekMinutes =
            current.weekStartDate === startOfWeek
              ? [...current.weekMinutes]
              : emptyWeek();
          weekMinutes[dayIndex] += focusDuration;
          const todayStamp = dateStamp(new Date());
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const streak =
            current.lastStudyDate === todayStamp
              ? current.streak
              : current.lastStudyDate === dateStamp(yesterday)
                ? current.streak + 1
                : 1;
          return {
            ...current,
            focusMinutes: current.focusMinutes + focusDuration,
            weekMinutes,
            weekStartDate: startOfWeek,
            streak,
            lastStudyDate: todayStamp,
          };
        });
        if (
          document.hidden &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          new Notification("Focus session complete", {
            body: "Your session is finished. Take a short break.",
          });
        }
        setToast("Session complete. Take a breath before the next one.");
        return;
      }
      secondsLeftRef.current = remaining - 1;
      setSecondsLeft(secondsLeftRef.current);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [focusDuration, timerRunning]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!paletteOpen) return;
    paletteRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPaletteOpen(false);
        returnFocusRef.current?.focus();
      }
      if (
        event.key === "Enter" &&
        (event.target as HTMLElement).matches("input")
      ) {
        document.querySelector<HTMLButtonElement>(".palette-result")?.click();
      }
      if (event.key === "Tab") {
        const dialog = document.querySelector<HTMLElement>(".command-palette");
        const focusable = dialog?.querySelectorAll<HTMLElement>(
          "input, button:not(:disabled)",
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [paletteOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        returnFocusRef.current = document.activeElement as HTMLElement;
        setPaletteQuery("");
        setPaletteOpen(true);
      }
      const target = event.target as HTMLElement;
      const isEditing = target.matches(
        'input, textarea, select, [contenteditable="true"]',
      );
      if (
        activeTab === "cards" &&
        !paletteOpen &&
        !isEditing &&
        (event.key === "ArrowRight" || event.key === "ArrowLeft")
      ) {
        setCardIndex((index) =>
          study.cards.length
            ? (index +
                (event.key === "ArrowRight" ? 1 : -1) +
                study.cards.length) %
              study.cards.length
            : 0,
        );
        setCardRevealed(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTab, paletteOpen, study.cards.length]);

  const today = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
  const completedTasks = study.tasks.filter((task) => task.done).length;
  const selectedNote =
    study.notes.find((note) => note.id === selectedNoteId) ?? study.notes[0];
  const filteredNotes = study.notes.filter((note) =>
    `${note.title} ${note.subject} ${note.body}`
      .toLowerCase()
      .includes(noteQuery.toLowerCase()),
  );
  const currentCard = study.cards[cardIndex];
  const completedPercent = study.tasks.length
    ? Math.round((completedTasks / study.tasks.length) * 100)
    : 0;
  const pageTitle =
    tabItems.find((tab) => tab.id === activeTab)?.label ?? "Today";
  const paletteActions = [
    ...tabItems.map((tab) => ({
      label: `Go to ${tab.label}`,
      detail: "Navigate",
      icon: tab.icon,
      action: () => setActiveTab(tab.id),
    })),
    ...study.notes.map((note) => ({
      label: `Open note: ${note.title || "Untitled note"}`,
      detail: note.subject,
      icon: NotebookPen,
      action: () => {
        setSelectedNoteId(note.id);
        setActiveTab("notes");
      },
    })),
    {
      label: "Create a new note",
      detail: "Quick action",
      icon: NotebookPen,
      action: addNote,
    },
    {
      label: "Start a focus session",
      detail: "Quick action",
      icon: Play,
      action: () => {
        setActiveTab("focus");
        setTimerRunning(true);
      },
    },
  ].filter((action) =>
    `${action.label} ${action.detail}`
      .toLowerCase()
      .includes(paletteQuery.toLowerCase()),
  );

  function showToast(message: string) {
    setToast(message);
  }

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = taskInput.trim();
    if (title.length < 3)
      return showToast(
        "Give your task a little more detail (3 characters minimum).",
      );
    setUndoAction(null);
    setStudy((current) => ({
      ...current,
      tasks: [
        ...current.tasks,
        {
          id: crypto.randomUUID(),
          title,
          subject: taskSubject,
          minutes: 25,
          done: false,
        },
      ],
    }));
    setTaskInput("");
    showToast("Task added to your plan.");
  }

  function toggleTask(id: string) {
    const task = study.tasks.find((item) => item.id === id);
    if (!task) return;
    setUndoAction({ id, done: task.done });
    setStudy((current) => ({
      ...current,
      tasks: current.tasks.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item,
      ),
    }));
    showToast(
      task.done
        ? "Task moved back to your list."
        : "Nice work. One more thing handled.",
    );
  }

  function undoTask() {
    if (!undoAction) return;
    setStudy((current) => ({
      ...current,
      tasks: current.tasks.map((item) =>
        item.id === undoAction.id ? { ...item, done: undoAction.done } : item,
      ),
    }));
    setUndoAction(null);
    showToast("Undid the last task change.");
  }

  function saveTaskTitle(id: string) {
    const title = editValue.trim();
    if (!title) return showToast("A task needs a title.");
    setUndoAction(null);
    setStudy((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === id ? { ...task, title } : task,
      ),
    }));
    setEditingTask(null);
    showToast("Task updated.");
  }

  function reorderTask(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    setUndoAction(null);
    setStudy((current) => {
      const tasks = [...current.tasks];
      const from = tasks.findIndex((task) => task.id === sourceId);
      const to = tasks.findIndex((task) => task.id === targetId);
      if (from < 0 || to < 0) return current;
      const [moved] = tasks.splice(from, 1);
      tasks.splice(to, 0, moved);
      return { ...current, tasks };
    });
    setDraggedTaskId(null);
    showToast("Plan reordered.");
  }

  function moveTask(id: string, direction: -1 | 1) {
    const index = study.tasks.findIndex((task) => task.id === id);
    const target = study.tasks[index + direction];
    if (target) reorderTask(id, target.id);
  }

  function updateNote(field: "title" | "body", value: string) {
    if (!selectedNote) return;
    setSaveStatus("Saving…");
    setStudy((current) => ({
      ...current,
      notes: current.notes.map((note) =>
        note.id === selectedNote.id
          ? { ...note, [field]: value, updatedAt: "Just now" }
          : note,
      ),
    }));
  }

  function addNote() {
    const note: Note = {
      id: crypto.randomUUID(),
      title: "Untitled note",
      subject: "General",
      body: "",
      updatedAt: "Just now",
    };
    setStudy((current) => ({ ...current, notes: [note, ...current.notes] }));
    setSelectedNoteId(note.id);
    setActiveTab("notes");
    showToast("New note created.");
  }

  function moveCard(direction: number) {
    setCardIndex((index) =>
      study.cards.length
        ? (index + direction + study.cards.length) % study.cards.length
        : 0,
    );
    setCardRevealed(false);
  }

  function addFlashcard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const front = newCardFront.trim();
    const back = newCardBack.trim();
    if (front.length < 2 || back.length < 2)
      return showToast("Add both a question and an answer.");
    const card: Flashcard = {
      id: crypto.randomUUID(),
      front,
      back,
      subject: "My cards",
      mastered: false,
    };
    setStudy((current) => ({ ...current, cards: [...current.cards, card] }));
    setCardIndex(study.cards.length);
    setCardRevealed(false);
    setNewCardFront("");
    setNewCardBack("");
    showToast("Flashcard added.");
  }

  function gradeCard(mastered: boolean) {
    if (!currentCard) return;
    setStudy((current) => ({
      ...current,
      cards: current.cards.map((card) =>
        card.id === currentCard.id ? { ...card, mastered } : card,
      ),
    }));
    showToast(
      mastered
        ? "Marked for a later review."
        : "We’ll bring this one back soon.",
    );
    moveCard(1);
  }

  function exportStudyData() {
    const blob = new Blob([JSON.stringify(study, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "studybuddy-backup.json";
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Your study data has been exported.");
  }

  async function enableNotifications() {
    if (!("Notification" in window))
      return showToast("This browser does not support notifications.");
    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    showToast(
      permission === "granted"
        ? "Browser notifications are enabled."
        : "Notifications were not enabled.",
    );
  }

  function openPalette() {
    returnFocusRef.current = document.activeElement as HTMLElement;
    setPaletteQuery("");
    setPaletteOpen(true);
  }

  function runPaletteAction(action: () => void) {
    action();
    setPaletteOpen(false);
    returnFocusRef.current?.focus();
  }

  function renderTasks(compact = false) {
    const tasks = compact ? study.tasks.slice(0, 3) : study.tasks;
    return (
      <div className="task-list" aria-label="Study tasks">
        {tasks.map((task) => {
          const index = study.tasks.findIndex((item) => item.id === task.id);
          return (
            <article
              className={`task-row ${task.done ? "is-done" : ""} ${draggedTaskId === task.id ? "is-dragging" : ""}`}
              key={task.id}
              draggable={!compact}
              onDragStart={() => setDraggedTaskId(task.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() =>
                draggedTaskId && reorderTask(draggedTaskId, task.id)
              }
              onDragEnd={() => setDraggedTaskId(null)}
            >
              <button
                className="task-check"
                aria-label={
                  task.done
                    ? `Mark ${task.title} incomplete`
                    : `Complete ${task.title}`
                }
                onClick={() => toggleTask(task.id)}
              >
                {task.done && <Check size={14} strokeWidth={2.5} />}
              </button>
              <div className="task-copy">
                {editingTask === task.id ? (
                  <form
                    className="inline-edit"
                    onSubmit={(event) => {
                      event.preventDefault();
                      saveTaskTitle(task.id);
                    }}
                  >
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                      aria-label="Edit task title"
                    />
                    <button aria-label="Save task title">
                      <Check size={15} />
                    </button>
                  </form>
                ) : (
                  <button
                    className="task-title"
                    onClick={() => {
                      setEditingTask(task.id);
                      setEditValue(task.title);
                    }}
                  >
                    {task.title}
                  </button>
                )}
                <span className="task-meta">
                  <span
                    className={`subject-dot ${task.subject.toLowerCase()}`}
                  />
                  {task.subject}
                  <span className="meta-divider">·</span>
                  {task.minutes} min
                </span>
              </div>
              {!compact && (
                <div className="task-actions">
                  <button
                    className="icon-button reorder-button"
                    title="Move task up"
                    aria-label="Move task up"
                    disabled={index === 0}
                    onClick={() => moveTask(task.id, -1)}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    className="icon-button reorder-button"
                    title="Move task down"
                    aria-label="Move task down"
                    disabled={index === study.tasks.length - 1}
                    onClick={() => moveTask(task.id, 1)}
                  >
                    <ArrowDown size={15} />
                  </button>
                  <span className="drag-handle" aria-hidden="true">
                    ⠿
                  </span>
                </div>
              )}
            </article>
          );
        })}
        {tasks.length === 0 && (
          <p className="empty-message">
            Your plan is clear. Add one small win.
          </p>
        )}
      </div>
    );
  }

  function renderToday() {
    return (
      <>
        <section className="welcome-row">
          <div>
            <span className="eyebrow">{today}</span>
            <h1>
              A little progress
              <br />
              <em>goes a long way.</em>
            </h1>
            <p className="welcome-copy">
              Your next good study day starts with one thing.
            </p>
          </div>
          <div className="streak-badge">
            <span className="streak-icon">
              <Flame size={18} />
            </span>
            <span>
              <strong>{study.streak} day streak</strong>
              <small>You're building a rhythm</small>
            </span>
          </div>
        </section>
        <section className="summary-grid" aria-label="Today's study summary">
          <article className="summary-card summary-highlight">
            <span className="summary-label">Focus time</span>
            <strong>
              {study.weekMinutes[dayIndex]}
              <small> min</small>
            </strong>
            <span className="summary-foot">
              <Clock3 size={13} /> Today's focus
            </span>
          </article>
          <article className="summary-card">
            <span className="summary-label">Tasks finished</span>
            <strong>
              {completedTasks}
              <small> / {study.tasks.length}</small>
            </strong>
            <span className="summary-foot">
              <CheckCircle2 size={13} /> {completedPercent}% of today's plan
            </span>
          </article>
          <article className="summary-card">
            <span className="summary-label">Cards to review</span>
            <strong>
              {study.cards.filter((card) => !card.mastered).length}
              <small> cards</small>
            </strong>
            <span className="summary-foot">
              <Brain size={13} /> Keep recall sharp
            </span>
          </article>
        </section>
        <div className="today-columns">
          <section className="panel plan-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">YOUR PLAN</span>
                <h2>Today's study list</h2>
              </div>
              <span className="subtle-count">{study.tasks.length} tasks</span>
            </div>
            <form className="add-task-form" onSubmit={addTask}>
              <label className="sr-only" htmlFor="new-task">
                Add a study task
              </label>
              <Plus size={17} aria-hidden="true" />
              <input
                id="new-task"
                value={taskInput}
                onChange={(event) => setTaskInput(event.target.value)}
                placeholder="Add a task to your day..."
                minLength={3}
              />
              <label className="sr-only" htmlFor="task-subject">
                Subject
              </label>
              <select
                id="task-subject"
                value={taskSubject}
                onChange={(event) => setTaskSubject(event.target.value)}
              >
                <option>Biology</option>
                <option>Calculus</option>
                <option>Literature</option>
                <option>History</option>
                <option>General</option>
              </select>
              <button
                type="submit"
                className="add-submit"
                aria-label="Add task"
              >
                <ArrowRight size={17} />
              </button>
            </form>
            {renderTasks()}
            <button className="text-link" onClick={() => setActiveTab("focus")}>
              Plan a focus session <ArrowRight size={14} />
            </button>
          </section>
          <aside className="side-stack">
            <section className="focus-card">
              <div className="focus-card-top">
                <span className="eyebrow">A QUIET MOMENT</span>
                <span className="live-dot" aria-label="Timer ready" />
              </div>
              <h2>
                Make room
                <br />
                for deep work.
              </h2>
              <p>One thing at a time. You’ve got this.</p>
              <button
                className="focus-cta"
                onClick={() => {
                  setActiveTab("focus");
                  setTimerRunning(true);
                }}
              >
                <Play size={15} fill="currentColor" /> Start a focus session
              </button>
              <span className="focus-card-note">
                25 min focus · 5 min pause
              </span>
            </section>
            <section className="panel week-panel">
              <div className="section-heading compact-heading">
                <div>
                  <span className="eyebrow">YOUR WEEK</span>
                  <h2>Showing up counts.</h2>
                </div>
                <button
                  className="icon-button"
                  title="View progress"
                  aria-label="View progress"
                  onClick={() => setActiveTab("progress")}
                >
                  <ArrowRight size={17} />
                </button>
              </div>
              <div className="mini-bars" aria-label="Focus minutes this week">
                {study.weekMinutes.map((value, index) => (
                  <div className="mini-bar-wrap" key={index}>
                    <span
                      className="mini-bar"
                      title={`${value} focus minutes`}
                      style={{
                        height: `${Math.max(8, Math.min(value * 1.15, 65))}px`,
                      }}
                    />
                    <small>{["M", "T", "W", "T", "F", "S", "S"][index]}</small>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </>
    );
  }

  function renderFocus() {
    const progress = 1 - secondsLeft / (focusDuration * 60);
    const circumference = 2 * Math.PI * 93;
    return (
      <section className="focus-view">
        <div className="focus-intro">
          <span className="eyebrow">YOUR FOCUS ROOM</span>
          <h1>
            Protect a little
            <br />
            <em>thinking time.</em>
          </h1>
          <p>Pick one task. Let the rest wait.</p>
        </div>
        <div className="timer-panel panel">
          <div
            className="timer-tabs"
            role="group"
            aria-label="Choose timer length"
          >
            {[25, 50, 15].map((minutes) => (
              <button
                key={minutes}
                className={focusDuration === minutes ? "selected" : ""}
                onClick={() => {
                  setFocusDuration(minutes);
                  secondsLeftRef.current = minutes * 60;
                  setSecondsLeft(minutes * 60);
                  setTimerRunning(false);
                }}
              >
                {minutes === 15 ? "Short break" : `${minutes} min`}
              </button>
            ))}
          </div>
          <div className="timer-face">
            <svg viewBox="0 0 210 210" aria-hidden="true">
              <circle className="timer-track" cx="105" cy="105" r="93" />
              <circle
                className="timer-progress"
                cx="105"
                cy="105"
                r="93"
                style={{
                  strokeDasharray: circumference,
                  strokeDashoffset: circumference * progress,
                }}
              />
            </svg>
            <div className="timer-readout" aria-live="off">
              <strong>{formatTime(secondsLeft)}</strong>
              <span>
                {timerRunning
                  ? "IN THE ZONE"
                  : secondsLeft === 0
                    ? "SESSION DONE"
                    : "READY WHEN YOU ARE"}
              </span>
            </div>
          </div>
          <div className="timer-controls">
            <button
              className="primary-button"
              onClick={() => {
                if (secondsLeft === 0) {
                  secondsLeftRef.current = focusDuration * 60;
                  setSecondsLeft(focusDuration * 60);
                }
                setTimerRunning((running) => !running);
              }}
            >
              {timerRunning ? (
                <Pause size={17} />
              ) : (
                <Play size={17} fill="currentColor" />
              )}
              {timerRunning ? "Pause session" : "Start session"}
            </button>
            <button
              className="icon-button reset-button"
              title="Reset timer"
              aria-label="Reset timer"
              onClick={() => {
                setTimerRunning(false);
                secondsLeftRef.current = focusDuration * 60;
                setSecondsLeft(focusDuration * 60);
              }}
            >
              <TimerReset size={19} />
            </button>
          </div>
          <div className="focus-hint">
            <Lightbulb size={15} />
            <span>Try putting your phone face down until the timer ends.</span>
          </div>
        </div>
        <div className="focus-bottom">
          <div className="focus-stat">
            <Clock3 size={18} />
            <span>
              <strong>{study.weekMinutes[dayIndex]} min</strong>
              <small>focused today</small>
            </span>
          </div>
          <div className="focus-stat">
            <Flame size={18} />
            <span>
              <strong>{study.streak} days</strong>
              <small>in your study rhythm</small>
            </span>
          </div>
          <p>Small, steady sessions beat the perfect plan.</p>
        </div>
      </section>
    );
  }

  function renderNotes() {
    return (
      <section className="notes-view">
        <div className="page-intro">
          <div>
            <span className="eyebrow">YOUR STUDY DESK</span>
            <h1>
              Notes that stay <em>yours.</em>
            </h1>
            <p>Capture an idea before it wanders off.</p>
          </div>
          <button className="primary-button" onClick={addNote}>
            <Plus size={17} /> New note
          </button>
        </div>
        <div className="notes-layout panel">
          <div className="notes-sidebar">
            <div className="notes-search">
              <Search size={15} />
              <input
                value={noteQuery}
                onChange={(event) => setNoteQuery(event.target.value)}
                placeholder="Find a note..."
                aria-label="Search notes"
              />
            </div>
            <div className="notes-filter-label">
              ALL NOTES <span>{filteredNotes.length}</span>
            </div>
            <div className="note-list">
              {filteredNotes.map((note) => (
                <button
                  key={note.id}
                  className={`note-list-item ${selectedNote?.id === note.id ? "selected" : ""}`}
                  onClick={() => setSelectedNoteId(note.id)}
                >
                  <span className="note-subject">{note.subject}</span>
                  <strong>{note.title || "Untitled note"}</strong>
                  <small>{note.updatedAt}</small>
                </button>
              ))}
              {filteredNotes.length === 0 && (
                <p className="empty-message">No notes match that search.</p>
              )}
            </div>
          </div>
          <div className="note-editor">
            {selectedNote ? (
              <>
                <div className="editor-meta">
                  <span className="eyebrow">{selectedNote.subject}</span>
                  <span className="saved-label">
                    <span className="save-dot" />
                    {saveStatus}
                  </span>
                </div>
                <input
                  className="note-title-input"
                  value={selectedNote.title}
                  onChange={(event) => updateNote("title", event.target.value)}
                  aria-label="Note title"
                  placeholder="Untitled note"
                />
                <textarea
                  className="note-body-input"
                  value={selectedNote.body}
                  onChange={(event) => updateNote("body", event.target.value)}
                  aria-label="Note content"
                  placeholder="Start writing. Your changes save as you go..."
                />
                <div className="editor-footer">
                  <span>Private to this device</span>
                  <span>
                    {
                      selectedNote.body.trim().split(/\s+/).filter(Boolean)
                        .length
                    }{" "}
                    words
                  </span>
                </div>
              </>
            ) : (
              <div className="empty-editor">
                <NotebookPen size={25} />
                <p>Choose a note or start a new one.</p>
                <button className="text-link" onClick={addNote}>
                  Create a note <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  function renderCards() {
    return (
      <section className="cards-view">
        <div className="page-intro">
          <div>
            <span className="eyebrow">ACTIVE RECALL</span>
            <h1>
              Make it <em>stick.</em>
            </h1>
            <p>A little retrieval practice goes a long way.</p>
          </div>
          <span className="card-counter">
            {study.cards.length
              ? `${cardIndex + 1} / ${study.cards.length}`
              : "0 cards"}
          </span>
        </div>
        <div className="cards-layout">
          <div className="review-column">
            <div
              className="flashcard-wrap"
              onPointerDown={(event) => {
                touchStartX.current = event.clientX;
              }}
              onPointerUp={(event) => {
                if (
                  touchStartX.current !== null &&
                  Math.abs(event.clientX - touchStartX.current) > 70
                )
                  moveCard(event.clientX < touchStartX.current ? 1 : -1);
                touchStartX.current = null;
              }}
            >
              {currentCard ? (
                <button
                  className={`flashcard ${cardRevealed ? "revealed" : ""}`}
                  onClick={() => setCardRevealed((revealed) => !revealed)}
                  aria-label={cardRevealed ? "Show question" : "Reveal answer"}
                >
                  <span className="flashcard-top">
                    <span>{currentCard.subject}</span>
                    <span>{cardRevealed ? "ANSWER" : "QUESTION"}</span>
                  </span>
                  <strong>
                    {cardRevealed ? currentCard.back : currentCard.front}
                  </strong>
                  <span className="flashcard-bottom">
                    {cardRevealed
                      ? "Tap to see the question again"
                      : "Tap anywhere to reveal"}
                  </span>
                </button>
              ) : (
                <div className="empty-card">
                  <Brain size={25} />
                  <strong>Your first card is one idea away.</strong>
                  <span>Add a question and answer to get started.</span>
                </div>
              )}
            </div>
            <div className="card-navigation">
              <button
                className="icon-button"
                title="Previous card"
                aria-label="Previous card"
                onClick={() => moveCard(-1)}
              >
                <ArrowLeft size={18} />
              </button>
              <span>
                Use <kbd>←</kbd> <kbd>→</kbd> to move
              </span>
              <button
                className="icon-button"
                title="Next card"
                aria-label="Next card"
                onClick={() => moveCard(1)}
              >
                <ArrowRight size={18} />
              </button>
            </div>
            {cardRevealed && currentCard && (
              <div className="grade-actions">
                <button
                  className="grade-again"
                  onClick={() => gradeCard(false)}
                >
                  <RotateCcw size={16} /> Review again
                </button>
                <button className="grade-known" onClick={() => gradeCard(true)}>
                  <Check size={16} /> I knew it
                </button>
              </div>
            )}
          </div>
          <form className="panel new-card-panel" onSubmit={addFlashcard}>
            <span className="eyebrow">BUILD YOUR DECK</span>
            <h2>Add a flashcard</h2>
            <label htmlFor="card-front">Question</label>
            <textarea
              id="card-front"
              value={newCardFront}
              onChange={(event) => setNewCardFront(event.target.value)}
              placeholder="What do you want to remember?"
              minLength={2}
              required
            />
            <label htmlFor="card-back">Answer</label>
            <textarea
              id="card-back"
              value={newCardBack}
              onChange={(event) => setNewCardBack(event.target.value)}
              placeholder="Write a clear, short answer..."
              minLength={2}
              required
            />
            <button className="primary-button" type="submit">
              <Plus size={16} /> Add to deck
            </button>
            <p className="form-hint">
              <Sparkles size={14} /> Keep each card focused on one idea.
            </p>
          </form>
        </div>
      </section>
    );
  }

  function renderProgress() {
    const maxMinutes = Math.max(30, ...study.weekMinutes);
    const bars = study.weekMinutes.map((minutes, index) => ({
      day: ["M", "T", "W", "T", "F", "S", "S"][index],
      value: minutes,
      height: minutes ? Math.max(8, (minutes / maxMinutes) * 100) : 3,
    }));
    return (
      <section className="progress-view">
        <div className="page-intro">
          <div>
            <span className="eyebrow">YOUR MOMENTUM</span>
            <h1>
              Look how far <em>you've come.</em>
            </h1>
            <p>Progress is built in the small moments.</p>
          </div>
          <button className="secondary-button" onClick={exportStudyData}>
            <Download size={16} /> Export my data
          </button>
        </div>
        <div className="progress-summary">
          <article className="progress-stat">
            <span className="stat-icon terracotta">
              <Clock3 size={19} />
            </span>
            <span className="eyebrow">TOTAL FOCUS TIME</span>
            <strong>
              {Math.floor(study.focusMinutes / 60)}
              <small>h</small> {study.focusMinutes % 60}
              <small>m</small>
            </strong>
            <span className="stat-caption">All completed focus sessions.</span>
          </article>
          <article className="progress-stat">
            <span className="stat-icon sage">
              <CheckCircle2 size={19} />
            </span>
            <span className="eyebrow">TASKS COMPLETED</span>
            <strong>
              {completedTasks}
              <small> / {study.tasks.length}</small>
            </strong>
            <span className="stat-caption">Every checkmark is earned.</span>
          </article>
          <article className="progress-stat">
            <span className="stat-icon gold">
              <Flame size={19} />
            </span>
            <span className="eyebrow">CURRENT STREAK</span>
            <strong>
              {study.streak}
              <small> days</small>
            </strong>
            <span className="stat-caption">A rhythm, not a race.</span>
          </article>
        </div>
        <div className="progress-columns">
          <section className="panel chart-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">THIS WEEK</span>
                <h2>Focus minutes</h2>
              </div>
              <span className="chart-total">
                {study.weekMinutes[dayIndex]} min today
              </span>
            </div>
            <div
              className="chart-area"
              role="img"
              aria-label={`Focus minutes this week: ${bars.map((bar) => `${bar.day} ${bar.value}`).join(", ")}`}
            >
              {bars.map((bar, index) => (
                <div className="chart-column" key={`${bar.day}-${index}`}>
                  <span
                    className={`chart-bar ${index === dayIndex ? "highlight" : ""}`}
                    style={{ height: `${bar.height}%` }}
                  >
                    <span className="chart-tooltip">{bar.value} min</span>
                  </span>
                  <small>{bar.day}</small>
                </div>
              ))}
            </div>
            <div className="chart-scale">
              <span>{maxMinutes} min</span>
              <span>{Math.round(maxMinutes / 2)} min</span>
              <span>0 min</span>
            </div>
          </section>
          <section className="panel progress-insight">
            <span className="insight-icon">
              <Lightbulb size={18} />
            </span>
            <span className="eyebrow">A NOTE TO SELF</span>
            <h2>Consistency beats intensity.</h2>
            <p>
              {study.weekMinutes[dayIndex] >= 50
                ? "You made time for your goals today. Let yourself feel good about that."
                : "A short session still counts. Give yourself ten minutes to get started."}
            </p>
            <button className="text-link" onClick={() => setActiveTab("focus")}>
              Start a small session <ArrowRight size={14} />
            </button>
          </section>
        </div>
        <section className="panel subject-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">WHAT'S ON YOUR DESK</span>
              <h2>Subjects in rotation</h2>
            </div>
            <button className="text-link" onClick={() => setActiveTab("today")}>
              View plan <ArrowRight size={14} />
            </button>
          </div>
          <div className="subject-progress-list">
            {["Biology", "Calculus", "Literature"].map((subject) => {
              const total = study.tasks.filter(
                (task) => task.subject === subject,
              ).length;
              const done = study.tasks.filter(
                (task) => task.subject === subject && task.done,
              ).length;
              const progress = total ? Math.round((done / total) * 100) : 0;
              return (
                <div className="subject-progress" key={subject}>
                  <span className={`subject-dot ${subject.toLowerCase()}`} />
                  <strong>{subject}</strong>
                  <div className="subject-track">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <small>
                    {total ? `${done} of ${total} tasks` : "No tasks planned"}
                  </small>
                </div>
              );
            })}
          </div>
        </section>
      </section>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#today"
          onClick={(event) => {
            event.preventDefault();
            setActiveTab("today");
          }}
        >
          <span className="brand-mark">
            <BookOpen size={18} />
          </span>
          <span>
            studybuddy<small>your study space</small>
          </span>
        </a>
        <span className="nav-caption">STUDY</span>
        <nav
          className="main-nav"
          role="tablist"
          aria-label="Study sections"
          aria-orientation="vertical"
        >
          {tabItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeTab === id}
              aria-controls="main-panel"
              className={`nav-item ${activeTab === id ? "active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {id === "cards" && (
                <span className="nav-count">
                  {study.cards.filter((card) => !card.mastered).length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-quote">
          <span className="quote-mark">“</span>
          <p>
            You don't have to see the whole staircase. Just take the first step.
          </p>
          <small>one thing at a time</small>
        </div>
        <div className="sidebar-bottom">
          <button
            className="profile-button"
            onClick={() =>
              showToast("Your study data is private to this device.")
            }
          >
            <span className="avatar">S</span>
            <span>
              <strong>Study space</strong>
              <small>Personal workspace</small>
            </span>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">
              <BookOpen size={17} />
            </span>
            <strong>studybuddy</strong>
          </div>
          <div className="breadcrumb">
            <span>My workspace</span>
            <ArrowRight size={13} />
            <strong>{pageTitle}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="search-trigger"
              onClick={openPalette}
              title="Search and commands (Ctrl+K)"
            >
              <Search size={16} />
              <span>Search anything...</span>
              <kbd>
                <Command size={11} /> K
              </kbd>
            </button>
            <button
              className="icon-button topbar-icon"
              title="Enable browser notifications"
              aria-label="Enable browser notifications"
              onClick={enableNotifications}
            >
              <Bell size={17} />
            </button>
            <button
              className="icon-button topbar-icon theme-button"
              title={
                darkMode ? "Switch to light theme" : "Switch to dark theme"
              }
              aria-label={
                darkMode ? "Switch to light theme" : "Switch to dark theme"
              }
              onClick={() => setDarkMode((mode) => !mode)}
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <span className="top-avatar">S</span>
          </div>
        </header>
        <div className="mobile-tabs" role="tablist" aria-label="Study sections">
          {tabItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeTab === id}
              className={activeTab === id ? "active" : ""}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={18} />
              <span>{label === "Focus room" ? "Focus" : label}</span>
            </button>
          ))}
        </div>
        <div
          id="main-panel"
          className={`page-content page-${activeTab}`}
          role="tabpanel"
          key={activeTab}
        >
          {activeTab === "today" && renderToday()}
          {activeTab === "focus" && renderFocus()}
          {activeTab === "notes" && renderNotes()}
          {activeTab === "cards" && renderCards()}
          {activeTab === "progress" && renderProgress()}
        </div>
        <footer className="app-footer">
          <span>
            <span className="save-dot" /> Your work saves automatically on this
            device
          </span>
          <button
            onClick={() =>
              showToast(
                "Your notes, cards, and plan are stored privately in this browser.",
              )
            }
          >
            About your data
          </button>
          <button
            onClick={() =>
              showToast("A new idea? Start in Notes and keep it simple.")
            }
          >
            Need a hand?
          </button>
        </footer>
      </main>
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <CheckCircle2 size={17} />
          <span>{toast}</span>
          {undoAction && toast.includes("Task") && (
            <button onClick={undoTask} aria-label="Undo task change">
              <Undo2 size={16} /> Undo
            </button>
          )}
          <button
            className="toast-close"
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {paletteOpen && (
        <div
          className="palette-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPaletteOpen(false);
              returnFocusRef.current?.focus();
            }
          }}
        >
          <section
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-labelledby="palette-title"
          >
            <h2 id="palette-title" className="sr-only">
              Search and commands
            </h2>
            <div className="palette-input-wrap">
              <Search size={19} />
              <input
                ref={paletteRef}
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
                placeholder="Search sections and actions..."
                aria-label="Search sections and actions"
              />
              <kbd>ESC</kbd>
              <button
                className="icon-button"
                onClick={() => {
                  setPaletteOpen(false);
                  returnFocusRef.current?.focus();
                }}
                aria-label="Close command palette"
              >
                <X size={18} />
              </button>
            </div>
            <span className="palette-label">QUICK ACTIONS</span>
            <div className="palette-results">
              {paletteActions.map(({ label, detail, icon: Icon, action }) => (
                <button
                  key={label}
                  className="palette-result"
                  onClick={() => runPaletteAction(action)}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                  <small>{detail}</small>
                  <ArrowRight size={14} />
                </button>
              ))}
              {paletteActions.length === 0 && (
                <p className="empty-message">No matches. Try another search.</p>
              )}
            </div>
            <div className="palette-footer">
              <span>
                <kbd>↵</kbd> to open
              </span>
              <span>
                <kbd>esc</kbd> to close
              </span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;

const modal = document.querySelector("#addTaskModal");
const openBtn = document.querySelector("#openAddTaskBtn");
const closeBtn = document.querySelector("#closeModalBtn");
const form = document.querySelector("#addTaskForm");
const formError = document.querySelector("#task-from-error");
const taskGrid = document.querySelector("#task-grid");
const taskTemplate = document.querySelector("#task-card-template");

function changeContent(targetElement, content) {
  if (targetElement) targetElement.textContent = content;
}

openBtn.addEventListener("click", () => modal.showModal());
closeBtn.addEventListener("click", () => modal.close());

async function loadTasks() {
  try {
    const response = await fetch("/tasks");

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (!response.ok) {
      throw new Error("Failed to fetch tasks from server.");
    }

    const tasks = await response.json();
    renderTasks(tasks);
  } catch (err) {
    console.error("Error loading tasks: ", err);
    if (taskGrid) {
      taskGrid.innerHTML = "<p class = 'error-text'>Unable to load tasks.</p>";
    }
  }
}

function renderTasks(tasks) {
  taskGrid.innerHTML = "";

  if (tasks.length === 0) {
    taskGrid.innerHTML = "<p>No tasks yet. Click '+ Add task' to get started. </p>";
  }

  tasks.forEach((task) => {
    const clone = taskTemplate.content.cloneNode(true);

    clone.querySelector(".task-title").textContent = task.title;
    clone.querySelector(".task-description").textContent = task.description || "No description provided";

    taskGrid.appendChild(clone);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  changeContent(formError, "");

  const data = new URLSearchParams(new FormData(form));

  if (!data.get("title")) {
    changeContent(formError, "Please fill in all fields");
    return;
  }

  try {
    const reponse = await fetch("/add-task", {
      method: "POST",
      headers: {
        "content-Type": "application/x-www-form-urlencoded",
      },
      body: data,
    });

    if (!reponse.ok) {
      const textError = await reponse.text();
      changeContent(formError, textError);
      return;
    }

    form.reset();
    modal.close();
    await loadTasks();
  } catch (error) {
    console.error(error.message);
    changeContent(formError, "Unable to connect to server.");
  }
});

loadTasks();

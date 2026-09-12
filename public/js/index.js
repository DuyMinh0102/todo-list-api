const modal = document.querySelector("#addTaskModal");
const openBtn = document.querySelector("#openAddTaskBtn");
const closeBtn = document.querySelector("#closeModalBtn");
const form = document.querySelector("#addTaskForm");
const formError = document.querySelector("#task-form-error");
const taskGrid = document.querySelector("#task-grid");
const completedTaskGrid = document.querySelector("#completed-task-grid");
const taskTemplate = document.querySelector("#task-card-template");
const logOutButton = document.querySelector("#logoutBtn");

const editModal = document.querySelector("#editTaskModal");
const editForm = document.querySelector("#editTaskForm");
const editFormError = document.querySelector("#edit-task-form-error");
const closeEditBtn = document.querySelector("#closeEditModalBtn");
const editTaskIdInput = document.querySelector("#editTaskId");
const editTaskDescInput = document.querySelector("#editTaskDesc");

function changeContent(targetElement, content) {
  if (targetElement) targetElement.textContent = content;
}

openBtn.addEventListener("click", () => modal.showModal());
closeBtn.addEventListener("click", () => modal.close());
closeEditBtn.addEventListener("click", () => editModal.close());

logOutButton.addEventListener("click", async () => {
  const response = await fetch("/remove-session", {
    method: "DELETE",
  });

  if (!response.ok) {
    const textError = await response.text();
    changeContent(formError, textError);
    return;
  }

  window.location.href = "/login";
});

function renderTasks(tasks) {
  taskGrid.innerHTML = "";
  completedTaskGrid.innerHTML = "";

  if (tasks.length === 0) {
    taskGrid.innerHTML = "<p>No tasks yet. Click '+ Add task' to get started. </p>";
  }

  tasks.forEach((task) => {
    const clone = taskTemplate.content.cloneNode(true);

    clone.querySelector(".task-title").textContent = task.title;
    clone.querySelector(".task-description").textContent = task.description || "No description provided";

    console.log(task.status);

    const deleteBtn = clone.querySelector(".btn-delete");
    deleteBtn.dataset.id = task.id;

    const markBtn = clone.querySelector(".btn-complete");
    markBtn.dataset.id = task.id;

    const editBtn = clone.querySelector(".btn-edit");
    editBtn.dataset.id = task.id;
    editBtn.dataset.desc = task.description || "";

    if (task.status === "in-progress") taskGrid.appendChild(clone);
    else {
      clone.querySelector(".task-card").classList.add("task-complete");

      completedTaskGrid.appendChild(clone);
    }
  });
}

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

taskGrid.addEventListener("click", async (event) => {
  if (event.target.classList.contains("btn-delete")) {
    const taskID = event.target.dataset.id;

    console.log(`Deleted task: ${taskID}`);

    const response = await fetch(`/delete-task/${taskID}`, { method: "DELETE" });

    if (!response.ok) {
      const textError = await response.text();
      changeContent(formError, textError);
      return;
    }

    loadTasks();
  }

  if (event.target.classList.contains("btn-complete")) {
    const taskID = event.target.dataset.id;

    console.log(`Marked task ${taskID} as completed.`);

    const response = await fetch(`/mark-as-done/${taskID}`, { method: "POST" });

    if (!response.ok) {
      const textError = await response.text();
      changeContent(formError, textError);
      return;
    }

    loadTasks();
  }

  if (event.target.classList.contains("btn-edit")) {
    const taskID = event.target.dataset.id;
    const currentDesc = event.target.dataset.desc;

    editTaskIdInput.value = taskID;
    editTaskDescInput.value = currentDesc;
    changeContent(editFormError, "");

    editModal.showModal();
  }
});

completedTaskGrid.addEventListener("click", async (event) => {
  if (event.target.classList.contains("btn-delete")) {
    const taskID = event.target.dataset.id;

    console.log(`Deleted task: ${taskID}`);

    const response = await fetch(`/delete-task/${taskID}`, { method: "DELETE" });

    if (!response.ok) {
      const textError = await response.text();
      changeContent(formError, textError);
      return;
    }

    loadTasks();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  changeContent(formError, "");

  const data = new URLSearchParams(new FormData(form));

  if (!data.get("title")) {
    changeContent(formError, "Please fill in all fields");
    return;
  }

  try {
    const response = await fetch("/add-task", {
      method: "POST",
      headers: {
        "content-Type": "application/x-www-form-urlencoded",
      },
      body: data,
    });

    if (!response.ok) {
      const textError = await response.text();
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

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  changeContent(editFormError, "");

  const taskID = editTaskIdInput.value;
  const data = new URLSearchParams(new FormData(editForm));

  try {
    const response = await fetch(`/edit-task/${taskID}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: data,
    });

    if (!response.ok) {
      const textError = await response.text();
      changeContent(editFormError, textError);
      return;
    }

    editForm.reset();
    editModal.close();
    await loadTasks();
  } catch (error) {
    console.error(error.message);
    changeContent(editFormError, "Unable to connect to server.");
  }
});

loadTasks();

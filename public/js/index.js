const modal = document.querySelector("#addTaskModal");
const openBtn = document.querySelector("#openAddTaskBtn");
const closeBtn = document.querySelector("#closeModalBtn");

function changeContent(targetElement, content) {
  if (targetElement) targetElement.textContent = content;
}

openBtn.addEventListener("click", () => modal.showModal());
closeBtn.addEventListener("click", () => modal.close());

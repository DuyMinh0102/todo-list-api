const modal = document.querySelector("#addTaskModal");
const openBtn = document.querySelector("#openAddTaskBtn");
const closeBtn = document.querySelector("#closeModalBtn");
const form = document.querySelector("#addTaskForm");
const formError = document.querySelector("#form-error");

function changeContent(targetElement, content) {
  if (targetElement) targetElement.textContent = content;
}

openBtn.addEventListener("click", () => modal.showModal());
closeBtn.addEventListener("click", () => modal.close());

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
  } catch (error) {
    console.error(error.message);
    changeContent(formError, "Unable to connect to server.");
  }
});

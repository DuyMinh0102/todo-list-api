const form = document.querySelector("form");

function changeContent(targetElement, content) {
  if (targetElement) targetElement.textContent = content;
}

form.addEventListener("add_task", async (event) => {
  event.preventDefault();
});

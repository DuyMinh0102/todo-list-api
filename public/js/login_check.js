const form = document.querySelector("form");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const data = new FormData(form);

  const regName = data.get("username");
  const regPWD = data.get("pwd");

  if (!regName || !regPWD) {
    return;
  }
});

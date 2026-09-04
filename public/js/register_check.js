const form = document.querySelector("form");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const data = new FormData(form);

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const wr = /\s/;

  const regName = data.get("username");
  const regEmail = data.get("email");
  const regPWD = data.get("pwd");
  const regConfirmPWD = data.get("confirm_pwd");

  if (!regName || !regEmail || !regPWD || !regConfirmPWD) {
    return;
  }

  if (wr.test(regName) || wr.test(regEmail) || wr.test(regPWD) || wr.test(regConfirmPWD)) {
    return;
  }

  if (regName.length < 6 || regName.length > 20) {
    return;
  }

  if (!emailRegex.test(regEmail)) {
    return;
  }

  if (regPWD !== regConfirmPWD) {
    return;
  }

  if (regPWD.length < 8 || regPWD.length > 20) {
    return;
  }
});

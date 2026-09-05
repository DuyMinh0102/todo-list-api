const form = document.querySelector("form");

const formErorr = document.querySelector("#form-error");
const usrnError = document.querySelector("#username-error");
const emailError = document.querySelector("#email-error");
const pwdError = document.querySelector("#pwd-error");
const confirmPwdError = document.querySelector("#confirm-pwd-error");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  [formError, usrnError, emailError, pwdError, confirmPwdError].forEach((el) => el && (el.textContent = ""));

  const data = new FormData(form);

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const wr = /\s/;

  const regName = data.get("username");
  const regEmail = data.get("email");
  const regPWD = data.get("pwd");
  const regConfirmPWD = data.get("confirm_pwd");

  if (!regName || !regEmail || !regPWD || !regConfirmPWD) {
    if (formError) formError.textContent = "Please fill in all fields.";
    return;
  }

  if (wr.test(regName) || wr.test(regEmail) || wr.test(regPWD)) {
    if (formError) formError.textContent = "Fields must not contain spaces.";
    return;
  }

  if (regName.length < 6 || regName.length > 20) {
    if (usrnError) usrnError.textContent = "Username must be 6-20 characters.";
    return;
  }

  if (!emailRegex.test(regEmail)) {
    if (emailError) emailError.textContent = "Please enter a valid email address.";
    return;
  }

  if (regPWD !== regConfirmPWD) {
    if (confirmPwdError) confirmPwdError.textContent = "Passwords do not match.";
    return;
  }

  if (regPWD.length < 8 || regPWD.length > 20) {
    if (pwdError) pwdError.textContent = "Password must be 8-20 characters.";
    return;
  }

  try {
    const response = await fetch("/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: data,
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (formError) formError.textContent = errorText;
      return;
    }

    window.location.href = "login";
  } catch (error) {
    console.error(error.message);
    if (formError) formError.textContent = "Unable to connect to server";
  }
});

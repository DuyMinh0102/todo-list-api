const form = document.querySelector("form");

const formError = document.querySelector("#form-error");
const usrnError = document.querySelector("#username-error");
const emailError = document.querySelector("#email-error");
const pwdError = document.querySelector("#pwd-error");
const confirmPwdError = document.querySelector("#confirm-pwd-error");

function changeElementContent(targetElement, content){
  if (targetElement) targetElement.textContent = content;
}

function sleep(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  [formError, usrnError, emailError, pwdError, confirmPwdError].forEach((el) => changeElementContent(el, ""));

  const data = new URLSearchParams(new FormData(form));

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const wr = /\s/;

  const regName = data.get("username");
  const regEmail = data.get("email");
  const regPWD = data.get("pwd");
  const regConfirmPWD = data.get("confirm_pwd");

  if (!regName || !regEmail || !regPWD || !regConfirmPWD) {
    changeElementContent(formError, "Please fill in all fields");
    return;
  }

  if (wr.test(regName) || wr.test(regEmail) || wr.test(regPWD)) {
    changeElementContent(formError, "Fields must not contain spaces");
    return;
  }

  if (regName.length < 6 || regName.length > 20) {
    changeElementContent(usrnError, "Username must be 6-20 characters.");
    return;
  }

  if (!emailRegex.test(regEmail)) {
    changeElementContent(emailError, "Please enter a valid email address.");
    return;
  }

  if (regPWD !== regConfirmPWD) {
    changeElementContent(confirmPwdError, "Passwords do not match.");
    return;
  }

  if (regPWD.length < 8 || regPWD.length > 20) {
    changeElementContent(pwdError, "Password must be 8-20 characters.");
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
      changeElementContent(formError, errorText);
      return;
    }

    let seconds = 3;
    const renderSuccessPage = () => {
      document.body.innerHTML = `
      <div style="text-align: center; margin-top: 50px; font-family: sans-serif;">
        <h2>Registration complete</h2>
        <p>Redirecting to login page in <strong>${seconds}</strong> seconds...</p>
      </div>
    `;
    };

    renderSuccessPage();

    const timer = setInterval(() => {
      --seconds;
      if (seconds > 0) renderSuccessPage();
      else {
        clearInterval(timer);
        window.location.href = "/login";
      }
    }, 1000);
  } catch (error) {
    console.error(error.message);
    changeElementContent(formError, "Unable to connect to server");
  }
});

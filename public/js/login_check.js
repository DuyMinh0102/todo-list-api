const form = document.querySelector("form");
const formError = document.querySelector("#form-error");

function changeContent(targetElement, content) {
  if (targetElement) targetElement.textContent = content;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  changeContent(formError, "");

  const data = new URLSearchParams(new FormData(form));

  const regName = data.get("username");
  const regPWD = data.get("pwd");

  console.log(regName, regPWD);

  if (!regName || !regPWD) {
    changeContent(formError, "Please fill in all fields.");
    return;
  }

  try {
    const response = await fetch("/login", {
      method: "POST",
      headers: {
        "content-Type": "application/x-www-form-urlencoded",
      },
      body: data,
    });

    if (!response.ok) {
      const errorText = await response.text();
      changeContent(formError, errorText);
      return;
    }

    let seconds = 3;
    const renderSuccessPage = () => {
      document.body.innerHTML = `
      <div style="text-align: center; margin-top: 50px; font-family: sans-serif;">
        <h2>Login successfully</h2>
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
        window.location.href = "/home";
      }
    }, 1000);
  } catch (error) {
    console.error(error.message);
    changeContent(formError, "Unable to connect to server.");
  }
});

const form = document.querySelector("form");
const formError = document.querySelector("#form-error");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (formError) formError.textContent = "";

  const data = new URLSearchParams(new FormData(form));

  const regName = data.get("username");
  const regPWD = data.get("pwd");

  console.log(regName, regPWD);

  if (!regName || !regPWD) {
    if (formError) formError.textContent = "Pleaes fill in all fields.";
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
      if (formError) formError.textContent = errorText;
      return;
    }

    window.location.href = "home";
  } catch (error) {
    console.error(error.message);
    if (formError) formError.textContent = "Unable to connect to server";
  }
});

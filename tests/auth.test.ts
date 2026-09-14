import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { deleteUserCascade } from "../src/database.ts";
import { setCookieHeader, getSessionCookie, createForm, sendAuthReq } from "../src/test_helper.ts";

function cleanupTestData() {
  try {
    deleteUserCascade("aValidUsername");
    deleteUserCascade("testuser_01");
    deleteUserCascade("testuser_02");
  } catch (err) {}
}

before(() => {
  cleanupTestData();
});

async function checkMatching(
  method: string,
  data: string,
  url: string,
  targetStatus: number,
  targetResText: string,
  cookie: string = "",
) {
  const res = await sendAuthReq(url, method, cookie, data);
  const resText = await res.text();

  assert.strictEqual(res.status, targetStatus);
  if (targetResText !== undefined) assert.strictEqual(resText, targetResText);

  const setCookie = res.headers.get("set-cookie");
  if (setCookie) setCookieHeader.value = setCookie;
}

describe("POST /register", () => {
  const currentTestingURL = "http://localhost:3000/register";

  it("should return 200 OK with valid registration form", async () => {
    const validUserData = createForm({
      username: "aValidUsername",
      email: "a100%validemail@gmail.com",
      pwd: "aVeryVeryValidPWD",
      confirm_pwd: "aVeryVeryValidPWD",
    });

    await checkMatching(
      "POST",
      validUserData,
      currentTestingURL,
      200,
      "Registration completed, redirecting to login page in 3 seconds...",
    );
  });

  it("should return 400 Bad Request when received incomplete payload", async () => {
    const incompletePayload = createForm({
      username: "testuser_01",
      email: "",
      pwd: "thisisuser01pwd",
      confirm_pwd: "thisisuser01pwd",
    });

    await checkMatching("POST", incompletePayload, currentTestingURL, 400, "Please fill in all fields.");
  });

  it("should return 400 Bad Request when pwd !== confirm_pwd", async () => {
    const pwdNotMatch = createForm({
      username: "testuser_02",
      email: "user02email@gmail.com",
      pwd: "thisisuser02pwd",
      confirm_pwd: "thisisuserO2pwd",
    });

    await checkMatching("POST", pwdNotMatch, currentTestingURL, 400, "Confirm password does not match");
  });

  it("should return 409 Conflict when registering with an existing username", async () => {
    const thisGuyRegisteredWithExistedUsername = createForm({
      username: "aValidUsername",
      email: "aValidEmail_@gmail.com",
      pwd: "validPWD___",
      confirm_pwd: "validPWD___",
    });

    await checkMatching(
      "POST",
      thisGuyRegisteredWithExistedUsername,
      currentTestingURL,
      409,
      "Username already exists.",
    );
  });
});

describe("POST /login", () => {
  const currentTestingURL = "http://localhost:3000/login";

  it("should return 200 OK when a valid login form is sent", async () => {
    const validUserLogin = createForm({
      username: "aValidUsername",
      pwd: "aVeryVeryValidPWD",
    });

    await checkMatching(
      "POST",
      validUserLogin,
      currentTestingURL,
      200,
      "Login successfully, redirecting to homepage in 3 seconds...",
    );
  });

  it("should return 400 Bad Request when form received has empty field", async () => {
    const emptyFieldLoginForm = createForm({
      username: "aValidUsername",
      pwd: "",
    });

    await checkMatching("POST", emptyFieldLoginForm, currentTestingURL, 400, "Username and Password are required.");
  });

  it("should return 401 Unauthorized when logging in using a non-existent username", async () => {
    const nonexistentUser = createForm({
      username: "aValidUsername_ButDoesntExists",
      pwd: "nonexistentPWD",
    });

    await checkMatching("POST", nonexistentUser, currentTestingURL, 401, "Unauthorized.");
  });

  it("should return 401 Unauthorized when logging in with wrong password", async () => {
    const wrongPWDUser = createForm({
      username: "aValidUsername",
      pwd: "wrongPWDBTW",
    });

    await checkMatching("POST", wrongPWDUser, currentTestingURL, 401, "Wrong password.");
  });
});

describe("DELETE /remove-session", () => {
  const currentTestingURL = "http://localhost:3000/remove-session";

  it("should return 401 Unauthorized when calling logout without a cookie", async () => {
    await checkMatching("DELETE", "", currentTestingURL, 401, "Already logged out or unauthorized.", "");
  });

  it("should return 401 Unauthorized when providing a fake or malformed session cookie", async () => {
    const fakeCookie = "session_id=fake_non_existent_session_12345";

    await checkMatching("DELETE", "", currentTestingURL, 401, "Unauthorized. Invalid session.", fakeCookie);
  });

  it("should return 200 OK when logging out and invalidating the session", async () => {
    const logoutRes = await sendAuthReq(currentTestingURL, "DELETE", getSessionCookie());
    assert.strictEqual(logoutRes.status, 200);

    const retryRes = await sendAuthReq("http://localhost:3000/tasks", "GET", getSessionCookie());
    assert.strictEqual(retryRes.status, 401);
  });
});

after(() => {
  cleanupTestData();
});

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { deleteUserCascade } from "../src/database.ts";

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

let setCookieHeader = "";

function getSessionCookie(): string {
  return setCookieHeader ? setCookieHeader.split(";")[0] : "";
}

function createForm(fields: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    params.append(key, value);
  }
  return params.toString();
}

async function sendForm(method: string, data: string, relativeURL: string): Promise<Response> {
  return fetch(relativeURL, {
    method,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: data,
  });
}

async function sendAuthReq(url: string, method: string, sessionCookie: string, data?: string): Promise<Response> {
  const headers: Record<string, string> = {};

  if (sessionCookie) {
    headers["Cookie"] = sessionCookie;
  }
  if (data) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  return fetch(url, {
    method,
    headers,
    body: data,
  });
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

    const res = await sendForm("POST", validUserData, currentTestingURL);
    const resText = await res.text();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(resText, "Registration completed, redirecting to login page in 3 seconds...");
  });

  it("should return 400 Bad Request when received incomplete payload", async () => {
    const incompletePayload = createForm({
      username: "testuser_01",
      email: "",
      pwd: "thisisuser01pwd",
      confirm_pwd: "thisisuser01pwd",
    });

    const res = await sendForm("POST", incompletePayload, currentTestingURL);
    const resText = await res.text();

    assert.strictEqual(res.status, 400);
    assert.strictEqual(resText, "Please fill in all fields.");
  });

  it("should return 400 Bad Request when pwd !== confirm_pwd", async () => {
    const pwdNotMatch = createForm({
      username: "testuser_02",
      email: "user02email@gmail.com",
      pwd: "thisisuser02pwd",
      confirm_pwd: "thisisuserO2pwd",
    });

    const res = await sendForm("POST", pwdNotMatch, currentTestingURL);
    const resText = await res.text();

    assert.strictEqual(res.status, 400);
    assert.strictEqual(resText, "Confirm password does not match");
  });

  it("should return 409 Conflict when registering with an existing username", async () => {
    const thisGuyRegisteredWithExistedUsername = createForm({
      username: "aValidUsername",
      email: "aValidEmail_@gmail.com",
      pwd: "validPWD___",
      confirm_pwd: "validPWD___",
    });

    const res = await sendForm("POST", thisGuyRegisteredWithExistedUsername, currentTestingURL);
    const resText = await res.text();

    assert.strictEqual(res.status, 409);
    assert.strictEqual(resText, "Username already exists.");
  });
});

describe("POST /login", () => {
  const currentTestingURL = "http://localhost:3000/login";

  it("should return 200 OK when a valid login form is sent", async () => {
    const validUserLogin = createForm({
      username: "aValidUsername",
      pwd: "aVeryVeryValidPWD",
    });

    const res = await sendForm("POST", validUserLogin, currentTestingURL);
    const resText = await res.text();
    const cookieHeader = res.headers.get("set-cookie");

    if (cookieHeader) setCookieHeader = cookieHeader;

    assert.strictEqual(res.status, 200);
    assert.ok(cookieHeader && cookieHeader.includes("session_id="), "Expected session_id cookie in response.");
    assert.strictEqual(resText, "Login successfully, redirecting to homepage in 3 seconds...");
  });

  it("should return 400 Bad Request when form received has empty field", async () => {
    const emptyFieldLoginForm = createForm({
      username: "aValidUsername",
      pwd: "",
    });

    const res = await sendForm("POST", emptyFieldLoginForm, currentTestingURL);
    const resText = await res.text();

    assert.strictEqual(res.status, 400);
    assert.strictEqual(resText, "Username and Password are required.");
  });

  it("should return 401 Unauthorized when logging in using a non-existent username", async () => {
    const nonexistentUser = createForm({
      username: "aValidUsername_ButDoesntExists",
      pwd: "nonexistentPWD",
    });

    const res = await sendForm("POST", nonexistentUser, currentTestingURL);
    const resText = await res.text();

    assert.strictEqual(res.status, 401);
    assert.strictEqual(resText, "Unauthorized.");
  });

  it("should return 401 Unauthorized when logging in with wrong password", async () => {
    const wrongPWDUser = createForm({
      username: "aValidUsername",
      pwd: "wrongPWDBTW",
    });

    const res = await sendForm("POST", wrongPWDUser, currentTestingURL);
    const resText = await res.text();

    assert.strictEqual(res.status, 401);
    assert.strictEqual(resText, "Wrong password.");
  });
});

describe("DELETE /remove-session", () => {
  const currentTestingURL = "http://localhost:3000/remove-session";

  it("should return 401 Unauthorized when calling logout without a cookie", async () => {
    const res = await sendAuthReq(currentTestingURL, "DELETE", "");
    const resText = await res.text();

    assert.strictEqual(res.status, 401);
    assert.strictEqual(resText, "Already logged out or unauthorized.");
  });

  it("should return 401 Unauthorized when providing a fake or malformed session cookie", async () => {
    const fakeCookie = "session_id=fake_non_existent_session_12345";
    const res = await sendAuthReq(currentTestingURL, "DELETE", fakeCookie);

    assert.strictEqual(res.status, 401);
  });

  it("should return 200 OK when requesting tasks with a valid session cookie", async () => {
    const res = await sendAuthReq("http://localhost:3000/tasks", "GET", getSessionCookie());

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(await res.json()));
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

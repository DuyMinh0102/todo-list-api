import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { deleteUserCascade } from "../src/database.ts";
import { createForm, sendAuthReq } from "../src/test_helper.ts";

function cleanupTestData() {
  try {
    deleteUserCascade("user_01");
    deleteUserCascade("user_02");
  } catch (err) {}
}

function getCookie(res: Response): string {
  const header = res.headers.get("set-cookie");
  return header ? header.split(";")[0] : "";
}

const BASEURL = "http://localhost:3000";

let user1Cookie = "";
let user2Cookie = "";
let createdTaskId: number;

async function checkMatching({
  url,
  method = "POST",
  data = "",
  cookie = "",
  status,
  targetText,
}: {
  url: string;
  method?: string;
  data?: string;
  cookie?: string;
  status: number;
  targetText?: string;
}) {
  const res = await sendAuthReq(url, method, cookie, data);
  const resText = await res.text();

  assert.strictEqual(res.status, status);

  if (targetText !== undefined) {
    assert.strictEqual(resText, targetText);
  }

  return res;
}

before(async () => {
  cleanupTestData();

  const User01 = createForm({
    username: "user_01",
    email: "fakeuser01@notamail.com",
    pwd: "user01pwd",
    confirm_pwd: "user01pwd",
  });

  const User02 = createForm({
    username: "user_02",
    email: "fakeuser02@notamail.com",
    pwd: "user02pwd",
    confirm_pwd: "user02pwd",
  });

  const registerURL = `${BASEURL}/register`;
  const loginURL = `${BASEURL}/login`;

  await sendAuthReq(registerURL, "POST", "", User01);
  await sendAuthReq(registerURL, "POST", "", User02);

  const logUser1 = await sendAuthReq(loginURL, "POST", "", User01);
  const logUser2 = await sendAuthReq(loginURL, "POST", "", User02);

  user1Cookie = getCookie(logUser1);
  user2Cookie = getCookie(logUser2);
});

describe("POST /add-task", () => {
  const currentTestingURL = `${BASEURL}/add-task`;

  it("should return 413 Payload too large if the request's data size is too large", async () => {
    const veryLargeBody = createForm({
      title: "large data",
      description: "a".repeat(1_000_100),
    });

    await checkMatching({
      url: currentTestingURL,
      data: veryLargeBody,
      cookie: user1Cookie,
      status: 413,
      targetText: "Payload too large.",
    });
  });

  it("should return 400 Title is required when trying to add a task with no title", async () => {
    const bodyWithoutTitle = createForm({
      title: "",
      description: "titleless",
    });

    await checkMatching({
      url: currentTestingURL,
      data: bodyWithoutTitle,
      cookie: user1Cookie,
      status: 400,
      targetText: "Title is required.",
    });
  });

  const bodySample = createForm({
    title: "thisIsTheTitle",
    description: "thisIsTheDesc",
  });

  it("should return 401 Unauthorized: Missing session cookie when trying to add a task without session id", async () => {
    await checkMatching({
      url: currentTestingURL,
      data: bodySample,
      status: 401,
      targetText: "Unauthorized: Missing session cookie.",
    });
  });

  it("should return 401 Unauthorized: Invalid or expired session when session is fake", async () => {
    const fakeCookie = "session_id=fake_non_existent_session_12345";

    await checkMatching({
      url: currentTestingURL,
      data: bodySample,
      cookie: fakeCookie,
      status: 401,
      targetText: "Unauthorized: Invalid or expired session.",
    });
  });

  it("should return 201 Task added successfully when request is valid", async () => {
    await checkMatching({
      url: currentTestingURL,
      data: bodySample,
      cookie: user1Cookie,
      status: 201,
      targetText: "Task added successfully.",
    });
  });
});

describe("GET /tasks", () => {
  const currentTestingURL = `${BASEURL}/tasks`;

  it("should return 401 Unauthorized JSON response when no session id is provided", async () => {
    const res = await sendAuthReq(currentTestingURL, "GET", "");
    assert.strictEqual(res.status, 401);

    const body = await res.json();
    assert.deepStrictEqual(body, { error: "Unauthorized." });
  });

  it("should return 401 Unauthorized JSON response when an invalid session is given", async () => {
    const fakeCookie = "session_id=fake_non_existent_session_12345";
    const res = await sendAuthReq(currentTestingURL, "GET", fakeCookie);
    assert.strictEqual(res.status, 401);

    const body = await res.json();
    assert.deepStrictEqual(body, { error: "Unauthorized: Invalid or expired session." });
  });

  it("should return 200 OK and tasks array for user_01", async () => {
    const res = await sendAuthReq(currentTestingURL, "GET", user1Cookie);
    assert.strictEqual(res.status, 200);

    const tasks = await res.json();
    assert.ok(Array.isArray(tasks));
    assert.strictEqual(tasks.length, 1);
    assert.strictEqual(tasks[0].title, "thisIsTheTitle");

    createdTaskId = tasks[0].id;
  });

  it("should return 200 OK with empty array for user_02", async () => {
    const res = await sendAuthReq(currentTestingURL, "GET", user2Cookie);
    assert.strictEqual(res.status, 200);

    const tasks = await res.json();
    assert.ok(Array.isArray(tasks));
    assert.strictEqual(tasks.length, 0);
  });
});

describe("PATCH /edit-task/:id", () => {
  it("should return 404 Not Found from router when non-numeric ID is passed", async () => {
    await checkMatching({
      url: `${BASEURL}/edit-task/abc`,
      method: "PATCH",
      cookie: user1Cookie,
      data: createForm({ description: "Updated Desc" }),
      status: 404,
      targetText: "404 Not Found",
    });
  });

  it("should return 401 Unauthorized when missing session cookie", async () => {
    await checkMatching({
      url: `${BASEURL}/edit-task/${createdTaskId}`,
      method: "PATCH",
      data: createForm({ description: "Updated Desc" }),
      status: 401,
      targetText: "Unauthorized.",
    });
  });

  it("should return 404 when user_02 tries to edit user_01's task", async () => {
    await checkMatching({
      url: `${BASEURL}/edit-task/${createdTaskId}`,
      method: "PATCH",
      cookie: user2Cookie,
      data: createForm({ description: "Hacked Desc" }),
      status: 404,
      targetText: "Task not found or you do not have permission to edit it",
    });
  });

  it("should return 200 OK when user_01 updates task description", async () => {
    await checkMatching({
      url: `${BASEURL}/edit-task/${createdTaskId}`,
      method: "PATCH",
      cookie: user1Cookie,
      data: createForm({ description: "Updated Description content" }),
      status: 200,
      targetText: `Task's description updated successfully. ID: ${createdTaskId}`,
    });
  });
});

describe("POST /mark-as-done/:id", () => {
  it("should return 404 Not Found from router when non-numeric ID is passed", async () => {
    await checkMatching({
      url: `${BASEURL}/mark-as-done/invalid`,
      method: "POST",
      cookie: user1Cookie,
      status: 404,
      targetText: "404 Not Found",
    });
  });

  it("should return 401 Unauthorized when missing session cookie", async () => {
    await checkMatching({
      url: `${BASEURL}/mark-as-done/${createdTaskId}`,
      method: "POST",
      status: 401,
      targetText: "Unauthorized.",
    });
  });

  it("should return 404 when user_02 attempts to mark user_01's task as done", async () => {
    await checkMatching({
      url: `${BASEURL}/mark-as-done/${createdTaskId}`,
      method: "POST",
      cookie: user2Cookie,
      status: 404,
      targetText: "Task not found or you do not have permission to mark it",
    });
  });

  it("should return 200 OK when user_01 marks task as completed", async () => {
    await checkMatching({
      url: `${BASEURL}/mark-as-done/${createdTaskId}`,
      method: "POST",
      cookie: user1Cookie,
      status: 200,
      targetText: `Task marked as completed successfully. ID: ${createdTaskId}`,
    });
  });
});

describe("DELETE /delete-task/:id", () => {
  it("should return 404 Not Found from router when non-numeric ID is passed", async () => {
    await checkMatching({
      url: `${BASEURL}/delete-task/not_a_number`,
      method: "DELETE",
      cookie: user1Cookie,
      status: 404,
      targetText: "404 Not Found",
    });
  });

  it("should return 401 Unauthorized when calling delete without cookie", async () => {
    await checkMatching({
      url: `${BASEURL}/delete-task/${createdTaskId}`,
      method: "DELETE",
      status: 401,
      targetText: "Unauthorized.",
    });
  });

  it("should return 404 when user_02 tries to delete user_01's task", async () => {
    await checkMatching({
      url: `${BASEURL}/delete-task/${createdTaskId}`,
      method: "DELETE",
      cookie: user2Cookie,
      status: 404,
      targetText: "Task not found or you do not have permission to delete it",
    });
  });

  it("should return 200 OK when user_01 deletes their task", async () => {
    await checkMatching({
      url: `${BASEURL}/delete-task/${createdTaskId}`,
      method: "DELETE",
      cookie: user1Cookie,
      status: 200,
      targetText: `Task deleted successfully. ID: ${createdTaskId}`,
    });
  });

  it("should return 404 Not Found when attempting to delete an already deleted task", async () => {
    await checkMatching({
      url: `${BASEURL}/delete-task/${createdTaskId}`,
      method: "DELETE",
      cookie: user1Cookie,
      status: 404,
      targetText: "Task not found or you do not have permission to delete it",
    });
  });
});

after(() => {
  cleanupTestData();
});

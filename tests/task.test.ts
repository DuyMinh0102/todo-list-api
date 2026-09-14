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

const BASEURL = "http://localhost:3000";
let user1CookieHeader: string | null, user2CookieHeader: string | null;

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

  const registerURL = BASEURL + "/register";
  const loginURL = BASEURL + "/login";
  await sendAuthReq("POST", User01, registerURL);
  await sendAuthReq("POST", User02, registerURL);

  const log_user1 = await sendAuthReq("POST", User01, loginURL);
  const log_user2 = await sendAuthReq("POST", User02, loginURL);

  user1CookieHeader = log_user1.headers.get("set-cookie");
  user2CookieHeader = log_user2.headers.get("set-cookie");
});

describe("Testing task adding operation", async () => {
  const currentTestingURL = BASEURL + "/add-task";

  it("should return 413 Payload too large if the request's data size is too large", async () => {
    const veryLargeBody = createForm({
      title: "large data",
      description: "a".repeat(1_000_100),
    });

    const res = await sendAuthReq("POST", veryLargeBody, currentTestingURL);
    const resText = await res.text();

    assert.strictEqual(res.status, 413);
    assert.strictEqual(resText, "Payload too large.");
  });

  it("should return 400 Title is required when trying to add a task with no title", async () => {
    const bodyWithoutTitle = createForm({
      title: "",
      description: "titleless",
    });

    const res = await sendAuthReq("POST", bodyWithoutTitle, currentTestingURL);
    const resText = await res.text();

    assert.strictEqual(res.status, 400);
    assert.strictEqual(resText, "Title is required.");
  });

  it("should return 401 Unauthorized: Missing session cookie when trying to add a task without session id", async () => {
    const bodySample = createForm({
      title: "thisIsTheTitle",
      description: "thisIsTheDesc",
    });
    const res = await sendAuthReq(currentTestingURL, "POST", "", bodySample);
    const resText = await res.text();

    assert.strictEqual(res.status, 401);
    assert.strictEqual(resText, "Unauthorized: Missing session cookie.");
  });

  it("should return 401 Unauthorized: Invalid or expired session when trying to add a task without valid session id", async () => {
    const bodySample = createForm({
      title: "thisIsTheTitle",
      description: "thisIsTheDesc",
    });
    const fakeCookie = "session_id=fake_non_existent_session_12345";
    const res = await sendAuthReq(currentTestingURL, "POST", fakeCookie, bodySample);
    const resText = await res.text();

    assert.strictEqual(res.status, 401);
    assert.strictEqual(resText, "Unauthorized: Invalid or expired session.");
  });

  it("should return 201 Task added successfully when a task adding request is valid", async () => {
    const bodySample = createForm({
      title: "thisIsTheTitle",
      description: "thisIsTheDesc",
    });
    let user1Cookie = "";
    if (user1CookieHeader) user1Cookie = user1CookieHeader.split(";")[0];

    const res = await sendAuthReq(currentTestingURL, "POST", user1Cookie, bodySample);
    const resText = await res.text();

    assert.strictEqual(res.status, 201);
    assert.strictEqual(resText, "Task added successfully.");
  });
});

describe("Testing get task operation", async () => {
  const currentTestingURL = BASEURL + "/tasks";

  it("should return 401 Unauthorized when received no session id", async () => {
    const res = await sendAuthReq(currentTestingURL, "GET", "");
    const resText = await res.text();
  });
});

describe("Testing delete task operation", async () => {});

describe("Testing task status marking", async () => {});

describe("Testing task description edit", async () => {});

after(() => {
  cleanupTestData();
});

const BASE = process.env.BASE_URL || "http://localhost:8080";
const TOTAL = 100000000000000;

async function hitLogin(i) {
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: `user${i}`, pwd: "wrong-password" }),
  });
  const text = await res.text();
  console.log(`#${String(i).padStart(2)} -> ${res.status} ${text.slice(0, 60)}`);
}

(async () => {
  for (let i = 1; i <= TOTAL; i++) {
    await hitLogin(i);
  }
})();

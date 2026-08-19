async function checkError() {
  const url = "https://pathumthani-assetflow.pichet-mekim.workers.dev";
  const loginRes = await fetch(`${url}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "admin",
      password: "AssetFlow@2569!"
    })
  });
  console.log("Status:", loginRes.status);
  console.log("Headers:", Object.fromEntries(loginRes.headers.entries()));
  console.log("Body text:", await loginRes.text());
}

checkError();

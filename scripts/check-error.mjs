async function checkError() {
  const url = "https://assetflow.pathumthani.workers.dev";
  const loginRes = await fetch(`${url}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "admin",
      password: "AssetFlow@2569!"
    })
  });
  console.log("Status:", loginRes.status);
  console.log("Body text:", await loginRes.text());
}

checkError();

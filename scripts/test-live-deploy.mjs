async function testLiveUrl() {
  const url = "https://pathumthani-assetflow.pichet-mekim.workers.dev";
  console.log("Testing live URL:", url);
  try {
    const res = await fetch(url);
    console.log("Status:", res.status, res.statusText);
    const html = await res.text();
    console.log("Response preview (first 250 chars):", html.substring(0, 250));
  } catch (err) {
    console.error("Fetch error:", err.message);
  }
}

testLiveUrl();

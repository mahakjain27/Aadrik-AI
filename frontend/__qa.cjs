const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  await page.screenshot({ path: "C:\\Users\\Hp\\AppData\\Local\\Temp\\claude\\c--Users-Hp-OneDrive-Desktop-Aadrik-AI\\e71740bd-d490-4887-b3a6-d0bd4d1e2da4\\scratchpad\\login_resized.png" });

  await browser.close();
})();

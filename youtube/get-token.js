#!/usr/bin/env node

const { google } = require("googleapis");
const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");

const PORT = 34569;
const REDIRECT_URI = `http://localhost:${PORT}`;
const ENV_PATH = path.join(__dirname, ".env.local");

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.force-ssl",
];

async function main() {
  const envContent = fs.readFileSync(ENV_PATH, "utf-8");
  const clientIdMatch = envContent.match(/GOOGLE_CLIENT_ID=(.+)/);
  const clientSecretMatch = envContent.match(/GOOGLE_CLIENT_SECRET=(.+)/);

  if (!clientIdMatch || !clientSecretMatch) {
    console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env.local");
    process.exit(1);
  }

  const clientId = clientIdMatch[1].trim();
  const clientSecret = clientSecretMatch[1].trim();

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.log("\n╔════════════════════════════════════════╗");
  console.log("║  YouTube Auth - Bloomora Labs Channel  ║");
  console.log("╚════════════════════════════════════════╝\n");
  console.log("⚠ Make sure you're logged into the correct Google account!");
  console.log(`\nOpen in browser:\n${authUrl}\n`);

  try {
    const { execSync } = require("child_process");
    const platform = process.platform;
    if (platform === "win32") {
      execSync(`start "" "${authUrl}"`, { stdio: "ignore" });
    } else if (platform === "darwin") {
      execSync(`open "${authUrl}"`, { stdio: "ignore" });
    } else {
      execSync(`xdg-open "${authUrl}"`, { stdio: "ignore" });
    }
  } catch {}

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const parsed = url.parse(req.url, true);
      if (parsed.query.code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h3>✅ Authorization successful! You can close this tab.</h3>");
        server.close();
        resolve(parsed.query.code);
      } else if (parsed.query.error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h3>❌ Error: ${parsed.query.error}</h3>`);
        server.close();
        reject(new Error(parsed.query.error));
      } else {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h3>Waiting for authorization...</h3>");
      }
    });
    server.listen(PORT, () => {
      console.log(`Listening for callback on http://localhost:${PORT}...`);
    });
  });

  const { tokens } = await oauth2Client.getToken(code);
  console.log(`\n✅ Refresh token: ${tokens.refresh_token}\n`);

  const updated = envContent.replace(
    /GOOGLE_REFRESH_TOKEN=.*/,
    `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`
  );
  fs.writeFileSync(ENV_PATH, updated);
  console.log("✓ Written to youtube/.env.local");
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});

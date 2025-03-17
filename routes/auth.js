/***************************************************
 * routes/auth.js
 **************************************************/
const express = require("express");
const router = express.Router();
const axios = require("axios");

// Grab environment variables
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const TENANT_ID = process.env.TENANT_ID;
// Fallback to local redirect if not set
const REDIRECT_URI = process.env.REDIRECT_URI || "http://localhost:8080/auth/callback";

// GET /auth/login
router.get("/login", (req, res) => {
  if (!TENANT_ID) {
    console.error("❌ TENANT_ID is missing! Did you set it in .env or secrets?");
    return res.send("Tenant ID is undefined. Cannot proceed.");
  }

  const authUrl =
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?` +
    `client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&response_mode=query` +
    `&scope=Tasks.Read Group.Read.All Calendars.Read Calendars.Read.Shared offline_access`;

  console.log("🔗 Redirecting to Microsoft Login:", authUrl);
  res.redirect(authUrl);
});

// GET /auth/callback
router.get("/callback", async (req, res) => {
  const code = req.query.code;
  try {
    console.log("🔑 Received authorization code:", code);

    // Exchange code for token
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    // Store token in session
    req.session.accessToken = tokenResponse.data.access_token;
    console.log("✅ Access token obtained:", req.session.accessToken);

    res.redirect("/");
  } catch (error) {
    console.error("❌ Authentication failed:", error.message);
    res.send("Authentication failed");
  }
});

module.exports = router;

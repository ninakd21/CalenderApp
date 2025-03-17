/***************************************************
 * routes/schedule.js
 **************************************************/
const express = require("express");
const router = express.Router();
const axios = require("axios");

// GET /schedule
router.get("/", async (req, res) => {
    if (!req.session.accessToken) {
        return res.redirect("/auth/login");
    }
    try {
        // Fetch user calendars
        const calendarsResponse = await axios.get("https://graph.microsoft.com/v1.0/me/calendars", {
            headers: { Authorization: `Bearer ${req.session.accessToken}` }
        });
        const calendars = calendarsResponse.data.value;

        // For each calendar, fetch events, etc. (Truncated for brevity)

        // Render schedule.ejs
        res.render("schedule", {
            title: "Schedule",
            calendars
            // plus any events you fetched
        });
    } catch (error) {
        console.error("❌ Error fetching schedule:", error.message);
        res.send("Failed to fetch calendar from Microsoft.");
    }
});

module.exports = router;

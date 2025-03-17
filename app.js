/***************************************************
 * app.js
 ***************************************************/
// 1) Load environment variables from .env (for local use)
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");
const axios = require("axios");
const authRoutes = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(session({
  secret: "secret-key",
  resave: false,
  saveUninitialized: true,
}));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));

// /auth routes for MS login
app.use("/auth", authRoutes);

app.get("/", async (req, res) => {
  if (!req.session.accessToken) {
    return res.redirect("/auth/login");
  }

  try {
    // 1) Fetch tasks
    const tasksRes = await axios.get("https://graph.microsoft.com/v1.0/me/planner/tasks", {
      headers: { Authorization: `Bearer ${req.session.accessToken}` }
    });
    const tasks = tasksRes.data.value || [];

    // 2) Fetch plans
    const plansRes = await axios.get("https://graph.microsoft.com/v1.0/me/planner/plans", {
      headers: { Authorization: `Bearer ${req.session.accessToken}` }
    });
    const plans = plansRes.data.value || [];
    const workPlan = plans.find(p => p.title.toLowerCase().includes("work")) || { id: "fake-work" };
    const personalPlan = plans.find(p => p.title.toLowerCase().includes("personal")) || { id: "fake-personal" };

    // 3) For each plan, fetch buckets
    // We'll build a bucketMap keyed by bucketId
    const bucketMap = {};
    for (const plan of plans) {
      // GET /planner/plans/{planId}/buckets to get buckets for this plan
      const bucketsRes = await axios.get(`https://graph.microsoft.com/v1.0/planner/plans/${plan.id}/buckets`, {
        headers: { Authorization: `Bearer ${req.session.accessToken}` }
      });
      const buckets = bucketsRes.data.value || [];
      buckets.forEach(bucket => {
        // Example: bucketMap["bucketId"] = { name: "To Do", planId: "..." }
        bucketMap[bucket.id] = { name: bucket.name, planId: bucket.planId };
      });
    }

    // 4) Attach bucketName to each task
    tasks.forEach(task => {
      if (bucketMap[task.bucketId]) {
        task.bucketName = bucketMap[task.bucketId].name;
      } else {
        task.bucketName = "UnknownBucket";
      }
    });

    // 5) Fetch calendars & build calendarEvents as before
    const calRes = await axios.get("https://graph.microsoft.com/v1.0/me/calendars", {
      headers: { Authorization: `Bearer ${req.session.accessToken}` }
    });
    const calendars = calRes.data.value || [];
    const calendarEvents = {};
    for (let cal of calendars) {
      const eventsRes = await axios.get(`https://graph.microsoft.com/v1.0/me/calendars/${cal.id}/events`, {
        headers: { Authorization: `Bearer ${req.session.accessToken}` }
      });
      calendarEvents[cal.id] = eventsRes.data.value || [];
    }

    // 6) Render home.ejs
    res.render("home", {
      title: "Dashboard",
      tasks,
      workPlan,
      personalPlan,
      calendars,
      calendarEvents
    });
  } catch (error) {
    console.error("Failed to fetch tasks or events:", error.message);
    res.send("Failed to fetch tasks or events from Microsoft Graph.");
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

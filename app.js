/***************************************************
 * app.js
 ***************************************************/
// 1) Load environment variables from .env
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
    let rawPlans = plansRes.data.value || [];
    console.log("All Plans from Graph", JSON.stringify(rawPlans, null, 2));

    // Filter to keep only the ones with exactly the titles we want
    let plans = rawPlans.filter(plan =>
      plan.title === "Work Plan" || plan.title === "Personal Plan" || plan.title === "School Plan"
    );

    // Map each plan to add displayName and dataPlanType
    plans = plans.map(plan => {
      if (plan.title === "Work Plan") {
        return {
          ...plan,
          displayName: plan.title,
          dataPlanType: "work"
        };
      } else if (plan.title === "Personal Plan") {
        return {
          ...plan,
          displayName: "Personal Plan",
          dataPlanType: "personal"
        };
      } else {
        // Must be "School Plan"
        return {
          ...plan,
          displayName: "School Plan",
          dataPlanType: "school"
        };
      }
    });
    

    // 3) For each plan, fetch buckets
    const bucketMap = {};
    for (const plan of plans) {
      const bucketsRes = await axios.get(`https://graph.microsoft.com/v1.0/planner/plans/${plan.id}/buckets`, {
        headers: { Authorization: `Bearer ${req.session.accessToken}` }
      });
      const buckets = bucketsRes.data.value || [];
      buckets.forEach(bucket => {
        bucketMap[bucket.id] = { name: bucket.name, planId: bucket.planId };
      });
    }

    // 4) Attach bucketName to each task
    // Attach bucketName and dataTaskType to each task
    tasks.forEach(task => {
      // Set bucketName as before
      if (bucketMap[task.bucketId]) {
        task.bucketName = bucketMap[task.bucketId].name;
      } else {
        task.bucketName = "UnknownBucket";
      }
      // Find the matching plan from your plans array
      const matchingPlan = plans.find(plan => plan.id === task.planId);
      // If a matching plan is found, use its dataPlanType; otherwise, default to "personal"
      task.dataTaskType = matchingPlan ? matchingPlan.dataPlanType : "school";
    });


    // 1) Get all calendars
    const calRes = await axios.get("https://graph.microsoft.com/v1.0/me/calendars", {
      headers: { Authorization: `Bearer ${req.session.accessToken}` }
    });
    let rawCalendars = calRes.data.value || [];
    console.log("All Outlook Calendars from Graph:", JSON.stringify(rawCalendars, null, 2));

    // 2) Filter to keep only the ones named "Calendar", "Personal", or "School"
    let calendars = rawCalendars.filter(cal =>
      cal.name === "Calendar" || cal.name === "Personal" || cal.name === "School"
    );

    // 3) Rename them and set dataCalendarType
    calendars = calendars.map(cal => {
      if (cal.name === "Calendar") {
        return {
          ...cal,
          displayName: "Work Calendar",
          dataCalendarType: "work"
        };
      } else if (cal.name === "Personal") {
        return {
          ...cal,
          displayName: "Personal Calendar",
          dataCalendarType: "personal"
        };

      } else {
        // Must be "School"
        return {
          ...cal,
          displayName: "School Calendar",
          dataCalendarType: "school"
        };
      }
    });


    // 6) For each kept calendar, get events
    const calendarEvents = {};
    for (let cal of calendars) {
      const eventsRes = await axios.get(`https://graph.microsoft.com/v1.0/me/calendars/${cal.id}/events`, {
        headers: { Authorization: `Bearer ${req.session.accessToken}` }
      });
      calendarEvents[cal.id] = eventsRes.data.value || [];
    }

    // 7) Render home.ejs
    res.render("home", {
      title: "Dashboard",
      tasks,
      plans,
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

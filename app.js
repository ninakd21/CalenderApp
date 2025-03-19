// 1) Load environment variables from .env
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");
const axios = require("axios");
const authRoutes = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 8080;

// Determine environment from .env variable; default to production
const ENVIRONMENT = process.env.ENVIRONMENT || 'production';
// Set BASE_URL: if local, use localhost; otherwise, use BASE_URL from env or default production URL.
const BASE_URL = ENVIRONMENT === 'local'
  ? `http://localhost:${PORT}`
  : (process.env.BASE_URL || 'https://newly-347716.wl.r.appspot.com');

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
    // Redirect using the BASE_URL so that when deployed, it uses prod URL
    return res.redirect(`${BASE_URL}/auth/login`);
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
    // console.log("All Plans from Graph", JSON.stringify(rawPlans, null, 2));

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

    // 3) Fetch all available buckets per plan type
    const bucketMap = {};
    const planBuckets = {}; // Store buckets categorized by plan type

    for (const plan of plans) {
      const bucketsRes = await axios.get(`https://graph.microsoft.com/v1.0/planner/plans/${plan.id}/buckets`, {
        headers: { Authorization: `Bearer ${req.session.accessToken}` }
      });

      const buckets = bucketsRes.data.value || [];

      // Store bucket information
      planBuckets[plan.dataPlanType] = planBuckets[plan.dataPlanType] || [];
      buckets.forEach(bucket => {
        bucketMap[bucket.id] = { name: bucket.name, planId: bucket.planId };
        planBuckets[plan.dataPlanType].push(bucket.name);
      });
    }

    console.log("Plan Buckets Data:", JSON.stringify(planBuckets, null, 2));

    // 4) Now that we have `bucketMap`, update tasks with their bucket names
    tasks.forEach(task => {
      if (bucketMap[task.bucketId]) {
        task.bucketName = bucketMap[task.bucketId].name;
      } else {
        task.bucketName = "Unknown Bucket"; // More readable fallback
      }

      // Ensure task has a valid plan type
      const matchingPlan = plans.find(plan => plan.id === task.planId);
      task.dataTaskType = matchingPlan ? matchingPlan.dataPlanType : "unknown";

      console.log(`Task: ${task.title}, Bucket: ${task.bucketName}, Type: ${task.dataTaskType}`);
    });



    // 5) Get all calendars
    const calRes = await axios.get("https://graph.microsoft.com/v1.0/me/calendars", {
      headers: { Authorization: `Bearer ${req.session.accessToken}` }
    });
    let rawCalendars = calRes.data.value || [];
    // console.log("All Outlook Calendars from Graph:", JSON.stringify(rawCalendars, null, 2));

    // 6) Filter to keep only the ones named "Calendar", "Personal", or "School"
    let calendars = rawCalendars.filter(cal =>
      cal.name === "Calendar" || cal.name === "Personal" || cal.name === "School"
    );

    // 7) Rename them and set dataCalendarType
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
        return {
          ...cal,
          displayName: "School Calendar",
          dataCalendarType: "school"
        };
      }
    });

    // 8) For each kept calendar, get events
    const calendarEvents = {};
    for (let cal of calendars) {
      const eventsRes = await axios.get(`https://graph.microsoft.com/v1.0/me/calendars/${cal.id}/events`, {
        headers: { Authorization: `Bearer ${req.session.accessToken}` }
      });
      calendarEvents[cal.id] = eventsRes.data.value || [];
    }

    // 9) Render home.ejs
    res.render("home", {
      title: "Dashboard",
      tasks,
      plans,
      calendars,
      calendarEvents,
      planBuckets: planBuckets || {}
    });
  } catch (error) {
    console.error("Failed to fetch tasks or events:", error.message);
    res.send("Failed to fetch tasks or events from Microsoft Graph.");
  }
});


app.listen(PORT, () => {
  console.log(`✅ Server running on ${BASE_URL}`);
});

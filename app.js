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


// Route for dynamically switching partials
// Route for dynamically loading task partials
app.get("/partials/:view", async (req, res) => {
  const { view } = req.params;

  if (view === "tasks" || view === "threedaystasks") {
    try {
      console.log(`🔄 Reloading Data for View: ${view}`);

      // 1) Fetch Tasks Again
      const tasksRes = await axios.get(
        "https://graph.microsoft.com/v1.0/me/planner/tasks",
        {
          headers: { Authorization: `Bearer ${req.session.accessToken}` },
        }
      );

      let tasks = tasksRes.data.value || [];
      tasks = tasks.map(task => ({
        ...task,
        dueDate: task.dueDateTime
          ? new Date(task.dueDateTime).toISOString().split("T")[0]
          : null,
        completed: task.percentComplete === 100,
      }));

      console.log("✅ Reloaded Tasks with Due Dates:", tasks);

      // 2) Fetch Plans Again (Ensure Plans Are Updated)
      const plansRes = await axios.get(
        "https://graph.microsoft.com/v1.0/me/planner/plans",
        {
          headers: { Authorization: `Bearer ${req.session.accessToken}` },
        }
      );
      // Define all acceptable school plan titles (original plus 3 additional)
      const SCHOOL_PLAN_TITLES = [
        "School Plan",
        "School Plan - DIT8210 IT Ldrs as Partners Strat Plng",       // Additional plan 1
        "School Plan - TS8535 System & App Security Advances",    // Additional plan 2
        "School Plan - RSCH7864 Quant Design and Analysis"     // Additional plan 3
      ];
      let rawPlans = plansRes.data.value || [];
      let plans = rawPlans.filter(plan => {
        return plan.title === "Work Plan" ||
               plan.title === "Personal Plan" ||
               SCHOOL_PLAN_TITLES.includes(plan.title);
      }).map(plan => ({
        ...plan,
        displayName: plan.title === "Work Plan" 
          ? "Work Plan" 
          : plan.title === "Personal Plan" 
            ? "Personal Plan" 
            : "School Plan", // Roll up all School plans to a single label
        dataPlanType: plan.title === "Work Plan" 
          ? "work" 
          : plan.title === "Personal Plan" 
            ? "personal" 
            : "school"
      }));

      console.log("✅ Reloaded Plans:", plans);

      // 3) Fetch Buckets Again (Ensure Buckets Are Updated)
      const bucketMap = {};
      const planBuckets = {};

      for (const plan of plans) {
        const bucketsRes = await axios.get(
          `https://graph.microsoft.com/v1.0/planner/plans/${plan.id}/buckets`,
          {
            headers: { Authorization: `Bearer ${req.session.accessToken}` },
          }
        );

        let buckets = bucketsRes.data.value || [];
        const validBuckets = [];

        for (const bucket of buckets) {
          const bucketTasksRes = await axios.get(
            `https://graph.microsoft.com/v1.0/planner/buckets/${bucket.id}/tasks`,
            {
              headers: { Authorization: `Bearer ${req.session.accessToken}` },
            }
          );

          const bucketTasks = bucketTasksRes.data.value || [];

          if (bucketTasks.length > 0) {
            bucketMap[bucket.id] = { name: bucket.name, planId: bucket.planId };
            validBuckets.push(bucket.name);
          }
        }

        planBuckets[plan.dataPlanType] = validBuckets;
      }

      console.log("✅ Reloaded Buckets:", planBuckets);

      // 4) Assign Buckets to Tasks
      tasks.forEach(task => {
        task.bucketName = bucketMap[task.bucketId] ? bucketMap[task.bucketId].name : "Unknown Bucket";
        const matchingPlan = plans.find(plan => plan.id === task.planId);
        task.dataTaskType = matchingPlan ? matchingPlan.dataPlanType : "unknown";
      });

      console.log("✅ Reloaded Tasks with Assigned Buckets & Plans:", tasks);

      res.render(`partials/${view}`, {
        tasks: tasks,
        planBuckets: planBuckets, // Ensure buckets are updated
      });

    } catch (error) {
      console.error("❌ Error loading task partial:", error.message);
      res.status(500).send("Error loading tasks.");
    }
  } else {
    res.status(404).send("Partial not found.");
  }
});

// Main Route
app.get("/", async (req, res) => {
  if (!req.session.accessToken) {
    return res.redirect(`${BASE_URL}/auth/login`);
  }

  try {

    // 1) Fetch tasks from Microsoft Planner
    const tasksRes = await axios.get("https://graph.microsoft.com/v1.0/me/planner/tasks", {
      headers: { Authorization: `Bearer ${req.session.accessToken}` }
    });
    let tasks = tasksRes.data.value || [];

    // 2) Process Due Dates & Completion Status
    tasks = tasks.map((task) => ({
      ...task,
      dueDate: task.dueDateTime
        ? new Date(task.dueDateTime).toISOString().split("T")[0]
        : null,
      completed: task.percentComplete === 100,
    }));

    console.log("✅ Processed Tasks with Due Dates:", tasks);


    // 2) Fetch plans
    const plansRes = await axios.get("https://graph.microsoft.com/v1.0/me/planner/plans", {
      headers: { Authorization: `Bearer ${req.session.accessToken}` }
    });
// Define all acceptable school plan titles (original plus additional titles)
const SCHOOL_PLAN_TITLES = [
  "School Plan",
  "School Plan - DIT8210 IT Ldrs as Partners Strat Plng",       // Additional plan 1
  "School Plan - TS8535 System & App Security Advances",         // Additional plan 2
  "School Plan - RSCH7864 Quant Design and Analysis"          // Additional plan 3 (if needed)
];

let rawPlans = plansRes.data.value || [];

let plans = rawPlans.filter(plan => {
  return plan.title === "Work Plan" ||
         plan.title === "Personal Plan" ||
         SCHOOL_PLAN_TITLES.includes(plan.title);
}).map(plan => ({
  ...plan,
  displayName: plan.title === "Work Plan"
    ? "Work Plan"
    : plan.title === "Personal Plan"
      ? "Personal Plan"
      : "School Plan", // Roll up all School plans under a single label
  dataPlanType: plan.title === "Work Plan"
    ? "work"
    : plan.title === "Personal Plan"
      ? "personal"
      : "school"
}));


    // 3) Fetch Buckets per Plan (Only Buckets That Contain Tasks)
    const bucketMap = {};
    const planBuckets = {};

    for (const plan of plans) {
      const bucketsRes = await axios.get(`https://graph.microsoft.com/v1.0/planner/plans/${plan.id}/buckets`, {
        headers: { Authorization: `Bearer ${req.session.accessToken}` }
      });

      let buckets = bucketsRes.data.value || [];

      // Check task count in each bucket
      const validBuckets = [];
      for (const bucket of buckets) {
        const bucketTasksRes = await axios.get(`https://graph.microsoft.com/v1.0/planner/buckets/${bucket.id}/tasks`, {
          headers: { Authorization: `Bearer ${req.session.accessToken}` }
        });

        const bucketTasks = bucketTasksRes.data.value || [];

        // Only include buckets that contain tasks
        if (bucketTasks.length > 0) {
          bucketMap[bucket.id] = { name: bucket.name, planId: bucket.planId };
          validBuckets.push(bucket.name);
        }
      }

      planBuckets[plan.dataPlanType] = validBuckets;
    }

    console.log("✅ Filtered Buckets by Task Count:", planBuckets);


    // 5) Assign Buckets to Tasks
    tasks.forEach((task) => {
      task.bucketName = bucketMap[task.bucketId]
        ? bucketMap[task.bucketId].name
        : "Unknown Bucket";
      const matchingPlan = plans.find((plan) => plan.id === task.planId);
      task.dataTaskType = matchingPlan ? matchingPlan.dataPlanType : "unknown";
    });

    console.log("✅ Tasks with Assigned Buckets & Plans:", tasks);

    // 5) Get Calendars
    const calRes = await axios.get("https://graph.microsoft.com/v1.0/me/calendars", {
      headers: { Authorization: `Bearer ${req.session.accessToken}` }
    });
    let rawCalendars = calRes.data.value || [];

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

    // 6) Fetch Events Per Calendar
    const calendarEvents = {};
    for (let cal of calendars) {
      const eventsRes = await axios.get(`https://graph.microsoft.com/v1.0/me/calendars/${cal.id}/events`, {
        headers: { Authorization: `Bearer ${req.session.accessToken}` }
      });
      calendarEvents[cal.id] = eventsRes.data.value || [];
    }
    // 7) Fetch Goals from Planner (Grouped by Priority in Each Bucket)
    const goals = [];
    for (const plan of plans) {
      const bucketsRes = await axios.get(`https://graph.microsoft.com/v1.0/planner/plans/${plan.id}/buckets`, {
        headers: { Authorization: `Bearer ${req.session.accessToken}` }
      });

      const buckets = bucketsRes.data.value || [];

      for (const bucket of buckets) {
        // Fetch tasks under each bucket
        const bucketTasksRes = await axios.get(`https://graph.microsoft.com/v1.0/planner/buckets/${bucket.id}/tasks`, {
          headers: { Authorization: `Bearer ${req.session.accessToken}` }
        });

        const bucketTasks = bucketTasksRes.data.value || [];

        // Filter tasks that have a priority set
        const priorityTasks = bucketTasks.filter(task => task.priority !== null);

        if (priorityTasks.length > 0) {
          let completedTasks = priorityTasks.filter(task => task.percentComplete === 100).length;
          let totalTasks = priorityTasks.length;

          goals.push({
            title: bucket.name, // The bucket name represents the goal
            planType: plan.dataPlanType, // Work, School, Personal
            totalTasks: totalTasks,
            completedTasks: completedTasks,
            progress: (completedTasks / totalTasks) * 100,
            tasks: priorityTasks.map(task => ({
              title: task.title,
              completed: task.percentComplete === 100
            }))
          });
        }
      }
    }

    console.log("🎯 Fetched Goals:", goals);


    // 7) Process Events for Calendar View
    let eventsByDay = {};

    Object.entries(calendarEvents).forEach(([calendarId, events]) => {
      events.forEach(event => {
        if (event.start && event.start.dateTime) {
          let eventDate = new Date(event.start.dateTime).toDateString();

          // Find the associated calendar to get its plan type
          let eventCalendar = calendars.find(cal => cal.id === calendarId);
          let planType = eventCalendar ? eventCalendar.dataCalendarType : "unknown";

          // Attach the correct plan type and calendar ID
          event.planType = planType;
          event.calendarId = calendarId;

          if (!eventsByDay[eventDate]) {
            eventsByDay[eventDate] = [];
          }
          eventsByDay[eventDate].push(event);
        }
      });
    });


    // 8) Sort Days for Display
    let sortedDays = Object.keys(eventsByDay).sort((a, b) => new Date(a) - new Date(b));

    console.log("📅 Sorted Calendar Days:", sortedDays);
    console.log("📌 Events Grouped by Day:", eventsByDay);

    // 9) Render home.ejs
    res.render("home", {
      title: "Dashboard",
      tasks,
      plans,
      calendars,
      calendarEvents,
      sortedDays,
      eventsByDay,
      goals,
      planBuckets: planBuckets || {}
    });

  } catch (error) {
    console.error("Failed to fetch tasks or events:", error.message);
    res.send("Failed to fetch tasks or events from Microsoft Graph.");
  }
});

// 10) Start Server
app.listen(PORT, () => {
  console.log(`✅ Server running on ${BASE_URL}`);
});

/***************************************************
 * routes/tasks.js
 **************************************************/
const express = require("express");
const router = express.Router();
const axios = require("axios");

// Define plan display names
const PLAN_TITLES = {
  WORK: "Work Plan",
  SCHOOL: "School Plan",
  PERSONAL: "Personal Plan"
};

// Define all acceptable school plan titles (original plus 3 additional)
const SCHOOL_PLAN_TITLES = [
  "School Plan",
  "School Plan - DIT8210 IT Ldrs as Partners Strat Plng",       // Additional plan 1
  "School Plan - TS8535 System & App Security Advances",    // Additional plan 2
  "School Plan - TS8535 System & App Security Advances"     // Additional plan 3
];

router.get("/", async (req, res) => {
  if (!req.session.accessToken) {
    return res.redirect("/auth/login");
  }

  try {
    // --- 1) Fetch Plans ---
    const plansRes = await axios.get("https://graph.microsoft.com/v1.0/me/planner/plans", {
      headers: { Authorization: `Bearer ${req.session.accessToken}` }
    });
    const plans = plansRes.data.value || [];
    console.log("Plans from Graph:", JSON.stringify(plans, null, 2));

    // Identify each plan by name exactly as before for work and personal
    const workPlan = plans.find(p => p.title === PLAN_TITLES.WORK);
    const personalPlan = plans.find(p => p.title === PLAN_TITLES.PERSONAL);
    
    // For school plans, get all matching plans
    const schoolPlans = plans.filter(p => SCHOOL_PLAN_TITLES.includes(p.title));

    // --- 2) Fetch Tasks (assigned to the current user) ---
    const tasksRes = await axios.get("https://graph.microsoft.com/v1.0/me/planner/tasks", {
      headers: { Authorization: `Bearer ${req.session.accessToken}` }
    });
    const tasks = tasksRes.data.value || [];
    console.log("Tasks from Graph:", JSON.stringify(tasks, null, 2));

    // Attach user-friendly planTitle to each task
    tasks.forEach(task => {
      if (workPlan && task.planId === workPlan.id) {
        task.planTitle = PLAN_TITLES.WORK;
      } else if (schoolPlans.some(sp => sp.id === task.planId)) {
        task.planTitle = PLAN_TITLES.SCHOOL;
      } else if (personalPlan && task.planId === personalPlan.id) {
        task.planTitle = PLAN_TITLES.PERSONAL;
      } else {
        task.planTitle = "Unknown";
      }
    });

    // Group tasks by planTitle for easier display
    const tasksByPlan = {
      Work: [],
      School: [],
      Personal: [],
      Unknown: []
    };
    tasks.forEach(t => {
      tasksByPlan[t.planTitle].push(t);
    });

    // --- 3) Render tasks.ejs ---
    res.render("tasks", {
      title: "My Tasks",
      tasks,
      tasksByPlan
    });

  } catch (error) {
    console.error("❌ Error fetching tasks or plans from Microsoft:", error.message);
    res.send("Failed to fetch tasks from Microsoft.");
  }
});

module.exports = router;

const express = require("express");
const axios = require("axios");
const session = require("express-session");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure session
app.use(session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: true,
}));

// Set up views
app.set("view engine", "ejs");
app.set("views", __dirname + "/views");
app.use(express.static("public"));

// Microsoft OAuth 2.0 Configuration
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const TENANT_ID = process.env.TENANT_ID;
const REDIRECT_URI = "http://localhost:3000/auth/callback";

// Redirect to Microsoft login
app.get("/login", (req, res) => {
    const authUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&response_mode=query&scope=Tasks.Read Group.Read.All Calendars.Read Calendars.Read.Shared offline_access`;
    res.redirect(authUrl);
});

// Handle callback & exchange code for token
app.get("/auth/callback", async (req, res) => {
    const code = req.query.code;
    try {
        const tokenResponse = await axios.post(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code,
            redirect_uri: REDIRECT_URI,
            grant_type: "authorization_code",
        }).toString(), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });

        req.session.accessToken = tokenResponse.data.access_token;
        res.redirect("/");
    } catch (error) {
        res.send("Authentication failed");
    }
});

// Fetch tasks from Microsoft Planner API and calendar events from Outlook
app.get("/", async (req, res) => {
    if (!req.session.accessToken) {
        return res.redirect("/login");
    }

    try {
        // Fetch Planner tasks
        const plannerResponse = await axios.get("https://graph.microsoft.com/v1.0/me/planner/tasks", {
            headers: { Authorization: `Bearer ${req.session.accessToken}` }
        });
        const tasks = plannerResponse.data.value;

        // Fetch user's calendars and filter them
        const calendarsResponse = await axios.get("https://graph.microsoft.com/v1.0/me/calendars", {
            headers: { Authorization: `Bearer ${req.session.accessToken}` }
        });
        let calendars = calendarsResponse.data.value.filter(cal => cal.name === "Calendar" || cal.name === "Personal");
        
        // Rename "Calendar" to "Work Calendar" for display purposes
        calendars = calendars.map(cal => cal.name === "Calendar" ? {...cal, displayName: "Work Calendar"} : {...cal, displayName: cal.name});

        // Fetch Planner Plans
        const plansResponse = await axios.get("https://graph.microsoft.com/v1.0/me/planner/plans", {
            headers: { Authorization: `Bearer ${req.session.accessToken}` }
        });
        let plans = plansResponse.data.value;
        
        // Group plans into Work and Personal
        const workPlan = plans.find(plan => plan.title.toLowerCase().includes("work"));
        const personalPlan = plans.find(plan => plan.title.toLowerCase().includes("personal"));
        
        // Create profiles based on Work and Personal Plans
        const profiles = [];
        if (workPlan) profiles.push({ id: workPlan.id, name: "Work Plan", color: "#FF6B6B" });
        if (personalPlan) profiles.push({ id: personalPlan.id, name: "Personal Plan", color: "#4ECDC4" });
        
        // Fetch events for Work and Personal calendars
        const calendarEvents = { work: [], personal: [] };
        for (let calendar of calendars) {
            const eventsResponse = await axios.get(`https://graph.microsoft.com/v1.0/me/calendars/${calendar.id}/events`, {
                headers: { Authorization: `Bearer ${req.session.accessToken}` }
            });
            if (calendar.name === "Calendar" || calendar.displayName === "Work Calendar") {
                calendarEvents.work = eventsResponse.data.value;
            } else {
                calendarEvents.personal = eventsResponse.data.value;
            }
        }

        res.render("home", { title: "Dashboard", tasks, calendars, calendarEvents, profiles, workPlan, personalPlan });
    } catch (error) {
        res.send("Failed to fetch tasks, calendar events, or profiles from Microsoft.");
    }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

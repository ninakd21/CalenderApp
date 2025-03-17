const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

// Set EJS as the view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Serve static files (CSS, JS)
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.get("/", (req, res) => {
    res.render("home", { title: "Home" });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
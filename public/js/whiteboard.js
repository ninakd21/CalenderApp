/***************************************************
 * whiteboard.js
 * 
 * Provides canvas-based drawing logic for your 
 * Whiteboard feature.
 **************************************************/

// Track state
let isDrawing = false;
let context = null;
let tool = "pen";      // 'pen' or 'eraser'
let lineWidth = 2;
let color = "#FFFFFF";

function setupWhiteboard() {
  const canvas = document.getElementById("canvas");
  if (!canvas) return;

  context = canvas.getContext("2d");
  // Resize canvas if needed:
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Set default styles
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = color;
  context.lineWidth = lineWidth;

  // Register event listeners
  canvas.addEventListener("mousedown", startDrawing);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stopDrawing);
  canvas.addEventListener("mouseout", stopDrawing);

  // For touch devices
  canvas.addEventListener("touchstart", startDrawing, { passive: true });
  canvas.addEventListener("touchmove", draw, { passive: false });
  canvas.addEventListener("touchend", stopDrawing);

  console.log("✅ Whiteboard setup complete!");
}

function startDrawing(e) {
  isDrawing = true;
  if (!context) return;

  const [x, y] = getXY(e);
  context.beginPath();
  context.moveTo(x, y);
}

function draw(e) {
  if (!isDrawing || !context) return;
  e.preventDefault(); // prevent scrolling on touch devices

  const [x, y] = getXY(e);
  context.lineTo(x, y);
  context.stroke();
}

function stopDrawing() {
  isDrawing = false;
  if (context) {
    context.closePath();
  }
}

function getXY(e) {
  const canvas = e.target;
  const rect = canvas.getBoundingClientRect();
  let x, y;

  if (e.touches && e.touches[0]) {
    x = e.touches[0].clientX - rect.left;
    y = e.touches[0].clientY - rect.top;
  } else {
    x = e.clientX - rect.left;
    y = e.clientY - rect.top;
  }
  return [x, y];
}

// Switch between pen and eraser
function setTool(newTool) {
  tool = newTool;
  if (!context) return;

  if (tool === "eraser") {
    context.strokeStyle = "#000000";
    context.lineWidth = lineWidth * 2;
  } else {
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
  }
}

// Adjust line width
function setLineWidth(newWidth) {
  lineWidth = newWidth;
  if (context) {
    context.lineWidth = tool === "eraser" ? lineWidth * 2 : lineWidth;
  }
}

// Change color (pen only)
function setColor(newColor) {
  color = newColor;
  if (context && tool === "pen") {
    context.strokeStyle = color;
  }
}

// Clear entire canvas
function clearCanvas() {
  const canvas = document.getElementById("canvas");
  if (!canvas || !context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
}

/***************************************************
 * Initialize Whiteboard
 * 
 * We'll call `setupWhiteboard()` when the page loads.
 **************************************************/
window.addEventListener("load", () => {
  setupWhiteboard();
});

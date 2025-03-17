/***************************************************
 * tasks.js
 *
 * Handles client-side interactions for the tasks
 * section in your mirror calendar app.
 **************************************************/

// Suppose your tasks are displayed in a list with
// the class "task-section" (as in home.ejs).
// Each <li> has data attributes (e.g., data-task-id)
// or plan info (data-task-type="work" or "personal").

console.log("tasks.js loaded!");

// Mark task as completed
function completeTask(taskId) {
  const li = document.querySelector(`[data-task-id="${taskId}"]`);
  if (!li) return;
  li.classList.add("text-success");
  // Optionally, you could send an API call to
  // mark the task as complete in Microsoft Planner
  // or in your database, for example:
  /*
  fetch(`/tasks/complete/${taskId}`, {
    method: "POST"
  }).then(res => res.json()).then(data => {
    console.log("Task completed:", data);
  }).catch(err => console.error(err));
  */
}

// Mark task as incomplete
function uncompleteTask(taskId) {
  const li = document.querySelector(`[data-task-id="${taskId}"]`);
  if (!li) return;
  li.classList.remove("text-success");
  // Optionally, revert in your data store
}

/***************************************************
 * Example: Auto-initialize or bind event listeners
 **************************************************/
// If you have dynamic tasks, you could bind event
// listeners to checkboxes or buttons once the DOM is loaded.

window.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded: tasks.js ready.");

  // Example: If each task <li> has a checkbox,
  // you could do something like:

  document.querySelectorAll(".task-checkbox").forEach(checkbox => {
    checkbox.addEventListener("change", (e) => {
      const taskId = e.target.dataset.taskId;
      if (e.target.checked) {
        completeTask(taskId);
      } else {
        uncompleteTask(taskId);
      }
    });
  });
  
});

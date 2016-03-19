/* globals win, con, storage */
function stub() {
}
// http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript generateQuickGuid() function
function generateUuid() {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}

var tracing = true;
function trace(msg) {
  if (tracing) {
    con.trace(msg);
  }
}

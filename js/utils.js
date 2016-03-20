/* globals win, con, storage */
function stub() {
}

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

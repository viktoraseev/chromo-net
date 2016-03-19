(function(win, con, storage) {/* globals win, con, storage */
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


// Simulates fire&forget messaging between tabs
// function send(target, data)
// function broadcast(data)

function UdpChannel(channel, onMessage) {
  this.send = function(target, data) {
    if (!target || target.lastIndexOf(prefix, 0) !== 0) {
      throw new Error('Message send to wrong channel');
    }
    storage.setItem(data);
  };
  this.broadcast = function(data) {
    storage.setItem(data);
  };
  function onStorage(event) {
  }
  win.addEventListener('storage', onStorage, false);
  trace('UdpChannel created');
}
new UdpChannel();
})(window, console, localStorage);
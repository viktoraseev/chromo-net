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

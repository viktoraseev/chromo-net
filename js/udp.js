// Simulates fire&forget messaging between tabs
// function send(data, target)
/* globals win, con, storage */
// http://hansifer.com/main.html - test page
function UdpChannel(channel, _id, onMessage) {
  if (!_id) {
    throw new Error('id is not specified');
  }
  if (!channel) {
    throw new Error('channel is not specified');
  }
  if (!onMessage) {
    throw new Error('onMessage is not specified');
  }

  var id = channel + '-' + _id;
  var counter = 0;
  var received = {};

  // event will not fire if value is already set to same
  this.send = function(data, target) {
    if (target && target.lastIndexOf(channel, 0) !== 0) {
      throw new Error('Message send to wrong channel');
    }
    var dataStr = JSON.stringify({c: counter++, d: data, t: target});

    storage[id] = dataStr;
  };

  function udpOnStorage(event) {
    var key = event.key;
    if (key === id) {
      return; // IE will sent events to yourself
    }
    // IE fire storage event twice if send to IFrame
    try {
      var valueStr = event.newValue;
      var value = JSON.parse(valueStr);
    } catch (e) {
      con.error(e);
      return;
    }

    if (value && (!value.t || (value.t && value.t === id))) {
      if (received[key] !== value.c) {
        received[key] = value.c;
        onMessage(value.d, key);
      }
    }
  }
  // IE doesn't fire storage event at subframes from window.open()
  if (browser.topStorage) {
    win.top.addEventListener('storage', udpOnStorage, false);
  } else {
    win.addEventListener('storage', udpOnStorage, false);
  }
  trace('UdpChannel created ');
}
win.ChromonetUdpChannel = UdpChannel;

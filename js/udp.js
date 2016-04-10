// Simulates fire&forget messaging between tabs
// function send(data, target)
/* globals win, con, storage */
// http://hansifer.com/main.html - test page
function UdpChannel(channel, _id, _onMessage) {
  var self = this;
  var onMessage = _onMessage;
  if (!_id) {
    throw new Error('id is not specified');
  }
  if (!channel) {
    throw new Error('channel is not specified');
  }

  var idCutoff = channel.length + 1;
  var id = channel + '-' + _id;
  var counter = 0;
  var received = {};
  var cleaner = new ChromonetChannelCleaner(channel);

  self.setEventListener = function(name, handler) {
    if (name !== 'message') {
      throw new Error('Only "message" type is supported');
    }
    onMessage = handler;
  };
  // event will not fire if value is already set to same
  self.send = function(data, target) {
    var obj = {c: counter++, d: data};
    if (target) {
      obj.t = channel + '-' + target;
    }
    storage.setItem(id, JSON.stringify(obj));
  };

  self.shutdown = function() {
    cleaner.shutdown();
    if (browser.topStorage) {
      win.top.removeEventListener('storage', udpOnStorage, false);
    } else {
      win.removeEventListener('storage', udpOnStorage, false);
    }
  };

  function udpOnStorage(event) {
    var key = event.key;
    if (key === id) {
      return; // IE will sent events to yourself
    }

    var value;
    try {
      var valueStr = event.newValue;
      // someone may delete the key
      if (!valueStr) {
        return;
      }
      value = JSON.parse(valueStr);
    } catch (e) {
      con.error(e);
      return;
    }

    // IE fire storage event twice if send to IFrame
    if (value && (!value.t || (value.t && value.t === id))) {
      if (key.lastIndexOf(channel, 0) === 0) {
        if (received[key] !== value.c) {
          received[key] = value.c;
          onMessage(value.d, key.substring(idCutoff));
        }
      }
    }
  }
  // IE doesn't fire storage event at subframes from window.open()
  if (browser.topStorage) {
    win.top.addEventListener('storage', udpOnStorage, false);
  } else {
    win.addEventListener('storage', udpOnStorage, false);
  }
}
win.ChromonetUdpChannel = UdpChannel;

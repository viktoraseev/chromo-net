(function(win, con, storage) {/* globals win, con, storage */
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

/* globals win, con, storage */
var browser = getCapabilities();

function getCapabilities() {
  var ua = navigator.userAgent;
  var ie = ua.match(/MSIE\s([\d.]+)/) || ua.match(/Trident\/[\d](?=[^\?]+).*rv:([0-9.].)/);
  var edge = ua.match('Edge/([0-9]{1,}[\.0-9]{0,})');
  return {
    // on edge, storage event doesnt work normally
    storageEvent: !edge,
    // IE doesn't fire storage event at subframes from window.open()
    topStorage: !!((ie && ie[1] == '11')),
    // ie doesnt support binary blobs
    blob: !(ie),
    // max msg size
    msgSize: 4000
  };
}

function ChromonetChannelCleaner(channel) {
  function cleanup() {
    var keys = Object.keys(storage);
    var l = keys.length;
    for (var i = 0; i < l; i++) {
      var key = keys[i];
      if (key.lastIndexOf(channel, 0) === 0) {
        storage.removeItem(key);
      }
    }
  }
  var timerId = setInterval(cleanup, 5000);
  this.shutdown = function() {
    cleanup();
    clearInterval(timerId);
  };
}
win.ChromonetChannelCleaner = ChromonetChannelCleaner;

function Chromonet(channel) {
  var self = this;
  var handlers = {};
  var serviceChannel;
  var state;
  var id;
  var freezeMode;

  // messages
  var MSG_ASK_NET_INFO = 'reportPlz';
  var MSG_RPL_NET_REPORT = 'reportHere';
  var MSG_PING = 'ping';
  var MSG_PONG = 'pong';
  var MSG_FREEZE = 'freeze';
  // timings
  var CONNECTING_TIMEOUT = 550; // host may be busy processing JS code
  var PING_TIMEOUT = 550; // host may be busy processing JS code

  // Public API's
  self.connect = function() {
    if (state.name() !== 'Disconnected') {
      throw new Error('Already connected or connecting');
    }
    changeState(new ConnectingState());
  };

  self.disconnect = function() {
    if (state.name() === 'Disconnected') {
      throw new Error('Already disconnected');
    }
    changeState(new DisconnectedState());
  };

  self.send = function(data, target) {
    state.send(data, target);
  };

  self.setEventListener = function(name, func) {
    handlers[name] = func;
  };

  self.id = function() {
    return id;
  };
  // changeState only if
  self.freeze = function(mode) {
    if (typeof mode !== 'undefined') {
      freezeMode = !!mode;
      console.log('Changed freezeMode to: ' + freezeMode + ', for ' + id);
      serviceChannel.send({t: MSG_FREEZE, mode: freezeMode});
    }
    return freezeMode;
  };
  self.serviceChannel = function() {
    return serviceChannel;
  };

  function changeState(newState) {
    if (!newState) {
      throw new Error('State could not be empty');
    }
    var prev = state;
    if (state) {
      state.leave(prev, newState);
    }
    state = newState;
    newState.enter(prev, newState);
  }

  function globalOnMessage(data, sender, time) {
    state.onMessage(data, sender, time);
  }

  function clientChannelOnMessage(data, sender, time) {
    fireEvent('message', {data: data, sender: sender});
  }

  function fireEvent(name, event) {
    var handler = handlers[name];
    if (handler) {
      try {
        handler(event);
      } catch (e) {
        console.error('Error during handing event ' + name, e);
      }
    }
  };

  changeState(new DisconnectedState());

  function DisconnectedState(reconnect) {
    var self = this;

    // ignore any messages
    self.onMessage = stub;
    self.enter = function(prevState, nextState) {
      if (serviceChannel) {
        serviceChannel.shutdown();
      }
      id = null;
      serviceChannel = null;
      fireEvent('disconnected', {type: 'disconnected'});
      if (reconnect) {
        changeState(new ConnectingState());
      }
    };
    self.name = function() { return 'Disconnected'; };
    self.leave = stub;
    self.send = function(data, target) {
      throw new Error('Could not send data while Disconnected');
    };
  }

  function ConnectingState(preserveId) {
    var self = this;
    var netInfo;
    var connectingDone;

    self.onMessage = function(data, sender, time) {
      if (data.t === MSG_ASK_NET_INFO) {
        // cant be host at this state
        serviceChannel.send({t: MSG_RPL_NET_REPORT, host: false},
          sender);
      } else if (data.t === MSG_RPL_NET_REPORT) {
        netInfo.push({id: sender, host: data.host});
        if (data.host) {
          //done(); that makes situation much worse and unstable.
        }
      } else if (data.t == MSG_PING) {
        serviceChannel.send({t: MSG_PONG}, sender);
      } else if (data.t === MSG_PONG) {
      } else {
        throw new Error('Unsupported message at ConnectingState ' + data.t);
      }
    };
    self.enter = function(prevState, nextState) {
      if (!preserveId && id) {
        throw new Error('Unexpected state, id should be null');
      }
      if (preserveId && !id) {
        throw new Error('Unexpected state, id should be not null');
      }
      if (!preserveId) {
        // it is important to create channel at this moment, to peorpery generate ID
        id = +Date.now() + '-' + generateUuid();
        serviceChannel = new ChromonetUdpChannel(channel, id, globalOnMessage);
      }
      serviceChannel.send({t: MSG_ASK_NET_INFO});
      netInfo = [];
      setTimeout(done, CONNECTING_TIMEOUT);
      fireEvent('connecting', {type: 'connecting', id: id});
    };
    self.name = function() { return 'Connecting'; };
    self.leave = stub;
    self.send = function(data, target) {
      throw new Error('Could not send data while Connecting');
    };
    function done() {
      if (connectingDone) {
        return;
      }
      connectingDone = true;
      if (netInfo.length > 0) {
        netInfo.push({id: id});
        var sorted = netInfo.map(function(e) {
          return e.id;
        }).sort();

        if (sorted[0] === id) {
          changeState(new HostState());
        } else {
          changeState(new ClientState(sorted[0]));
        }
      } else {
        changeState(new HostState());
      }
    }

  }

  function ClientState(hostId) {
    var self = this;
    var clientChannel;
    var c;

    function pingFailed() {
      if (!freezeMode) {
        changeState(new ConnectingState(true));
      }
    }

    self.onMessage = function(data, sender, time) {
      if (data.t === MSG_ASK_NET_INFO) {
        // cant be host at this state
        serviceChannel.send({t: MSG_RPL_NET_REPORT, host: false},
          sender);
      } else if (data.t == MSG_PING) {
        serviceChannel.send({t: MSG_PONG}, sender);
      } else if (data.t === MSG_PONG) {
        pingService.pong();
      } else if (data.t === MSG_RPL_NET_REPORT) {
        // may come later
      } else if (data.t === MSG_FREEZE) {
        freezeMode = data.mode;
        console.log('Changed freezeMode to: ' + freezeMode + ', for ' + id);
      } else {
        throw new Error('unknown message at ClientState ' + data.t);
      }
    };
    self.enter = function(prevState, nextState) {
      clientChannel = new ChromonetUdpChannel(channel + 'client', id,
        clientChannelOnMessage);
      pingService = new ChromonetPing(serviceChannel, hostId, pingFailed);
      fireEvent('client', {type: 'client', id: id, host: hostId});
    };
    self.name = function() { return 'Client'; };
    self.leave = function(prevState, nextState) {
      pingService.shutdown();
      clientChannel.shutdown();
    };
    self.send = function(data, target) {
      clientChannel.send(data, target);
    };
  }

  function HostState() {
    // if someone else got host status - disconnect himself.
    var self = this;
    var clientChannel;

    self.onMessage = function(data, sender, time) {
      if (data.t === MSG_ASK_NET_INFO) {
        serviceChannel.send({t: MSG_RPL_NET_REPORT, host: true},
          sender);
      } else if (data.t == MSG_PING) {
        serviceChannel.send({t: MSG_PONG}, sender);
      } else if (data.t === MSG_PONG) {
        // late pong's
      } else if (data.t === MSG_RPL_NET_REPORT) {
        // may come later
      } else if (data.t === MSG_FREEZE) {
        freezeMode = data.mode;
        console.log('Changed freezeMode to: ' + freezeMode + ', for ' + id);
      } else {
        throw new Error('unknown message at HostState ' + data.t);
      }
    };
    self.enter = function(prevState, nextState) {
      clientChannel = new ChromonetUdpChannel(channel + 'client', id,
        clientChannelOnMessage);
      fireEvent('host', {type: 'host', id: id});
    };
    self.name = function() { return 'Host'; };
    self.leave = function(prevState, nextState) {
      clientChannel.shutdown();
    };
    self.send = function(data, target) {
      clientChannel.send(data, target);
    };
  }

}

win.Chromonet = Chromonet;

function ChromonetPing(channelObj, targetId, onError) {
  var PING = 'ping';
  var PERIOD = 700;
  var lastReply = Date.now();
  function ping() {
    if (lastReply && (Date.now() - lastReply > PERIOD * 3)) {
      onError();
      return;
    }
    channelObj.send({t: PING}, targetId);
  }
  var timerId = setInterval(ping, PERIOD);
  this.shutdown = function() {
    clearInterval(timerId);
  };
  this.pong = function() {
    lastReply = Date.now();
  };
}
win.ChromonetPing = ChromonetPing;

/* globals win, con, storage */

function TcpChannel(channel, _id) {
  this.connect = function(_id, onMessage, onError) {
  };
  this.send = function(data, onError) {
  };
}
win.ChromonetTcpChannel = TcpChannel;

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

    // filter other events early
    if (key.lastIndexOf(channel + '-', 0) !== 0) {
      return;
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
      if (received[key] !== value.c) {
        received[key] = value.c;
        onMessage(value.d, key.substring(idCutoff));
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
})(window, console, localStorage);
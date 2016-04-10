function Chromonet(channel) {
  var self = this;
  var handlers = {};
  var serviceChannel;
  var state;
  var id;
  // messages
  var MSG_ASK_NET_INFO = 'reportPlz';
  var MSG_RPL_NET_REPORT = 'reportHere';
  var MSG_PING = 'ping';
  var MSG_PONG = 'pong';
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
      throw new Error('Could not send data while Connecting');
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
          done();
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
        netInfo.sort(function(a, b) {
          return a.id > b.id;
        });
        if (netInfo[0].id === id) {
          changeState(new HostState());
        } else {
          changeState(new ClientState(netInfo[0].id));
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
      changeState(new ConnectingState(true));
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

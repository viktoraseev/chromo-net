function ChromonetPing(channelObj, targetId, onError) {
  var PING = 'ping';
  var PERIOD = 1000;
  var lastReply = Date.now();
  function ping() {
    if (lastReply && (Date.now() - lastReply > PERIOD * 2)) {
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

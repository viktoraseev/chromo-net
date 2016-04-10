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

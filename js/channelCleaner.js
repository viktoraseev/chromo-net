function ChromonetChannelCleaner(channel) {
  setInterval(function() {
    var keys = Object.keys(storage);
    var l = keys.length;
    for (var i = 0; i < l; i++) {
      var key = keys[i];
      if (key.lastIndexOf(channel, 0) === 0) {
        storage.removeItem(key);
      }
    }
  }, 5000);
}
win.ChromonetChannelCleaner = ChromonetChannelCleaner;

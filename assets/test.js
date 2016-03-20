function pingPong() {
  var udp = new ChromonetUdpChannel('PingPong', Date.now(),
  function(data, sender) {
    console.log('got ' + data);
    if (data === 'ping') {
      console.log('sent pong');
      udp.send('pong', sender);
    }
  });
  window.ping = function() {
    console.log('sent ping');
    udp.send('ping');
  };
}

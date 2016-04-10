// Ping pong test
// Chrome - 1ms
// Safari 7 - 1ms
// IE - 20ms
function pingPong() {
  var time = 0;
  var udp = new ChromonetUdpChannel('PingPong', Date.now(),
  function(data, sender) {
    var newtime = +new Date();
    console.log('got ' + data + ' ' + (newtime - time));
    if (data === 'ping') {
      console.log('sent pong');
      udp.send('pong', sender);
    }
  });
  window.ping = function() {
    console.log('sent ping');
    time = +new Date();
    udp.send('ping');
  };
}
function networkTest() {
  var net = window.net = new Chromonet('networkTest channel');
  window.log = function log(name, e) {
    var e = document.createElement('div');
    e.innerText = JSON.stringify(name);
    document.body.appendChild(e);
  };
  net.setEventListener('disconnected', log);
  net.setEventListener('connecting', log);
  net.setEventListener('client', log);
  net.setEventListener('host', log);
  net.setEventListener('message', log);
  window.connect = function() {
    net.connect();
  };
  window.disconnect = function() {
    net.disconnect();
  };
}

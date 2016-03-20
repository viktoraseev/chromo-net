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

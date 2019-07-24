
let ctx;
let canvas;
let map;
let markers;

const downScale = 1.0;
const senderStampMotorLeft = 0;
const senderStampMotorRight = 10;

let isSailing = false;
let motorRpmLeft = 0;
let motorRpmRight = 0;
let changedView = false;

window.onload = function (evt) {
  initMap();
  init2dView();
  initLibcluon();
}

document.body.onmousedown = function (evt) {
  var pos = getMousePos(canvas, evt);
  if (pos.x < 0 || pos.x > canvas.width ||
      pos.y < 0 || pos.y > canvas.height) {
    isSailing = false;
    motorRpmLeft = 0;
    motorRpmRight = 0;
  } else {
    isSailing = true;
  }
}

document.body.onmousemove = function (evt) {
  if (isSailing) {
    var pos = getMousePos(canvas, evt);
    if (pos.x < 0 || pos.x > canvas.width ||
        pos.y < 0 || pos.y > canvas.height) {
    } else {
      const baseRpm = downScale * (2 * (1.0 - pos.y / canvas.height) - 1);
      const sideScale = pos.x / canvas.width;
      if (sideScale < 0.5) {
        motorRpmRight = baseRpm * (pos.x / (0.5 * canvas.width));
      } else {
        motorRpmRight = baseRpm;
      }
      if (sideScale > 0.5) {
        motorRpmLeft = baseRpm * (1.0 - ((pos.x - 0.5 * canvas.width) / (0.5 * canvas.width)));
      } else {
        motorRpmLeft = baseRpm;
      }
    }
  }
}

document.body.onmouseup = function (evt) {
  isSailing = false;
  motorRpmLeft = 0;
  motorRpmRight = 0;
}

function initMap() {
  map =  L.map('map');
  let osm = new L.TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');		
  map.addLayer(osm);
  map.setView(new L.LatLng(57.70942631838934, 11.948822736740114), 17);

  markers = new L.FeatureGroup();
  map.addLayer(markers);
}

function init2dView() {
  canvas = document.getElementById("2d-view");
  canvas.width = 500;
  canvas.height = 500;
  const w = canvas.width;
  const h = canvas.height;

  if(canvas.getContext) {
    ctx = canvas.getContext("2d");
  }

  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke(); 
  
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.stroke(); 
}

function initLibcluon() {
  var lc = libcluon();

  if ("WebSocket" in window) {
    var ws = new WebSocket("ws://" + window.location.host + "/", "od4");
    ws.binaryType = 'arraybuffer';

    ws.onopen = function() {
      onStreamOpen(ws, lc);
    }

    ws.onmessage = function(evt) {
      onMessageReceived(lc, evt.data);
    };

    ws.onclose = function() {
      onStreamClosed();
    };

    setInterval(function() {
      const dataType = 1086;
      dataOut(lc, ws, dataType, senderStampMotorLeft, "{\"position\":" + motorRpmLeft + "}");
      dataOut(lc, ws, dataType, senderStampMotorRight, "{\"position\":" + motorRpmRight + "}");
      
      $("#left-pedal").text((motorRpmLeft * 100.0).toFixed(1));
      $("#right-pedal").text((motorRpmRight * 100.0).toFixed(1));
    }, 100);

    map.on('mouseup', function(e) {
      dataOut(lc, ws, 19, 0, "{\"latitude\":" + e.latlng.lat + ", \"longitude\":" + e.latlng.lng + "}");
    });

  } else {
    console.log("Error: websockets not supported by your browser.");
  }
}

function onStreamOpen(ws, lc) {
  function getResourceFrom(url) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", url, false);
    xmlHttp.send(null);
    return xmlHttp.responseText;
  }

  var odvd = getResourceFrom("opendlv-standard-message-set-v0.9.4.odvd");

  console.log("Connected to stream.");
  console.log("Loaded " + lc.setMessageSpecification(odvd) + " messages from specification.");
}

function onStreamClosed() {
  console.log("Disconnected from stream.");
}

function onMessageReceived(lc, msg) {

  var data_str = lc.decodeEnvelopeToJSON(msg);

  if (data_str.length == 2) {
    return;
  }

  d = JSON.parse(data_str);

  dataIn(d);
}

function dataIn(data) {
  if (d.dataType == 19) {
    const lat = d['opendlv_proxy_GeodeticWgs84Reading']['latitude'];
    const lon = d['opendlv_proxy_GeodeticWgs84Reading']['longitude'];
    if (!changedView) {
      map.setView(new L.LatLng(lat, lon), 18);
      changedView = true;
    }

    let c;
    if (d.senderStamp == 99) {
      const c = L.circle([lat, lon], {
        color: "red",
        fillColor: "red",
        radius: 1
      });
      markers.addLayer(c);
    }
    if (d.senderStamp == 0) {
      const c = L.circle([lat, lon], {
        color: "blue",
        fillColor: "blue",
        radius: 1
      });
      markers.addLayer(c);
    }
    if (d.senderStamp == 98) {
      const c = L.circle([lat, lon], {
        color: "green",
        fillColor: "green",
        radius: 1
      });
      markers.addLayer(c);
    }

  }
  if (d.dataType == 1047) {
    if (d.senderStamp == senderStampMotorLeft) {
      $("#left-rpm").text(d['opendlv_proxy_WheelSpeedReading']['wheelSpeed'] / 0.105);
    }
    if (d.senderStamp == senderStampMotorRight) {
      $("#right-rpm").text(d['opendlv_proxy_WheelSpeedReading']['wheelSpeed'] / 0.105);
    }
  }
}

function dataOut(lc, ws, dataType, senderStamp, messageJson) {
  const message = lc.encodeEnvelopeFromJSONWithoutTimeStamps(messageJson, dataType, senderStamp);
  strToAb = str =>
    new Uint8Array(str.split('')
      .map(c => c.charCodeAt(0))).buffer;
  ws.send(strToAb(message), { binary: true });
}

function getMousePos(canvas, evt) {
  let rect = canvas.getBoundingClientRect();
  return {
    x: evt.clientX - rect.left,
    y: evt.clientY - rect.top
  };
}

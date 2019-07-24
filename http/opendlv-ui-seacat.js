
let ctx;
let canvas;

const senderStampMotorLeft = 0;
const senderStampMotorRight = 1;
const senderStampRodderLeft = 2;
const senderStampRodderRight = 3;
const senderStampThruster = 4;

let isSailing = false;
let motorLeft = 0;
let motorRight = 0;
let rodderLeft = 0;
let rodderRight = 0;
let thruster = 0;

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
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.stroke(); 
  
  ctx.beginPath();
  ctx.moveTo(w / 10, 0);
  ctx.lineTo(w / 10, h);
  ctx.stroke(); 
  
  ctx.beginPath();
  ctx.moveTo(w - w / 10, 0);
  ctx.lineTo(w - w / 10, h);
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
      dataOut(lc, ws, dataType, senderStampMotorLeft, "{\"position\":" + motorLeft + "}");
      dataOut(lc, ws, dataType, senderStampMotorRight, "{\"position\":" + motorRight + "}");
      dataOut(lc, ws, dataType, senderStampRodderLeft, "{\"position\":" + rodderLeft + "}");
      dataOut(lc, ws, dataType, senderStampRodderRight, "{\"position\":" + rodderRight + "}");
      dataOut(lc, ws, dataType, senderStampThruster, "{\"position\":" + thruster + "}");
      
      $("#motor-left").text((motorLeft * 100.0).toFixed(1));
      $("#motor-right").text((motorRight * 100.0).toFixed(1));
      $("#rodder-left").text((rodderLeft * 100.0).toFixed(1));
      $("#rodder-right").text((rodderRight * 100.0).toFixed(1));
      $("#thruster").text((thruster * 100.0).toFixed(1));
    }, 100);

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
  /*
  if (d.dataType == 1047) {
    if (d.senderStamp == senderStampMotorLeft) {
      $("#left-rpm").text(d['opendlv_proxy_WheelSpeedReading']['wheelSpeed'] / 0.105);
    }
    if (d.senderStamp == senderStampMotorRight) {
      $("#right-rpm").text(d['opendlv_proxy_WheelSpeedReading']['wheelSpeed'] / 0.105);
    }
  }
  */
}

function dataOut(lc, ws, dataType, senderStamp, messageJson) {
  const message = lc.encodeEnvelopeFromJSONWithoutTimeStamps(messageJson, dataType, senderStamp);
  strToAb = str =>
    new Uint8Array(str.split('')
      .map(c => c.charCodeAt(0))).buffer;
  ws.send(strToAb(message), { binary: true });
}

init2dView();
initLibcluon();



function getMousePos(canvas, evt) {
  let rect = canvas.getBoundingClientRect();
  return {
    x: evt.clientX - rect.left,
    y: evt.clientY - rect.top
  };
}

document.body.onmousedown = function (evt) {
  var pos = getMousePos(canvas, evt);
  if (pos.x < 0 || pos.x > canvas.width ||
      pos.y < 0 || pos.y > canvas.height) {
    isSailing = false;
    motorLeft = 0.5;
    motorRight = 0.5;
    rodderLeft = 0.5;
    rodderRight = 0.5;
    thruster = 0.5;
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
      const sideScale = pos.x / canvas.width;
      
      const base = 1.0 - pos.y / canvas.height;
      if (sideScale < 0.5) {
        motorRight = base * (pos.x / (0.5 * canvas.width));
      } else {
        motorRight = base;
      }
      if (sideScale > 0.5) {
        motorLeft = base * (1.0 - ((pos.x - 0.5 * canvas.width) / (0.5 * canvas.width)));
      } else {
        motorLeft = base;
      }

      rodderRight = sideScale;
      rodderLeft = sideScale;

      if (sideScale < 0.1) {
        thruster = 0.5 * pos.x / (0.1 * canvas.width);
      } else if (sideScale > 0.9) {
        thruster = 0.5 + 0.5 * (pos.x - 0.9 * canvas.width) / (0.1 * canvas.width);
      } else {
        thruster = 0.5;
      }
    }
  }
}

document.body.onmouseup = function (evt) {
  isSailing = false;
  motorLeft = 0.5;
  motorRight = 0.5;
  rodderLeft = 0.5;
  rodderRight = 0.5;
  thruster = 0.5;
}


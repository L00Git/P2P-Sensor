#!/usr/bin/env node
var WebSocketClient = require('websocket').client;
var client = new WebSocketClient();
var readline = require('readline');
client.on('connectFailed', function (error) {
    console.log('Connect Error: ' + error.toString());
});
client.on('connect', function (connection) {
    console.log('WebSocket Client Connected');
    connection.on('error', function (error) {
        console.log("Connection Error: " + error.toString());
    });
    connection.on('close', function () {
        console.log('echo-protocol Connection Closed');
    });
    connection.on('message', function (message) {
        if (message.type === 'utf8') {
            console.log("Received: '" + message.utf8Data + "'");
        }
    });
    function sendNumber() {
        if (connection.connected) {
            var number = Math.round(Math.random() * 0xFFFFFF);
            connection.sendUTF("blabla" + number.toString());
            //setTimeout(sendNumber, 1000);
        }
    }
    //sendNumber();
    function question() {
        var rl = readline.createInterface(process.stdin, process.stdout);
        rl.question("SUB/GET Test ", function (answer) {
            connection.sendUTF(answer);
            console.log("Query" + answer + "sent!");
            rl.close();
            setTimeout(question, 1000);
        });
    }
    question();
});
client.connect('ws://localhost:8080/', 'echo-protocol');
//# sourceMappingURL=app.js.map
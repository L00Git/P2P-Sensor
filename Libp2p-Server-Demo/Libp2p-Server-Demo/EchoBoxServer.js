"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EccoBoxServer = void 0;
const WebSocketServer = require('websocket').server;
const http = require('http');
class EccoBoxPeer {
    constructor(connect, id) {
        this.connection = connect;
        this.topics = new Array();
        this.id = id;
    }
    addTopic(topic) {
        if (!this.isSubscribed(topic)) {
            this.topics.push(topic);
            return "SUB SUCCESS";
        }
        return "ALREADY SUB";
    }
    removeTopic(topic) {
        this.topics.forEach((element, index) => {
            if (element === topic) {
                this.topics.splice(index, 1);
                return "REMOVE SUCCESS";
            }
        });
        return "REMOVE UNSUCCESSFUL";
    }
    isSubscribed(topic) {
        let found = false;
        this.topics.forEach(element => {
            console.log("Comparing: " + topic + " to " + element);
            if (element == topic) {
                found = true;
            }
        });
        return found;
    }
}
class EccoBoxServer {
    constructor(p2p) {
        this.eccoBoxPeers = new Array();
        this.p2p = p2p;
        //list of connections
        this.eccoBoxPeers = new Array();
        let root = this;
        this.server = http.createServer(function (request, response) {
            console.log((new Date()) + ' Received request for ' + request.url);
            response.writeHead(404);
            response.end();
        });
        this.server.listen(8080, function () {
            console.log((new Date()) + ' Server is listening on port 8080');
        });
        this.wsServer = new WebSocketServer({
            httpServer: this.server,
            // You should not use autoAcceptConnections for production
            // applications, as it defeats all standard cross-origin protection
            // facilities built into the protocol and the browser.  You should
            // *always* verify the connection's origin and decide whether or not
            // to accept it.
            autoAcceptConnections: false
        });
        this.wsServer.on('request', function (request) {
            if (!root.originIsAllowed(request.origin)) {
                // Make sure we only accept requests from an allowed origin
                request.reject();
                console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
                return;
            }
            let connection = request.accept('echo-protocol', request.origin);
            console.log((new Date()) + ' Connection accepted.');
            const eccoBoxPeerId = Math.floor(new Date().getTime() / 1000).toString();
            let newEccoBoxPeer = new EccoBoxPeer(connection, eccoBoxPeerId);
            console.log("peer: %s", newEccoBoxPeer);
            console.log("peers: %s", root.eccoBoxPeers);
            let index = root.eccoBoxPeers.push(newEccoBoxPeer) - 2;
            function reply(msg, id) {
                return __awaiter(this, void 0, void 0, function* () {
                    let reply = yield root.evalQuery(msg, id);
                    connection.sendUTF(reply);
                });
            }
            connection.on('message', function (message) {
                console.log("Received message from:" + eccoBoxPeerId);
                if (message.type === 'utf8') {
                    console.log('Received Message: ' + message.utf8Data);
                    reply(message.utf8Data.toString(), eccoBoxPeerId);
                }
                else if (message.type === 'binary') {
                    console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
                    connection.sendBytes(message.binaryData);
                }
            });
            connection.on('close', function (reasonCode, description) {
                root.eccoBoxPeers.splice(index, 1);
                console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
            });
        });
    }
    originIsAllowed(origin) {
        // put logic here to detect whether the specified origin is allowed.
        return true;
    }
    subscribeMessage(topic, msg) {
        this.eccoBoxPeers.forEach(eccoBoxPeer => {
            if (eccoBoxPeer.isSubscribed(topic)) {
                const responseMessage = "SUCCESS";
                eccoBoxPeer.connection.sendUTF(`{ "message": "${responseMessage}", "data": [${msg}], "type": "${topic}", "description": "SUB"  }`);
            }
        });
    }
    respond(msg) {
        let str = msg.split(' ');
        let id = str[str.length - 1];
        this.getEccoBoxPeerFromId(id).connection.sendUTF(msg.substring(0, msg.lastIndexOf(' ')));
        console.log("Resond: " + msg.substring(0, msg.lastIndexOf(' ') - 1));
    }
    //missing get and pub functionality
    evalQuery(query, eccoBoxPeerId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Evaluating: " + query);
            let commands = query.split(" ", 2);
            commands[1] = query.substring(query.indexOf(' ') + 1);
            //Format: GET OPT TOPIC
            if (commands[0] === "GET") {
                console.log("Received Get");
                let response = yield this.p2p.get(commands[1], eccoBoxPeerId, this);
                commands = commands[1].split(" ", 2);
                return response;
            }
            else if (commands[0] === "SUB") {
                console.log("Received Subscribe! Sub to: " + commands[1]);
                try {
                    let response = this.getEccoBoxPeerFromId(eccoBoxPeerId).addTopic(commands[1]);
                    this.p2p.subscribe(commands[1], this);
                    return response;
                }
                catch (e) {
                    return e;
                }
            }
            else if (commands[0] === "UNSUB") {
                try {
                    let response = this.getEccoBoxPeerFromId(eccoBoxPeerId).removeTopic(commands[1]);
                    this.p2p.unsubscribe(commands[1]);
                    return response;
                }
                catch (e) {
                    return e;
                }
            }
            //alles auf dem eigenen topic
            else if (commands[0] === "PUB") {
                try {
                    console.log("PUB RECIEVED: " + commands[1]);
                    if (JSON.parse(commands[1]).value != null && JSON.parse(commands[1]).key != null) {
                        this.p2p.addToMyTopic(commands[1]);
                        console.log("Published: " + commands[1]);
                        return "Published: " + commands[1];
                    }
                    else {
                        return "BAD FORMAT";
                    }
                }
                catch (err) {
                    console.log(err);
                    return "BAD FORMAT";
                }
            }
            else if (commands[0] === "STATUS" && commands[1] === "TOPICS") {
                console.log("STATUS REVIEVED: " + commands[1]);
                return this.p2p.getStatus();
            }
            else {
                console.log("INVALID COMMAND: " + query);
                return "INVALID COMMAND";
            }
        });
    }
    getEccoBoxPeerFromId(Id) {
        let foundPeer = null;
        this.eccoBoxPeers.forEach(element => {
            console.log("Element id %s", element.id);
            console.log("Param id %s", Id);
            console.log("comparing %s", (element.id == Id).toString());
            if (element.id == Id) {
                foundPeer = element;
            }
        });
        return foundPeer;
    }
}
exports.EccoBoxServer = EccoBoxServer;
//# sourceMappingURL=EchoBoxServer.js.map
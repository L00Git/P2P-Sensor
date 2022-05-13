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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const stream_1 = require("stream");
const util_1 = require("util");
const Libp2p = require('libp2p');
const TCP = require('libp2p-tcp');
const { NOISE } = require('libp2p-noise');
const MPLEX = require('libp2p-mplex');
const MDNS = require('libp2p-mdns');
const Gossipsub = require("libp2p-gossipsub");
const { multiaddr } = require('multiaddr');
const { fromString } = require('uint8arrays/from-string');
const { toString } = require('uint8arrays/to-string');
const WebSocketServer = require('websocket').server;
const http = require('http');
/* eslint-disable no-console */
//https://github.com/libp2p/js-libp2p/blob/master/examples/chat/src/stream.js
const pipe = require('it-pipe');
const map = require('it-map');
let readline = require('readline');
const { createReadStream, createWriteStream, promises } = require('fs');
const fs = require('fs');
class redundantTopic {
    constructor(topic) {
        this.writeStream = createWriteStream(__dirname + `/sensors/${topic}.csv`, { 'flags': 'a' });
    }
}
class p2pNode {
    constructor(myTopic) {
        this.redundantTopics = new Array(); //wenn redundanteTopic gel�scht wird auch Datei l�schen
        this.stop = () => __awaiter(this, void 0, void 0, function* () {
            // stop libp2p
            yield this.node.stop();
            console.log('libp2p has stopped');
            process.exit(0);
        });
        if (myTopic != null) {
            this.myTopic = myTopic;
            fs.mkdir(__dirname + `/sensors`, (err) => {
                if (err) {
                    //console.error(err);
                }
            });
            if (fs.statSync(__dirname + `/sensors`).isDirectory()) {
                this.writeStream = createWriteStream(__dirname + `/sensors/${myTopic}.csv`, { 'flags': 'a' });
            }
        }
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            //this.writeStream.write(`{"key": "12409132409", "value": "new"},\n`)
            //let fileContent = await this.streamToString(this.readStream)
            this.node = yield Libp2p.create({
                addresses: {
                    // add a listen address (localhost) to accept TCP connections on a random port
                    listen: ['/ip4/0.0.0.0/tcp/0']
                },
                modules: {
                    transport: [TCP],
                    connEncryption: [NOISE],
                    streamMuxer: [MPLEX],
                    peerDiscovery: [MDNS],
                    pubsub: Gossipsub
                }, config: {
                    peerDiscovery: {
                        autoDial: true, // Auto connect to discovered peers (limited by ConnectionManager minConnections)
                        // The `tag` property will be searched when creating the instance of your Peer Discovery service.
                        // The associated object, will be passed to the service when it is instantiated.
                    },
                    pubsub: {
                        enabled: true,
                        emitSelf: true
                    }
                }
            });
            // start libp2p
            yield this.node.start();
            console.log('libp2p has started');
            this.setTerminalTitle(this.node.peerId.toB58String());
            this.node.on('peer:discovery', (peerData) => {
                console.log('Found a peer in the local network', peerData.id.toString(), peerData.multiaddrs);
            });
            this.node.connectionManager.on('peer:connect', (connection) => {
                console.log('Connected to %s', connection.remotePeer.toB58String()); // Log connected peer
            });
            /*
               GET MADDR/ID OPT TIMESTAMP
               GET MADDR/ID LAST TIMESTAMP
               GET MADDR/ID ALL TIMESTAMP
               GET MADDR/ID BETWEEN,10000,20000 TIMESTAMP
             */
            if (this.myTopic != null) {
                console.log("JA 1");
                this.node.pubsub.subscribe(this.myTopic + "_ORGA");
                this.node.pubsub.on(this.myTopic + "_ORGA", (msg) => {
                    let topic = this.myTopic;
                    let resp = this.response;
                    let n = this.node;
                    msg = toString(msg.data);
                    let commands = msg.split(" ", 5);
                    this.get(commands[2] + " " + this.myTopic).then(function (value) {
                        resp(commands[1], value + " " + commands[3], n, commands[4]);
                    }, function (err) {
                        resp(commands[1], err + " " + commands[3], n, commands[4]);
                    });
                });
            }
            this.node.multiaddrs.forEach(addr => {
                if (!addr.toString().includes("127.0.0.1"))
                    this.myAddr = `${addr.toString()}/p2p/${this.node.peerId.toB58String()}`;
                console.log(`${addr.toString()}/p2p/${this.node.peerId.toB58String()}`);
            });
            process.on('SIGTERM', this.stop);
            process.on('SIGINT', this.stop);
        });
    }
    //Quelle finden
    setTerminalTitle(title) {
        process.stdout.write(String.fromCharCode(27) + "]0;" + title + String.fromCharCode(7));
    }
    response(adr, obj, n, responseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("JA 3.5" + adr + " " + obj + "\n node:" + n);
                const { stream, protocol } = yield n.dialProtocol(multiaddr(adr), `/response:${responseId}/1.0.0`);
                console.log("JA 4: %s", obj);
                pipe(
                // Read from stdin (the source)
                stream_1.Readable.from(obj), (source) => (map(source, (string) => fromString(string))), 
                //lp.encode(),
                // Write to the stream (the sink)
                stream.sink);
            }
            catch (e) {
                console.log(e);
            }
        });
    }
    //FORMAT: OPT TOPIC
    // OPT: ALL / LAST / BETWEEN,10,20
    get(query, ecchoBoxPeerId = null, listener = null) {
        return __awaiter(this, void 0, void 0, function* () {
            let response = "ERROR";
            try {
                let commands = query.split(" ", 2);
                if (commands[1] == this.myTopic || this.redundantTopics.some(element => { element.topic == commands[1]; })) {
                    let data = yield promises.readFile(__dirname + `/sensors/${commands[1]}.csv`); //Does open read and close inffective ?
                    data = data.toString().substring(0, data.toString().length - 2);
                    console.log("Ohne , Hier: " + data);
                    if (commands[0] == "ALL") {
                        return `{ "message": "SUCCESS", "data": [${data}], "type": "${commands[1]}", "description": "${commands[0]}" }`;
                    }
                    else if (commands[0] == "LAST") {
                        let jsonData = JSON.parse(`{"data": [${data}]}`);
                        jsonData = JSON.stringify(jsonData.data[jsonData.data.length - 1]);
                        if ((0, util_1.isNullOrUndefined)(jsonData))
                            return `{ "message": "SUCCESS", "data": [], "type": "${commands[1]}", "description": "${commands[0]}" }`;
                        else
                            return `{ "message": "SUCCESS", "data": [${jsonData}], "type": "${commands[1]}", "description": "${commands[0]}" }`;
                    }
                    else if (commands[0].startsWith("BETWEEN")) {
                        let bound = commands[0].split(",", 3);
                        let lowerBoud = parseInt(bound[1]);
                        let upperBoud = parseInt(bound[2]);
                        // Unexpected token ] in JSON at pos 
                        let jsonData = JSON.parse(`{"data": [${data}]}`);
                        console.log(jsonData.data);
                        let result = "";
                        jsonData = jsonData.data.forEach((element) => {
                            if (parseInt(element.key) >= lowerBoud && parseInt(element.key) <= upperBoud) {
                                console.log(element);
                                result += JSON.stringify(element);
                            }
                        });
                        console.log(result);
                        return `{ "message": "SUCCESS", "data": [${result}], "type": "${commands[1]}", "description": "${commands[0]}" }`;
                    }
                    else {
                        return `{ "message": "ERROR", "data": [], "type": "${commands[1]}" }`;
                    }
                }
                else {
                    if (ecchoBoxPeerId != null && listener != null) {
                        console.log(commands[1] + "_ORGA", "GET " + this.myAddr + " " + commands[0] + " " + ecchoBoxPeerId);
                        let responseId = Math.floor(new Date().getTime() / 1000).toString();
                        this.listen(listener, responseId);
                        this.publish(commands[1] + "_ORGA", "GET " + this.myAddr + " " + commands[0] + " " + ecchoBoxPeerId + " " + responseId);
                    }
                    return `{ "message": "PLEASE WAIT", "data": [], "type": "${commands[1]}", "description": "${commands[0]}" }`;
                }
            }
            catch (err) {
                console.log(err);
                return `{ "message": "ERROR", "data": [], "type": "N/A" }`;
            }
        });
    }
    subscribe(topic, listener) {
        console.log('Topic is %s', topic);
        this.node.pubsub.subscribe(topic);
        this.node.pubsub.on(topic, (msg) => {
            if (this.redundantTopics.some(element => { element.topic == topic; }))
                this.redundantTopics.find(element => { element.topic == topic; }).writeStream.write(msg + ",\n");
            console.log(`Topic: ${topic} \nMessage :${toString(msg.data)}\n\n`);
            listener.subscribeMessage(topic, msg.data);
        });
        console.log('I am subscribed to : %s', this.node.pubsub.getTopics());
    }
    unsubscribe(topic) {
        this.node.pubsub.unsubscribe(topic);
        console.log('I am subscribed to : %s', this.node.pubsub.getTopics());
    }
    addToMyTopic(msg) {
        this.writeStream.write(msg + ",\n");
        this.publish(this.myTopic, msg);
    }
    publish(topic, msg) {
        this.node.pubsub.publish(topic, fromString(msg)).catch(err => {
            console.error(err);
        });
    }
    listen(listener, responseId) {
        console.log('Listening for response');
        this.node.handle(`/response:${responseId}/1.0.0`, ({ connection, stream, protocol }) => __awaiter(this, void 0, void 0, function* () {
            pipe(
            // Read from the stream (the source)
            stream.source, (source) => map(source, (buf) => toString(buf.slice())), 
            // Sink function
            function (source) {
                var source_1, source_1_1;
                var e_1, _a;
                return __awaiter(this, void 0, void 0, function* () {
                    try {
                        // For each chunk of data
                        for (source_1 = __asyncValues(source); source_1_1 = yield source_1.next(), !source_1_1.done;) {
                            let chunk = source_1_1.value;
                            console.log("%s", chunk.toString());
                            listener.respond(chunk.toString());
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (source_1_1 && !source_1_1.done && (_a = source_1.return)) yield _a.call(source_1);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                });
            });
            this.unlisten(`/response:${responseId}/1.0.0`);
        }));
    }
    unlisten(prot) {
        this.node.unhandle(prot);
    }
}
// !! Server Topic als Argument !!
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        if (process.argv.length >= 1) {
            const p2p = new p2pNode(process.argv[2]);
            yield p2p.init();
            const server = new EccoBoxServer(p2p);
        }
        else {
            const p2p = new p2pNode(null);
            yield p2p.init();
            const server = new EccoBoxServer(p2p);
        }
    });
}
main();
//Ab hier Server
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
    /*replyAll() {
        //console.log("ReplyAll Called");
        for (let index in this.eccoBoxPeers) {
            console.log("Trying to send something to a peer");
            this.eccoBoxPeers[index].connection.sendUTF("you were the: " + index.toString() + "st");
        }
    }

    publishTopic(topic: String, data: String) {
        console.log("Publishment: " + data + " on Topic: " + topic);
        for (let index in this.eccoBoxPeers) {
            if (this.eccoBoxPeers[index].isSubscribed(topic)) {
                this.eccoBoxPeers[index].connection.sendUTF(data);
            }
        }
    }*/
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
//format der antwort
/*
{
    message: "SUCCESS oder ERROR",
        data: {
        
        values : [{
            key: 12409132409,
            value: 30�
        },
        {
            key: 12409132409,
            value: 30�
        }]
    },
}

{
    message: "SUCCESS oder ERROR",
        data: {
        type: "TEMP",
            values: [{
                12409132409: 30�
            },
            {
                    12409132409: 30�
            }]
        }
}
GET OPT TOPC
GET LAST TEMP   einzelne
GET ALL TEMP    gesammte
GET BETWEEN,10000,20000 TEMP

{"12312": "30"},
{"12312": "40"},


{"key": "12409132409",
"value": "30"},
{"key": "12409132409",
"value": "30"},
{"key": "12409132409",
"value": "30"}

{"message": "SUCCESS oder ERROR","data": [ X ], "type": "TEMP"}

const text = '{"Message":"SUCCESS", "birth":"1986-12-14", "city":"New York"}';
const obj = JSON.parse(text);
*/
//# sourceMappingURL=app.js.map
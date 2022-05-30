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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.p2pNode = void 0;
const console_1 = __importDefault(require("console"));
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
/* eslint-disable no-console */
//https://github.com/libp2p/js-libp2p/blob/master/examples/chat/src/stream.js
const pipe = require('it-pipe');
const map = require('it-map');
const { createReadStream, createWriteStream, promises } = require('fs');
const fs = require('fs');
const lookup_1 = require("./lookup");
class redundantTopic {
    constructor(topic) {
        this.topic = topic;
        fs.mkdir(__dirname + `/sensors`, (err) => {
            if (err) {
                //console.error(err);
            }
        });
        if (fs.statSync(__dirname + `/sensors`).isDirectory()) {
            this.writeStream = createWriteStream(__dirname + `/sensors/${topic}.csv`, { 'flags': 'a' });
        }
    }
    getData() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield promises.readFile(__dirname + `/sensors/${this.topic}.csv`);
        });
    }
    clearFile() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let clearWrite = createWriteStream(__dirname + `/sensors/${this.topic}.csv`, { 'flags': 'w' });
                clearWrite.end();
                console_1.default.log("Overwritten");
            }
            catch (e) {
                console_1.default.error("Cant overwrite: " + e);
            }
        });
    }
    getFileSize() {
        try {
            return fs.stat(__dirname + `/sensors/${this.topic}.csv`).size;
        }
        catch (err) {
            console_1.default.log(err);
            return null;
        }
    }
}
class p2pNode {
    constructor(redundantCount, myTopic) {
        this.redundantTopics = new Array(); //wenn redundanteTopic gel�scht wird auch Datei l�schen
        this.lookupService = new lookup_1.lookupService();
        this.stop = () => __awaiter(this, void 0, void 0, function* () {
            // stop libp2p
            yield this.node.stop();
            console_1.default.log('libp2p has stopped');
            process.exit(0);
        });
        this.redundantCount = 0;
        if (myTopic != null) {
            this.redundantCount = redundantCount;
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
            let root = this;
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
                    }, dialer: {
                        dialTimeout: 3000
                    }
                }
            });
            // start libp2p
            yield this.node.start();
            console_1.default.log('libp2p has started');
            this.setTerminalTitle(this.node.peerId.toB58String());
            this.node.on('peer:discovery', (peerData) => {
                console_1.default.log('Found a peer in the local network', peerData.id.toB58String(), peerData.multiaddrs);
            });
            this.node.connectionManager.on('peer:connect', (connection) => {
                console_1.default.log('Connected to %s', connection.remotePeer.toB58String()); // Log connected peer
                this.announceMyself();
                this.initiateSaveRedundant();
            });
            //  /ip4/192.168.178.27/tcp/51018/p2p/QmRvAvdFqPmSrbyKq6BiwvCzd4AkNLzfXpVpBJdbBsjXLJ
            //  /ip4/192.168.178.27/tcp/51018/p2p/QmRvAvdFqPmSrbyKq6BiwvCzd4AkNLzfXpVpBJdbBsjXLJ
            this.node.connectionManager.on('peer:disconnect', (connection) => {
                console_1.default.log("Disconnecting: " + connection.remoteAddr);
                console_1.default.log("Disconnecting: " + connection.remotePeer.toB58String());
                this.lookupService.unregister(connection.remotePeer.toB58String());
                this.publish("ORGA_DISCON", connection.remotePeer.toB58String());
            });
            /*
               GET MADDR/ID OPT TIMESTAMP
               GET MADDR/ID LAST TIMESTAMP
               GET MADDR/ID ALL TIMESTAMP
               GET MADDR/ID BETWEEN,10000,20000 TIMESTAMP
             */
            if (this.myTopic != null) {
                console_1.default.log("JA 1");
                //maddr topics
                this.node.pubsub.subscribe("ORGA_ANNOUNCE");
                this.node.pubsub.on("ORGA_ANNOUNCE", (msg) => {
                    try {
                        console_1.default.log("Got Announce %s", toString(msg.data));
                        const splitMessage = toString(msg.data).split(" ", 2);
                        console_1.default.log("split0: %s", splitMessage[0]);
                        console_1.default.log("split1: %s", splitMessage[1]);
                        console_1.default.log("Array split1: %s", JSON.parse(splitMessage[1]));
                        if (splitMessage[0] != root.myAddr && root.lookupService.register(multiaddr(splitMessage[0]), JSON.parse(splitMessage[1]))) { // if see new maddr send my metadata
                            this.announceMyself();
                        }
                        console_1.default.log("lookupService:" + JSON.stringify(root.lookupService.peerRefrences));
                    }
                    catch (e) {
                        console_1.default.error(e);
                    }
                });
                this.node.pubsub.subscribe("ORGA_DISCON");
                this.node.pubsub.on("ORGA_DISCON", (msg) => {
                    try {
                        console_1.default.log("Got Discon %s", toString(msg.data));
                        this.lookupService.unregister((toString(msg.data)));
                        console_1.default.log("lookupService:" + JSON.stringify(root.lookupService.peerRefrences));
                    }
                    catch (e) {
                        console_1.default.error(e);
                    }
                });
            }
            this.node.handle(`/get/1.0.0`, ({ connection, stream, protocol }) => __awaiter(this, void 0, void 0, function* () {
                let topic = this.myTopic;
                let resp = this.response;
                let n = this.node;
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
                                console_1.default.log("get message: %s", chunk.toString());
                                //"GET " + this.myAddr + " " + commands[0] + " " + commands[1] + " " + ecchoBoxPeerId + " " + responseId
                                let commands = chunk.toString().split(" ", 6);
                                console_1.default.log("opt: " + commands[2] + "topic: " + commands[3] + "adr: " + commands[1] + "clientId: " + commands[4] + "responseId: " + commands[5]);
                                root.get(commands[2] + " " + commands[3]).then(function (value) {
                                    resp(commands[1], value + " " + commands[4], n, commands[5]);
                                }, function (err) {
                                    resp(commands[1], err + " " + commands[4], n, commands[5]);
                                });
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
            }));
            this.node.multiaddrs.forEach(addr => {
                if (!addr.toString().includes("127.0.0.1"))
                    this.myAddr = `${addr.toString()}/p2p/${this.node.peerId.toB58String()}`;
                console_1.default.log(`${addr.toString()}/p2p/${this.node.peerId.toB58String()}`);
            });
            process.on('SIGTERM', this.stop);
            process.on('SIGINT', this.stop);
        });
    }
    //Quelle finden
    setTerminalTitle(title) {
        process.stdout.write(String.fromCharCode(27) + "]0;" + title + String.fromCharCode(7));
    }
    announceMyself() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.myTopic != null) {
                yield new Promise(resolve => setTimeout(resolve, 1000));
                yield this.myAddr;
                let topics = new Array();
                topics.push(this.myTopic);
                this.redundantTopics.forEach(element => {
                    topics.push(element.topic);
                });
                console_1.default.log("topics: " + topics);
                console_1.default.log("topics stringify" + JSON.stringify(topics));
                this.publish("ORGA_ANNOUNCE", this.myAddr + " " + JSON.stringify(topics));
            }
        });
    }
    initiateSaveRedundant() {
        return __awaiter(this, void 0, void 0, function* () {
            yield new Promise(resolve => setTimeout(resolve, 10000)); // wait 10 sec
            try {
                if (this.redundantCount > 0) {
                    let staus = this.getStatus().replace(/"/g, '').replace('{', '').replace('}', '');
                    console_1.default.log("redundant before:" + staus);
                    if (staus.split(",").length > 1) {
                        let leastRedundant = [null, null];
                        staus.split(",").forEach(elment => {
                            let topic = elment.split(":")[0];
                            let topicAmount = parseInt(elment.split(":")[1]);
                            console_1.default.log("redundant looping:" + topic + " " + topicAmount);
                            console_1.default.log("redundant topic:" + topic + " mytopic " + this.myTopic + " redundantTopics: " + JSON.stringify(this.redundantTopics));
                            if (topic != this.myTopic && !this.redundantTopics.some(redundantTop => { return redundantTop.topic == topic; })) {
                                if (leastRedundant[0] == null) {
                                    console_1.default.log("redundant saving:" + topic + " " + topicAmount);
                                    leastRedundant[0] = topic;
                                    leastRedundant[1] = topicAmount;
                                }
                                if (topicAmount < leastRedundant[1]) {
                                    console_1.default.log("redundant saving:" + topic + " " + topicAmount);
                                    leastRedundant[0] = topic;
                                    leastRedundant[1] = topicAmount;
                                }
                            }
                        });
                        console_1.default.log("redundant found:" + leastRedundant[0] + " " + leastRedundant[1]);
                        if (leastRedundant[0] != null) {
                            let newRedundantTopic = new redundantTopic(leastRedundant[0]);
                            newRedundantTopic.clearFile();
                            this.redundantTopics.push(newRedundantTopic);
                            let responseId = Math.floor(new Date().getTime() / 1000).toString();
                            this.listenNewRedundant(this.redundantTopics[this.redundantTopics.length - 1], responseId);
                            this.dialGet("GET " + this.myAddr + " ALL " + leastRedundant[0] + " 1 " + responseId, leastRedundant[0]);
                            this.announceMyself();
                        }
                    }
                }
            }
            catch (e) {
                console_1.default.error("Error saving redundant: " + e);
            }
        });
    }
    response(adr, obj, n, responseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                //console.log("JA 3.5" + adr + " " + obj + "\n node:" + n)                --- wieder an machen
                const { stream, protocol } = yield n.dialProtocol(multiaddr(adr), `/response:${responseId}/1.0.0`);
                // console.log("JA 4: %s", obj)                --- wieder an machen
                pipe(
                // Read from stdin (the source)
                stream_1.Readable.from(obj), (source) => (map(source, (string) => fromString(string))), 
                //lp.encode(),
                // Write to the stream (the sink)
                stream.sink);
            }
            catch (e) {
                console_1.default.log(e);
            }
        });
    }
    //https://bobbyhadz.com/blog/javascript-count-occurrences-of-each-element-in-array
    countOccurrences(arr) {
        const count = {};
        for (const element of arr) {
            if (count[element]) {
                count[element] += 1;
            }
            else {
                count[element] = 1;
            }
        }
        return JSON.stringify(count);
    }
    getStatus() {
        let topics = Array();
        if (this.myTopic != null)
            topics.push(this.myTopic);
        this.redundantTopics.forEach(element => {
            topics.push(element.topic);
        });
        topics.push(...this.lookupService.getAllTopics());
        return this.countOccurrences(topics);
    }
    //FORMAT: OPT TOPIC
    // OPT: ALL / LAST / BETWEEN,10,20
    get(query, ecchoBoxPeerId = null, listener = null) {
        return __awaiter(this, void 0, void 0, function* () {
            let response = "ERROR";
            try {
                let commands = query.split(" ", 2);
                if (commands[1] == this.myTopic || this.redundantTopics.some(element => { return element.topic == commands[1]; })) {
                    let data = yield promises.readFile(__dirname + `/sensors/${commands[1]}.csv`); //Does open read and close inffective ?
                    data = data.toString().substring(0, data.toString().length - 2);
                    //console.log("Ohne , Hier: " + data)               --- wieder an machen
                    if (commands[0] == "ALL") {
                        return `{ "message": "SUCCESS", "data": [${data}], "type": "${commands[1]}", "description": "${commands[0]}" }`;
                    }
                    else if (commands[0] == "LAST") {
                        let jsonData = JSON.parse(`{"data": [${data}]}`);
                        //jsonData = JSON.stringify(jsonData.data[jsonData.data.length - 1])
                        jsonData = JSON.stringify(jsonData.data.sort(function (a, b) {
                            return parseInt(b['key']) - parseInt(a['key']);
                        })[0]);
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
                        console_1.default.log(jsonData.data);
                        let result = "";
                        jsonData = jsonData.data.forEach((element) => {
                            if (parseInt(element.key) >= lowerBoud && parseInt(element.key) <= upperBoud) {
                                console_1.default.log(element);
                                result += JSON.stringify(element);
                            }
                        });
                        console_1.default.log(result);
                        return `{ "message": "SUCCESS", "data": [${result}], "type": "${commands[1]}", "description": "${commands[0]}" }`;
                    }
                    else {
                        return `{ "message": "ERROR", "data": [], "type": "${commands[1]}" }`;
                    }
                }
                else {
                    if (ecchoBoxPeerId != null && listener != null) {
                        let responseId = Math.floor(new Date().getTime() / 1000).toString();
                        console_1.default.log("GET " + this.myAddr + " " + commands[0] + " " + commands[1] + " " + ecchoBoxPeerId + " " + responseId);
                        this.listen(listener, responseId);
                        this.dialGet("GET " + this.myAddr + " " + commands[0] + " " + commands[1] + " " + ecchoBoxPeerId + " " + responseId, commands[1]);
                    }
                    return `{ "message": "PLEASE WAIT", "data": [], "type": "${commands[1]}", "description": "${commands[0]}" }`;
                }
            }
            catch (err) {
                console_1.default.log(err);
                return `{ "message": "ERROR", "data": [], "type": "N/A" }`;
            }
        });
    }
    subscribe(topic, listener) {
        console_1.default.log('Topic is %s', topic);
        if (!this.node.pubsub.getTopics().includes(topic)) {
            this.node.pubsub.subscribe(topic);
            this.node.pubsub.on(topic, (msg) => {
                var _a;
                (_a = this.redundantTopics.find(element => { return element.topic == topic; })) === null || _a === void 0 ? void 0 : _a.writeStream.write(msg + ",\n"); // test if ? works
                console_1.default.log(`Topic: ${topic} \nMessage :${toString(msg.data)}\n\n`);
                listener.subscribeMessage(topic, toString(msg.data));
            });
        }
        console_1.default.log('I am subscribed to : %s', this.node.pubsub.getTopics());
    }
    unsubscribe(topic) {
        this.node.pubsub.unsubscribe(topic);
        console_1.default.log('I am subscribed to : %s', this.node.pubsub.getTopics());
    }
    addToMyTopic(msg) {
        this.writeStream.write(msg + ",\n");
        this.publish(this.myTopic, msg);
    }
    publish(topic, msg) {
        this.node.pubsub.publish(topic, fromString(msg)).catch(err => {
            console_1.default.error(err);
        });
    }
    dialGet(msg, topic) {
        return __awaiter(this, void 0, void 0, function* () {
            console_1.default.log("Dial Get: " + topic, " " + JSON.stringify(this.lookupService));
            if (this.lookupService.find(topic).length == 0)
                return false;
            try {
                console_1.default.log("Dial Get" + msg + " from: " + this.lookupService.find(topic)[0].maddr);
                const { stream, protocol } = yield this.node.dialProtocol(this.lookupService.find(topic)[0].maddr, `/get/1.0.0`);
                pipe(
                // Read from stdin (the source)
                stream_1.Readable.from(msg), (source) => (map(source, (string) => fromString(string))), 
                //lp.encode(),
                // Write to the stream (the sink)
                stream.sink);
            }
            catch (e) {
                console_1.default.error("dialGetError " + e);
                console_1.default.log("Removed refrence to " + this.lookupService.find(topic)[0].maddr + " due to Error");
                this.lookupService.unregister(this.lookupService.find(topic)[0].maddr.toString().substring(this.lookupService.find(topic)[0].maddr.toString().lastIndexOf('/') + 1, this.lookupService.find(topic)[0].maddr.toString().length)); //if error with this peer remove him
                console_1.default.log("lookupService:" + JSON.stringify(this.lookupService.peerRefrences));
                this.dialGet(msg, topic);
            }
        });
    }
    listen(listener, responseId) {
        console_1.default.log('Listening for response');
        this.node.handle(`/response:${responseId}/1.0.0`, ({ connection, stream, protocol }) => __awaiter(this, void 0, void 0, function* () {
            pipe(
            // Read from the stream (the source)
            stream.source, (source) => map(source, (buf) => toString(buf.slice())), 
            // Sink function
            function (source) {
                var source_2, source_2_1;
                var e_2, _a;
                return __awaiter(this, void 0, void 0, function* () {
                    console_1.default.log("start receiving");
                    let allData = "";
                    try {
                        // For each chunk of data
                        for (source_2 = __asyncValues(source); source_2_1 = yield source_2.next(), !source_2_1.done;) {
                            let chunk = source_2_1.value;
                            //console.log("One Chunk: %s", chunk.toString())                 --- wieder an machen
                            allData += chunk.toString();
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (source_2_1 && !source_2_1.done && (_a = source_2.return)) yield _a.call(source_2);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                    //console.log("All Chunks%s", allData)                --- wieder an machen
                    listener.respond(allData);
                });
            });
            this.unlisten(`/response:${responseId}/1.0.0`);
        }));
    }
    listenNewRedundant(redundantTop, responseId) {
        console_1.default.log('Listening for response redundant');
        this.node.handle(`/response:${responseId}/1.0.0`, ({ connection, stream, protocol }) => __awaiter(this, void 0, void 0, function* () {
            pipe(
            // Read from the stream (the source)
            stream.source, (source) => map(source, (buf) => toString(buf.slice())), 
            // Sink function
            function (source) {
                var source_3, source_3_1;
                var e_3, _a;
                return __awaiter(this, void 0, void 0, function* () {
                    console_1.default.log("start receiving");
                    let allData = "";
                    try {
                        // For each chunk of data
                        for (source_3 = __asyncValues(source); source_3_1 = yield source_3.next(), !source_3_1.done;) {
                            let chunk = source_3_1.value;
                            //console.log("One Chunk: %s", chunk.toString())                --- wieder an machen
                            allData += chunk.toString();
                        }
                    }
                    catch (e_3_1) { e_3 = { error: e_3_1 }; }
                    finally {
                        try {
                            if (source_3_1 && !source_3_1.done && (_a = source_3.return)) yield _a.call(source_3);
                        }
                        finally { if (e_3) throw e_3.error; }
                    }
                    //console.log("All Chunks: %s", allData.substring(0, allData.lastIndexOf(' ')))
                    let jsonData = JSON.parse(allData.substring(0, allData.lastIndexOf(' ')));
                    //console.log("bin in Success" + jsonData + " " + JSON.stringify(jsonData))                --- wieder an machen
                    if (jsonData.message == "SUCCESS") {
                        console_1.default.log("bin in Success");
                        let stringified = JSON.stringify(jsonData.data);
                        redundantTop.writeStream.write(stringified.replace('[', '').slice(0, stringified.lastIndexOf(']')) + ",\n");
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
exports.p2pNode = p2pNode;
//# sourceMappingURL=p2pNode.js.map
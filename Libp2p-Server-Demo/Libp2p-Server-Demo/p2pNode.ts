import console from "console";
import { ReadStream, WriteStream } from "fs";
import { connect } from "net";
import { Readable } from "stream";
import { isNullOrUndefined, TextEncoder } from "util";

const Libp2p = require('libp2p')
const TCP = require('libp2p-tcp')
const { NOISE } = require('libp2p-noise')
const MPLEX = require('libp2p-mplex')
const MDNS = require('libp2p-mdns')
const Gossipsub = require("libp2p-gossipsub")
const { multiaddr } = require('multiaddr');
import { Multiaddr } from "multiaddr";
const { fromString } = require('uint8arrays/from-string')
const { toString } = require('uint8arrays/to-string')

import { SubListener } from './EchoBoxServer'


/* eslint-disable no-console */
//https://github.com/libp2p/js-libp2p/blob/master/examples/chat/src/stream.js

const pipe = require('it-pipe')
const map = require('it-map')


const { createReadStream, createWriteStream, promises } = require('fs')
const fs = require('fs')

import { lookupService } from './lookup'

class redundantTopic {
    topic: String
    writeStream: WriteStream

    constructor(topic: String) {
        this.topic = topic
        fs.mkdir(__dirname + `/sensors`, (err) => {
            if (err) {
                //console.error(err);
            }
        })
        if (fs.statSync(__dirname + `/sensors`).isDirectory()) {
            this.writeStream = createWriteStream(__dirname + `/sensors/${topic}.csv`, { 'flags': 'a' })
        }
    }

    async getData() {
        return await promises.readFile(__dirname + `/sensors/${this.topic}.csv`)
    }

    async clearFile() {
        try {
            let clearWrite = createWriteStream(__dirname + `/sensors/${this.topic}.csv`, { 'flags': 'w' })
            clearWrite.end()
            console.log("Overwritten")
        } catch (e) {
            console.error("Cant overwrite: " + e)
        }
    }

    getFileSize() {
        try {
            return fs.stat(__dirname + `/sensors/${this.topic}.csv`).size
        } catch (err) {
            console.log(err);
            return null
        }
    }


}

export class p2pNode {

    writeStream: WriteStream

    myTopic: String
    redundantCount: Number

    redundantTopics: Array<redundantTopic> = new Array() //wenn redundanteTopic gelöscht wird auch Datei löschen


    lookupService: lookupService = new lookupService()

    node: any

    myAddr: String

    constructor(redundantCount: Number, myTopic: String) {
        this.redundantCount = 0
        if (myTopic != null) {
            this.redundantCount = redundantCount
            this.myTopic = myTopic
            fs.mkdir(__dirname + `/sensors`, (err) => {
                if (err) {
                    //console.error(err);
                }
            })
            if (fs.statSync(__dirname + `/sensors`).isDirectory()) {
                this.writeStream = createWriteStream(__dirname + `/sensors/${myTopic}.csv`, { 'flags': 'a' })
            }
        }
    }

    public async init() {

        //this.writeStream.write(`{"key": "12409132409", "value": "new"},\n`)

        //let fileContent = await this.streamToString(this.readStream)

        let root = this

        this.node = await Libp2p.create({
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
        })

        // start libp2p
        await this.node.start()
        console.log('libp2p has started')

        this.setTerminalTitle(this.node.peerId.toB58String())

        this.node.on('peer:discovery', (peerData) => {
            console.log('Found a peer in the local network', peerData.id.toB58String(), peerData.multiaddrs)
        })

        this.node.connectionManager.on('peer:connect', (connection) => {
            console.log('Connected to %s', connection.remotePeer.toB58String()) // Log connected peer
            this.announceMyself()
            this.initiateSaveRedundant()
        })
        //  /ip4/192.168.178.27/tcp/51018/p2p/QmRvAvdFqPmSrbyKq6BiwvCzd4AkNLzfXpVpBJdbBsjXLJ
        //  /ip4/192.168.178.27/tcp/51018/p2p/QmRvAvdFqPmSrbyKq6BiwvCzd4AkNLzfXpVpBJdbBsjXLJ
        this.node.connectionManager.on('peer:disconnect', (connection) => {
            console.log("Disconnecting: " + connection.remoteAddr)
            console.log("Disconnecting: " + connection.remotePeer.toB58String())
            this.lookupService.unregister(connection.remotePeer.toB58String())
            this.publish("ORGA_DISCON", connection.remotePeer.toB58String())
        })

        /*
           GET MADDR/ID OPT TIMESTAMP
           GET MADDR/ID LAST TIMESTAMP
           GET MADDR/ID ALL TIMESTAMP
           GET MADDR/ID BETWEEN,10000,20000 TIMESTAMP
         */

        if (this.myTopic != null) {


            console.log("JA 1")

            //maddr topics
            this.node.pubsub.subscribe("ORGA_ANNOUNCE")
            this.node.pubsub.on("ORGA_ANNOUNCE", (msg) => {
                try {
                    console.log("Got Announce %s", toString(msg.data))
                    const splitMessage = toString(msg.data).split(" ", 2)

                    console.log("split0: %s", splitMessage[0])
                    console.log("split1: %s", splitMessage[1])
                    console.log("Array split1: %s", JSON.parse(splitMessage[1]))
                    if (splitMessage[0] != root.myAddr && root.lookupService.register(multiaddr(splitMessage[0]), JSON.parse(splitMessage[1]))) { // if see new maddr send my metadata
                        this.announceMyself()
                    }
                    console.log("lookupService:" + JSON.stringify(root.lookupService.peerRefrences))
                } catch (e) {
                    console.error(e)
                }
            })

            this.node.pubsub.subscribe("ORGA_DISCON")
            this.node.pubsub.on("ORGA_DISCON", (msg) => {
                try {
                    console.log("Got Discon %s", toString(msg.data))
                    this.lookupService.unregister((toString(msg.data)))
                    console.log("lookupService:" + JSON.stringify(root.lookupService.peerRefrences))
                } catch (e) {
                    console.error(e)
                }
            })

        }

        this.node.handle(`/get/1.0.0`, async ({ connection, stream, protocol }) => {


            let topic = this.myTopic
            let resp = this.response
            let n = this.node




            pipe(
                // Read from the stream (the source)
                stream.source,

                (source) => map(source, (buf) => toString(buf.slice())),
                // Sink function
                async function (source) {
                    // For each chunk of data
                    for await (let chunk of source) {
                        console.log("get message: %s", chunk.toString())
                        //"GET " + this.myAddr + " " + commands[0] + " " + commands[1] + " " + ecchoBoxPeerId + " " + responseId
                        let commands = chunk.toString().split(" ", 6)
                        console.log("opt: " + commands[2] + "topic: " + commands[3] + "adr: " + commands[1] + "clientId: " + commands[4] + "responseId: " + commands[5])

                        root.get(commands[2] + " " + commands[3]).then(function (value) {
                            resp(commands[1], value + " " + commands[4], n, commands[5])
                        }, function (err) {
                            resp(commands[1], err + " " + commands[4], n, commands[5])
                        })
                    }
                }
            )
        })

        this.node.multiaddrs.forEach(addr => {
            if (!addr.toString().includes("127.0.0.1"))
                this.myAddr = `${addr.toString()}/p2p/${this.node.peerId.toB58String()}`
            console.log(`${addr.toString()}/p2p/${this.node.peerId.toB58String()}`)
        })


        process.on('SIGTERM', this.stop)
        process.on('SIGINT', this.stop)
    }
    //Quelle finden
    setTerminalTitle(title) {
        process.stdout.write(
            String.fromCharCode(27) + "]0;" + title + String.fromCharCode(7)
        );
    }

    async announceMyself() {
        if (this.myTopic != null) {
            await new Promise(resolve => setTimeout(resolve, 1000))
            await this.myAddr

            let topics = new Array()
            topics.push(this.myTopic)
            this.redundantTopics.forEach(element => {
                topics.push(element.topic)
            })
            console.log("topics: " + topics)
            console.log("topics stringify" + JSON.stringify(topics))
            this.publish("ORGA_ANNOUNCE", this.myAddr + " " + JSON.stringify(topics))
        }
    }

    async initiateSaveRedundant() {
        await new Promise(resolve => setTimeout(resolve, 10000)) // wait 10 sec
        try {
            if (this.redundantCount > 0) {
                let staus = this.getStatus().replace(/"/g, '').replace('{', '').replace('}', '')
                console.log("redundant before:" + staus)
                if (staus.split(",").length > 1) {
                    let leastRedundant: [string, number] = [null, null]
                    staus.split(",").forEach(elment => {
                        let topic = elment.split(":")[0]
                        let topicAmount = parseInt(elment.split(":")[1])
                        console.log("redundant looping:" + topic + " " + topicAmount)
                        console.log("redundant topic:" + topic + " mytopic " + this.myTopic + " redundantTopics: " + JSON.stringify(this.redundantTopics))
                        if (topic != this.myTopic && !this.redundantTopics.some(redundantTop => { return redundantTop.topic == topic })) {
                            if (leastRedundant[0] == null) { 
                                console.log("redundant saving:" + topic + " " + topicAmount)
                                leastRedundant[0] = topic
                                leastRedundant[1] = topicAmount
                            }
                            if (topicAmount < leastRedundant[1]) {
                                console.log("redundant saving:" + topic + " " + topicAmount)
                                leastRedundant[0] = topic
                                leastRedundant[1] = topicAmount
                            }
                        }
                    })
                    console.log("redundant found:" + leastRedundant[0] + " " + leastRedundant[1])
                    if (leastRedundant[0] != null) {
                        let newRedundantTopic = new redundantTopic(leastRedundant[0])
                        newRedundantTopic.clearFile()
                        this.redundantTopics.push(newRedundantTopic)
                        let responseId = Math.floor(new Date().getTime() / 1000).toString()
                        this.listenNewRedundant(this.redundantTopics[this.redundantTopics.length-1], responseId)
                        this.dialGet("GET " + this.myAddr + " ALL " + leastRedundant[0] + " 1 " + responseId, leastRedundant[0])
                    }
                }
            }
        } catch (e) {
            console.error("Error saving redundant: " + e)
        }
    }

    async response(adr: String, obj: String, n: any, responseId: String) {
        try {
            //console.log("JA 3.5" + adr + " " + obj + "\n node:" + n)                --- wieder an machen
            const { stream, protocol } = await n.dialProtocol(multiaddr(adr), `/response:${responseId}/1.0.0`)
            // console.log("JA 4: %s", obj)                --- wieder an machen
            pipe(
                // Read from stdin (the source)
                Readable.from(obj),

                (source) => (map(source, (string) => fromString(string))),

                //lp.encode(),

                // Write to the stream (the sink)
                stream.sink
            )
        }
        catch (e) {
            console.log(e);
        }
    }

    //https://bobbyhadz.com/blog/javascript-count-occurrences-of-each-element-in-array
    countOccurrences(arr: any): String {
        const count = {};

        for (const element of arr) {
            if (count[element]) {
                count[element] += 1;
            } else {
                count[element] = 1;
            }
        }
        return JSON.stringify(count)
    }

    getStatus(): String {
        let topics = Array()
        if (this.myTopic != null)
            topics.push(this.myTopic)

        this.redundantTopics.forEach(element => {
            topics.push(element.topic)
        })

        topics.push(...this.lookupService.getAllTopics())

        return this.countOccurrences(topics)
    }

    //FORMAT: OPT TOPIC
    // OPT: ALL / LAST / BETWEEN,10,20
    async get(query: String, ecchoBoxPeerId: String = null, listener: SubListener = null): Promise<String> {

        let response = "ERROR"
        try {
            let commands = query.split(" ", 2)
            if (commands[1] == this.myTopic || this.redundantTopics.some(element => { return element.topic == commands[1] })) {
                let data = await promises.readFile(__dirname + `/sensors/${commands[1]}.csv`)    //Does open read and close inffective ?
                data = data.toString().substring(0, data.toString().length - 2)
                //console.log("Ohne , Hier: " + data)               --- wieder an machen
                if (commands[0] == "ALL") {
                    return `{ "message": "SUCCESS", "data": [${data}], "type": "${commands[1]}", "description": "${commands[0]}" }`
                }
                else if (commands[0] == "LAST") {

                    let jsonData = JSON.parse(`{"data": [${data}]}`)
                    //jsonData = JSON.stringify(jsonData.data[jsonData.data.length - 1])
                    jsonData = JSON.stringify(jsonData.data.sort(
                        function (a, b) {
                            return parseInt(b['key']) - parseInt(a['key']);
                        }
                    )[0])
                    if (isNullOrUndefined(jsonData))
                        return `{ "message": "SUCCESS", "data": [], "type": "${commands[1]}", "description": "${commands[0]}" }`
                    else
                        return `{ "message": "SUCCESS", "data": [${jsonData}], "type": "${commands[1]}", "description": "${commands[0]}" }`
                }
                else if (commands[0].startsWith("BETWEEN")) {
                    let bound = commands[0].split(",", 3)
                    let lowerBoud = parseInt(bound[1])
                    let upperBoud = parseInt(bound[2])

                    // Unexpected token ] in JSON at pos 

                    let jsonData = JSON.parse(`{"data": [${data}]}`)

                    console.log(jsonData.data)

                    let result = ""

                    jsonData = jsonData.data.forEach((element) => {
                        if (parseInt(element.key) >= lowerBoud && parseInt(element.key) <= upperBoud) {
                            console.log(element)
                            result += JSON.stringify(element)
                        }
                    })
                    console.log(result)

                    return `{ "message": "SUCCESS", "data": [${result}], "type": "${commands[1]}", "description": "${commands[0]}" }`
                }
                else {
                    return `{ "message": "ERROR", "data": [], "type": "${commands[1]}" }`
                }
            } else {
                if (ecchoBoxPeerId != null && listener != null) {
                    let responseId = Math.floor(new Date().getTime() / 1000).toString()
                    console.log("GET " + this.myAddr + " " + commands[0] + " " + commands[1] + " " + ecchoBoxPeerId + " " + responseId)
                    this.listen(listener, responseId)
                    this.dialGet("GET " + this.myAddr + " " + commands[0] + " " + commands[1] + " " + ecchoBoxPeerId + " " + responseId, commands[1])
                }
                return `{ "message": "PLEASE WAIT", "data": [], "type": "${commands[1]}", "description": "${commands[0]}" }`
            }
        } catch (err) {
            console.log(err)
            return `{ "message": "ERROR", "data": [], "type": "N/A" }`
        }
    }


    stop = async () => {
        // stop libp2p
        await this.node.stop()
        console.log('libp2p has stopped')
        process.exit(0)
    }



    subscribe(topic: String, listener: SubListener) {
        console.log('Topic is %s', topic)

        if (!this.node.pubsub.getTopics().includes(topic)) {
            this.node.pubsub.subscribe(topic)
        
            this.node.pubsub.on(topic, (msg) => {
                this.redundantTopics.find(element => { return element.topic == topic })?.writeStream.write(msg + ",\n") // test if ? works

                console.log(`Topic: ${topic} \nMessage :${toString(msg.data)}\n\n`)
                listener.subscribeMessage(topic, toString(msg.data))
            })
        }
        console.log('I am subscribed to : %s', this.node.pubsub.getTopics())
    }

    unsubscribe(topic: String) {
        this.node.pubsub.unsubscribe(topic)
        console.log('I am subscribed to : %s', this.node.pubsub.getTopics())
    }

    addToMyTopic(msg: String) {
        this.writeStream.write(msg + ",\n")
        this.publish(this.myTopic, msg)
    }

    publish(topic: String, msg: String) {
        this.node.pubsub.publish(topic, fromString(msg)).catch(err => {
            console.error(err)
        })
    }

    async dialGet(msg: String, topic: String) {
        console.log("Dial Get: " + topic, " " + JSON.stringify(this.lookupService))
        if (this.lookupService.find(topic).length == 0)
            return false
        try {
            console.log("Dial Get" + msg + " from: " + this.lookupService.find(topic)[0].maddr)
            const { stream, protocol } = await this.node.dialProtocol(this.lookupService.find(topic)[0].maddr, `/get/1.0.0`)
            pipe(
                // Read from stdin (the source)
                Readable.from(msg),

                (source) => (map(source, (string) => fromString(string))),

                //lp.encode(),

                // Write to the stream (the sink)
                stream.sink
            )
        } catch (e) {
            console.error("dialGetError " + e)
            console.log("Removed refrence to " + this.lookupService.find(topic)[0].maddr + " due to Error")
            this.lookupService.unregister(this.lookupService.find(topic)[0].maddr.toString().substring(this.lookupService.find(topic)[0].maddr.toString().lastIndexOf('/') + 1, this.lookupService.find(topic)[0].maddr.toString().length)) //if error with this peer remove him
            console.log("lookupService:" + JSON.stringify(this.lookupService.peerRefrences))
            this.dialGet(msg, topic)
        }
    }

    listen(listener: SubListener, responseId: String) {
        console.log('Listening for response')
        this.node.handle(`/response:${responseId}/1.0.0`, async ({ connection, stream, protocol }) => {
            pipe(
                // Read from the stream (the source)
                stream.source,

                (source) => map(source, (buf) => toString(buf.slice())),
                // Sink function
                async function (source) {
                    console.log("start receiving")
                    let allData = ""
                    // For each chunk of data
                    for await (let chunk of source) {
                        //console.log("One Chunk: %s", chunk.toString())                 --- wieder an machen
                        allData += chunk.toString()
                    }
                    //console.log("All Chunks%s", allData)                --- wieder an machen
                    listener.respond(allData)
                }
            )
            this.unlisten(`/response:${responseId}/1.0.0`)
        })
    }

    listenNewRedundant(redundantTop: redundantTopic, responseId: String) {
        console.log('Listening for response redundant')
        this.node.handle(`/response:${responseId}/1.0.0`, async ({ connection, stream, protocol }) => {
            pipe(
                // Read from the stream (the source)
                stream.source,

                (source) => map(source, (buf) => toString(buf.slice())),
                // Sink function
                async function (source) {
                    console.log("start receiving")
                    let allData = ""
                    // For each chunk of data
                    for await (let chunk of source) {
                        //console.log("One Chunk: %s", chunk.toString())                --- wieder an machen
                        allData += chunk.toString()
                    }
                    //console.log("All Chunks: %s", allData.substring(0, allData.lastIndexOf(' ')))
                    let jsonData = JSON.parse(allData.substring(0, allData.lastIndexOf(' ')))
                    //console.log("bin in Success" + jsonData + " " + JSON.stringify(jsonData))                --- wieder an machen
                    if (jsonData.message == "SUCCESS") {
                        console.log("bin in Success")
                        redundantTop.writeStream.write(JSON.stringify(jsonData.data) + ",\n")
                    }
                }
            )
            this.unlisten(`/response:${responseId}/1.0.0`)
        })
    }

    unlisten(prot: String) {
        this.node.unhandle(prot)
    }

}
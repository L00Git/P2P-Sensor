"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupService = void 0;
class peerRefrence {
    constructor(maddr, topics) {
        this.maddr = maddr;
        this.topics = topics;
    }
}
class lookupService {
    constructor() {
        this.peerRefrences = new Array();
    }
    find(topic) {
        return this.peerRefrences.filter(element => {
            return element.topics.includes(topic);
        });
    }
    register(maddr, topics) {
        let register = true;
        const newPeerRefrence = new peerRefrence(maddr, topics);
        if (this.peerRefrences.some(element => { return element.maddr.equals(maddr); })) //if see new maddr return true => send all my metadata
            register = false;
        if (!this.peerRefrences.some(element => { return element.maddr.equals(maddr) && element.topics.length == topics.length && element.topics.every((value, index) => value == topics[index]); })) {
            this.unregister(maddr.toString().substring(maddr.toString().lastIndexOf('/') + 1, maddr.toString().length));
            this.peerRefrences.push(newPeerRefrence);
        }
        return register;
    }
    unregister(peerId) {
        const index = this.peerRefrences.findIndex(element => {
            console.log(element.maddr.toString().substring(element.maddr.toString().lastIndexOf('/') + 1, element.maddr.toString().length));
            console.log(peerId);
            console.log("boolean: " + (element.maddr.toString().substring(element.maddr.toString().lastIndexOf('/') + 1, element.maddr.toString().length) == peerId).toString());
            return element.maddr.toString().substring(element.maddr.toString().lastIndexOf('/') + 1, element.maddr.toString().length) == peerId;
        });
        if (index > -1)
            this.peerRefrences.splice(index, 1);
    }
    getAllTopics() {
        let topics = new Array();
        this.peerRefrences.forEach(element => {
            topics.push(...element.topics);
        });
        return topics;
    }
}
exports.lookupService = lookupService;
//# sourceMappingURL=lookup.js.map
import { Multiaddr } from "multiaddr";


class peerRefrence {
    maddr: Multiaddr
    topics: Array<String>
    constructor(maddr, topics) {
        this.maddr = maddr
        this.topics = topics
    }
}
export class lookupService {
    peerRefrences: Array<peerRefrence> = new Array()

    find(topic: String): Array<peerRefrence> {
        return this.peerRefrences.filter(element => {
            return element.topics.includes(topic)
        })
    }

    register(maddr: Multiaddr, topics: Array<String>): Boolean {
        let register = true

        const newPeerRefrence = new peerRefrence(maddr, topics)



        if (this.peerRefrences.some(element => { return element.maddr.equals(maddr) })) //if see new maddr return true => send all my metadata
            register = false


        if (!this.peerRefrences.some(element => { return element.maddr.equals(maddr) && element.topics.length == topics.length && element.topics.every((value, index) => value == topics[index]) })) {
            this.unregister(maddr)
            this.peerRefrences.push(newPeerRefrence)
        }


        return register
    }

    unregister(maddr: Multiaddr) {
        const index = this.peerRefrences.findIndex(element => { return element.maddr.equals(maddr) })
        if (index > -1)
            this.peerRefrences.splice(index, 1)
    }

    getAllTopics(): Array<String> {
        let topics: Array<String> = new Array()

        this.peerRefrences.forEach(element => {
            topics.push(...element.topics)
        })
        return topics
    }
}
import { p2pNode } from './p2pNode'
import { EccoBoxServer } from './EchoBoxServer'


// !! redundant Anzahl und Server Topic als Argument !!
async function main() {
    if (process.argv.length >= 1) {

        const p2p = new p2pNode(parseInt(process.argv[2]), process.argv[3])
        await p2p.init()
        const server = new EccoBoxServer(p2p)
        
    } else {
        const p2p = new p2pNode(null, null)
        await p2p.init()
        const server = new EccoBoxServer(p2p)
    }
}
main()





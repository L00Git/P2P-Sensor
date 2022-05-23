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
const p2pNode_1 = require("./p2pNode");
const EchoBoxServer_1 = require("./EchoBoxServer");
// !! redundant Anzahl und Server Topic als Argument !!
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        if (process.argv.length >= 1) {
            const p2p = new p2pNode_1.p2pNode(parseInt(process.argv[2]), process.argv[3]);
            yield p2p.init();
            const server = new EchoBoxServer_1.EccoBoxServer(p2p);
        }
        else {
            const p2p = new p2pNode_1.p2pNode(null, null);
            yield p2p.init();
            const server = new EchoBoxServer_1.EccoBoxServer(p2p);
        }
    });
}
main();
//# sourceMappingURL=app.js.map
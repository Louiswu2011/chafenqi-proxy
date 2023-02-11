import {proxyServer} from "./src/proxy/proxyServer.js";
import {frontServer} from "./src/proxy/frontServer.js";

const frontServerPort = 8082;
const proxyServerPort = 8998;

frontServer.listen(frontServerPort)
frontServer.on("error", (err) => {
    console.error("Frontend server error: ", err)
})
console.log("Frontend server listening on 8082")

proxyServer.listen(proxyServerPort)
proxyServer.on("error", (err) => {
    console.error("Proxy server error: ", err)
})
console.log("Proxy server listening on 8998")
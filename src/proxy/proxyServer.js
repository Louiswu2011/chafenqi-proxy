import http from "http";
import url from "url";
import { setValue, delValue, getValue } from "./appdb.js";
import net from "net";
import {updateChunithmScore, updateMaimaiScore} from "./spider.js";

const server = http.createServer(httpOptions)

const CONNECTION_WHITE_LIST = [
    "127.0.0.1",
    "localhost",

    "tgk-wcaime.wahlap.com",

    "maimai.bakapiano.com",
    "www.diving-fish.com",

    "open.weixin.qq.com",
    "support.weixin.qq.com",
    "weixin110.qq.com",
    "szextshort.weixin.qq.com",
    "szshort.weixin.qq.com",
    "szminorshort.weixin.qq.com",
    "res.wx.qq.com",

    // Server address
    "43.139.107.206"
]

const maimaiUrlPrefix = "http://tgk-wcaime.wahlap.com/wc_auth/oauth/callback/maimai-dx"
const chunithmUrlPrefix = "http://tgk-wcaime.wahlap.com/wc_auth/oauth/callback/chunithm"

function checkHostValidity(host) {
    if (!host) return false;
    host = host.split(":")[0];
    return CONNECTION_WHITE_LIST.find((value) => value === host)
}
function httpOptions(cReq, cRes) {
    cReq.on("error", (e) => {
       console.log("cannot connect to client.")
    });

    console.log("http connection from ", cReq.url, ":", cReq.port)
    var cReqUrl = url.parse(cReq.url)
    // Refuse irrelevant connection
    if (!checkHostValidity(cReqUrl.host)) {
        try {
            console.log("Invalid host: ", cReqUrl.host)
            cRes.statusCode = 400;
            cRes.writeHead(400, {
                "Access-Control-Allow-Origin": "*",
            });
            cRes.end("HTTP/1.1 400 Bad Request (Host not valid)");
        } catch (err) {
            console.error("Error when checking host validity: ", err);
        }
        return;
    }

    if (cReqUrl.href.startsWith(maimaiUrlPrefix) || cReqUrl.href.startsWith(chunithmUrlPrefix)) {
        console.log("hooking request...");

        try {
            const queryUrl = cReqUrl.href.replace("http", "https");
            let queryToken = url.parse(queryUrl, true).query.r;

            let currentGame = cReqUrl.href.startsWith(maimaiUrlPrefix) ? "mai" : "chu"
            queryToken = (cReqUrl.href.startsWith(maimaiUrlPrefix) ? "mai:" : "chu:") + queryToken

            getValue(queryToken).then((value) => {
                if (value !== undefined) {
                    // console.log(queryToken, value);

                    let userToken = value
                    let wahlapToken = queryToken.slice(4)
                    console.log("user token: ", userToken, "\nwahlap token: ", wahlapToken)
                    delValue(queryToken);

                    // update score here
                    if (currentGame === "mai") {
                        updateMaimaiScore(userToken, queryUrl, cRes)
                    } else if (currentGame === "chu") {
                        updateChunithmScore(userToken, queryUrl, cRes)
                    } else {
                        cRes.statusCode = 400
                        cRes.write("Invalid game mode!")
                        cRes.end();
                    }

                    // TODO: Add success page
                    let successPageUrl = ""
                    // cRes.writeHead(302, { location: successPageUrl });
                    cRes.statusCode = 200
                    cRes.write("成绩上传成功！\n您可以立刻关闭该页面，回到查分器刷新缓存即可获取最新数据。", "utf-8")
                    cRes.end();
                } else {
                    console.error("Cannot find user token!")
                }
            });
        } catch (err) {
            console.error(err);
        }

        return;
    }

    var components = {
        hostname: cReqUrl.hostname,
        port: cReqUrl.port,
        path: cReqUrl.path,
        method: cReq.method,
        headers: cReq.headers,
    };

    var connection = http.request(components, function (res) {
        cRes.writeHead(res.statusCode, res.headers);
        res.pipe(cRes);
    });

    connection.on("error", (err) => {
        console.error("server error: " , err);
    });

    cReq.pipe(connection);
}

server.on("connect", (cReq, cSocket, head) => {
    cSocket.on("error", (err) => {
       console.error("client socket error: ", err);
    });

    // console.log("https connection from ", cReq.url)

    var cReqUrl = url.parse("https://" + cReq.url);
    // console.log("href: ", cReqUrl.href)

    // Refuse irrelevant connections
    if (!checkHostValidity(cReqUrl.host) || cReqUrl.href.startsWith("https://maimai.wahlap.com/")) {
        try {
            cSocket.statusCode = 400;
            cSocket.end("HTTP/1.1 400 Bad Request");
        } catch (err) {
            console.error(err);
        }
        return;
    }

    var components = {
        host: cReqUrl.hostname,
        port: cReqUrl.port,
    };

    // console.log("Redirecting https connection to ", components.host, ":", components.port)
    var sSocket = net.connect(components, () => {
       cSocket.write(
           "HTTP/" +
           cReq.httpVersion +
           " 200 Connection Established\r\n" +
           "Proxy-agent: Node.js-Proxy\r\n" +
           "\r\n",
           "utf-8",
           () => {
               sSocket.write(head);
               sSocket.pipe(cSocket);
               cSocket.pipe(sSocket);
           }
       );
    });

    sSocket.on("error", (err) => {
        console.error("error when forwarding connection: ", err);
        cSocket.end();
    });
});

server.on("clientError", (err, cSocket) => {
    // console.log("throw invalid connection.");
    cSocket.statusCode = 400;
    cSocket.end("HTTP/1.1 400 Bad Request");
})

export { server as proxyServer }
import cors from "cors";
import express from "express";
import {getChunithmOAuthUrl, getMaimaiOAuthUrl} from "./spider.js";
import url from "url";
import {delValue, setValue} from "./appdb.js";
import {Sequelize} from "sequelize";

const app = express();
app.use(cors());

async function uploadToken(sReq, sRes, query, dest) {
    console.log("request arrived.")
    let { token } = query
    // console.log("user token: ", token);

    if (!token) {
        sRes.status(400).send("Token不能为空！");
        return;
    }

    // get auth url
    const href = dest === 0 ? await getChunithmOAuthUrl() : await getMaimaiOAuthUrl()

    const resultUrl = url.parse(href, true);
    // console.log("oauth url: ", resultUrl)
    const { redirect_uri } = resultUrl.query;
    // console.log("redirect url:", redirect_uri)
    const r = url.parse(redirect_uri, true).query.r;
    console.log("got r token: ", r)

    dest === 0 ?
        await setValue("chu:" + r, token) :
        await setValue("mai:" + r, token)

    dest === 0 ?
        setTimeout(() => delValue("mai:" + r), 1000 * 60 * 5) :
        setTimeout(() => delValue("chu:" + r), 1000 * 60 * 5)

    sRes.redirect(href)
}

async function getRecentData(sReq, sRes, body) {
    let { mode, username, count } = body

    const dbPath = mode === 0 ?
        "./userdata_chunithm.db" :
        "./userdata_maimai.db"

    const db = new Sequelize({
        dialect: `sqlite`,
        storage: dbPath,
        logging: false
    })

    try {
        await db.authenticate()
        console.log("connected to database.")
    } catch (err) {
        console.error("Error connecting to server: ", err)
    }


    db.query("select * from `" + username + "` order by timestamp desc limit " + count)
        .catch(() => {
            console.log("Cannot find user " + username)
            sRes.status(400).send("")
        })
        .then((result) => {
            sRes.status(200).send(JSON.stringify(result))
        })
        .finally(() => {
            sRes.end()
            db.close()
        })
}

app.get("/upload_chunithm", async (sReq, sRes) => {
    return await uploadToken(sReq, sRes, sReq.query, 0);
})

app.get("/upload_maimai", async (sReq, sRes) => {
    return await uploadToken(sReq, sRes, sReq.query, 1);
})

app.get("/hello", async (sReq, sRes) => {
    sRes.status(200).send("Hello there!");
})

app.get("/latest", async (sReq, sRes) => {
    sRes.status(200)
    sRes.write("<a href=\"itms-services://?action=download-manifest&url=https://onedrive-vercel-index-cx9azbmq9-louiswu2011.vercel.app/api/raw/?path=/App/manifest.plist\">Click to install</a>")
    sRes.end()
})

app.get("/recent", async (sReq, sRes) => {
    return await getRecentData(sReq, sRes, sReq.query)
})

export { app as frontServer }
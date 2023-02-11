import {
    fetch as fetchWithCookie,
    CookieJar,
} from "node-fetch-cookies"

import axios from "axios"

import fetch from "node-fetch"
import * as fs from "fs";

async function getMaimaiOAuthUrl() {
    const res = await fetch("https://tgk-wcaime.wahlap.com/wc_auth/oauth/authorize/maimai-dx");
    const href = res.url.replace("redirect_uri=https", "redirect_uri=http");
    return href;
}

async function getChunithmOAuthUrl() {
    const res = await fetch("https://tgk-wcaime.wahlap.com/wc_auth/oauth/authorize/chunithm");
    const href = res.url.replace("redirect_uri=https", "redirect_uri=http");
    return href;
}

async function updateMaimaiScore(token, oauthUrl) {
    console.log("Uploading maimaiDX scores...")
    const jar = new CookieJar();
    const fishJar = new CookieJar();

    fishJar.addCookie("jwt_token=" + token, "https://www.diving-fish.com")
    const fetch = async (url, options) => await fetchWithCookie(jar, url, options)
    const authResult = await fetch(oauthUrl, {
        headers: {
            Host: "tgk-wcaime.wahlap.com",
            Connection: "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x6307001e)",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-User": "?1",
            "Sec-Fetch-Dest": "document",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        },
    });

    const result = await fetch("https://maimai.wahlap.com/maimai-mobile/home/");
    const body = await result.text();
    if (body.match("错误")) {
        console.error("Error visiting home!");
        return;
    }

    for (let diff = 0; diff < 5; diff++) {
        const result = await fetch(
            `https://maimai.wahlap.com/maimai-mobile/record/musicGenre/search/?genre=99&diff=${diff}`
        );
        const body = await result.text()

        const uploadResult = await fetchWithCookie(fishJar,"https://www.diving-fish.com/api/maimaidxprober/player/update_records_html", {
            method: "POST",
            body: body,
        });

        console.log("Uploading diff " + diff)
    }

    console.log("Upload complete.")
}

async function updateChunithmScore(token, oauthUrl, cRes) {
    axios.defaults.withCredentials = true

    let postUrls = [
        "/record/musicGenre/sendBasic",
        "/record/musicGenre/sendAdvanced",
        "/record/musicGenre/sendExpert",
        "/record/musicGenre/sendMaster",
        "/record/musicGenre/sendUltima",
    ]

    let getUrls = [
        "/record/musicGenre/basic",
        "/record/musicGenre/advanced",
        "/record/musicGenre/expert",
        "/record/musicGenre/master",
        "/record/musicGenre/ultima",
        "/record/worldsEndList/",
        "/home/playerData/ratingDetailRecent/",
    ]

    console.log("Uploading Chunithm scores...")

    const jar = new CookieJar();
    const fishJar = new CookieJar()

    fishJar.addCookie("jwt_token=" + token, "https://www.diving-fish.com")
    const fetch = async (url, options) => await fetchWithCookie(jar, url, options)
    await fetch(oauthUrl, {
        headers: {
            Host: "tgk-wcaime.wahlap.com",
            Connection: "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x6307001e)",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-User": "?1",
            "Sec-Fetch-Dest": "document",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        },
    });

    const result = await fetch("https://chunithm.wahlap.com/chunithm/home/");
    const body = await result.text();
    if (body.match("错误")) {
        console.error("Error visiting home?")
        return;
    }

    for (let i = 0; i < 7; i++) {
        if (i < 5) {
            const sendResult = await fetch("https://chunithm.wahlap.com/mobile" + postUrls[i], {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: "genre=99&token=" + jar.cookies.get('chunithm.wahlap.com').get('_t').value
            })
        }

        const getResult = await fetch("https://chunithm.wahlap.com/mobile" + getUrls[i], {
            method: "GET",
        })

        const uploadContent = await getResult.text()

        console.log("Uploading score for ", getUrls[i])
        let uploadUrl = "https://www.diving-fish.com/api/chunithmprober/player/update_records_html"
        if (i === 6) { uploadUrl += "?recent=1" }
        const uploadResult = await fetchWithCookie(fishJar, uploadUrl, {
            method: "POST",
            body: uploadContent
        });
    }

    console.log("Upload complete.")
}

export {
    updateMaimaiScore,
    updateChunithmScore,
    getMaimaiOAuthUrl,
    getChunithmOAuthUrl
}
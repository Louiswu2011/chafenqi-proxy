import {CookieJar, fetch as fetchWithCookie,} from "node-fetch-cookies"

import axios from "axios"

import fetch from "node-fetch"
import {parse} from "node-html-parser"
import {DataTypes, Sequelize} from "sequelize"

async function getMaimaiOAuthUrl() {
    const res = await fetch("https://tgk-wcaime.wahlap.com/wc_auth/oauth/authorize/maimai-dx");
    return res.url.replace("redirect_uri=https", "redirect_uri=http");
}

async function getChunithmOAuthUrl() {
    const res = await fetch("https://tgk-wcaime.wahlap.com/wc_auth/oauth/authorize/chunithm");
    return res.url.replace("redirect_uri=https", "redirect_uri=http");
}

async function updateMaimaiScore(token, oauthUrl, cRes) {
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

        const resultText = (await result.text())
            .match(/<html.*>([\s\S]*)<\/html>/)[1]
            .replace(/\s+/g, " ");

        const parseResult = await fetchWithCookie(fishJar,"http://www.diving-fish.com:8089/page", {
            method: "POST",
            headers: { "content-type": "text/plain" },
            body: resultText
        });

        const uploadResult = await fetchWithCookie(fishJar, "https://www.diving-fish.com/api/maimaidxprober/player/update_records", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: await parseResult.text()
        })

        console.log("Uploading diff " + diff)
        console.log(await uploadResult.text())
    }

    // Upload recent score to local db
    const db = new Sequelize({
        dialect: `sqlite`,
        storage: `./userdata_maimai.db`,
        logging: false
    })

    try {
        await db.authenticate()
        console.log("connected to database.")
    } catch (err) {
        console.error("Error connecting to server: ", err)
    }

    const response = await fetchWithCookie(fishJar, "https://www.diving-fish.com/api/maimaidxprober/player/profile", {
        method: "GET"
    })

    const {username} = JSON.parse(await response.text())

    console.log("got username: ", username)

    const userdata = db.define("RecentData", {
        timestamp: {
            type: DataTypes.INTEGER,
            primaryKey: true
        },
        title: {
            type: DataTypes.STRING
        },
        achievement: {
            type: DataTypes.STRING
        },
        is_new_record: {
            type: DataTypes.INTEGER
        },
        dx_score: {
            type: DataTypes.STRING
        },
        fc_status: {
            type: DataTypes.STRING
        },
        fs_status: {
            type: DataTypes.STRING
        },
        note_tap: {
            type: DataTypes.STRING,
            allowNull: true
        },
        note_hold: {
            type: DataTypes.STRING,
            allowNull: true
        },
        note_slide: {
            type: DataTypes.STRING,
            allowNull: true
        },
        note_touch: {
            type: DataTypes.STRING,
            allowNull: true
        },
        note_break: {
            type: DataTypes.STRING,
            allowNull: true
        },
        max_combo: {
            type: DataTypes.STRING
        },
        max_sync: {
            type: DataTypes.STRING,
            allowNull: true
        },
        matching_1: {
            type: DataTypes.STRING,
            allowNull: true
        },
        matching_2: {
            type: DataTypes.STRING,
            allowNull: true
        },
        matching_3: {
            type: DataTypes.STRING,
            allowNull: true
        },
    }, {
        db,
        modelName: "RecentData",
        tableName: username
    })
    await userdata.sync()

    const recentPlayResult = await fetch(`https://maimai.wahlap.com/maimai-mobile/record/`)
    const recentPlayBody = await recentPlayResult.text()

    const html = parse(recentPlayBody)
    const idxList = html.querySelectorAll(".playlog_result_block.m_t_5.f_l")
        .flatMap((item) => item.querySelector(`input`).getAttribute(`value`))

    for (const idx of idxList) {
        const result = await fetch(`https://maimai.wahlap.com/maimai-mobile/record/playlogDetail/?idx=${idx}`, {
            method: "GET"
        })

        const html = parse(await result.text())

        const title = html.querySelector(".basic_block.m_5.p_5.p_l_10.f_13.break").text
        const achievement = html.querySelector(".playlog_achievement_txt.t_r").text
        const newRecord = html.querySelector(".playlog_deluxscore_newrecord") != null
        const dxScore = html.querySelector(".white.p_r_5.f_15.f_r").text
            .replace(",", "")
        let fcStatus = html.querySelectorAll(".h_35.m_5.f_l")[0].getAttribute("src").match("\\/([a-zA-z]+).png")[1]
            .replace("_", "")
        let fsStatus = html.querySelectorAll(".h_35.m_5.f_l")[1].getAttribute("src").match("\\/([a-zA-z]+).png")[1]
            .replace("_", "")

        let notes = []
        html.querySelector("table.playlog_notes_detail.t_r.f_l.f_11.f_b")
            .querySelectorAll("tr")
            .forEach((item, index) => {
                if (index !== 0) {
                    notes.push(item.querySelectorAll("td")
                        .flatMap((item) => item.text))
                }
            })

        const maxCombo = html.querySelectorAll(".f_r.f_14.white")[0].text
        const maxSync = html.querySelectorAll(".f_r.f_14.white")[1].text
        const matching = html.querySelectorAll(".basic_block.p_3.t_c.f_11").map((item) => item.text)

        const playTime = Date.parse(html.querySelectorAll("span.v_b")[1].text) / 1000

        try {
            const entry = await userdata.create({
                timestamp: playTime,
                title: title,
                achievement: achievement,
                is_new_record: newRecord ? 1 : 0,
                dx_score: dxScore,
                fc_status: fcStatus === "fcdummy" ? null : fcStatus,
                fs_status: fsStatus === "fsdummy" ? null : fsStatus,
                note_tap: notes[0].length === 0 ? null : notes[0].join(),
                note_hold: notes[1].length === 0 ? null : notes[1].join(),
                note_slide: notes[2].length === 0 ? null : notes[2].join(),
                note_touch: notes[3].length === 0 ? null : notes[3].join(),
                note_break: notes[4].length === 0 ? null : notes[4].join(),
                max_combo: maxCombo,
                max_sync: maxSync,
                matching_1: matching[0],
                matching_2: matching[1],
                matching_3: matching[2]
            })
        } catch (err) {
            // Suppress Duplicate Error
        }

        console.log("Uploaded idx " + idx)
    }

    console.log("Upload recent complete.")
    await db.close()


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

    // Upload recent score to local db
    const db = new Sequelize({
        dialect: `sqlite`,
        storage: `./userdata_chunithm.db`,
        logging: false
    })

    try {
        await db.authenticate()
        console.log("connected to database.")
    } catch (err) {
        console.error("Error connecting to server: ", err)
    }

    const response = await fetchWithCookie(fishJar, "https://www.diving-fish.com/api/chunithmprober/player/profile", {
        method: "GET"
    })

    const {username} = JSON.parse(await response.text())

    console.log("got username: ", username)

    const userdata = db.define("RecentData", {
        playtime: {
            type: DataTypes.INTEGER,
            primaryKey: true
        },
        title: {
            type: DataTypes.STRING
        },
        score: {
            type: DataTypes.STRING
        },
        is_new_record: {
            type: DataTypes.INTEGER
        },
        fc_status: {
            type: DataTypes.STRING
        },
        rank_index: {
            type: DataTypes.STRING
        },
        judge_critical: {
            type: DataTypes.STRING
        },
        judge_justice: {
            type: DataTypes.STRING
        },
        judge_attack: {
            type: DataTypes.STRING
        },
        judge_miss: {
            type: DataTypes.STRING
        },
        note_tap: {
            type: DataTypes.STRING
        },
        note_hold: {
            type: DataTypes.STRING
        },
        note_slide: {
            type: DataTypes.STRING
        },
        note_air: {
            type: DataTypes.STRING
        },
        note_flick: {
            type: DataTypes.STRING
        }
    }, {
        db,
        modelName: "RecentData",
        tableName: username
    })
    await userdata.sync()

    const recentLogResult = await fetch("https://chunithm.wahlap.com/mobile/record/playlog", {
        method: "GET"
    })

    const html = parse(await recentLogResult.text())
    const idxList = html.querySelectorAll(".frame02.w400")
        .flatMap((item) => item.querySelectorAll(`input`)[0].getAttribute(`value`))
    const tokenList = html.querySelectorAll(".frame02.w400")
        .flatMap((item) => item.querySelectorAll(`input`)[1].getAttribute(`value`))

    for (const idx in idxList) {
        const postLogDetailResult = await fetch("https://chunithm.wahlap.com/mobile/record/playlog/sendPlaylogDetail/", {
            method: "POST",
            body: `idx=${idx}&token=${tokenList[0]}`
        })

        const html = parse(await postLogDetailResult.text())
        const playtime = Date.parse(html.querySelector(".box_inner01").text) / 1000
        const title = html.querySelector(".play_musicdata_title").text
        const score = html.querySelector(".play_musicdata_score_text").text
            .replaceAll(",", "")
        const is_new_record = html.querySelector(".play_musicdata_score_img") === null
        const fc_status = html.querySelector(".play_musicdata_icon.clearfix")
            .querySelectorAll("img")[0]
            .getAttribute("src")
            .match("\\icon_([a-zA-z]+).png")[1]
        const rank_index = html.querySelector(".play_musicdata_icon.clearfix")
            .querySelectorAll("img")[1]
            .getAttribute("src")
            .match("\\icon_rank_([0-9]+).png")[1]
        const judge_critical = html.querySelector(".text_critical.play_data_detail_judge_text").text
            .replaceAll(",", "")
        const judge_justice = html.querySelector(".text_justice.play_data_detail_judge_text").text
            .replaceAll(",", "")
        const judge_attack = html.querySelector(".text_attack.play_data_detail_judge_text").text
            .replaceAll(",", "")
        const judge_miss = html.querySelector(".text_miss.play_data_detail_judge_text").text
            .replaceAll(",", "")
        const note_tap = html.querySelector(".font_90.text_tap_red.play_data_detail_notes_text").text
        const note_hold = html.querySelector(".font_90.text_hold_yellow.play_data_detail_notes_text").text
        const note_slide = html.querySelector(".font_90.text_slide_blue.play_data_detail_notes_text").text
        const note_air = html.querySelector(".font_90.text_air_green.play_data_detail_notes_text").text
        const note_flick = html.querySelector(".font_90.text_flick_skyblue.play_data_detail_notes_text").text

        try {
            const entry = userdata.create({
                playtime: playtime,
                title: title,
                score: score,
                is_new_record: is_new_record,
                fc_status: fc_status,
                rank_index: rank_index,
                judge_critical: judge_critical,
                judge_justice: judge_justice,
                judge_attack: judge_attack,
                judge_miss: judge_miss,
                note_tap: note_tap,
                note_hold: note_hold,
                note_slide: note_slide,
                note_air: note_air,
                note_flick: note_flick
            })
        } catch (err) {

        }
    }

    await db.close()
    console.log("Uploaded recent data.")

    console.log("Upload complete.")
}

export {
    updateMaimaiScore,
    updateChunithmScore,
    getMaimaiOAuthUrl,
    getChunithmOAuthUrl
}
"use strict";

require('dotenv').config();
const Discord = require('discord.js');
const Browser = require("zombie");
const MongoClient = require('mongodb').MongoClient;

const startDate = new Date();
let endDate = new Date();
endDate = endDate.setDate(endDate.getDate() + 1);
let lastURLDicewars;

const login = process.env.LOGIN;
const password = process.env.PASSWORD;
const dbUri = process.env.MONGODB_URI;
const discordId = process.env.DISCORD_ID;
const discordToken = process.env.DISCORD_TOKEN;
const discordHook = new Discord.WebhookClient(discordId, discordToken);
const browser = new Browser({silent: true});

process.on('uncaughtException', function (error) {
    console.log("\x1b[31m", "Exception: ", error, "\x1b[0m");
});

async function connectToDB() {
    try {
        let dbMain = await MongoClient.connect(dbUri, {useUnifiedTopology: true});
        let db = await dbMain.db('heroku_mmbfnmr0');

        let collectionLastURLDicewars = await db.collection('lastURLDicewars');
        lastURLDicewars = await collectionLastURLDicewars.findOne();
        lastURLDicewars = JSON.parse(lastURLDicewars.lastURLDicewars);
    } catch (e) {
        debug('Cant find lastURL and in mongodb before start parser!!!');
        debug(e);
        await sendMessage('debug: Cant find lastURL and in mongodb before start parser!!! ' + e, {}, true);
        lastURLDicewars = [];
        lastURLDicewars[11] = 'nothing';
    }
}

async function disconnectFromDB() {
    if (lastURLDicewars.length) {
        try {
            let dbMain = await MongoClient.connect(dbUri, {useUnifiedTopology: true});
            let db = await dbMain.db('heroku_mmbfnmr0');
            let collectionLastURLDicewars = await db.collection('lastURLDicewars');
            await collectionLastURLDicewars.updateOne({}, {$set: {"lastURLDicewars": JSON.stringify(lastURLDicewars)}});
            await dbMain.close();

        } catch (e) {
            debug('Cant save lastURL and close connection before exit!!!');
            debug(e);
        }
    }
}

browser.visit("https://epicmafia.com/home", function () {
    debug('TESTING: on the login page');
    browser.fill('#login_form > p:nth-child(1) > input[type=text]', login);
    browser.fill('#login_form > p:nth-child(2) > input[type=password]', password);
    browser.pressButton('#login_form > .submit > .red', async function () {
        debug('TESTING: logged in');
        await connectToDB();

        debug('after connection to db, lastURL = ' + lastURLDicewars);

        let i = 0;

        debug('_Проснулась; Последний раз была тут: [' +
            getGameNumberByLink(lastURLDicewars[11]) + '](' + lastURLDicewars[11] + ')');

        debug(browser.source.substring(0, 40));
        let parsedObjData = await getParsedObj(browser.source);
        while (endDate - new Date() > 9000000) {
            try {
                debug(browser.source.substring(0, 40));
                debug('current time = ' + getCurrentTime() + ' and current loop step is ' + i);
                debug(endDate - new Date());
                await sendURLIfExist(parsedObjData);

                parsedObjData = await getRequestData();
                await ((delay) => {
                    return new Promise(resolve => {
                        setTimeout(resolve, delay)
                    });
                })(3000);
                i++;
            } catch (e) {
                debug('AFTER ERROR: current time = ' + getCurrentTime() + ' and current loop step is ' + i + ' and wait 1 min');
                debug('Error while sendURLIfExist(getParsedObj(browser.source))!!!');
                debug(e);
                await sendMessage('debug: Error while sendURLIfExist(getParsedObj(browser.source))!!! ' + e, {}, true);
                await ((delay) => {
                    return new Promise(resolve => {
                        setTimeout(resolve, delay)
                    });
                })(60000);
                i++;
            }
        }
        debug('start date = ' + startDate);
        debug('end   date = ' + getCurrentTime());

        debug('_Ушла баиньки; Сохранила последнюю: [' +
            getGameNumberByLink(lastURLDicewars[11]) + '](' + lastURLDicewars[11] + ')');

        await disconnectFromDB();
        try {
            await browser.tabs.closeAll();
        } catch (e) {
            debug('Cant close browser before exit!!!');
            debug(e);
        }
        await process.exit(0);
    })
});

function getParsedObj(data) {
    try {
        let sub1 = data.split('window.gamepage = \"')[1];
        let gamedata = sub1.split('\";', 1)[0];
        gamedata = gamedata.replace(/\\"/g, '\"');
        return JSON.parse(gamedata).data;
    } catch (e) {
        console.log('Error in getParsedObj(data) function!!!');
        console.log(e);
        throw e;
    }
}

async function sendURLIfExist(obj) {
    debug('in send URL If Exist function');
    for (let currentGameIndex = obj.length - 1; currentGameIndex >= 0; currentGameIndex--) {
        let game = obj[currentGameIndex];
        let isCanJoinGame = game.action === ('Join game');
        let isGameWithPassword = game.password === true;
        let gameType = game.gametype;
        let playersNumber = game.target;
        let isGameTypeDicewars = gameType === 'dicewars';

        if (!isGameWithPassword && isGameTypeDicewars && isCanJoinGame) {
            let gameURL = 'https://epicmafia.com/game/' + game.id;
            if (lastURLDicewars.indexOf(gameURL) === -1) {
                lastURLDicewars.shift();
                lastURLDicewars[11] = gameURL;
                let sendingMessage = 'Game on ' + playersNumber + ' players: ' + gameURL;
                await sendMessageToDicewarsChannel(sendingMessage);
            }
        }
    }
}

async function getRequestData() {
    let resultJSONArray = await browser.fetch('https://epicmafia.com/game/find?page=1').then(response => response.json());
    let resultResponse = resultJSONArray[1];
    let resultJSON = JSON.parse(resultResponse).data;
    return resultJSON;
}

async function sendMessageToDicewarsChannel(sendingMessage) {
    try {
        await discordHook.send(sendingMessage);
    } catch (e) {
        debug('Sending message to discord.');
        debug(e);
    }
}

function getCurrentTime() {
    let today = new Date();
    return today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
}

function getGameNumberByLink(link) {
    return link.match(/game\/(\d*)/)[1];
}

function debug(msg) {
    console.log(msg);
}

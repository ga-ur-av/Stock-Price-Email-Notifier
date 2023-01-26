const express = require('express');
const { default: puppeteer } = require('puppeteer');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const hbs = require('nodemailer-express-handlebars');
const path = require('path');
require('dotenv').config();

const app = express();

cron.schedule('30 10,14 * * *', async () => {
    console.log('cron is working');
})

app.get('/', (req, res) => {
    res.send("This is working");
});

var stockApi;

async function scrapeChannel(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);

    const [el] = await page.$x('/html/body/div/div[2]/div[2]/div[2]/div/div/div[1]/div/div/table/tbody/tr[1]/td[1]/a')
    const text = await el.getProperty('textContent');
    const stName = await text.jsonValue();

    const [el2] = await page.$x('/html/body/div/div[2]/div[2]/div[2]/div/div/div[1]/div/div/table/tbody/tr[1]/td[3]/text()')
    const priceSrc = await el2.getProperty('textContent');
    let priceVal = await priceSrc.jsonValue();

    const [el3] = await page.$x('/html/body/div/div[2]/div[2]/div[2]/div/div/div[1]/div/div/table/tbody/tr[1]/td[4]')
    const lowSrc = await el3.getProperty('textContent');
    const lowVal = await lowSrc.jsonValue();

    const [el4] = await page.$x('/html/body/div/div[2]/div[2]/div[2]/div/div/div[1]/div/div/table/tbody/tr[1]/td[5]')
    const highSrc = await el4.getProperty('textContent');
    const highVal = await highSrc.jsonValue();

    const [el5] = await page.$x('/html/body/div/div[2]/div[2]/div[2]/div/div/div[1]/div/div/table/tbody/tr[1]/td[3]/div')
    const downBy = await el5.getProperty('textContent');
    const downVal = await downBy.jsonValue();

    let downValMod = downVal.replace(/\(.*?\)/gm, "");
    downValMod = downValMod.replace(/\+/g, "");
    downValMod = downValMod.replace(/\-/g, "");
    let priceValMod = priceVal.replace(/\₹/g, "");
    priceValMod = priceValMod.replace(/,/, '');

    let pTemp = (downValMod / priceValMod) * 100;

    let percentage = parseFloat(pTemp).toFixed(2);

    if (percentage * 100 < 1000) {
        function sendmail() {
            const mailTransporter = nodemailer.createTransport({
                service: 'gmail',
                secure: true,
                auth: {
                    user: process.env.GID,
                    pass: process.env.GPW
                },
                tls: {
                    rejectUnauthorized: false
                }
            });

            const handlebarOptions = {
                viewEngine: {
                    extName: ".handlebars",
                    partialsDir: path.resolve('./view'),
                    defaultLayout: false
                },
                viewPath: path.resolve('./views'),
                extName: ".handlebars",
            }

            mailTransporter.use('compile', hbs(handlebarOptions));

            let mailDetails = {
                from: process.env.GID,
                to: process.env.GID,
                subject: `Your stock is down by ${percentage}%`,
                template: 'email',
                context: {
                    userN: 'Gaurav',
                    name: stName,
                    pct: percentage,
                    pVal: priceVal,
                    hVal: highVal,
                    lVal: lowVal
                }
                // text: `Your stock ${stName} is down by ${downVal}, current price is ${priceVal}, 52 Week Low price is ${lowVal}, 52 Week High price is ${highVal}`
            };

            mailTransporter.sendMail(mailDetails, function (err, data) {
                if (err) {
                    console.log('Error occured ' + err);
                } else {
                    console.log('Email sent successfully');
                }
            });
        }
        sendmail();
    }


    stockApi = {
        stocksName: stName,
        currentPrice: priceVal,
        lowPrice: lowVal,
        highPrice: highVal,
        downBy: downVal
    }

    // console.log(stockApi);

    browser.close();

}

scrapeChannel('https://groww.in/markets/top-losers?index=GIDXNIFTY100');

const port = 3000;

app.listen(port, () => {
    console.log(`server started at port ${port}`);
})

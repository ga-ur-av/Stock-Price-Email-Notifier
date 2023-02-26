const express = require('express');
const { default: puppeteer } = require('puppeteer');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const eHbs = require('nodemailer-express-handlebars');
const path = require('path');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const users = require('./models/schema');
require('dotenv').config();

const app = express();

app.set('views', path.join(__dirname, '/views'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(express.json());

app.set('view enginer', 'hbs');
app.use(express.static('public'));

// Connection to mongoose

mongoose.set('strictQuery', false);
mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true})
.then(() => {
    console.log('DB Connected');
})
.catch((err) => {
    console.log(err);
})

app.get('/', (req, res) => {
    res.render('index.hbs');
});

// collecting data from users
app.post('/', (req, res) => {
    const userName = req.body.name;
    const userEmail = req.body.email;
    console.log(userName, " \n" + userEmail);
    const user = new users({
        name: userName,
        email: userEmail
    })

    user.save((err, doc) => {
        if(!err){
            res.redirect('./subbed.html')
        } else{
            console.log('error is: ' + err);
        }
    })
})

// cron.schedule('45 14 * * *', async () => {
//     await scrapeChannel('https://groww.in/markets/top-losers?index=GIDXNIFTY100');
//     console.log('Mail sent successfully');
// })

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

    // Getting all the users

    var mailList = [];
    users.find({}, function(err, allUsers){
        if(err){
            console.log(err);
        }
        allUsers.forEach(function(users){
            mailList.push(users.email);
            return mailList;
        })
    })


    if (true) {
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

            mailTransporter.use('compile', eHbs(handlebarOptions));

            let mailDetails = {
                from: process.env.GID,
                to: process.env.GID,
                bcc: mailList,
                subject: `Your stock is down by ${percentage}%`,
                template: 'email',
                context: {
                    userN: 'Gaurav',
                    name: stName,
                    pct: percentage + '%',
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

    browser.close();

}

scrapeChannel('https://groww.in/markets/top-losers?index=GIDXNIFTY100');

const port = 3000;

app.listen(port, () => {
    console.log(`server started at port ${port}`);
})

const got = require("got");
const tunnel = require("tunnel");
const fs = require('fs');
const chalk = require('chalk');
const { v4: uuidv4 } = require('uuid');
const adyenEncrypt = require('node-adyen-encrypt')(18);
const { NoCaptchaTaskProxyless } = require("node-capmonster");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const parser = require("fast-xml-parser");
const countries = {"US":"United States", "CA":"Canada"};
const states = {
    "AL": "Alabama",
    "AK": "Alaska",
    "AS": "American Samoa",
    "AZ": "Arizona",
    "AR": "Arkansas",
    "CA": "California",
    "CO": "Colorado",
    "CT": "Connecticut",
    "DE": "Delaware",
    "DC": "District Of Columbia",
    "FM": "Federated States Of Micronesia",
    "FL": "Florida",
    "GA": "Georgia",
    "GU": "Guam",
    "HI": "Hawaii",
    "ID": "Idaho",
    "IL": "Illinois",
    "IN": "Indiana",
    "IA": "Iowa",
    "KS": "Kansas",
    "KY": "Kentucky",
    "LA": "Louisiana",
    "ME": "Maine",
    "MH": "Marshall Islands",
    "MD": "Maryland",
    "MA": "Massachusetts",
    "MI": "Michigan",
    "MN": "Minnesota",
    "MS": "Mississippi",
    "MO": "Missouri",
    "MT": "Montana",
    "NE": "Nebraska",
    "NV": "Nevada",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "NM": "New Mexico",
    "NY": "New York",
    "NC": "North Carolina",
    "ND": "North Dakota",
    "MP": "Northern Mariana Islands",
    "OH": "Ohio",
    "OK": "Oklahoma",
    "OR": "Oregon",
    "PW": "Palau",
    "PA": "Pennsylvania",
    "PR": "Puerto Rico",
    "RI": "Rhode Island",
    "SC": "South Carolina",
    "SD": "South Dakota",
    "TN": "Tennessee",
    "TX": "Texas",
    "UT": "Utah",
    "VT": "Vermont",
    "VI": "Virgin Islands",
    "VA": "Virginia",
    "WA": "Washington",
    "WV": "West Virginia",
    "WI": "Wisconsin",
    "WY": "Wyoming",
    "ON": "Ontario"
}

let cacheHH = 0;
let cacheHM = 0;
let cacheMM = 0;
let cacheMH = 0;

const webhook = "https://discord.com/api/webhooks/840444854503866399/FIsdXZOh7jQSQSS9tBOvKCWEhM5sw7QUbSCt6mBmTMWajwkzxq7JXJFcaldx8qU31Y7m";

module.exports = class Task{
    constructor(taskNum, profile, SKU, site, proxylist) {
        this.SKU = SKU;
        this.proxylist = proxylist;
        this.site = site;
        this.taskNum = taskNum;
        this.currProxy = "";
        this.profileName = profile.Name;
        this.fname = profile.Shipping.FirstName;
        this.lname = profile.Shipping.LastName;
        this.phone = profile.Phone;
        this.email = profile.Email;
        this.line1 = profile.Shipping.Address;
        this.line2 = profile.Shipping.Apt;
        this.postal = profile.Shipping.Zip;
        this.city = profile.Shipping.City;
        this.country = profile.Country;
        this.state = profile.Shipping.State;
        this.ccNum = profile.CCNumber;
        this.exp = {month:profile.ExpMonth, year:profile.ExpYear};
        this.cvv = profile.CVV;
        this.proxyAgent = "";
        this.cookies = {"waiting_room=":"", "JSESSIONID=":"", "datadome=":"", "cart-guid=":""};
        this.csrf = "";
        this.prodInfo = "";
        this.ddStatus = "";
        this.currIndex = 0;
        this.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
        this.guid = "";
        this.sizeInfo = "";
    }
    
    async start(){
        await this.getProxy();
        await this.createSession();
    }
    async getProxy() {
        let proxies = fs.readFileSync(`${this.proxylist}`).toString().split('\n');
        let prox = proxies[Math.floor(Math.random() * proxies.length)];
        this.currProxy = prox;
        prox = prox.split(":");
        prox[1] = prox[1].trim();
        prox[3] = prox[3].trim();
        if (prox.length > 2){
            this.proxyAgent = tunnel.httpsOverHttp({
                proxy: {
                    host: prox[0],
                    port: prox[1],
                    proxyAuth: `${prox[2]}:${prox[3]}`
                }
            })
                
        }
        
        else {
            this.proxyAgent = tunnel.httpsOverHttp({
                proxy: {
                    host: prox[0],
                    port: prox[1]
                }
            })
        }
    }

    async removeNullCookies() {
        let obj = this.cookies;
        for (var propName in obj) {
            if (obj[propName] === "") {
            delete obj[propName];
            }
        }
        let cookieString = "";
        for (var key in obj) {
            if (cookieString.length === 0) {
                cookieString = key+obj[key];
            }
            else {
                cookieString = cookieString +"; "+ key+obj[key];
            }
            
        }
        return cookieString;
    }

    async createSession() {
        await this.getProxy();
        console.log(chalk.yellow(`[${this.taskNum}] - Creating Session...`));
        try {
            let reqCookieString = await this.removeNullCookies();
            if (reqCookieString.length === 0) {
                reqCookieString = undefined;
            }
            let response = await got(`https://${this.site}/api/session?timestamp=${Date.now().toString()}`, {
                headers: {
                    "accept": "application/json",
                    "accept-language": "en-US,en;q=0.9",
                    "content-type": "application/json",
                    "sec-ch-ua": "\" Not A;Brand\";v=\"99\", \"Chromium\";v=\"90\", \"Google Chrome\";v=\"90\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "cookie": reqCookieString,
                    'user-agent': this.userAgent,
                    'x-fl-request-id': uuidv4().toString()
                    //'DNT': 1,
                },
                timeout: 7000,
                retry: {limit: 5, methods: ["GET", "POST"]},
                agent: {
                    https: this.proxyAgent
                }
                
            });
            
            if (response.statusCode === 200) {
                this.csrf = JSON.parse(response.body).data.csrfToken;
                if (response.headers["set-cookie"]){
                    for (let i=0; i<response.headers["set-cookie"].length; i++){
                        let cookie = response.headers["set-cookie"][i];
                        let cookieKey = cookie.substring(0, cookie.indexOf("=")+1);
                        this.cookies[cookieKey] = cookie.substring(cookie.indexOf("=")+1);
                    }
                    this.prodInfo = await this.findProduct();
                    await this.atc();
                }
                else {
                    this.prodInfo = await this.findProduct();
                    await this.atc();
                }
                
            }

        } catch (e) {
            if (e.response){
                if (e.response.statusCode === 403){
                    console.log(chalk.magenta(`[${this.taskNum}] - DD captcha on creating session! Rotating Proxy...`));
                    await sleep(3000);
                    await this.createSession();
                    
                }
                else if (e.response.statusCode === 529){
                    if (e.response.headers["set-cookie"]){
                        console.log(`[${this.taskNum}] - IN QUEUE...`);
                        for (let i=0; i<e.response.headers["set-cookie"].length; i++){
                            let cookie = e.response.headers["set-cookie"][i];
                            let cookieKey = cookie.substring(0, cookie.indexOf("=")+1);
                            this.cookies[cookieKey] = cookie.substring(cookie.indexOf("=")+1);
                        }
                        await sleep(40000);
                        await this.createSession();
                        
                    }
                    else {
                        console.log(`[${this.taskNum}] - PERMA QUEUE...`);
                        await sleep(60000);
                        await this.createSession();
                    }
                }
                else {
                    console.log(chalk.red(`[${this.taskNum}] - Unknown error retrying...`));
                    console.log(e);
                    await sleep(3000);
                    await this.createSession();
                }
            }
            else {
                console.log(chalk.red(`[${this.taskNum}] - Unknown error retrying...`));
                console.log(e);
                await sleep(3000);
                await this.createSession();
            }
        }
    
    }
    
    async atc(){
            try{
                let reqCookieString = await this.removeNullCookies();
                let sizeInfo = await this.getSize();
                let response = await got.post(`https://${this.site}/apigate/users/carts/current/entries?timestamp=${Date.now().toString()}`, 
                    {
                        headers: {
                            'accept': "application/json",
                            'accept-language': "en-CA,en;q=1.0",
                            'accept-encoding': "gzip, deflate, br",
                            'host': `${this.site}`,
                            'referer': `https://${this.site}/product/~/${this.SKU}.html`,
                            'cookie': reqCookieString,
                            'user-agent': this.userAgent,
                            'x-csrf-token': this.csrf,
                            'x-fl-productid': sizeInfo.sizePID.toString(),
                            'x-fl-request-id': uuidv4().toString(),
                            'x-flapi-session-id': this.cookies["JSESSIONID="]
                        },
                        json: {
                            productQuantity: 1,
                            productId: sizeInfo.sizePID
                        },
                        timeout: 7000,
                        retry: {limit: 5, methods: ["GET", "POST"]},
                        agent: {
                            https: this.proxyAgent
                        }
                    
                });
                
                if (response.statusCode === 200){
                    console.log(chalk.bgGreen(`[${this.taskNum}] - ${sizeInfo.prodName} [${sizeInfo.sizeName}] Added to cart!`));
                    
                    for (let i=0; i<response.headers["set-cookie"].length; i++){
                        let cookie = response.headers["set-cookie"][i];
                        let cookieKey = cookie.substring(0, cookie.indexOf("=")+1);
                        this.cookies[cookieKey] = cookie.substring(cookie.indexOf("=")+1);
                    }
                    
                    this.guid = JSON.parse(response.body)["guid"];
                    this.sizeInfo = sizeInfo;
                    await this.submitEmail();
                }

    
            } catch (e){
                if (e.response){
                    if (e.response.statusCode === 403){
                        console.log(chalk.magenta(`[${this.taskNum}] - DD captcha! Attempting to solve...`));
                        
                        if (e.response.headers["set-cookie"]){
                            for (let i=0; i<e.response.headers["set-cookie"].length; i++){
                                let cookie = e.response.headers["set-cookie"][i];
                                let cookieKey = cookie.substring(0, cookie.indexOf("=")+1);
                                this.cookies[cookieKey] = cookie.substring(cookie.indexOf("=")+1);
                            }
                        }
                        let captchaURL = JSON.parse(e.response.body)["url"];
                        await this.ddCaptcha(captchaURL, "atc");
                        
                    }
                    else if (e.response.statusCode === 429 || e.response.statusCode === 531){
                        //console.log(chalk.yellow(`[${this.taskNum}] - [${e.response.statusCode +" "+ e.response.headers["x-cache"]}] OOS Retrying...`));
                        if (e.response.headers["x-cache"] === "HIT, HIT") {
                            cacheHH += 1; 
                        } 
                        if (e.response.headers["x-cache"] === "HIT, MISS") {
                            cacheHM += 1;
                        } 
                        if (e.response.headers["x-cache"] === "MISS, MISS") {
                            cacheMM += 1;
                            
                        } 
                        if (e.response.headers["x-cache"] === "MISS, HIT") {
                            cacheMH += 1;
                        }
                        console.log(
                            chalk.white(
                                `OUT OF STOCK - [HIT, HIT ${cacheHH}] - [HIT,MISS ${cacheHM}] - [MISS,MISS ${cacheMM}] - [MISS,HIT ${cacheMH}] Total Tested: ${cacheMM+cacheHH+cacheHM+cacheMH} - Percent: ${
                                (cacheMM / (cacheMM+cacheHH+cacheHM+cacheMH)) * 100
                                }`
                            )
                        );
                        if (e.response.headers["set-cookies"]){
                            for (let i=0; i<e.response.headers["set-cookie"].length; i++){
                                let cookie = e.response.headers["set-cookie"][i];
                                let cookieKey = cookie.substring(0, cookie.indexOf("=")+1);
                                this.cookies[cookieKey] = cookie.substring(cookie.indexOf("=")+1);
                            }
                            await sleep(1500);
                            await this.atc();
                        }
                        else {
                            await sleep(1500);
                            await this.atc();
                        }
                        
                    }
                    else{
                        console.log(e.response.statusCode +" "+ e.response.body);
                        console.log(chalk.yellow(`[${this.taskNum}] - Retrying atc 3000ms...`));
                        await sleep(3000);
                        await this.atc();
                    }
                }
                else {
                    console.log(e);
                    console.log(chalk.yellow(`[${this.taskNum}] - Retrying atc 3000ms...`));
                    await sleep(3000);
                    await this.atc();
                }
                
                
            }
        
    }
    
    async ddCaptcha(url, step){
        const recaptcha = new NoCaptchaTaskProxyless("c9088ab0f40e6455132006af467a30d6");
        //let prox = this.currProxy.split(":");
        let ddurl = url.split("&");
        if (ddurl[4] === "t=bv"){
            console.log(chalk.red(`[${this.taskNum}] - Proxy Datadome Banned!`));
            //this.cookies = {"waiting_room=":"", "JSESSIONID=":"", "datadome=":"", "cart-guid=":""};
            await this.createSession();
        }
        else {
            console.log(chalk.magenta(`[${this.taskNum}] - Solving Datadome Captcha!`));
            //, prox[0], prox[1], prox[2], prox[3], "http"
            await recaptcha.createTask("6LccSjEUAAAAANCPhaM2c-WiRxCZ5CzsjR_vd8uX", url, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36")
                .then((taskId) => {
                    //console.info(taskId);
                    return taskId
                }).then((taskId) => {
                    return taskId;
                }).then((taskId) => {
                    recaptcha.joinTaskResult(taskId)
                .then(async (response) => {
                    ddurl[0] = ddurl[0].substring(ddurl[0].indexOf('=')+1);
                    ddurl[1] = ddurl[1].substring(ddurl[1].indexOf('=')+1);
                    ddurl[3] = ddurl[3].substring(ddurl[3].indexOf('=')+1);
                    ddurl[5] = ddurl[5].substring(ddurl[5].indexOf('=')+1);
                    ddurl.push(response);
                    await this.submitCap(ddurl, url, step);
                });
            });
            
            
            
            
        }
        
        
    }

    async submitCap(ddurl, referer, step) {
        try {
            let response = await got(`https://geo.captcha-delivery.com/captcha/check?cid=${encodeURIComponent(ddurl[1])}&icid=${encodeURIComponent(ddurl[0])}&ccid=${encodeURIComponent(null)}&g-recaptcha-response=${encodeURIComponent(ddurl[6])}&hash=${encodeURIComponent(ddurl[3])}&ua=${encodeURIComponent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36")}&referer=${encodeURIComponent("http://"+this.site+"/api/users/carts/current/entries")}&parent_url=${encodeURIComponent("https://"+this.site+"/")}&x-forwarded-for=${encodeURIComponent("")}&captchaChallenge=${encodeURIComponent(175937071)}&s=${encodeURIComponent(ddurl[5])}`, {
                headers: {
                    "accept": "application/json",
                    "accept-encoding": "gzip, deflate, br",
                    "accept-language": "en-US,en;q=0.9",
                    "connection": "keep-alive",
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "host": "geo.captcha-delivery.com",
                    //"origin": `https://${this.site}`,
                    "referer": referer+`&cid=${encodeURIComponent(ddurl[1])}&referer=${encodeURIComponent("https://"+this.site+"/product/~/"+this.SKU+".html")}`,
                    "sec-ch-ua": "\" Not A;Brand\";v=\"99\", \"Chromium\";v=\"90\", \"Google Chrome\";v=\"90\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    //'cache-control': 'no-cache,must-revalidate,max-age=0',
                    "cookie": this.cookies,
                    "user-agent": this.userAgent
                },
                timeout: 7000,
                retry: {limit: 5, methods: ["GET", "POST"]},
                agent: {
                    https: this.proxyAgent
                }
                
            });
            let responseBody = JSON.parse(response.body);
            this.cookies["datadome="] = responseBody["cookie"].split("=")[1]+"=31536000; Domain=.footlocker.com; Path=/; Secure; SameSite=Lax";
            console.log(chalk.green(`[${this.taskNum}] - Solved Datadome Captcha!`));
            if (step === "atc"){
                await this.atc();
            }
            if (step === "email"){
                await this.submitEmail();
            }
            if (step === "shipping"){
                await this.submitShipping();
            }
            if (step === "billing"){
                await this.submitBilling();
            }
            if (step === "submit"){
                await this.submitOrder();
            }
        } catch (e) {
            console.log(e);
            console.log(e.response.statusCode +" "+ e.response.body);
        }
    }
    
    async findProduct(){
        try {
            console.log(chalk.yellow(`[${this.taskNum}] - Searching for product...`));
            let response = await got(`https://${this.site}/api/products/pdp/${this.SKU}`, {
                
                headers: {
                    'accept': 'application/xml',
                    'user-agent': this.userAgent,
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    'referer': `https://${this.site}`,
                    'accept-encoding': 'gzip, deflate, br',
                    'accept-language': 'en-US,en;q=0.9',
                    //'DNT': 1,
                },
                timeout: 7000,
                retry: {limit: 5, methods: ["GET", "POST"]},
                agent: {
                    https: this.proxyAgent
                }
            
            });
            
            if (response.statusCode == 200) {
                console.log(chalk.yellow(`[${this.taskNum}] - Product Found!`));
                return response.body;
                
            } else {
                await sleep(3000);
                await this.findProduct();
                
            }
    
        } catch (e) {
            console.log(e);
            if (e.response.statusCode === 403){
                console.log(chalk.magenta(`[${this.taskNum}] - Datadome captcha! Rotating proxy...`));
                if (e.response.headers["set-cookie"]){
                    for (let i=0; i<e.response.headers["set-cookie"].length; i++){
                        let cookie = e.response.headers["set-cookie"][i];
                        let cookieKey = cookie.substring(0, cookie.indexOf("=")+1);
                        this.cookies[cookieKey] = cookie.substring(cookie.indexOf("=")+1);
                    }
                }
                await this.getProxy();
                await sleep(3000);
                this.findProduct();
            }
            else if (e.response.statusCode === 400){
                console.log(chalk.yellow(`[${this.taskNum}] - Product not avaliable. Waiting for restock...`));
                await sleep(10000);
            }
            else {
                console.log(e.response.statusCode +" "+ e.response.body);
                await sleep(3000);
                await this.findProduct();
            }

        }
    }
    
    async getSize(){
        const jsonData = parser.parse(
            this.prodInfo,
            {
                attrNodeName: "#attributes",
                textNodeName: "#text",
                attributeNamePrefix: "",
                arrayMode: "false",
                ignoreAttributes: false,
                parseAttributeValue: true,
            },
            true
            );
        
        let prodName = jsonData.pdp.name;
        let prodImg = `https://images.footlocker.com/pi/${this.SKU}/large/${this.SKU}.jpeg`;
        let productCode = "";
        try {
            for (let item of jsonData.pdp.variantAttributes) {
                //console.log(item['sku']);
                if (String(item['sku']) == this.SKU) {
                    productCode = String(item['code']);
                    //console.log("product code: " + productCode);
                    break;
                }
            }
        } catch (err) {
            //console.log("ONE PRODUCT ON PAGE");
            productCode = String(jsonData.pdp.variantAttributes.code);
            //console.log("product code: " + productCode);
        }
        
        let sizes = {};
        try {
            for (let pid of jsonData.pdp.sellableUnits) {
                if (productCode == String(pid['attributes'][1]['id'])){
                    try {
                        let sizeName = String(pid['attributes'][0]['value']);
                        let sizePID = String(pid['attributes'][0]['id']);
                        let sizeStyle = String(pid['attributes'][1]['value']);
                        sizes[sizeName] = [sizePID, sizeStyle];
                    }
                    catch (e) {
                        console.log(e);
                        
                    }
                }
            }
        } catch (e) {
            console.log("ONE SIZE");
            let sizePID = String(jsonData.pdp.sellableUnits.attributes[0].id);
            sizes["ONE SIZE"] = sizePID;
        }
        
        //console.log(sizes);
        let randSize = Object.keys(sizes)[Math.floor(Math.random()*Object.keys(sizes).length)];
        let randPID = sizes[randSize][0];
        let prodStyle = sizes[randSize][1];
        let sizeInfo = {'prodName':prodName, 'sizeName':randSize, 'sizePID':randPID, 'prodImg': prodImg, 'prodStyle': prodStyle};
        return sizeInfo;

        
    }
    
    async submitEmail(){
        console.log(chalk.cyan(`[${this.taskNum}] - Setting E-mail...`));
        try{
            let reqCookieString = await this.removeNullCookies();
            let response = await got.put(`https://${this.site}/api/users/carts/current/email/${this.email}?timestamp=${Date.now().toString()}`, {
                    headers: {
                        'accept': 'application/json',
                        'user-agent': this.userAgent,
                        'accept-language': 'en-US,en;q=0.9',
                        'content-type': 'application/json',
                        'sec-fetch-dest': 'empty',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-site': 'same-origin',
                        'referer': `https://${this.site}/checkout`,
                        'Cookie': reqCookieString,
                        'cache-control': 'no-cache,must-revalidate,max-age=0',
                        'x-csrf-token': this.csrf,
                        'x-fl-request-id': uuidv4().toString()
                        },
                        timeout: 7000,
                        retry: {limit: 5, methods: ["GET", "POST"]},
                        agent: {
                            https: this.proxyAgent
                        }
                    });
                    
                    if (response.statusCode === 200){
                        console.log(chalk.green(`[${this.taskNum}] - Set Email!`));
                        if (response.headers["set-cookie"]){
                            for (let i=0; i<response.headers["set-cookie"].length; i++){
                                let cookie = response.headers["set-cookie"][i];
                                let cookieKey = cookie.substring(0, cookie.indexOf("=")+1);
                                this.cookies[cookieKey] = cookie.substring(cookie.indexOf("=")+1);
                            }
                        }
                        
                        await this.submitShipping();
                    }
    
                } catch (e){
                    console.log(e);
                    if (e.response.statusCode === 403){
                        console.log(chalk.magenta(`[${this.taskNum}] - DD captcha! Rotating proxy...`));
                        if (e.response.headers["set-cookie"]){
                            for (let i=0; i<e.response.headers["set-cookie"].length; i++){
                                let cookie = e.response.headers["set-cookie"][i];
                                let cookieKey = cookie.substring(0, cookie.indexOf("=")+1);
                                this.cookies[cookieKey] = cookie.substring(cookie.indexOf("=")+1);
                            }
                        }
                        let captchaURL = JSON.parse(e.response.body)["url"];
                        await this.ddCaptcha(captchaURL, "email");
                        
                        
                    }
                    else if (e.response.body["errors"][0]["code"] === 11512) {
                        console.log(chalk.red(`[${this.taskNum}] - Cart Emptied!`));
                        await this.failedWebhook(e.response.body);
                        await this.createSession();
                    }
                    else {
                        console.log(e.response.statusCode +" "+ e.response.body);
                        console.log(chalk.yellow(`[${this.taskNum}] - Retrying email 3000ms...`));
                        await sleep(3000);
                        await this.submitEmail();
                    }
                }
    }
    
    async submitShipping(){
        console.log(chalk.cyan(`[${this.taskNum}] - Setting Shipping...`));
        
        try{
            let reqCookieString = await this.removeNullCookies();
            let response = await got.post(`https://${this.site}/api/users/carts/current/addresses/shipping?timestamp=${Date.now().toString()}`, 
                {
                    headers: {
                        'accept': 'application/json',
                        'user-agent': this.userAgent,
                        'accept-language': 'en-US,en;q=0.9',
                        'content-type': 'application/json',
                        'sec-fetch-dest': 'empty',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-site': 'same-origin',
                        'referer': `https://${this.site}/checkout`,
                        'cookie': reqCookieString,
                        'cache-control': 'no-cache,must-revalidate,max-age=0',
                        'x-csrf-token': this.csrf,
                        'x-fl-request-id': uuidv4().toString()
                        },
                    json: {
                        shippingAddress:{
                            setAsDefaultBilling:false,
                            setAsDefaultShipping:false,
                            firstName: this.fname,
                            lastName: this.lname,
                            phone: this.phone,
                            country:{
                                isocode: this.country,
                                name: countries[this.country]
                            },
                            email:false,
                            id:null,
                            setAsBilling:false,
                            saveInAddressBook:false,
                            region:{
                                countryIso: this.country,
                                isocode: this.country + "-" + this.state,
                                isocodeShort: this.state,
                                name: states[this.state]
                            },
                            type:"default",
                            LoqateSearch:"",
                            line1: this.line1,
                            line2: this.line2,
                            postalCode: this.postal,
                            town: this.city,
                            regionFPO:null,
                            shippingAddress:true,
                            recordType:" "
                        
                        }
                
                    },
                    timeout: 7000,
                    retry: {limit: 5, methods: ["GET", "POST"]},
                    agent: {
                        https: this.proxyAgent
                    }
                });
                    
                    if (response.statusCode === 201){
                        console.log(chalk.green(`[${this.taskNum}] - Set Shipping!`));
                        if (response.headers["set-cookie"]){
                            for (let i=0; i<response.headers["set-cookie"].length; i++){
                                let cookie = response.headers["set-cookie"][i];
                                let cookieKey = cookie.substring(0, cookie.indexOf("=")+1);
                                this.cookies[cookieKey] = cookie.substring(cookie.indexOf("=")+1);
                            }
                        }
                        await this.submitBilling();
                    }
                    
    
                } catch (e){
                    
                    console.log(e);
                    let responseBody = JSON.parse(e.response.body);
                    if (e.response.statusCode === 403){
                        console.log(chalk.magenta(`[${this.taskNum}] - DD captcha! Rotating proxy...`));
                        if (e.response.headers["set-cookie"]){
                            for (let i=0; i<e.response.headers["set-cookie"].length; i++){
                                let cookie = e.response.headers["set-cookie"][i];
                                let cookieKey = cookie.substring(0, cookie.indexOf("=")+1);
                                this.cookies[cookieKey] = cookie.substring(cookie.indexOf("=")+1);
                            }
                        }
                        let captchaURL = JSON.parse(e.response.body)["url"];
                        await this.ddCaptcha(captchaURL, "shipping");
                        
                        
                    }
                    else if (responseBody["errors"][0]["code"] === 11512) {
                        console.log(chalk.red(`[${this.taskNum}] - Cart Emptied!`));
                        await this.failedWebhook(e.response.body);
                        await this.createSession();
                    }
                    else {
                        console.log(e.response.statusCode +" "+ e.response.body);
                        console.log(chalk.yellow(`[${this.taskNum}] - Retrying shipping 3000ms...`));
                        await sleep(3000);
                        await this.submitShipping();
                    }
                }
    }
    
    async submitBilling(){
        console.log(chalk.cyan(`[${this.taskNum}] - Setting Billing...`));
        try{
            let reqCookieString = await this.removeNullCookies();
            let response = await got.post(`https://${this.site}/api/users/carts/current/set-billing?timestamp=${Date.now().toString()}`, 
                {
                    headers: {
                        'accept': 'application/json',
                        'user-agent': this.userAgent,
                        'accept-language': 'en-US,en;q=0.9',
                        'content-type': 'application/json',
                        'sec-fetch-dest': 'empty',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-site': 'same-origin',
                        'referer': `https://${this.site}/checkout`,
                        'cookie': reqCookieString,
                        'cache-control': 'no-cache,must-revalidate,max-age=0',
                        'x-csrf-token': this.csrf,
                        'x-fl-request-id': uuidv4().toString()
                        },
                    json: {
                        setAsDefaultBilling: false,
                        setAsDefaultShipping: false,
                        firstName: this.fname,
                        lastName: this.lname,
                        email: false,
                        phone: this.phone,
                        country: {
                            isocode: this.country,
                            name: countries[this.country]
                        },
                        id: null,
                        setAsBilling: false,
                        saveInAddressBook: false,
                        region: {
                            countryIso: this.country,
                            isocode: this.country + "-" + this.state,
                            isocodeShort: this.state,
                            name: states[this.state]
                        },
                        type: "default",
                        LoqateSearch: "",
                        line1: this.line1,
                        line2: this.line2,
                        postalCode: this.postal,
                        town: this.city,
                        regionFPO: null,
                        shippingAddress: true,
                        recordType: " "
                    },
                    timeout: 7000,
                    retry: {limit: 5, methods: ["GET", "POST"]},
                    agent: {
                        https: this.proxyAgent
                    }
                });

                    if (response.statusCode === 200){
                        console.log(chalk.green(`[${this.taskNum}] - Set Billing!`));
                        if (response.headers["set-cookie"]){
                            for (let i=0; i<response.headers["set-cookie"].length; i++){
                                let cookie = response.headers["set-cookie"][i];
                                let cookieKey = cookie.substring(0, cookie.indexOf("=")+1);
                                this.cookies[cookieKey] = cookie.substring(cookie.indexOf("=")+1);
                            }
                        }
                        await this.submitOrder();
    
                    }
                    
                } catch (e){
                    console.log(e);
                    let responseBody = JSON.parse(e.response.body);
                    if (e.response.statusCode === 403){
                        console.log(chalk.magenta(`[${this.taskNum}] - DD captcha! Rotating proxy...`));
                        if (e.response.headers["set-cookie"]){
                            for (let i=0; i<e.response.headers["set-cookie"].length; i++){
                                let cookie = e.response.headers["set-cookie"][i];
                                let cookieKey = cookie.substring(0, cookie.indexOf("=")+1);
                                this.cookies[cookieKey] = cookie.substring(cookie.indexOf("=")+1);
                            }
                        }
                        let captchaURL = JSON.parse(e.response.body)["url"];
                        await this.ddCaptcha(captchaURL, "billing");
                        
                        
                    }
                    else if (responseBody["errors"][0]["code"] === 11512) {
                        console.log(chalk.red(`[${this.taskNum}] - Cart Emptied!`));
                        await this.failedWebhook(e.response.body);
                        await this.createSession();
                    }
                    else {
                        console.log(e.response.statusCode +" "+ e.response.body);
                        console.log(chalk.yellow(`[${this.taskNum}] - Retrying billing 3000ms...`));
                        await sleep(3000);
                        await this.submitBilling();
                    }
                }
    }
    
    async submitOrder(){
        console.log(chalk.cyan(`[${this.taskNum}] - Submitting order...`));
        const adyenKey = "10001|A237060180D24CDEF3E4E27D828BDB6A13E12C6959820770D7F2C1671DD0AEF4729670C20C6C5967C664D18955058B69549FBE8BF3609EF64832D7C033008A818700A9B0458641C5824F5FCBB9FF83D5A83EBDF079E73B81ACA9CA52FDBCAD7CD9D6A337A4511759FA21E34CD166B9BABD512DB7B2293C0FE48B97CAB3DE8F6F1A8E49C08D23A98E986B8A995A8F382220F06338622631435736FA064AEAC5BD223BAF42AF2B66F1FEA34EF3C297F09C10B364B994EA287A5602ACF153D0B4B09A604B987397684D19DBC5E6FE7E4FFE72390D28D6E21CA3391FA3CAADAD80A729FEF4823F6BE9711D4D51BF4DFCB6A3607686B34ACCE18329D415350FD0654D";
        const options = {};
        const cseInstance = adyenEncrypt.createEncryption(adyenKey, options);
    
        try{
            let reqCookieString = await this.removeNullCookies();
            //console.log(reqCookieString);
            let response = await got.post(`https://${this.site}/api/v2/users/orders?timestamp=${Date.now().toString()}`, 
                {
                    headers: {
                        'accept': 'application/json',
                        'user-agent': this.userAgent,
                        'accept-language': 'en-US,en;q=0.9',
                        'content-type': 'application/json',
                        'sec-fetch-dest': 'empty',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-site': 'same-origin',
                        'referer': `https://${this.site}/checkout`,
                        'cookie': reqCookieString,
                        'cache-control': 'no-cache,must-revalidate,max-age=0',
                        'x-csrf-token': this.csrf,
                        'x-fl-request-id': uuidv4().toString()
                        },
                    json: {
                        preferredLanguage: "en",
                        termsAndCondition: false,
                        deviceId: "0400JapG4txqVP4Nf94lis1ztioT9A1DShgAnrp/XmcfWoVVgr+Rt2dAZPhMS97Z4yfjSLOS3mruQCzk1eXuO7gGCUfgUZuLE2xCJiDbCfVZTGBk19tyNs7g8zV85QpvmtF/PiH81LzIHY+IkDNqVmd50UN13n2vmAeykQgdlVeDidxKHN6aih3fKgo5VNMvaDXfrI3MaSYrgzshIqKrjK+gdyAFUwN05hXzcycRhS8EwApMRV0YmXEHAJzxpxtwqoC5Z/uCi7ME8loQwLLSzeFEuVfe4edP+YyrMScNWPrm3gkaBb9G9UOUXcvHqddDV9xroOXUWxljyPBhr+EUEFUSupVPfVKB9sZJ46VFF/44X5H/en4BDxe4+OZQr69AjaUl045LA0C3pTnwPJC0Hu9JH3Bxvhzk2DIVX6t2xsBNqMDIx5G6nzZ9jXlFnBT3M8OkdpLBWppZ1Q3D4TWhv78VEIne56x7fyVRFqHfv6lgZq/ZTCRM2i38ODBnxg3zCYy92TutBhVT32XB3jbHpPIKlngK641yQ9TLuZmcL034xXt6Jn7YNCrmjvQEiZ1pw11WS4kLlwW7s8ANfyJw5Y9lzLhejolH6jy42HYF5oyZHJfZ6UlIkWTbNIkaggCoyjgUKzNeVAMriyg4Q2BjiRVT3AHzj486sjgySgPiIcnlrVBLh7h/QYTtLXhkSark47KQq4HnEqNOos1c6njJgQh/4vXJiqy0MXMQOThNipDmXv9I185O+yC2f3lLEO0Tay66NZEyiLNePemJKSIdwO9O5ZtntuUkG6NTrhfKkelca2xdDtglXz+ixRpFSmv7cY/k5mNV6QxgbclhfIUcFuybLLNvS9LBZED55Ix5aAKTQzySBBWhu07LmRdt5U4CpewIj2qku3ZkvzkAM9dbBROeNQfbQD1p+KEcV6i8/tb5alAK/XRNo3H5dCCofHI9aHmKGVsh1GZGb/t+MWh63oYq0txXGHfPclPyz19jO/zaAINtquuRVsO81SnNZmoS7eHHVSrctRidvsPBjasMWTIwS4obv4YxF5s3PTXpysOY+zgFX7lgghghAudVvu4eBdAZkujB6DYvpTIKWZo7ckRYxzYKc0l3GqSVnbPexAyx9XKwLY4MxzBgJOfH8d/kXMM9COBxCZxjphtLxKF6v2PPxl4QQc9zoBJvG/4+kPO6g2PZuCYrzj4mEQTXvE++wwwVhHEj8cU6xd0=",
                        cartId: this.guid,
                        encryptedCardNumber: cseInstance.encrypt({
                            number: this.ccNum,
                            generationtime: new Date().toISOString(),
                        }),
                        encryptedExpiryMonth: cseInstance.encrypt({
                            expiryMonth: this.exp.month,
                            generationtime: new Date().toISOString(),
                        }),
                        encryptedExpiryYear: cseInstance.encrypt({
                            expiryYear: this.exp.year,
                            generationtime: new Date().toISOString(),
                        }),
                        encryptedSecurityCode: cseInstance.encrypt({
                            cvc: this.cvv,
                            generationtime: new Date().toISOString(),
                        }),
                        paymentMethod: "CREDITCARD",
                        returnUrl: `https://${this.site}/adyen/checkout`,
                        browserInfo: {
                            screenWidth: 1920,
                            screenHeight: 1080,
                            colorDepth: 24,
                            userAgent: this.userAgent,
                            timeZoneOffset: 240,
                            language: "en-US",
                            javaEnabled: false
                        }
                    },
                    timeout: 7000,
                    retry: {limit: 5, methods: ["GET", "POST"]},
                    agent: {
                        https: this.proxyAgent
                    }
                });

                    if (response.statusCode === 201){
                        console.log(chalk.bgGreen(`[${this.taskNum}] - Payment Success!`));
                        console.log(this.cookies);
                        console.log(reqCookieString);
                        await this.successWebhook(response.body);
                    }
    
                } catch (e){
                    if (e.response.statusCode === 403){
                        console.log(chalk.magenta(`[${this.taskNum}] - DD captcha! Rotating proxy...`));
                        if (e.response.headers["set-cookie"]){
                            for (let i=0; i<e.response.headers["set-cookie"].length; i++){
                                let cookie = e.response.headers["set-cookie"][i];
                                let cookieKey = cookie.substring(0, cookie.indexOf("=")+1);
                                this.cookies[cookieKey] = cookie.substring(cookie.indexOf("=")+1);
                            }
                        }
                        let captchaURL = JSON.parse(e.response.body)["url"];
                        await this.ddCaptcha(captchaURL, "submit");
                        
                        
                    }
                    else{
                        console.log(e.response.statusCode +" "+ e.response.body);
                        let responseBody = JSON.parse(e.response.body);
                        if (responseBody["errors"][0]["code"] === 12001){
                            console.log(chalk.bgRed(`[${this.taskNum}] - Payment Declined!`));
                            await this.failedWebhook(responseBody);
                        }
                        else if (responseBody["errors"][0]["code"] === 11512) {
                            console.log(chalk.red(`[${this.taskNum}] - Cart Emptied!`));
                            await this.failedWebhook(responseBody);
                        }
                        else if (responseBody["errors"][0]["code"] === 12004) {
                            console.log(chalk.red(`[${this.taskNum}] - Retrying checkout submission...`));
                            await sleep(3000);
                            await this.submitOrder();
                        }
                        else {
                            console.log(chalk.red(`[${this.taskNum}] - Unhandled Error! Stopping Task...`));
                            await this.failedWebhook(responseBody);
                        }
                    }
                }              
    }
    
    async failedWebhook(reason) {
        try {
            let color = '000000';
            let titleText = ':x: Payment Failure :x:';
            await got.post(webhook, {
                json:{
                    "content": null,
                    "embeds": [
                        {
                        "title": titleText,
                        "color": color,
                        "fields": [
                            {
                            "name": "**Item**",
                            "value": this.sizeInfo.prodName,
                            "inline": true
                            },
                            {
                            "name": "**Style**",
                            "value": this.sizeInfo.prodStyle,
                            "inline": true
                            },
                            {
                            "name": "**Size**",
                            "value": this.sizeInfo.sizeName,
                            "inline": true
                            },
                            {
                            "name": "**Profile**",
                            "value": `||${this.profileName}||`,
                            "inline": true
                            },
                            {
                            "name": "**Site**",
                            "value": this.site,
                            "inline": true
                            },
                            {
                            "name": "**Email**",
                            "value": `||${this.email}||`,
                            "inline": true
                            },
                            {
                            "name": "**SKU**",
                            "value": this.SKU,
                            "inline": true
                            },
                            {
                            "name": "**Proxy List**",
                            "value": `||${this.currProxy}||`,
                            "inline": false
                            },
                            {
                            "name": "**Reason**",
                            "value": reason.errors[0].message +" CODE:"+ reason.errors[0].code,
                            "inline": false
                            }
                        ],
                        "footer": {
                            "text": "v0.02",
                            "icon_url": "https://cdn.discordapp.com/emojis/691715611780317184.png?v=1"
                        },
                        "thumbnail": {
                            "url": this.sizeInfo.prodImg
                        }
                        }
                    ]
            }
            });
            console.log(`[${this.taskNum}] - Webhook sent`);
        } catch (e) {
            console.log(e);
            console.log(e.response.body.toString());
            console.log(chalk.yellow(`[${this.taskNum}] - Error Sending Webhook Retrying...`));
        }
    }
    
    async successWebhook(orderInfo){
        try {
            let orderData = JSON.parse(orderInfo);
            let color = '8519553';
            let titleText = ':yum: Successful Checkout :yum:';
            
            await got.post(webhook, {
                json:{
                    "content": null,
                    "embeds": [
                      {
                        "title": titleText,
                        "color": color,
                        "fields": [
                          {
                            "name": "**Item**",
                            "value": this.sizeInfo.prodName,
                            "inline": true
                          },
                          {
                            "name": "**Style**",
                            "value": this.sizeInfo.prodStyle,
                            "inline": true
                          },
                          {
                            "name": "**Size**",
                            "value": this.sizeInfo.sizeName,
                            "inline": true
                          },
                          {
                            "name": "**Profile**",
                            "value": `||${this.profileName}||`,
                            "inline": true
                          },
                          {
                            "name": "**Site**",
                            "value": this.site,
                            "inline": true
                          },
                          {
                            "name": "**Order Number**",
                            "value": `||${orderData["order"]["code"]}||`,
                            "inline": true
                          },
                          {
                            "name": "**Email**",
                            "value": `||${orderData["order"]["deliveryAddress"]["email"]}||`,
                            "inline": true
                          },
                          {
                            "name": "**Price w/ tax**",
                            "value": orderData["order"]["totalPriceWithTax"]["formattedValue"],
                            "inline": true
                          },
                          {
                            "name": "**SKU**",
                            "value": this.SKU,
                            "inline": true
                          },
                          {
                            "name": "**Proxy**",
                            "value": `||${this.currProxy}||`,
                            "inline": false
                          },
                        ],
                        "footer": {
                          "text": "v0.02",
                          "icon_url": "https://cdn.discordapp.com/emojis/691715611780317184.png?v=1"
                        },
                        "thumbnail": {
                          "url": this.sizeInfo.prodImg
                        }
                      }
                    ]
                }
            });
            console.log(`[${this.taskNum}] - Webhook sent`);
        } catch (e) {
            console.log(e.response.body);
            console.log(chalk.yellow(`[${this.taskNum}] - Error Sending Webhook Retrying...`));
        }
    }
}

const Task = require('./backend.js');
const fs = require('fs');
const inquirer = require('inquirer');
const profiles = JSON.parse(fs.readFileSync('profiles.json', 'utf8'));
const path = require('path');

let proxyLists = [];
let SKU = '';
let site = '';
let numTasks = 0;

async function createProxyLists() {
    const directoryPath = path.join(__dirname);
    fs.readdir(directoryPath, function (err, files) {
        //error
        if (err) {
            return console.log('Unable to scan directory: ' + err);
        }
        files.forEach(function (file) {
            //lists all files that end with .txt
            if (file.endsWith('.txt')) {
                proxyLists.push(file);
            }
        });
    });
}
createProxyLists();

inquirer
    .prompt([
        {
            type: 'list',
            name: 'storeList',
            message: 'Select the store',
            choices: ['www.footlocker.com', 'www.champssports.com', 'www.footaction.com', 'www.eastbay.com', 'www.kidsfootlocker.com', 'www.footlocker.ca']
        },
        {
            type: 'list',
            name: 'proxyList',
            message: 'Select the proxy list; avaliable options:',
            choices: proxyLists,
        },

        {
            name: 'sku',
            message: 'Enter the SKU; Example: https://www.footlocker.com/product/(Product Name)/(SKU).html'
        },
        {
            name: 'taskCount',
            message: 'How many tasks do you want to make?'
        }
    ])
    .then(answers => {
        site = answers.storeList;
        SKU = answers.sku;
        numTasks = answers.taskCount;
        proxylist = answers.proxyList
        init();
    });

async function init() {
    let currProfile = 0;
    for (let i = 0; i < numTasks; i++) {
        if (profiles[currProfile]) {
            let task = new Task("Task " + i, profiles[currProfile], SKU, site, proxylist);
            task.start();
            await sleep(300);
            currProfile++;
        }
        else {
            i--;
            currProfile = 0;
        }
    }
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

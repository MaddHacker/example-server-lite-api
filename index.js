/**
 * Copyright 2018 MaddHacker
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const url = require('url');

const sl = require('server-lite');
const datez = require('date-utilz');
const stringz = require('string-utilz');
const om = require('output-manager');
const o = new om.Out(); // console logging
const fs = require('fs');
const os = require('os');

o.i('Starting...');
const utilz = new sl.utils(o);
const handler = new sl.handler(utilz, 'webapp', '/html/index.html', '/js/concat/', '/css/concat/');

function readDb(cb) {
    fs.readFile('./test-db.json', 'utf8', cb);
}
function writeDb(obj) {
    fs.writeFile('./test-db.json', JSON.stringify(obj), function (err, data) {
        if (err) { o.e(err); }
        else { o.i('Successfully wrote database'); }
    });
}

var db;
readDb(function (err, data) {
    if (err) {
        o.e(err);
    }
    o.i(data);
    db = (data) ? JSON.parse(data) : {};
    o.d("DB: " + JSON.stringify(db));
    db.info = {
        name: 'example-server-list-api',
        version: '1.0.0',
        author: 'MaddHacker'
    }
});


function onReq(request, response) {
    o.i('Recieved request of type : ' + request.method);
    let resBody = {
        debug: {
            appInfo: db.info,
            requestMethod: request.method
        }
    };

    let statusCode = 200;

    let tmpPath = url.parse(request.url).pathname;
    o.i(stringz.fmt('...for path "%{s}"', tmpPath));
    resBody.debug.requestPath = tmpPath;

    switch (request.method) {
        case 'GET':
            let getName = tmpPath.split('/')[1];
            resBody.debug.requestNameValue = getName;
            if (getName.length > 0) {
                resBody.person = db.people[getName];
                resBody.response = (resBody.person) ? "Successfully found '" + getName + "'" : "Could not find person named '" + getName + "'";
                statusCode = (resBody.person) ? 200 : 404;
                resBody.debug.requestNameValue = getName;
            } else {
                resBody.people = db.people;
                resBody.response = 'Sending you ALLLLL the people...';
            }
            finishRequest(response, resBody, statusCode);
            break;
        case 'PUT':
        case 'POST':
            let reqBodyString = [];
            request.on('data', (chunk) => {
                reqBodyString.push(chunk);
            }).on('end', () => {
                reqBodyString = Buffer.concat(reqBodyString).toString();
                // at this point, `reqBody` has the entire request body stored in it as a string
                o.i('Request body: ' + reqBodyString);
                resBody.debug.requestBody = reqBodyString;
                let reqBody = JSON.parse(reqBodyString);
                console.log(reqBody);
                resBody.response = "Trying to put person with name '" + reqBody.name + "'";
                let people = {} || db.people;
                people[reqBody.name] = reqBodyString;
                db.people = people;
                resBody.people = people;
                finishRequest(response, resBody, statusCode);
            });
            break;
        case 'DELETE':
            let delName = tmpPath.split('/')[1];
            let didDelete = delete db.people[delName];
            resBody.response = didDelete ? "Successfully deleted '" + delName + "'" : "Failed to delete '" + delName + "'";
            statusCode = didDelete ? 200 : 400;
            finishRequest(response, resBody, statusCode);
            break;
        default:
            o.e('Unknown request type: ' + request.method);
            resBody.error = "Unknown request type: '" + request.method + "'!";
            statusCode = 500;
            finishRequest(response, resBody, statusCode);
            break;
    }

}

function finishRequest(response, resBody, statusCode) {
    let bodyStr = JSON.stringify(resBody);

    response.statusCode = statusCode;
    response.setHeader('Content-Type', 'application/json;charset=utf-8');
    response.setHeader('Content-Length', bodyStr.length);
    response.write(bodyStr);
    response.end();
    writeDb(db);
}

const cfg = new sl.config({
    out: o,
    port: 8888,
    onRequest: onReq
});

const httpSvr = new sl.server.http(cfg);

httpSvr.start();
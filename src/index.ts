require('@dotenvx/dotenvx').config();

import fs from 'fs';
import path from 'path';

import http from 'http';
import https from 'https';
import express from 'express';
import serveIndex from 'serve-index';

const port_http = process.env.PORT_HTTP || 8080;
const port_https = process.env.PORT_HTTPS || 8081;

const ssl_path = process.env.SSL_PATH || '';
const ssl_file_public_key = path.join(ssl_path, 'cert.pem');
const ssl_file_private_key = path.join(ssl_path, 'privkey.pem');
const ssl_file_chain = path.join(ssl_path, 'chain.pem');
const ssl_file_chainfull = path.join(ssl_path, 'fullchain.pem');
const chain_files = [ssl_file_chain, ssl_file_chainfull];

const app = express();

const options = {
    cert: readFileSyncSafe(ssl_file_public_key),
    key: readFileSyncSafe(ssl_file_private_key),
    ca: readFilesSyncSafe(chain_files),
};

const server_http = http.createServer(app);
const server_https = https.createServer(options, app);

server_http.listen(port_http, () => {
    console.log(`Server started at http://localhost:${port_http}`);
});
server_https.listen(port_https, () => {
    console.log(`Server started at https://localhost:${port_https}`);
});

app.use('/public', serveIndex('frontend', { icons: true }));
app.use('/public', express.static('frontend'));

app.get('/', function (_req, res) {
    res.redirect('/public');
});

function readFileSyncSafe(file: string): string | Buffer {
    try {
        return fs.readFileSync(file);
    } catch (err) {
        console.error(`Error reading file: ${file}`);
        return '';
    }
}

function readFilesSyncSafe(files: string[]) {
    return files.map(readFileSyncSafe).filter((content) => content !== null);
}

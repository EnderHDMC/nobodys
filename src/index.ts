import * as dotenv from "dotenv-flow";
dotenv.config();

import fs from "fs";
import path from "path";

import http from "http";
import https from "https";
import express from "express";
import serveIndex from "serve-index";
import {
  Express,
  NextFunction,
  Request,
  Response,
} from "express-serve-static-core";
import { ParsedQs } from "qs";

const port_http = process.env.PORT_HTTP || 8080;
const port_https = process.env.PORT_HTTPS || 8081;
const hostname = process.env.HOST || process.env.HOSTNAME || "localhost";

const ssl_path = process.env.SSL_PATH || `/etc/letsencrypt/live/${hostname}/`;
const ssl_file_public_key = path.join(ssl_path, "cert.pem");
const ssl_file_private_key = path.join(ssl_path, "privkey.pem");
const ssl_file_chain = path.join(ssl_path, "chain.pem");
const ssl_file_chainfull = path.join(ssl_path, "fullchain.pem");
const chain_files = [ssl_file_chain, ssl_file_chainfull];

const app = express();

const secureContext = getSecureContext(false) || {};
const options = { ...secureContext };

const server_http = http.createServer(app);
const server_https = https.createServer(options, app);

server_http.listen(port_http, () => {
  const port = hostname == "localhost" ? `:${port_http}` : "";
  console.log(`Server started at http://${hostname}${port}`);
});
server_https.listen(port_https, () => {
  const port = hostname == "localhost" ? `:${port_https}` : "";
  console.log(`Server started at https://${hostname}${port}`);
});

serveFiles(app, "public", { icons: true });
serveFiles(app, ".well-known", { icons: true });

app.post("/reload-certificates", isLocalhost, (req, res, next) => {
  console.log("Reloading certificates...");

  const secureContext = getSecureContext(false);
  if (!secureContext) {
    return res.status(500).send("Certificates failed to load");
  }

  server_https.setSecureContext(secureContext);
  console.log("Certificates reloaded successfully");

  return res.send("Certificates reloaded");
});

app.get("/", function (_req, res) {
  res.redirect("/public");
});

function serveFiles(
  app: Express,
  path: string,
  indexOptions?: serveIndex.Options
) {
  const webPath = `/${path}`;
  path = `webroot/${path}`;
  app.use(webPath, express.static(path));
  app.use(webPath, serveIndex(path, indexOptions));
}

function getSecureContext(error = true) {
  try {
    return {
      cert: fs.readFileSync(ssl_file_public_key),
      key: fs.readFileSync(ssl_file_private_key),
      ca: chain_files.map((file) => fs.readFileSync(file)),
    };
  } catch (err) {
    if (error) throw err;
    console.error(err);
    return null;
  }
}

type expressRequest = Request<{}, any, any, ParsedQs, Record<string, any>>;
type expressResponse = Response<any, Record<string, any>, number>;

function isLocalhost(
  req: expressRequest,
  res: expressResponse,
  next: NextFunction
) {
  // TODO: Bulletproof this
  //       What happens behind a proxy?
  const local = ["127.0.0.1", "::1"];
  const remote = req.socket.remoteAddress || "disconnect";

  if (!local.includes(remote)) {
    return res.status(403).send("Request from external source");
  }
  return next();
}

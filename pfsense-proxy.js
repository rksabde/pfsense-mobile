#!/usr/bin/env node
/**
 * Simple HTTPS proxy to forward requests from Docker container to pfSense
 * Runs on host machine at port 4443
 * Docker container connects to host.docker.internal:4443
 */

const http = require('http');
const https = require('https');
const url = require('url');

const PROXY_PORT = 4443;
const PFSENSE_HOST = '192.168.1.1';
const PFSENSE_PORT = 443;

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  const options = {
    hostname: PFSENSE_HOST,
    port: PFSENSE_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
    rejectUnauthorized: false // Accept self-signed certificates
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`Error: ${err.message}`);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad Gateway: Could not connect to pfSense');
  });

  req.pipe(proxyReq);
});

server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`pfSense proxy listening on port ${PROXY_PORT}`);
  console.log(`Forwarding to https://${PFSENSE_HOST}:${PFSENSE_PORT}`);
  console.log(`Docker containers can access via: http://host.docker.internal:${PROXY_PORT}`);
  console.log('Press Ctrl+C to stop');
});

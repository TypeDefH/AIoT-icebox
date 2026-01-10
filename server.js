const http = require('http');
const crypto = require('crypto');

const CONFIG = {
    ACCESS_KEY: "jWA3twGsWVPY/H0K3ENHnr8fhzQECdtciMACxvZjWsutS59xX7Tm9grlBYr1i2Jb", 
    USER_ID: "421964", 
    PRODUCT_ID: "tnOp9vX0Ge",
    DEVICE_NAME: "test"
};

function generateAuthorization() {
    const method = 'sha1';
    const version = '2022-05-01';
    const res = `userid/${CONFIG.USER_ID}`;
    const et = Math.ceil((Date.now() / 1000) + 3600); 
    const StringForSignature = et + '\n' + method + '\n' + res + '\n' + version;
    const base64Key = Buffer.from(CONFIG.ACCESS_KEY, 'base64');
    const sign = crypto.createHmac(method, base64Key).update(StringForSignature, 'utf8').digest('base64');
    return `version=${version}&res=${encodeURIComponent(res)}&et=${et}&method=${method}&sign=${encodeURIComponent(sign)}`;
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, authorization');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const token = generateAuthorization();

    if (req.url === '/api/data' && req.method === 'GET') {
        try {
            const oneNetUrl = `https://iot-api.heclouds.com/thingmodel/query-device-property?product_id=${CONFIG.PRODUCT_ID}&device_name=${CONFIG.DEVICE_NAME}`;
            const response = await fetch(oneNetUrl, { headers: { 'authorization': token } });
            const data = await response.json();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ code: 500, msg: "OneNET连接失败: " + e.message }));
        }
    }
    else if (req.url === '/api/control' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const params = JSON.parse(body);
                const controlUrl = `https://iot-api.heclouds.com/thingmodel/device-property-modify`;
                const payload = {
                    product_id: CONFIG.PRODUCT_ID,
                    device_name: CONFIG.DEVICE_NAME,
                    params: params
                };
                const response = await fetch(controlUrl, {
                    method: 'POST',
                    headers: { 'authorization': token, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ code: 400, msg: e.message }));
            }
        });
    }
    else if (req.url.startsWith('/api/history') && req.method === 'GET') {
        try {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const identifier = urlObj.searchParams.get('identifier') || 'temp';
            const endTime = Date.now();
            const startTime = endTime - 24 * 60 * 60 * 1000;
            const query = new URLSearchParams({
                product_id: CONFIG.PRODUCT_ID,
                device_name: CONFIG.DEVICE_NAME,
                identifier: identifier,
                start_time: startTime,
                end_time: endTime,
                limit: 20
            });
            const historyUrl = `https://iot-api.heclouds.com/thingmodel/query-device-property-history?${query.toString()}`;
            const response = await fetch(historyUrl, { headers: { 'authorization': token } });
            const data = await response.json();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ code: 500, msg: e.message }));
        }
    }
    else {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end("✅ 移动制冷后端服务已就绪");
    }
});

// 关键修改：Zeabur 部署时会自动提供 PORT 环境变量
const PORT = process.env.PORT || 3000; 
server.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ 服务启动成功，监听端口: ${PORT}`);
});
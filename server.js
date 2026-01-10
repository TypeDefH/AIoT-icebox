const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CONFIG = {
    ACCESS_KEY: "jWA3twGsWVPY/H0K3ENHnr8fhzQECdtciMACxvZjWsutS59xX7Tm9grlBYr1i2Jb", 
    USER_ID: "421964", 
    PRODUCT_ID: "tnOp9vX0Ge",
    DEVICE_NAME: "test"
};

/**
 * 生成 OneNET API 鉴权 Token
 */
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
    // 设置跨域头（CORS）
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, authorization');

    // 处理预检请求
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const token = generateAuthorization();
    const urlObj = new URL(req.url, `http://${req.headers.host}`);

    // 路由 1: 获取实时数据 API
    if (urlObj.pathname === '/api/data' && req.method === 'GET') {
        try {
            const oneNetUrl = `https://iot-api.heclouds.com/thingmodel/query-device-property?product_id=${CONFIG.PRODUCT_ID}&device_name=${CONFIG.DEVICE_NAME}`;
            const response = await fetch(oneNetUrl, { headers: { 'authorization': token } });
            const data = await response.json();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        } catch (e) {
            res.writeHead(500); res.end(JSON.stringify({ code: 500, msg: "OneNET连接失败: " + e.message }));
        }
    }
    // 路由 2: 设备控制 API
    else if (urlObj.pathname === '/api/control' && req.method === 'POST') {
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
                res.writeHead(400); res.end(JSON.stringify({ code: 400, msg: e.message }));
            }
        });
    }
    // 路由 3: 历史数据 API
    else if (urlObj.pathname === '/api/history' && req.method === 'GET') {
        try {
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
            res.writeHead(500); res.end(JSON.stringify({ code: 500, msg: e.message }));
        }
    }
    // 路由 4: 静态页面托管 (访问根目录时返回 index.html)
    else if (urlObj.pathname === '/' || urlObj.pathname === '/index.html') {
        const filePath = path.join(__dirname, 'index.html');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end("❌ 找不到 index.html 文件，请确保它在根目录中。");
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(data);
        });
    }
    // 其他未定义路由
    else {
        res.writeHead(404);
        res.end("404 Not Found");
    }
});

// 监听端口配置
const PORT = process.env.PORT || 8080; 
server.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ 服务启动成功，访问地址: http://localhost:${PORT}`);
});
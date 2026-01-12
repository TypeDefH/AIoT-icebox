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
    // 设置过期时间为 1 小时后
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
    if (req.method === 'OPTIONS') { 
        res.writeHead(204); 
        res.end(); 
        return; 
    }

    const token = generateAuthorization();
    const urlObj = new URL(req.url, `http://${req.headers.host}`);

    // --- 路由 1: 获取实时数据 API ---
    if (urlObj.pathname === '/api/data' && req.method === 'GET') {
        try {
            const oneNetUrl = `https://iot-api.heclouds.com/thingmodel/query-device-property?product_id=${CONFIG.PRODUCT_ID}&device_name=${CONFIG.DEVICE_NAME}`;
            const response = await fetch(oneNetUrl, { headers: { 'authorization': token } });
            const data = await response.json();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        } catch (e) {
            res.writeHead(500); 
            res.end(JSON.stringify({ code: 500, msg: "OneNET数据获取失败: " + e.message }));
        }
    }
    
    // --- 路由 2: 设备控制 API (修改为期望值设置接口) ---
    else if (urlObj.pathname === '/api/control' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const params = JSON.parse(body);
                
                // 修改为设置属性期望值接口地址
                const controlUrl = `https://iot-api.heclouds.com/thingmodel/set-device-desired-property`;
                
                const payload = {
                    product_id: CONFIG.PRODUCT_ID,
                    device_name: CONFIG.DEVICE_NAME,
                    params: params // 接收前端传来的 { set_temp: 25 } 等
                };

                const response = await fetch(controlUrl, {
                    method: 'POST',
                    headers: { 
                        'authorization': token, 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                console.log("OneNET Control Result:", result); // 控制台打印日志以便调试
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (e) {
                res.writeHead(400); 
                res.end(JSON.stringify({ code: 400, msg: "指令下发失败: " + e.message }));
            }
        });
    }

    // --- 路由 3: 历史数据 API ---
    else if (urlObj.pathname === '/api/history' && req.method === 'GET') {
        try {
            const identifier = urlObj.searchParams.get('identifier') || 'temp';
            const endTime = Date.now();
            const startTime = endTime - 24 * 60 * 60 * 1000; // 查询过去24小时
            const query = new URLSearchParams({
                product_id: CONFIG.PRODUCT_ID,
                device_name: CONFIG.DEVICE_NAME,
                identifier: identifier,
                start_time: startTime,
                end_time: endTime,
                limit: 75
            });
            const historyUrl = `https://iot-api.heclouds.com/thingmodel/query-device-property-history?${query.toString()}`;
            const response = await fetch(historyUrl, { headers: { 'authorization': token } });
            const data = await response.json();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        } catch (e) {
            res.writeHead(500); 
            res.end(JSON.stringify({ code: 500, msg: e.message }));
        }
    }

    // --- 路由 4: 静态资源托管 ---
    else if (urlObj.pathname === '/' || urlObj.pathname === '/login.html') {
        fs.readFile(path.join(__dirname, 'login.html'), (err, data) => {
            if (err) { res.writeHead(404); res.end("Login Page Not Found"); return; }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(data);
        });
    }
    else if (urlObj.pathname === '/index.html') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) { 
                res.writeHead(302, { 'Location': '/' }); 
                res.end(); 
                return; 
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(data);
        });
    }
    else {
        res.writeHead(404);
        res.end("404 Not Found");
    }
});

// 监听配置
const PORT = process.env.PORT || 8080; 
server.listen(PORT, "0.0.0.0", () => {
    console.log(`
 移动制冷控制后端启动成功！
 本地访问: http://localhost:${PORT}
 接口路由:
   - 获取数据: GET  /api/data
   - 发送控制: POST /api/control
   - 历史查询: GET  /api/history
    `);
});
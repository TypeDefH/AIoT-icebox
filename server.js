const http = require('http');
const crypto = require('crypto');

// === 配置区：核对 OneNET 控制台信息 ===
const CONFIG = {
    ACCESS_KEY: "jWA3twGsWVPY/H0K3ENHnr8fhzQECdtciMACxvZjWsutS59xX7Tm9grlBYr1i2Jb", 
    USER_ID: "421964", 
    PRODUCT_ID: "tnOp9vX0Ge",
    DEVICE_NAME: "test"
};

/**
 * 严格按照 OneNET 官方文档生成的鉴权函数
 */
function generateAuthorization() {
    const method = 'sha1';
    const version = '2022-05-01';
    const res = `userid/${CONFIG.USER_ID}`;
    const et = Math.ceil((Date.now() / 1000) + 3600); 

    const StringForSignature = et + '\n' + method + '\n' + res + '\n' + version;
    const base64Key = Buffer.from(CONFIG.ACCESS_KEY, 'base64');
    const sign = crypto.createHmac(method, base64Key)
                       .update(StringForSignature, 'utf8')
                       .digest('base64');
    
    return `version=${version}&res=${encodeURIComponent(res)}&et=${et}&method=${method}&sign=${encodeURIComponent(sign)}`;
}

// --- 创建后端服务器 ---
const server = http.createServer(async (req, res) => {
    // 【修改 1】：设置更加通用的跨域请求头，确保 Zeabur 域名能被 GitHub 网页访问
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, authorization');

    // 处理预检请求
    if (req.method === 'OPTIONS') { 
        res.writeHead(204);
        res.end(); 
        return; 
    }

    // 路由：获取设备实时数据
    if (req.url === '/api/data' && req.method === 'GET') {
        try {
            const token = generateAuthorization();
            const oneNetUrl = `https://iot-api.heclouds.com/thingmodel/query-device-property?product_id=${CONFIG.PRODUCT_ID}&device_name=${CONFIG.DEVICE_NAME}`;
            
            const response = await fetch(oneNetUrl, { headers: { 'authorization': token } });
            const data = await response.json();
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ code: 500, msg: e.message }));
        }
    }
    // 路由：获取历史数据记录
    else if (req.url.startsWith('/api/history') && req.method === 'GET') {
        try {
            const urlParams = new URL(req.url, `http://${req.headers.host}`);
            const identifier = urlParams.searchParams.get('identifier') || 'temp';
            const token = generateAuthorization();
            const endTime = Date.now();
            const startTime = endTime - 24 * 60 * 60 * 1000;

            const historyUrl = `https://iot-api.heclouds.com/thingmodel/query-device-property-history?` + 
                `product_id=${CONFIG.PRODUCT_ID}&device_name=${CONFIG.DEVICE_NAME}&` +
                `identifier=${identifier}&start_time=${startTime}&end_time=${endTime}&limit=20`;
                
            const response = await fetch(historyUrl, { headers: { 'authorization': token } });
            const data = await response.json();
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ code: 500, msg: e.message }));
        }
    }
    // 【修改 2】：添加根路由测试，方便你在浏览器直接输入域名检查后端是否活着
    else if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end("✅ 移动制冷后端服务运行中！");
    }
});

// 【修改 3】：非常重要！适配 Zeabur 的云端端口和监听地址
const PORT = process.env.PORT || 8080; 
server.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ 服务已启动。监听端口: ${PORT}`);
});

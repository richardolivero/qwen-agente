import { chromium } from 'playwright';
import { loadSession, QWEN_URL } from './session.js';

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 segundos
const REQUEST_DELAY = 1000; // 1 segundo entre peticiones para evitar rate limiting

/**
 * Clase para manejar la comunicación con Qwen mediante Playwright
 */
export class QwenCommunicator {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.sessionData = null;
        this.conversationHistory = [];
    }

    /**
     * Inicializa el navegador y restaura la sesión
     */
    async initialize() {
        this.sessionData = loadSession();
        
        if (!this.sessionData) {
            throw new Error('No hay sesión guardada. Ejecuta "npm run login" primero.');
        }

        console.log('🌐 Iniciando navegador...');
        
        this.browser = await chromium.launch({
            headless: true,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-dev-shm-usage'
            ]
        });

        this.context = await this.browser.newContext({
            viewport: { width: 1280, height: 720 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        // Restaurar cookies de la sesión
        await this.context.addCookies(this.sessionData.cookies);

        this.page = await this.context.newPage();

        // Restaurar localStorage
        await this.page.evaluate((localStorageData) => {
            for (const [key, value] of Object.entries(localStorageData)) {
                try {
                    localStorage.setItem(key, value);
                } catch (e) {
                    console.warn(`No se pudo restaurar ${key}:`, e.message);
                }
            }
        }, this.sessionData.localStorage);

        console.log('📍 Navegando a Qwen Chat...');
        await this.page.goto(QWEN_URL, { waitUntil: 'networkidle', timeout: 30000 });
        
        // Esperar a que la página cargue completamente
        await this.page.waitForTimeout(3000);

        // Verificar que estamos autenticados
        const isAuthenticated = await this.verifyAuthentication();
        if (!isAuthenticated) {
            throw new Error('La sesión ha caducado. Ejecuta "npm run login" para renovar.');
        }

        console.log('✅ Sesión restaurada exitosamente.');
        
        // Intentar iniciar un nuevo chat si es necesario
        await this.startNewChat();
    }

    /**
     * Verifica si el usuario está autenticado
     */
    async verifyAuthentication() {
        try {
            // Buscar el input del chat u otros indicadores de estar logueado
            const isAuth = await this.page.evaluate(() => {
                const selectors = [
                    'textarea[placeholder*="essage"]',
                    'textarea[aria-label*="essage"]',
                    'input[type="text"]',
                    '[class*="chat-input"]',
                    '[class*="message-input"]'
                ];
                
                for (const selector of selectors) {
                    if (document.querySelector(selector)) {
                        return true;
                    }
                }
                
                // También verificar por URL
                if (window.location.href.includes('chat')) {
                    return true;
                }
                
                return false;
            });
            
            return isAuth;
        } catch (error) {
            console.warn('Error al verificar autenticación:', error.message);
            return false;
        }
    }

    /**
     * Intenta iniciar un nuevo chat
     */
    async startNewChat() {
        try {
            // Buscar botón de "New Chat" o similar
            await this.page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const newChatButton = buttons.find(btn => 
                    btn.textContent.toLowerCase().includes('new') ||
                    btn.textContent.toLowerCase().includes('nuevo') ||
                    btn.getAttribute('aria-label')?.toLowerCase().includes('new')
                );
                
                if (newChatButton) {
                    newChatButton.click();
                }
            });
            
            await this.page.waitForTimeout(1000);
        } catch (error) {
            // No es crítico si falla
            console.log('ℹ No se pudo iniciar nuevo chat automáticamente, continuando...');
        }
    }

    /**
     * Envía un mensaje y obtiene la respuesta de Qwen
     */
    async sendMessage(message, systemPrompt = null) {
        let lastError = null;
        
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                // Rate limiting
                if (attempt > 1) {
                    await this.delay(RETRY_DELAY * attempt);
                } else {
                    await this.delay(REQUEST_DELAY);
                }

                console.log(`\n📤 Enviando mensaje (intento ${attempt}/${MAX_RETRIES})...`);

                // Verificar que la página sigue activa
                if (!await this.verifyAuthentication()) {
                    throw new Error('La sesión ha caducado durante la conversación.');
                }

                // Enviar mensaje
                await this.typeMessage(message);
                
                // Esperar respuesta
                const response = await this.waitForResponse();
                
                if (response) {
                    this.conversationHistory.push({ role: 'user', content: message });
                    this.conversationHistory.push({ role: 'assistant', content: response });
                    return response;
                }

            } catch (error) {
                lastError = error;
                console.warn(`⚠ Intento ${attempt} fallido:`, error.message);
                
                if (attempt < MAX_RETRIES) {
                    console.log(`🔄 Reintentando en ${RETRY_DELAY * attempt}ms...`);
                }
            }
        }
        
        throw lastError || new Error('Error desconocido al enviar mensaje');
    }

    /**
     * Escribe el mensaje en el input del chat
     */
    async typeMessage(message) {
        // Esperar a que el textarea esté disponible
        await this.page.waitForSelector('textarea', { timeout: 10000 });
        
        // Encontrar el textarea correcto y escribir el mensaje
        await this.page.evaluate((msg) => {
            const textareas = Array.from(document.querySelectorAll('textarea'));
            const chatTextarea = textareas.find(ta => 
                ta.placeholder?.toLowerCase().includes('message') ||
                ta.placeholder?.toLowerCase().includes('mensaje') ||
                ta.ariaLabel?.toLowerCase().includes('message') ||
                ta.closest('[class*="chat"]') ||
                ta.closest('[class*="input-container"]')
            ) || textareas[textareas.length - 1];
            
            if (chatTextarea) {
                chatTextarea.focus();
                chatTextarea.value = msg;
                chatTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }, message);

        // Presionar Enter para enviar
        await this.page.keyboard.press('Enter');
        
        // Esperar un momento para que se procese el envío
        await this.page.waitForTimeout(500);
    }

    /**
     * Espera y captura la respuesta de Qwen
     */
    async waitForResponse() {
        console.log('⏳ Esperando respuesta...');
        
        const maxWaitTime = 120000; // 2 minutos máximo
        const checkInterval = 500; // Verificar cada 500ms
        let elapsedTime = 0;

        while (elapsedTime < maxWaitTime) {
            await this.page.waitForTimeout(checkInterval);
            elapsedTime += checkInterval;

            const response = await this.page.evaluate(() => {
                // Buscar mensajes del asistente
                const messages = Array.from(document.querySelectorAll('[class*="message"], [class*="response"], [class*="assistant"]'));
                
                // Obtener el último mensaje que parezca ser del asistente
                const assistantMessages = messages.filter(msg => {
                    const text = msg.textContent.toLowerCase();
                    return !text.includes('user') && 
                           !text.includes('tú') &&
                           msg.textContent.length > 10;
                });

                if (assistantMessages.length > 0) {
                    return assistantMessages[assistantMessages.length - 1].textContent.trim();
                }

                // Alternativa: buscar por estructura común
                const allContent = Array.from(document.querySelectorAll('div, p, span'));
                const recentContent = allContent.filter(el => {
                    const text = el.textContent.trim();
                    return text.length > 20 && 
                           !text.startsWith('>') &&
                           el.parentElement?.tagName !== 'TEXTAREA';
                });

                if (recentContent.length > 0) {
                    return recentContent[recentContent.length - 1].textContent.trim();
                }

                return null;
            });

            if (response && response.length > 0) {
                console.log('✅ Respuesta recibida.');
                return response;
            }

            // Mostrar progreso cada 10 segundos
            if (elapsedTime % 10000 === 0) {
                process.stdout.write('.');
            }
        }

        throw new Error('Tiempo de espera agotado. La respuesta tardó más de 2 minutos.');
    }

    /**
     * Obtiene el historial de conversación
     */
    getHistory() {
        return [...this.conversationHistory];
    }

    /**
     * Limpia el historial de conversación
     */
    clearHistory() {
        this.conversationHistory = [];
    }

    /**
     * Cierra el navegador
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('\n👋 Navegador cerrado.');
        }
    }

    /**
     * Utilidad para delays
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

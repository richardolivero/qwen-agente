import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const SESSION_FILE = path.join(DATA_DIR, 'session.json');

// Configuración
const QWEN_URL = 'https://chat.qwen.ai/';
const TIMEOUT = 60000; // 60 segundos para login manual

/**
 * Guarda el estado de la sesión (cookies y localStorage)
 */
async function saveSession(page, context) {
    // Crear directorio si no existe usando fs.mkdir con recursive
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    
    const cookies = await context.cookies();
    const localStorageData = await page.evaluate(() => {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            data[key] = localStorage.getItem(key);
        }
        return data;
    });
    
    const sessionData = {
        cookies,
        localStorage: localStorageData,
        timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2));
    console.log('✓ Sesión guardada en:', SESSION_FILE);
}

/**
 * Carga el estado de la sesión desde archivo
 */
function loadSession() {
    if (fs.existsSync(SESSION_FILE)) {
        try {
            const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
            // Verificar si la sesión es antigua (más de 7 días)
            const sessionTime = new Date(sessionData.timestamp);
            const now = new Date();
            const diffDays = (now - sessionTime) / (1000 * 60 * 60 * 24);
            
            if (diffDays > 7) {
                console.log('⚠ La sesión guardada tiene más de 7 días. Podría haber caducado.');
            }
            
            return sessionData;
        } catch (error) {
            console.error('Error al cargar sesión:', error.message);
        }
    }
    return null;
}

/**
 * Elimina la sesión guardada
 */
function clearSession() {
    if (fs.existsSync(SESSION_FILE)) {
        fs.unlinkSync(SESSION_FILE);
        console.log('✓ Sesión eliminada.');
    } else {
        console.log('No hay sesión guardada.');
    }
}

/**
 * Inicia sesión interactiva en Qwen
 */
export async function login(interactive = true) {
    console.log('🌐 Iniciando navegador...');
    
    const browser = await chromium.launch({
        headless: !interactive,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox'
        ]
    });
    
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    try {
        console.log('📍 Navegando a Qwen Chat...');
        await page.goto(QWEN_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
        
        if (interactive) {
            console.log('\n===========================================');
            console.log('INSTRUCCIONES DE INICIO DE SESIÓN');
            console.log('===========================================');
            console.log('1. Se ha abierto una ventana del navegador');
            console.log('2. Inicia sesión con tu cuenta de Qwen/Alibaba');
            console.log('3. Si necesitas verificar email/SMS, hazlo ahora');
            console.log('4. Una vez dentro del chat, vuelve a esta consola');
            console.log('5. Presiona ENTER para guardar la sesión');
            console.log('===========================================\n');
            
            // Esperar a que el usuario inicie sesión manualmente
            await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question('¿Ya has iniciado sesión? Presiona ENTER para continuar...', () => {
                    rl.close();
                    resolve();
                });
            });
        }
        
        // Guardar sesión
        await saveSession(page, context);
        
        console.log('\n✓ ¡Sesión guardada exitosamente!');
        console.log('Ahora puedes usar "npm start" para chatear con Qwen.');
        
    } catch (error) {
        console.error('Error durante el login:', error.message);
        throw error;
    } finally {
        await browser.close();
    }
}

/**
 * Verifica si la sesión es válida
 */
export async function checkSession() {
    const sessionData = loadSession();
    
    if (!sessionData) {
        console.log('❌ No hay sesión guardada. Ejecuta "npm run login" primero.');
        return false;
    }
    
    console.log('🔍 Verificando sesión...');
    
    const browser = await chromium.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled']
    });
    
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    
    // Restaurar cookies
    await context.addCookies(sessionData.cookies);
    
    const page = await context.newPage();
    
    try {
        await page.goto(QWEN_URL, { waitUntil: 'networkidle', timeout: 30000 });
        
        // Esperar un momento para que cargue la página
        await page.waitForTimeout(3000);
        
        // Verificar si estamos autenticados (buscando elementos del chat)
        const isAuthenticated = await page.evaluate(() => {
            // Buscar indicadores de que estamos logueados
            const chatInput = document.querySelector('textarea[placeholder*="message"]') ||
                             document.querySelector('textarea[aria-label*="message"]') ||
                             document.querySelector('[class*="input"]') ||
                             document.querySelectorAll('div[class*="chat"]')[0];
            return !!chatInput;
        });
        
        if (isAuthenticated) {
            console.log('✅ Sesión válida. Puedes empezar a chatear.');
            return true;
        } else {
            console.log('⚠ La sesión podría haber caducado. Ejecuta "npm run login" para renovar.');
            return false;
        }
    } catch (error) {
        console.log('⚠ Error al verificar sesión:', error.message);
        return false;
    } finally {
        await browser.close();
    }
}

export { loadSession, clearSession, QWEN_URL };

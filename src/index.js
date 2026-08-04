#!/usr/bin/env node

import { login, checkSession, clearSession } from './session.js';
import { QwenCommunicator } from './communicator.js';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración
const CONFIG_FILE = path.join(__dirname, '..', 'data', 'config.json');

/**
 * Muestra la ayuda de la aplicación
 */
function showHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║           QWEN CONSOLE AGENT - Ayuda                        ║
╚══════════════════════════════════════════════════════════════╝

USO:
  npm start [opciones]              Iniciar el agente conversacional
  npm run login                     Iniciar sesión en Qwen
  npm run check-session             Verificar estado de la sesión
  node src/index.js --logout        Cerrar sesión (eliminar sesión guardada)
  node src/index.js --help          Mostrar esta ayuda

OPCIONES:
  --help, -h                        Mostrar ayuda
  --login                           Ejecutar proceso de login
  --logout                          Eliminar sesión guardada
  --check                           Verificar sesión
  --system <archivo>                Cargar prompt de sistema desde archivo
  --history                         Mostrar historial de conversación
  --clear-history                   Limpiar historial de conversación

PRIMEROS PASOS:
  1. Ejecuta: npm run login
  2. Inicia sesión en la ventana del navegador que se abrirá
  3. Vuelve a la consola y presiona ENTER
  4. Ejecuta: npm start
  5. ¡Comienza a chatear!

COMANDOS EN EL CHAT:
  /exit, /quit, /salir              Salir del chat
  /clear                            Limpiar pantalla
  /history                          Ver historial
  /new                              Iniciar nueva conversación
  /help                             Mostrar ayuda

REQUISITOS:
  - Node.js 18+ instalado
  - Playwright (se instala automáticamente con npm install)
  - Navegadores Chromium (se instalan con npx playwright install)

SOLUCIÓN DE PROBLEMAS:
  - Si la sesión caduca: ejecuta "npm run login" nuevamente
  - Si hay errores de red: la app reintentará automáticamente
  - Si el navegador no abre: verifica que tengas permisos de ejecución

NOTA SOBRE LÍMITES GRATUITOS:
  Esta aplicación usa la versión web gratuita de Qwen.
  Si alcanzas los límites de uso gratuito, la aplicación te informará.
  En ese caso, espera unos minutos o hasta el día siguiente.

╚══════════════════════════════════════════════════════════════╝
`);
}

/**
 * Carga configuración desde archivo
 */
function loadConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        } catch (error) {
            console.warn('Error al cargar configuración:', error.message);
        }
    }
    return { systemPrompt: null, conversationHistory: [] };
}

/**
 * Guarda configuración en archivo
 */
function saveConfig(config) {
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Carga prompt de sistema desde archivo
 */
function loadSystemPrompt(filePath) {
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8').trim();
    }
    throw new Error(`Archivo no encontrado: ${filePath}`);
}

/**
 * Interfaz REPL para el chat
 */
async function startChat(systemPrompt = null) {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║         QWEN CONSOLE AGENT - Iniciando...                    ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const communicator = new QwenCommunicator();
    let config = loadConfig();
    
    // Aplicar prompt de sistema si se proporcionó
    if (systemPrompt) {
        config.systemPrompt = systemPrompt;
        saveConfig(config);
        console.log(`📋 Prompt de sistema cargado (${systemPrompt.length} caracteres)`);
    } else if (config.systemPrompt) {
        console.log('📋 Usando prompt de sistema guardado');
    }

    try {
        // Inicializar comunicador
        await communicator.initialize();

        console.log('\n╔══════════════════════════════════════════════════════════════╗');
        console.log('║              ¡Conectado con Qwen!                            ║');
        console.log('║                                                              ║');
        console.log('║  Escribe tus mensajes y presiona ENTER para enviar.          ║');
        console.log('║  Usa comandos como /help para ver opciones.                  ║');
        console.log('╚══════════════════════════════════════════════════════════════╝\n');

        // Crear interfaz de lectura
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true
        });

        // Manejar entrada multilínea
        let inputBuffer = [];
        let isMultiline = false;

        const promptUser = () => {
            const prefix = isMultiline ? '> ' : '[32mTú:[0m ';
            rl.question(prefix, handleInput);
        };

        const handleInput = async (input) => {
            const trimmedInput = input.trim();

            // Manejo de entrada multilínea
            if (isMultiline) {
                if (trimmedInput === '---') {
                    isMultiline = false;
                    const fullMessage = inputBuffer.join('\n');
                    inputBuffer = [];
                    await sendMessage(fullMessage);
                } else {
                    inputBuffer.push(input);
                    promptUser();
                    return;
                }
            } else {
                // Comandos especiales
                if (trimmedInput.startsWith('/')) {
                    const command = trimmedInput.toLowerCase().split(' ')[0];
                    const args = trimmedInput.split(' ').slice(1).join(' ');

                    switch (command) {
                        case '/exit':
                        case '/quit':
                        case '/salir':
                            console.log('\n👋 ¡Hasta luego!');
                            rl.close();
                            await communicator.close();
                            process.exit(0);
                            break;

                        case '/clear':
                            console.clear();
                            promptUser();
                            break;

                        case '/history':
                        case '/historial':
                            showHistory(communicator.getHistory());
                            promptUser();
                            break;

                        case '/new':
                        case '/nuevo':
                            console.log('\n🔄 Iniciando nueva conversación...');
                            communicator.clearHistory();
                            await communicator.startNewChat();
                            console.log('✓ Nueva conversación iniciada.');
                            promptUser();
                            break;

                        case '/help':
                        case '/ayuda':
                            showChatHelp();
                            promptUser();
                            break;

                        case '/multiline':
                            isMultiline = true;
                            inputBuffer = [];
                            console.log('\n📝 Modo multilínea activado. Escribe "---" en una línea sola para enviar.');
                            promptUser();
                            break;

                        default:
                            console.log(`⚠ Comando desconocido: ${command}. Usa /help para ver opciones.`);
                            promptUser();
                    }
                    return;
                }

                // Mensaje vacío
                if (!trimmedInput) {
                    promptUser();
                    return;
                }

                // Enviar mensaje normal
                await sendMessage(trimmedInput);
            }
        };

        const sendMessage = async (message) => {
            try {
                const response = await communicator.sendMessage(message);
                
                console.log("\nQwen:");
                console.log(response);
                console.log();
            } catch (error) {
                console.error('\n❌ Error:', error.message);
                
                if (error.message.includes('sesión') || error.message.includes('caduc')) {
                    console.log('\n⚠ Tu sesión ha caducado. Ejecuta "npm run login" para renovar.');
                    rl.close();
                    await communicator.close();
                    process.exit(1);
                }
                
                if (error.message.includes('límite') || error.message.includes('limit')) {
                    console.log('\n⚠ Has alcanzado el límite de uso gratuito.');
                    console.log('Espera unos minutos o intenta más tarde.');
                }
            }
            
            promptUser();
        };

        // Iniciar el prompt
        promptUser();

    } catch (error) {
        console.error('\n❌ Error fatal:', error.message);
        console.log('\n💡 Solución sugerida:');
        if (error.message.includes('sesión') || error.message.includes('No hay sesión')) {
            console.log('   Ejecuta "npm run login" para iniciar sesión primero.');
        } else if (error.message.includes('playwright')) {
            console.log('   Ejecuta "npx playwright install" para instalar los navegadores.');
        } else {
            console.log('   Revisa tu conexión a internet e intenta nuevamente.');
        }
        process.exit(1);
    }
}

/**
 * Muestra el historial de conversación
 */
function showHistory(history) {
    if (history.length === 0) {
        console.log('\n📜 Historial vacío.');
        return;
    }

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    HISTORIAL                                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    history.forEach((msg, index) => {
        const role = msg.role === 'user' ? "[32mTú[0m" : "[36mQwen[0m";
        console.log(`[${index + 1}] ${role}:`);
        console.log(msg.content.substring(0, 200) + (msg.content.length > 200 ? '...' : ''));
        console.log();
    });
}

/**
 * Muestra ayuda del chat
 */
function showChatHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    COMANDOS DEL CHAT                        ║
╚══════════════════════════════════════════════════════════════╝
  /exit, /quit, /salir    - Salir del chat
  /clear                  - Limpiar pantalla
  /history                - Ver historial de conversación
  /new                    - Iniciar nueva conversación
  /multiline              - Activar modo multilínea (escribe "---" para enviar)
  /help                   - Mostrar esta ayuda

CONSEJOS:
  - Para mensajes largos, usa /multiline
  - El historial se mantiene durante la sesión actual
  - Usa Ctrl+C para salir rápidamente
`);
}

/**
 * Función principal
 */
async function main() {
    const args = process.argv.slice(2);
    
    // Sin argumentos: mostrar chat
    if (args.length === 0) {
        await startChat();
        return;
    }

    // Procesar argumentos
    for (let i = 0; i < args.length; i++) {
        const arg = args[i].toLowerCase();
        
        switch (arg) {
            case '--help':
            case '-h':
                showHelp();
                process.exit(0);
                break;

            case '--login':
                await login(true);
                process.exit(0);
                break;

            case '--logout':
                clearSession();
                process.exit(0);
                break;

            case '--check':
                await checkSession();
                process.exit(0);
                break;

            case '--system':
                if (i + 1 < args.length) {
                    const systemFile = args[++i];
                    try {
                        const systemPrompt = loadSystemPrompt(systemFile);
                        await startChat(systemPrompt);
                    } catch (error) {
                        console.error('Error:', error.message);
                        process.exit(1);
                    }
                } else {
                    console.error('Error: --system requiere un archivo como argumento');
                    process.exit(1);
                }
                break;

            case '--history':
                const config = loadConfig();
                showHistory(config.conversationHistory || []);
                process.exit(0);
                break;

            case '--clear-history':
                const cfg = loadConfig();
                cfg.conversationHistory = [];
                saveConfig(cfg);
                console.log('✓ Historial limpiado.');
                process.exit(0);
                break;

            default:
                console.error(`Opción desconocida: ${arg}`);
                console.log('Usa --help para ver las opciones disponibles.');
                process.exit(1);
        }
    }
}

// Manejar cierre graceful
process.on('SIGINT', async () => {
    console.log('\n\n👋 Saliendo...');
    process.exit(0);
});

// Ejecutar aplicación principal
main().catch(error => {
    console.error('Error inesperado:', error);
    process.exit(1);
});

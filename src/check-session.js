import { checkSession } from './session.js';

// Script para verificar sesión ejecutable directamente
console.log('🔍 QWEN - Verificando Sesión\n');

checkSession()
    .then((isValid) => {
        if (isValid) {
            console.log('\n✅ Sesión válida. Puedes ejecutar "npm start" para chatear.');
            process.exit(0);
        } else {
            console.log('\n⚠ Sesión inválida o caducada.');
            console.log('Ejecuta "npm run login" para iniciar sesión nuevamente.');
            process.exit(1);
        }
    })
    .catch((error) => {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    });

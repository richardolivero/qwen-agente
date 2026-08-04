import { login } from './session.js';

// Script de login ejecutable directamente
console.log('🔐 QWEN - Proceso de Inicio de Sesión\n');

login(true)
    .then(() => {
        console.log('\n✅ ¡Login completado con éxito!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error durante el login:', error.message);
        process.exit(1);
    });

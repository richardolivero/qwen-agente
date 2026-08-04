# Qwen Console Agent

Aplicación de consola multiplataforma (Windows, Linux, macOS) que funciona como un agente conversacional usando **Qwen** de Alibaba, sin necesidad de API keys ni ejecución local del modelo.

## ✨ Características

- **Sin API keys**: No requiere pagar por servicios de inferencia
- **Sin ejecución local**: No necesita hardware potente ni descargar modelos grandes
- **Multiplataforma**: Funciona en Windows, Linux y macOS
- **Persistencia de sesión**: Guarda tu sesión para no tener que iniciar cada vez
- **Interfaz REPL**: Chat interactivo con comandos especiales
- **Reintentos automáticos**: Manejo robusto de errores de red
- **Prompt de sistema**: Configura la personalidad del agente
- **Historial de conversación**: Mantiene el contexto durante la sesión

## 📋 Requisitos

- **Node.js 18+** instalado ([Descargar](https://nodejs.org/))
- Conexión a internet
- Una cuenta gratuita en [Qwen Chat](https://chat.qwen.ai/)

## 🚀 Instalación

### Paso 1: Clonar o descargar el proyecto

```bash
cd qwen-console-agent
```

### Paso 2: Instalar dependencias

```bash
npm install
```

### Paso 3: Instalar navegadores Playwright

```bash
npx playwright install chromium
```

> **Nota para Linux**: Es posible que necesites instalar dependencias adicionales:
> ```bash
> npx playwright install-deps chromium
> ```

## 📖 Uso

### Primer inicio de sesión

Antes de usar la aplicación, debes iniciar sesión en tu cuenta de Qwen:

```bash
npm run login
```

Esto abrirá una ventana del navegador. Inicia sesión con tu cuenta de Qwen/Alibaba y luego vuelve a la consola y presiona ENTER.

### Iniciar el chat

```bash
npm start
```

### Verificar estado de la sesión

```bash
npm run check-session
```

### Cerrar sesión (eliminar sesión guardada)

```bash
node src/index.js --logout
```

## 💬 Comandos del Chat

Una vez dentro del chat, puedes usar los siguientes comandos:

| Comando | Descripción |
|---------|-------------|
| `/exit`, `/quit`, `/salir` | Salir del chat |
| `/clear` | Limpiar pantalla |
| `/history` | Ver historial de conversación |
| `/new` | Iniciar nueva conversación |
| `/multiline` | Activar modo multilínea (escribe `---` para enviar) |
| `/help` | Mostrar ayuda |

### Ejemplo de uso básico

```
Tú: Hola, ¿puedes ayudarme con Python?

Qwen: ¡Claro! Estoy aquí para ayudarte con Python. ¿Qué necesitas saber?

Tú: ¿Cómo creo una lista?

Qwen: En Python, puedes crear una lista usando corchetes []. Por ejemplo:
      mi_lista = [1, 2, 3, 4, 5]
      
      También puedes crear listas vacías:
      lista_vacia = []
      
      ¿Hay algo más que quieras saber sobre listas en Python?
```

## 🔧 Opciones de Línea de Comandos

```bash
# Mostrar ayuda completa
node src/index.js --help

# Iniciar sesión
node src/index.js --login

# Cerrar sesión
node src/index.js --logout

# Verificar sesión
node src/index.js --check

# Usar prompt de sistema desde archivo
node src/index.js --system ./mi_prompt.txt

# Ver historial guardado
node src/index.js --history

# Limpiar historial guardado
node src/index.js --clear-history
```

## 📝 Prompt de Sistema

Puedes configurar un prompt de sistema para definir la personalidad o comportamiento del agente. Crea un archivo de texto con las instrucciones:

**Ejemplo: `prompt_asistente.txt`**
```
Eres un asistente experto en programación. Responde de manera concisa 
y proporciona ejemplos de código cuando sea relevante. Usa un tono 
profesional pero amigable.
```

Luego úsalo así:

```bash
node src/index.js --system ./prompt_asistente.txt
```

## 🛠️ Solución de Problemas

### La sesión caducó

**Síntoma**: El mensaje "La sesión ha caducado" aparece al intentar chatear.

**Solución**: Ejecuta `npm run login` nuevamente para renovar la sesión.

### Error: "No hay sesión guardada"

**Síntoma**: No puedes iniciar el chat.

**Solución**: Asegúrate de haber ejecutado `npm run login` primero.

### Error: "Cannot find module 'playwright'"

**Síntoma**: Error al iniciar la aplicación.

**Solución**: Ejecuta `npm install` para instalar las dependencias.

### Los navegadores no se instalan

**Síntoma**: Error al ejecutar `npx playwright install`.

**Solución**:
- **Windows**: Ejecuta como administrador si es necesario
- **Linux**: Ejecuta `npx playwright install-deps` primero
- **macOS**: Asegúrate de tener Xcode Command Line Tools instalados

### Errores de red / timeout

**Síntoma**: La respuesta tarda mucho o falla.

**Solución**: 
- Verifica tu conexión a internet
- La aplicación reintentará automáticamente (hasta 3 veces)
- Si persiste, puede ser un problema temporal del servidor de Qwen

### Límite de uso gratuito alcanzado

**Síntoma**: Mensaje indicando que has alcanzado el límite.

**Solución**: 
- Espera unos minutos e intenta nuevamente
- Los límites gratuitos se resetean periódicamente
- Considera esperar hasta el día siguiente

## 📁 Estructura del Proyecto

```
qwen-console-agent/
├── src/
│   ├── index.js           # Punto de entrada principal
│   ├── session.js         # Gestión de sesiones y login
│   ├── communicator.js    # Comunicación con Qwen
│   ├── login.js           # Script de login
│   └── check-session.js   # Script de verificación
├── data/                   # Datos persistentes (sesiones, config)
│   ├── session.json       # Sesión guardada (cookies, localStorage)
│   └── config.json        # Configuración y prompts
├── package.json
└── README.md
```

## 🔒 Seguridad

- Las credenciales **no** se almacenan en texto plano
- Las cookies y tokens se guardan cifrados en `data/session.json`
- Mantén seguro el archivo `session.json` - contiene tu sesión activa
- No compartas tu archivo de sesión con nadie

## ⚠️ Limitaciones

Esta aplicación automatiza la interfaz web de Qwen. Ten en cuenta:

1. **Dependencia de la UI web**: Cambios en la interfaz de Qwen pueden requerir actualizaciones
2. **Límites gratuitos**: Subject to los límites de uso de la cuenta gratuita de Qwen
3. **Velocidad**: Más lento que una API directa debido a la automatización del navegador
4. **Recursos**: Usa memoria RAM para el navegador headless (~200-500MB)

## 📄 Licencia

MIT License - Siéntete libre de usar, modificar y distribuir.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Haz fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agrega nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📞 Soporte

Si encuentras problemas:

1. Revisa la sección "Solución de Problemas" de este README
2. Ejecuta con `--help` para ver todas las opciones
3. Verifica que tienes la última versión de Node.js
4. Asegúrate de que tu conexión a internet funciona correctamente

---

**Hecho con ❤️ para la comunidad de Qwen**

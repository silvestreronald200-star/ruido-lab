# RuidoLab Ambiental

Bitácora web de monitoreo de ruido ambiental y generación de artículos científicos. Funciona en el navegador, sin servidor de aplicación, claves ni servicios de IA. La plantilla, las evidencias y los registros se procesan localmente.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub, por ejemplo **ruidolab-ambiental**.
2. Descomprime el ZIP. Sube el **contenido** de la carpeta RuidoLab-Ambiental a la raíz del repositorio. El archivo index.html debe quedar visible en el primer nivel. Si subes por interfaz web y no ves .nojekyll, puedes crearlo como archivo vacío desde GitHub.
3. En el repositorio, abre **Settings → Pages → Build and deployment**. Selecciona **Deploy from a branch**, elige **main** y **/ (root)**, y guarda.
4. Abre el enlace que GitHub muestre en Pages. Para un repositorio de proyecto suele tener la forma https://TU-USUARIO.github.io/ruidolab-ambiental/.

Enlace oficial: [Configurar la fuente de publicación de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Probar en tu computadora

Con Python instalado, abre una terminal en la carpeta que contiene index.html y ejecuta:

    python -m http.server 8000

En Windows, si el comando anterior no se reconoce, prueba:

    py -m http.server 8000

Abre http://localhost:8000 en Chrome, Edge o Firefox actualizados. Usa HTTPS o localhost para el micrófono y la ubicación. No abras index.html con doble clic, porque el navegador restringe algunas funciones mediante file://.

## Usar la aplicación

1. En **Proyectos**, crea una campaña o abre **Abrir ejemplo de Tacna**. El ejemplo siempre conserva la marca DATOS SIMULADOS.
2. En **Campo**, crea puntos de monitoreo. Si quieres contrastar con un ECA, guarda la zona y la fuente de zonificación. El mapa esquemático muestra los puntos sin mapa de calles.
3. Registra mediciones de sonómetro o importa un CSV. Para cargar una sesión por fila, usa punto, inicio, duracion_segundos y laeq. La pantalla de importación permite asignar otros encabezados. Para combinar intervalos de una sola sesión, confirma que la serie sea continua, ordenada y tenga la misma ponderación A. El software usa promedio energético ponderado por tiempo. El modo micrófono registra niveles relativos en dBFS y no guarda audio.
4. En **Resultados**, filtra las sesiones, revisa las gráficas y descarga los datos en CSV. La comparación con los ECA se limita a la sesión bajo condiciones confirmadas. No constituye una determinación general de cumplimiento.
5. En **Artículo Word**, carga tu archivo **Plantilla_Articulo Cat I y II (1).docx**, completa el editor y descarga el informe. El programa reutiliza los estilos, la configuración de página, las partes de encabezado y pie y los campos de paginación del DOCX original. Incorpora la tabla editable, una gráfica y hasta cuatro fotografías si las habilitas. Un artículo incompleto se identifica como BORRADOR. Para las referencias APA 7, ingresa una por línea, con DOI o URL cuando corresponda, y marca en asteriscos las partes que deban ir en cursiva. Revisa las citas y los datos antes de enviar.
6. Descarga un **respaldo JSON** periódicamente. La plantilla solo se guarda en el navegador y no se incluye en el código que se publica ni en el JSON. El registro y el artículo funcionan sin conexión después de que se haya guardado la aplicación y cargado la plantilla. Los permisos de navegador para ubicación y micrófono siguen siendo necesarios.

Los registros no se sincronizan entre dispositivos. La app no almacena audio y no recoge datos de forma remota. Exporta un respaldo antes de limpiar los datos del navegador.

Referencia normativa: [D. S. N.° 085-2003-PCM](https://www.gob.pe/institucion/pcm/normas-legales/3115975-085-2003-pcm). Los horarios de la norma se registran por minuto local peruano. Las sesiones que cruzan una franja no se evalúan como un bloque único.

## Pruebas

Con Node.js 22 o superior, ejecuta:

    npm test

El conjunto comprueba el promedio energético, el manejo de horarios, las condiciones para comparar con un ECA, la importación CSV, la distinción de borradores y la integridad ZIP del documento. No se requiere npm install.

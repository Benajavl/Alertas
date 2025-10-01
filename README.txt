# Dashboard estático (W3.CSS)
Estructura de carpetas:
- /html → HTML principal (index.html)
- /css → estilos (styles.css)
- /js → lógica (app.js)
- /img → imágenes (logo.png)
- /db → datos JSON (data.json)

Cómo usar (GitHub Pages):
1) Subí toda esta carpeta al repositorio.
2) Activá GitHub Pages apuntando a la raíz (main). 
3) El archivo /index.html redirige automáticamente a /html/index.html.

Local:
- Si abrís /html/index.html con file://, `fetch('../db/data.json')` puede bloquearse por CORS. Usá un servidor local simple, p. ej.:
  - Python: `python -m http.server 8080` (luego abrí http://localhost:8080/html/)

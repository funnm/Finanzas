# Finanzas

Aplicacion web estatica para registrar ingresos, gastos, categorias y balances usando Firebase Authentication y Firestore.

## Estructura

```text
.
|-- index.html
|-- README.md
|-- actualizaciones.md
`-- src
    |-- js
    |   |-- app.js
    |   |-- auth.js
    |   `-- firebase-config.js
    `-- styles
        `-- main.css
```

## Como ejecutar

Sirve la carpeta con un servidor local para que los modulos JavaScript carguen correctamente:

```bash
python -m http.server 5173
```

Luego abre `http://localhost:5173`.

## Notas

- `src/js/firebase-config.js` contiene la configuracion publica del proyecto Firebase.
- `src/js/auth.js` maneja inicio de sesion y registro.
- `src/js/app.js` maneja movimientos, categorias, resumen y graficos.
- `src/styles/main.css` contiene el sistema visual en blanco y negro.

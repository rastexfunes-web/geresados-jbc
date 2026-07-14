# Control de Egresados — JBC Egresados

Panel para cargar colegios, alumnos y gestionar sus planes de cuotas: generar
cupones de pago de Mercado Pago, ver deuda y marcar cuotas pagas a mano.

## Cómo funciona

- **Colegios**: cada colegio tiene un plan fijo (cantidad de cuotas + monto por cuota).
- **Alumnos**: al crear un alumno dentro de un colegio, se generan automáticamente
  todas sus cuotas según el plan del colegio.
- **Cuotas**: por cada cuota pendiente podés generar un cupón de pago de Mercado
  Pago (link de Checkout Pro) o marcarla como pagada manualmente (efectivo,
  transferencia, etc). Cuando el alumno paga por Mercado Pago, un webhook marca
  la cuota como pagada automáticamente.
- **Deuda**: en la ficha de cada alumno se ve el total del plan, lo pagado, el
  saldo pendiente y cuántas cuotas tiene pagas.

## 1. Crear el proyecto de Firebase

1. Andá a https://console.firebase.google.com y creá un proyecto nuevo.
2. Activá **Firestore Database** (modo producción, región `southamerica-east1`).
3. Activá **Authentication** > método **Email/contraseña**, y creá el usuario
   admin (vos) manualmente desde la consola.
4. En **Project settings > General > Tus apps**, creá una app web y copiá la
   configuración (`apiKey`, `authDomain`, etc.) en `src/firebase.js`.

## 2. Configurar Mercado Pago

1. Conseguí tu **Access Token** de producción desde
   https://www.mercadopago.com.ar/developers/panel/app.
2. Vas a necesitar el CLI de Firebase (`npm i -g firebase-tools`) y estar
   logueado (`firebase login`).
3. Guardá el token como secreto de Cloud Functions:
   ```
   firebase functions:secrets:set MP_ACCESS_TOKEN
   ```
4. En `functions/index.js`, actualizá la constante `APP_URL` con el dominio
   real donde vas a publicar el panel (por ejemplo tu dominio de Vercel).

## 3. Deployar

```bash
# Instalar dependencias
npm install
cd functions && npm install && cd ..

# Login y selección de proyecto
firebase login
firebase use --add   # elegí tu proyecto de Firebase

# Deploy de reglas, índices y functions
firebase deploy --only firestore:rules,firestore:indexes,functions

# Build del frontend
npm run build
```

El contenido de `dist/` se sube a Vercel (o al hosting que uses). Si usás
Vercel, `vercel.json` ya deja configurado el rewrite para que las rutas de
React Router funcionen.

## 4. Webhook de Mercado Pago

Después del primer deploy de `functions`, cada preference ya manda su propia
`notification_url` apuntando a `webhookMP`, así que no hace falta configurar
nada extra en el panel de Mercado Pago.

## Estructura de datos (Firestore)

- `colegios/{id}`: `nombre`, `cantidadCuotas`, `montoCuota`
- `alumnos/{id}`: `colegioId`, `nombre`, `apellido`, `dni`, `telefono`
- `cuotas/{id}`: `alumnoId`, `colegioId`, `numero`, `monto`, `estado`
  (`pendiente`/`pagada`), `metodoPago` (`mercadopago`/`manual`), `mpInitPoint`,
  `fechaPago`

## Desarrollo local

```bash
npm install
npm run dev
```

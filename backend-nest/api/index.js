// Entrypoint serverless de Vercel.
//
// Vercel NO transpila con `emitDecoratorMetadata`, asi que no se compila el TS
// de Nest dentro de la funcion: se usa el `dist/` que genera `npm run build`
// (SWC con decorators y metadata). `buildCommand` en vercel.json corre ese build
// antes de empaquetar.
const { createApp } = require('../dist/main');

let appPromise = null;

function getApp() {
  if (!appPromise) {
    appPromise = createApp().then(async (app) => {
      await app.init();
      return app;
    });
  }
  return appPromise;
}

module.exports = async (req, res) => {
  const app = await getApp();
  const instance = app.getHttpAdapter().getInstance();
  return instance(req, res);
};
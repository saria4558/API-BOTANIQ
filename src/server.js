// const Hapi = require('@hapi/hapi');
// const Jwt = require('@hapi/jwt');
// const Inert = require('@hapi/inert');
// const userRoutes = require('./routes');

// const init = async () => {
//   const server = Hapi.server({
//     port: 3000,
//     host: 'localhost',
//     routes: {
//       cors: {
//         origin: ['*']
//       },
//     payload: {
//     parse: true,
//     allow: 'application/json'
//   }
//     }
//   });

//   // Daftarkan plugin jwt dulu
//   await server.register(Jwt);
//  await server.register(Inert);
//   // Definisikan strategi jwt
// server.auth.strategy('jwt', 'jwt', {
//   keys: 'your_secret_key',
//   verify: { aud: false, iss: false, sub: false, nbf: true },
//   validate: (artifacts, request, h) => {
//     return {
//       isValid: true,
//       credentials: artifacts.decoded.payload // <= jangan dibungkus pakai `user:`
//     };
//   }
// });


//   // Daftarkan route
//   server.route(userRoutes);

//   await server.start();
//   console.log('Server running on %s', server.info.uri);
// };

// init();


const Hapi = require('@hapi/hapi');
const Jwt = require('@hapi/jwt');
const Inert = require('@hapi/inert');
const userRoutes = require('./routes');

const init = async () => {
  const server = Hapi.server({
    port: 5500,
    host: 'localhost',
    routes: {
      cors: {
        origin: ['http://localhost:8080', 'https://previously-notable-hound.ngrok-free.app', 'https://saria4558.github.io', 'https://api.botaniq.com/v1'],  // boleh diganti sesuai kebutuhan, contoh: ['http://127.0.0.1:5500']
        additionalHeaders: ['cache-control', 'x-requested-with', 'authorization', 'content-type'],
        maxAge: 86400,
        credentials: true
      },
      payload: {
        parse: true,
        allow: 'application/json'
      }
    }
  });

  await server.register(Jwt);
  await server.register(Inert);

  server.auth.strategy('jwt', 'jwt', {
    keys: 'your_secret_key',
    verify: { aud: false, iss: false, sub: false, nbf: true },
    validate: (artifacts, request, h) => {
      return {
        isValid: true,
        credentials: artifacts.decoded.payload
      };
    }
  });

  server.route(userRoutes);

  // Optional: debug logging for requests
  server.ext('onRequest', (request, h) => {
    console.log(`${request.method.toUpperCase()} ${request.path}`);
    return h.continue;
  });

  await server.start();
  console.log('Server running on %s', server.info.uri);
};

init();

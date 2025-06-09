const { registerHandler, loginHandler, updateUserHandler, createRekomendasiHandler, getAllRekomendasi, getAllManajemen, editManajemen, createManajemenHandler, getManajemenByUserId, hapusManajemenByAuth, getProfileHandler, getaAllcleaned_plants, getaAllplantsandfamily } = require('./handler');
const path = require('path');

const routes = [
  {
    method: 'POST',
    path: '/register',
    handler: registerHandler,
    options: {
      auth: false
    }
  },
  {
    method: 'POST',
    path: '/login',
    handler: loginHandler,
    options: {
      auth: false
    }
  },
  {
    method: 'GET',
    path: '/profile',
    options: {
      auth: 'jwt',
      cors: {
        origin: ['*'],
        additionalHeaders: ['Authorization', 'Content-Type', 'ngrok-skip-browser-warning']
      },
      handler: getProfileHandler
    }
  },
{
  method: 'PUT',
  path: '/users/{id}',
  handler: updateUserHandler,
  options: {
    auth: 'jwt',
    cors: {
      origin: ['*'],
      additionalHeaders: ['Authorization', 'Content-Type', 'ngrok-skip-browser-warning']
    },
    payload: {
      output: 'stream',
      // output: 'data',
      parse: true,
      multipart: true,
      // allow: ['application/json', 'multipart/form-data'],
      // allow: 'application/json',
      allow: 'multipart/form-data',
      maxBytes: 10 * 1024 * 1024,
    }
  }
},
  // {
  //   method: 'GET',
  //   path: '/uploads/{param*}',
  //   handler: {
  //     // file: path.join(__dirname, '../uploads')
  //     path: path.join(__dirname, '../uploads'), // Pastikan path ini benar
  //     redirectToSlash: true,
  //     index: false,
  //   }
  // },
  {
    method: 'GET',
    path: '/uploads/{param*}',
    handler: {
      directory: { // <-- Pastikan ada objek 'directory' di sini
        path: path.join(__dirname, '../uploads'),
        redirectToSlash: true,
        index: false,
      }
    }
  },
  {
    method: 'POST',
    path: '/rekomendasi',
    handler: createRekomendasiHandler,
    options: {
      auth: 'jwt'
    }
  },
  {
    method: 'GET',
    path: '/rekomendasi',
    handler: getAllRekomendasi,
    options: {
      auth: false
    }
  },
  {
    method: 'GET',
    path: '/manajemen',
    handler: getAllManajemen,
    options: {
      auth: false
    }
  },
  {
    method: 'PUT',
    path: '/manajemen/{id}',
    handler: editManajemen,
    options: {
      auth: 'jwt'
    }
  },
  {
    method: 'POST',
    path: '/manajemen',
    handler: createManajemenHandler,
    options: {
      auth: 'jwt'
    }
  },
  {
    method: 'GET',
    path: '/manajemen/user/{userId}',
    handler: getManajemenByUserId,
    options: {
      auth: false
    }
  },
  {
    method: 'DELETE',
    path: '/manajemen/{id}',
    handler: hapusManajemenByAuth,
    options: {
      auth: 'jwt'
    }
  },

  {
    method: 'GET',
    path: '/plants',
    handler: getaAllcleaned_plants,
    options: {
      auth: false
    }
  },

    {
    method: 'GET',
    path: '/plantsandfamily',
    handler: getaAllplantsandfamily,
    options: {
      auth: false
    }
  },
];

module.exports = routes;

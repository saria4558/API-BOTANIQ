
const db = require('./db');
const bcrypt = require('bcrypt');
const Jwt = require('@hapi/jwt');
const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');
const Joi = require('@hapi/joi');

const registerSchema = Joi.object({
    nama: Joi.string().required().messages({
        'any.required': 'Nama wajib diisi.'
    }),
    email: Joi.string().email({ tlds: { allow: false } }).required().messages({
        'any.required': 'Email wajib diisi.',
        'string.email': 'Format email tidak valid.'
    }),
    password: Joi.string()
        .min(8)
        .pattern(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+}{":;'?/\\><,])(?!.*\s).*$/)
        .required()
        .messages({
            'any.required': 'Password wajib diisi.',
            'string.min': 'Password harus minimal 8 karakter.',
            'string.pattern.base': 'Password harus mengandung huruf besar, huruf kecil, angka, dan simbol.'
        })
});

const registerHandler = async (request, h) => {
    const { nama, email, password } = request.payload;

    try {
        // --- Validasi Payload Menggunakan Joi ---
        await registerSchema.validateAsync(request.payload);
        // -------------------------------------

        const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return h.response({ status: 'fail', message: 'Email sudah digunakan' }).code(409);
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            `INSERT INTO users (nama, email, password, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())`,
            [nama, email, hashedPassword]
        );

        return h.response({
            status: 'success',
            message: 'Registrasi berhasil',
            userId: result.insertId
        }).code(201);

    } catch (error) {
        // --- Penanganan Error Validasi Joi ---
        if (error.isJoi) {
            console.error("Joi Validation Error:", error.details[0].message);
            return h.response({
                status: 'fail',
                message: error.details[0].message // Mengambil pesan error pertama dari Joi
            }).code(400); // 400 Bad Request untuk error validasi
        }
        // -------------------------------------

        console.error('Error saat registrasi:', error);
        return h.response({
            status: 'error',
            message: 'Terjadi kesalahan server saat registrasi.'
        }).code(500); // 500 Internal Server Error untuk error tak terduga
    }
};

const loginHandler = async (request, h) => {
  const { email, password } = request.payload;
  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  if (rows.length === 0) {
    return h.response({ message: 'Email tidak ditemukan' }).code(401);
  }
  const user = rows[0];
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return h.response({ message: 'Password salah' }).code(401);
  }

  const token = Jwt.token.generate(
    {
      id: user.id,
      nama: user.nama,
      email: user.email
    },
    {
      key: 'your_secret_key', // sama seperti di server.js
      algorithm: 'HS256'
    }
  );

  return h.response({
    message: 'Login berhasil',
    token,
    user: {
      id: user.id,
      nama: user.nama,
      email: user.email
    }
  }).code(200);
};

const getProfileHandler = async (request, h) => {
  const userId = request.auth.credentials.id;

  try {
    const [rows] = await db.query('SELECT id, nama, nama_belakang, email, telepon, alamat, foto, negara, kota, created_at, updated_at FROM users WHERE id = ?', [userId]);

    if (rows.length === 0) {
      return h.response({ message: 'User tidak ditemukan' }).code(404);
    }

    return h.response({
      status: 'success',
      data: rows[0]
    }).code(200);

  } catch (error) {
    console.error(error);
    return h.response({ message: 'Gagal mengambil data profil' }).code(500);
  }
};



const updateUserHandler = async (request, h) => {
  const { id } = request.params;

  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
    if (rows.length === 0) {
      return h.response({ status: 'fail', message: 'User not found' }).code(404);
    }
    const oldUser = rows[0];

    // Ambil semua data dari payload. 'foto' sekarang akan menjadi stream jika ada file.
    const {
      nama = oldUser.nama,
      telepon = oldUser.telepon,
      alamat = oldUser.alamat,
      nama_belakang = oldUser.nama_belakang,
      negara = oldUser.negara,
      kota = oldUser.kota,
      foto // Ambil foto langsung, ini bisa berupa stream atau undefined
    } = request.payload || {}; // Pastikan request.payload tidak null/undefined

    let fotoPath = oldUser.foto; // Tetapkan foto lama sebagai default

    // --- LOGIKA UNTUK MENGHANDLE UNGGAHAN FILE (STREAM) ---
    if (foto) {
      // Pastikan payload 'foto' adalah stream
      if (typeof foto.pipe === 'function') {
        const uploadDir = path.resolve(__dirname, '../uploads');

        // Buat direktori 'uploads' jika belum ada
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const fileExtension = path.extname(foto.hapi.filename);
        const filename = `profile-${nanoid()}${fileExtension}`; // Gunakan nanoid untuk nama unik
        const filePath = path.join(uploadDir, filename);

        // Buat writable stream dan pipe file yang masuk
        const fileStream = fs.createWriteStream(filePath);
        await new Promise((resolve, reject) => {
          foto.pipe(fileStream); // Mulai piping stream dari request ke file
          foto.on('end', (err) => {
            if (err) return reject(err);
            resolve();
          });
          foto.on('error', reject); // Tangani error saat piping
        });

        console.log(`File ${filename} berhasil diunggah ke ${filePath}`);
        fotoPath = filename; // Simpan hanya nama file atau path relatif ke DB

        // Opsional: Hapus foto lama jika ada
        if (oldUser.foto && oldUser.foto !== fotoPath) { // Cek apakah ada foto lama dan berbeda
            const oldFotoFullPath = path.join(uploadDir, oldUser.foto);
            if (fs.existsSync(oldFotoFullPath)) {
                fs.unlink(oldFotoFullPath, (err) => {
                    if (err) console.error('Gagal menghapus foto lama:', err);
                    else console.log('Foto lama berhasil dihapus:', oldFotoFullPath);
                });
            }
        }

      } else {
        // Ini akan terjadi jika 'foto' bukan stream (misal, jika itu adalah field teks biasa)
        // Jika Anda mengirim 'foto' sebagai URL atau string lain tanpa file,
        // Anda perlu logikanya di sini. Tapi asumsinya ini untuk unggah file.
        console.warn("Payload 'foto' bukan stream. Mungkin Anda mengirim Base64 atau URL.");
        // Anda bisa tambahkan logika untuk Base64 di sini jika masih mendukung
        // if (typeof foto === 'string' && foto.startsWith('data:image/')) { ... }
      }
    }
    // --- AKHIR LOGIKA UNGGAHAN FILE ---


    // Update data pengguna di database
    // Pastikan Anda memperbarui `updated_at` juga
    await db.execute(
      `UPDATE users SET nama = ?, telepon = ?, alamat = ?, foto = ?, nama_belakang = ?, negara = ?, kota = ?, updated_at = NOW() WHERE id = ?`,
      [nama, telepon, alamat, fotoPath, nama_belakang, negara, kota, id]
    );

    return h.response({ status: 'success', message: 'User updated successfully' }).code(200);

  } catch (err) {
    console.error('Update user error:', err); // Log error yang lebih spesifik
    return h.response({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An internal server error occurred',
      details: err.message // Menambahkan detail error untuk debugging (hapus di produksi)
    }).code(500);
  }
};


const createRekomendasiHandler = async (request, h) => {
 const userId = request.auth.credentials.id;

  const {
    latin, family, category, climate,
    ideal_light, tolerated_light, watering,
    insects, plant_use, temp_max_celsius, temp_min_celsius
  } = request.payload;

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    const [insertRek] = await conn.query(`
      INSERT INTO rekomendasi_tanaman
      (latin, family, category, climate, ideal_light, tolerated_light, watering, insects, plant_use, temp_max_celsius, temp_min_celsius)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      latin, family, category, climate, ideal_light,
      tolerated_light, watering, insects, plant_use,
      temp_max_celsius, temp_min_celsius
    ]);

    const rekomendasiId = insertRek.insertId;

    await conn.query(`
      INSERT INTO manajemen_kebun (user_id, family, created_at, updated_at)
      VALUES (?, ?, NOW(), NOW())
    `, [userId, family]);

    await conn.commit();

    return h.response({
      message: 'Berhasil menambahkan rekomendasi dan otomatis ke manajemen',
      rekomendasiId
    }).code(201);

  } catch (err) {
    await conn.rollback();
    console.error('Error saat insert:', err);
    return h.response({ message: 'Gagal menambahkan data' }).code(500);
  } finally {
    conn.release();
  }
};

const getAllRekomendasi = async () => {
  const tableName = 'rekomendasi_tanaman';
  try {
    const [rows] = await db.execute(`SELECT * FROM ${tableName}`);
    return {
      status: 'success',
      data: rows
    };
  } catch (error) {
    return { status: 'fail', message: error.message };
  }
};

const createManajemenHandler = async (request, h) => {
  const userId = request.auth.credentials.id;
  const {
    plant_name,
    growth,
    soil,
    sunlight,
    watering,
    fertilization_type,
    family
  } = request.payload;

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    // 1. Insert dulu ke rekomendasi_tanaman jika belum ada
    await conn.query(`
      INSERT IGNORE INTO rekomendasi_tanaman (family) VALUES (?)
    `, [family]);

    // 2. Baru insert ke manajemen_kebun
    const [insertRek] = await conn.query(`
      INSERT INTO manajemen_kebun
      (user_id, plant_name, growth, soil, sunlight, watering, fertilization_type, family, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      userId, plant_name, growth, soil, sunlight, watering, fertilization_type, family
    ]);

    await conn.commit();

    return h.response({
      message: 'Berhasil menambahkan manajemen dan otomatis ke rekomendasi',
      manajemenId: insertRek.insertId
    }).code(201);

  } catch (err) {
    await conn.rollback();
    console.error('Error saat insert:', err);
    return h.response({ message: 'Gagal menambahkan data' }).code(500);
  } finally {
    conn.release();
  }
};



const getAllManajemen = async () => {
  const tableName = 'manajemen_kebun';
  try {
    const [rows] = await db.execute(`SELECT * FROM ${tableName}`);
    return {
      status: 'success',
      data: rows
    };
  } catch (error) {
    return { status: 'fail', message: error.message };
  }
};

const getManajemenByUserId = async (request, h) => {
  const { userId } = request.params;

  try {
    const [rows] = await db.execute(
      'SELECT * FROM manajemen_kebun WHERE user_id = ?',
      [userId]
    );

    return {
      status: 'success',
      data: rows
    };
  } catch (error) {
    return h.response({ status: 'fail', message: error.message }).code(500);
  }
};


const editManajemen = async (request, h) => {
  const { id } = request.params;
  const {
    plant_name,
    growth,
    soil,
    sunlight,
    watering,
    fertilization_type
  } = request.payload;

  const user_id = request.auth.credentials.id; // perbaikan di sini
  const updated_at = new Date();

  try {
    const [result] = await db.execute(
      `UPDATE manajemen_kebun
       SET plant_name = ?, growth = ?, soil = ?, sunlight = ?, watering = ?, fertilization_type = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [plant_name, growth, soil, sunlight, watering, fertilization_type, updated_at, id, user_id]
    );

    if (result.affectedRows === 0) {
      return h
        .response({ status: 'fail', message: 'Data tidak ditemukan atau akses ditolak' })
        .code(404);
    }

    return {
      status: 'success',
      message: 'Data berhasil diperbarui'
    };
  } catch (error) {
    return h
      .response({ status: 'fail', message: error.message })
      .code(500);
  }
};


// const hapusManajemen = async (request, h) => {
//   const { id } = request.params;

//   try {
//     const [result] = await db.execute('DELETE FROM manajemen_kebun WHERE id = ?', [id]); // <== di sini ubah pool jadi db
//     if (result.affectedRows === 0) {
//       return h.response({ status: 'fail', message: 'Data tidak ditemukan' }).code(404);
//     }

//     return { status: 'success', message: 'Data berhasil dihapus' };
//   } catch (error) {
//     return h.response({ status: 'fail', message: error.message }).code(500);
//   }
// };

const hapusManajemenByAuth = async (request, h) => {
  const { id } = request.params;
  const user_id = request.auth.credentials.id; // Ambil id user dari token JWT

  try {
    const [result] = await db.execute(
      'DELETE FROM manajemen_kebun WHERE id = ? AND user_id = ?',
      [id, user_id]
    );

    if (result.affectedRows === 0) {
      return h.response({
        status: 'fail',
        message: 'Data tidak ditemukan atau akses ditolak'
      }).code(404);
    }

    return {
      status: 'success',
      message: 'Data berhasil dihapus'
    };
  } catch (error) {
    return h.response({
      status: 'fail',
      message: error.message
    }).code(500);
  }
};



const getaAllcleaned_plants = async () => {
  const tableName = 'cleaned_plants';
  try {
    const [rows] = await db.execute(`SELECT * FROM ${tableName}`);
    return {
      status: 'success',
      data: rows
    };
  } catch (error) {
    return { status: 'fail', message: error.message };
  }
};

const getaAllplantsandfamily = async () => {
  const tableName = 'plantsandfamily';
  try {
    const [rows] = await db.execute(`SELECT * FROM ${tableName}`);
    return {
      status: 'success',
      data: rows
    };
  } catch (error) {
    return { status: 'fail', message: error.message };
  }
};

module.exports = {
  registerHandler,
  loginHandler,
  updateUserHandler, 
  createRekomendasiHandler,
  getAllRekomendasi,
  getAllManajemen,
  editManajemen,
  // hapusManajemen,
  createManajemenHandler,
  getManajemenByUserId,
  hapusManajemenByAuth,
  getProfileHandler,
  getaAllcleaned_plants,
  getaAllplantsandfamily,
};
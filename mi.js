// Mi Stick / Android TV kumandası: "Android TV Remote v2" protokolü (Google TV uygulamasının kullandığı).
// Eşleştirme TLS 6467 (TV ekranındaki 6 haneli kod), kumanda TLS 6466. Bağımlılık yok.
const tls = require('tls');
const net = require('net');
const crypto = require('crypto');

// Android KeyEvent kodları
const TUSLAR = {
  UP: 19, DOWN: 20, LEFT: 21, RIGHT: 22, OK: 23, BACK: 4, HOME: 3, MENU: 82, POWER: 26,
  VOLUP: 24, VOLDOWN: 25, MUTE: 164, PLAY_PAUSE: 85, STOP: 86, NEXT: 87, PREVIOUS: 88, REWIND: 89, FF: 90,
  SEARCH: 84, SETTINGS: 176, DEL: 67, ENTER: 66, INFO: 165, CHUP: 166, CHDOWN: 167,
  0: 7, 1: 8, 2: 9, 3: 10, 4: 11, 5: 12, 6: 13, 7: 14, 8: 15, 9: 16,
};
const TUS_ARASI_MS = 120;
const OZELLIKLER = 622; // ping, tuş, yazı, ses, güç, uygulama bağlantısı

// ---------- kendinden imzalı istemci sertifikası (elle DER) ----------
function der(etiket, ...parcalar) {
  const g = Buffer.concat(parcalar);
  const boy = g.length < 128 ? [g.length] : g.length < 256 ? [0x81, g.length] : [0x82, g.length >> 8, g.length & 255];
  return Buffer.concat([Buffer.from([etiket, ...boy]), g]);
}
function kimlikUret() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const algoritma = der(0x30, der(0x06, Buffer.from('2a864886f70d01010b', 'hex')), der(0x05)); // sha256WithRSAEncryption
  const ad = der(0x30, der(0x31, der(0x30, der(0x06, Buffer.from('550403', 'hex')), der(0x0c, Buffer.from('atvremote')))));
  const seri = crypto.randomBytes(8);
  seri[0] = (seri[0] & 0x7f) | 0x40;
  const tbs = der(0x30,
    der(0xa0, der(0x02, Buffer.from([2]))), der(0x02, seri), algoritma, ad,
    der(0x30, der(0x17, Buffer.from('240101000000Z')), der(0x17, Buffer.from('491231235959Z'))),
    ad, publicKey.export({ type: 'spki', format: 'der' }));
  const imza = crypto.sign('sha256', tbs, privateKey);
  const govde = der(0x30, tbs, algoritma, der(0x03, Buffer.from([0]), imza)).toString('base64').match(/.{1,64}/g).join('\n');
  return {
    sertifika: `-----BEGIN CERTIFICATE-----\n${govde}\n-----END CERTIFICATE-----\n`,
    anahtar: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

// ---------- protobuf (yalnız gereken kadarı) ----------
function varint(n) {
  const b = [];
  while (n > 127) { b.push((n % 128) | 128); n = Math.floor(n / 128); }
  b.push(n);
  return Buffer.from(b);
}
const alanV = (no, deger) => Buffer.concat([varint(no * 8), varint(deger)]);
const alanB = (no, govde) => {
  const g = Buffer.isBuffer(govde) ? govde : Buffer.from(String(govde), 'utf8');
  return Buffer.concat([varint(no * 8 + 2), varint(g.length), g]);
};
const cerceve = (mesaj) => Buffer.concat([varint(mesaj.length), mesaj]);

function coz(buf) {
  const alanlar = {};
  let i = 0;
  const oku = () => {
    let n = 0, carpan = 1, b;
    do { b = buf[i++]; n += (b & 127) * carpan; carpan *= 128; } while (b & 128 && i < buf.length);
    return n;
  };
  while (i < buf.length) {
    const bas = oku();
    const tur = bas % 8;
    if (tur === 0) alanlar[Math.floor(bas / 8)] = oku();
    else if (tur === 2) { const n = oku(); alanlar[Math.floor(bas / 8)] = buf.subarray(i, i + n); i += n; }
    else if (tur === 1) i += 8;
    else if (tur === 5) i += 4;
    else break;
  }
  return alanlar;
}

// Soketten gelen akışı uzunluk önekli mesajlara böler.
function mesajlariDinle(soket, mesajGeldi) {
  let tampon = Buffer.alloc(0);
  soket.on('data', (d) => {
    tampon = Buffer.concat([tampon, d]);
    for (;;) {
      let boy = 0, carpan = 1, i = 0, tam = false;
      while (i < tampon.length) {
        const b = tampon[i++];
        boy += (b & 127) * carpan; carpan *= 128;
        if (!(b & 128)) { tam = true; break; }
      }
      if (!tam || tampon.length < i + boy) return;
      const mesaj = tampon.subarray(i, i + boy);
      tampon = tampon.subarray(i + boy);
      mesajGeldi(coz(mesaj));
    }
  });
}

// ayarlar: { miIp, miSertifika, miAnahtar, miEslesti } alanlarını taşıyan canlı nesneyi döndüren işlev.
module.exports = function miKumanda(ayarlarAl, kaydet) {
  const tlsSecenek = (port) => {
    const a = ayarlarAl();
    return { host: a.miIp, port, cert: a.miSertifika, key: a.miAnahtar, rejectUnauthorized: false };
  };

  // ---------- eşleştirme (6467) ----------
  const eslesmeMesaji = (no, govde) => cerceve(Buffer.concat([alanV(1, 2), alanV(2, 200), alanB(no, govde)]));
  const KODLAMA = Buffer.concat([alanV(1, 3), alanV(2, 6)]); // onaltılık, 6 hane
  let eslesme = null;

  function eslestirmeBaslat() {
    const a = ayarlarAl();
    if (!a.miSertifika || !a.miAnahtar) { Object.assign(a, (({ sertifika, anahtar }) => ({ miSertifika: sertifika, miAnahtar: anahtar }))(kimlikUret())); kaydet(); }
    if (eslesme) eslesme.soket.destroy();
    return new Promise((tamam, hata) => {
      const soket = tls.connect(tlsSecenek(6467));
      const kayit = { soket, sonuc: null };
      let bitti = false;
      const zaman = setTimeout(() => bitir(new Error('Mi Stick yanıt vermedi')), 6000);
      function bitir(e) {
        if (bitti) return;
        bitti = true;
        clearTimeout(zaman);
        if (e) { soket.destroy(); hata(e); } else tamam();
      }
      const kapandi = (e) => { bitir(e); if (kayit.sonuc) kayit.sonuc(e); };
      soket.on('secureConnect', () => soket.write(eslesmeMesaji(10, Buffer.concat([alanB(1, 'atvremote'), alanB(2, 'Web Kumanda')]))));
      mesajlariDinle(soket, (m) => {
        if (m[2] !== 200) return kapandi(new Error(m[2] === 402 ? 'Kod yanlış' : `Mi Stick eşleştirmeyi reddetti (${m[2]})`));
        if (m[11]) soket.write(eslesmeMesaji(20, Buffer.concat([alanB(1, KODLAMA), alanV(3, 1)])));
        else if (m[20]) soket.write(eslesmeMesaji(30, Buffer.concat([alanB(1, KODLAMA), alanV(2, 1)])));
        else if (m[31]) { eslesme = kayit; bitir(); } // kod artık TV ekranında
        else if (m[41] && kayit.sonuc) kayit.sonuc();
      });
      soket.on('error', () => kapandi(new Error('Mi Stick\'e bağlanılamadı (kapalı olabilir)')));
      soket.on('close', () => {
        if (eslesme === kayit) eslesme = null;
        kapandi(new Error('Eşleştirme süresi doldu, yeniden başlat'));
      });
    });
  }

  function eslestirmeBitir(kodGirdi) {
    const kod = String(kodGirdi).trim().toUpperCase();
    if (!/^[0-9A-F]{6}$/.test(kod)) throw new Error('Kod 6 haneli olmalı (0-9, A-F)');
    if (!eslesme) throw new Error('Önce eşleştirmeyi başlat');
    const kayit = eslesme;
    const hex = (s) => Buffer.from(s.length % 2 ? '0' + s : s, 'hex');
    const benim = crypto.createPublicKey(ayarlarAl().miSertifika).export({ format: 'jwk' });
    const sunucu = kayit.soket.getPeerCertificate();
    const ozet = crypto.createHash('sha256')
      .update(Buffer.from(benim.n, 'base64url')).update(Buffer.from(benim.e, 'base64url'))
      .update(hex(sunucu.modulus)).update(hex(sunucu.exponent.replace(/^0x/, '')))
      .update(hex(kod.slice(2))).digest();
    if (ozet[0] !== parseInt(kod.slice(0, 2), 16)) throw new Error('Kod yanlış, TV ekranındaki kodu tekrar yaz');
    return new Promise((tamam, hata) => {
      kayit.sonuc = (e) => {
        kayit.sonuc = null;
        if (e) return hata(e);
        ayarlarAl().miEslesti = true;
        kaydet();
        kayit.soket.end();
        if (uzak) uzak.soket.destroy();
        tamam();
      };
      kayit.soket.write(eslesmeMesaji(40, alanB(1, ozet)));
    });
  }

  // ---------- kumanda (6466) ----------
  let uzak = null; // { soket, hazir, bagli, acik, uygulama, ime, alan }
  let sonDeneme = 0;

  function baglan() {
    if (uzak) return uzak.hazir;
    const a = ayarlarAl();
    if (!a.miIp || !a.miEslesti) return Promise.reject(new Error('Mi Stick eşleştirilmemiş'));
    sonDeneme = Date.now();
    const soket = tls.connect(tlsSecenek(6466));
    const kayit = { soket, bagli: false, acik: null, uygulama: '', ime: 0, alan: 0 };
    kayit.hazir = new Promise((tamam, hata) => {
      let bitti = false;
      const zaman = setTimeout(() => bitir(new Error('Mi Stick yanıt vermedi')), 5000);
      function bitir(e) {
        if (bitti) return;
        bitti = true;
        clearTimeout(zaman);
        if (e) { soket.destroy(); hata(e); } else { kayit.bagli = true; tamam(kayit); }
      }
      mesajlariDinle(soket, (m) => {
        if (m[1]) {
          const cihaz = Buffer.concat([alanB(1, 'Web Kumanda'), alanB(2, 'Node'), alanV(3, 1), alanB(4, '1'), alanB(5, 'atvremote'), alanB(6, '1.0.0')]);
          soket.write(cerceve(alanB(1, Buffer.concat([alanV(1, OZELLIKLER), alanB(2, cihaz)]))));
        } else if (m[2]) { soket.write(cerceve(alanB(2, alanV(1, OZELLIKLER)))); bitir(); }
        else if (m[8]) soket.write(cerceve(alanB(9, alanV(1, coz(m[8])[1] || 0))));
        else if (m[40]) kayit.acik = !!coz(m[40])[1];
        else if (m[20]) { const u = coz(m[20])[1]; const p = u && coz(u)[12]; if (p) kayit.uygulama = p.toString(); }
        else if (m[21]) { const b = coz(m[21]); kayit.ime = b[1] || 0; kayit.alan = b[2] || 0; }
      });
      soket.on('error', () => bitir(new Error('Mi Stick\'e bağlanılamadı (kapalı olabilir ya da eşleştirme silinmiş)')));
      soket.on('close', () => {
        if (uzak === kayit) uzak = null;
        bitir(new Error('Mi Stick bağlantıyı kapattı (yeniden eşleştirmek gerekebilir)'));
      });
    });
    kayit.hazir.catch(() => {});
    uzak = kayit;
    return kayit.hazir;
  }

  const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
  let kuyruk = Promise.resolve();
  function gonder(mesajlar) {
    const is = kuyruk.then(async () => {
      const k = await baglan();
      for (const m of mesajlar) {
        if (k.soket.destroyed) throw new Error('Mi Stick bağlantıyı kapattı');
        k.soket.write(cerceve(typeof m === 'function' ? m(k) : m));
        await bekle(TUS_ARASI_MS);
      }
    });
    kuyruk = is.catch(() => {});
    return is;
  }

  function tus(girdi) {
    const adlar = (Array.isArray(girdi) ? girdi : String(girdi).split(/[\s,]+/)).filter(Boolean).map((t) => String(t).toUpperCase());
    if (!adlar.length || adlar.length > 40) throw new Error('Tuş listesi boş ya da çok uzun');
    for (const t of adlar) if (!(t in TUSLAR)) throw new Error('Geçersiz tuş: ' + t);
    return gonder(adlar.map((t) => alanB(10, Buffer.concat([alanV(1, TUSLAR[t]), alanV(2, 3)])))); // 3 = kısa basış
  }

  const uygulamaAc = (baglanti) => gonder([alanB(90, alanB(1, baglanti))]);

  // Mi Stick'te odak bir yazı kutusundayken metni kutuya yazar.
  function yazi(metin) {
    const son = [...metin].length - 1;
    return gonder([(k) => alanB(21, Buffer.concat([
      alanV(1, k.ime), alanV(2, k.alan),
      alanB(3, Buffer.concat([alanV(1, 1), alanB(2, Buffer.concat([alanV(1, son), alanV(2, son), alanB(3, metin)]))])),
    ]))]);
  }

  // Ağda 6466 portu açık cihazları bulur.
  function ara(onEk, haric) {
    return Promise.all(Array.from({ length: 254 }, (_, i) => new Promise((tamam) => {
      const ip = onEk + (i + 1);
      if (ip === haric) return tamam(null);
      const s = net.connect({ host: ip, port: 6466 });
      const bitir = (sonuc) => { s.destroy(); tamam(sonuc); };
      s.setTimeout(800, () => bitir(null));
      s.on('connect', () => bitir(ip));
      s.on('error', () => bitir(null));
    }))).then((l) => l.filter(Boolean));
  }

  function durum() {
    const a = ayarlarAl();
    if (a.miEslesti && !uzak && Date.now() - sonDeneme > 10000) baglan().catch(() => {});
    const bagli = !!(uzak && uzak.bagli);
    return { ip: a.miIp || '', eslesti: !!a.miEslesti, bagli, acik: bagli ? uzak.acik : null, uygulama: bagli ? uzak.uygulama : '' };
  }

  return { eslestirmeBaslat, eslestirmeBitir, tus, uygulamaAc, yazi, ara, durum, kopar: () => { if (uzak) uzak.soket.destroy(); } };
};
module.exports.kimlikUret = kimlikUret;
module.exports.pb = { varint, alanV, alanB, coz };

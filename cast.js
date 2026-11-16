// Chromecast (Mi Stick'in Cast tarafı): bilgisayardaki dosyayı Default Media Receiver ile oynatır. Cast v2, TLS 8009.
const tls = require('tls');
const { alanV, alanB, coz } = require('./mi').pb;

const NS_BAGLANTI = 'urn:x-cast:com.google.cast.tp.connection';
const NS_NABIZ = 'urn:x-cast:com.google.cast.tp.heartbeat';
const NS_ALICI = 'urn:x-cast:com.google.cast.receiver';
const NS_MEDYA = 'urn:x-cast:com.google.cast.media';
const UYGULAMA = 'CC1AD845'; // Default Media Receiver

let aktif = null; // { soket, oturum, gonder }

function oynat(ip, adres, tur, baslik) {
  if (aktif) aktif.soket.destroy();
  return new Promise((tamam, hata) => {
    const soket = tls.connect({ host: ip, port: 8009, rejectUnauthorized: false });
    const kayit = { soket, oturum: null };
    let bitti = false, yuklendi = false, tampon = Buffer.alloc(0);
    const gonder = (hedef, ns, veri) => {
      const m = Buffer.concat([alanV(1, 0), alanB(2, 'sender-0'), alanB(3, hedef), alanB(4, ns), alanV(5, 0), alanB(6, JSON.stringify(veri))]);
      const boy = Buffer.alloc(4);
      boy.writeUInt32BE(m.length);
      if (!soket.destroyed) soket.write(Buffer.concat([boy, m]));
    };
    kayit.gonder = gonder;
    const zaman = setTimeout(() => bitir(new Error('Mi Stick oynatmayı başlatmadı')), 20000);
    const nabiz = setInterval(() => gonder('receiver-0', NS_NABIZ, { type: 'PING' }), 5000);
    function bitir(e) {
      if (bitti) return;
      bitti = true;
      clearTimeout(zaman);
      if (e) { soket.destroy(); hata(e); } else { aktif = kayit; tamam(); }
    }
    soket.on('secureConnect', () => {
      gonder('receiver-0', NS_BAGLANTI, { type: 'CONNECT' });
      gonder('receiver-0', NS_ALICI, { type: 'LAUNCH', appId: UYGULAMA, requestId: 1 });
    });
    soket.on('data', (d) => {
      tampon = Buffer.concat([tampon, d]);
      while (tampon.length >= 4 && tampon.length >= 4 + tampon.readUInt32BE(0)) {
        const n = tampon.readUInt32BE(0);
        const m = coz(tampon.subarray(4, 4 + n));
        tampon = tampon.subarray(4 + n);
        let v;
        try { v = JSON.parse(m[6].toString()); } catch { continue; }
        if (v.type === 'PING') gonder('receiver-0', NS_NABIZ, { type: 'PONG' });
        else if (v.type === 'RECEIVER_STATUS' && !yuklendi) {
          const u = ((v.status || {}).applications || []).find((a) => a.appId === UYGULAMA);
          if (!u || !u.transportId) continue;
          yuklendi = true;
          kayit.oturum = u.sessionId;
          gonder(u.transportId, NS_BAGLANTI, { type: 'CONNECT' });
          gonder(u.transportId, NS_MEDYA, {
            type: 'LOAD', requestId: 2, autoplay: true,
            media: { contentId: adres, contentType: tur, streamType: 'BUFFERED', metadata: { metadataType: 0, title: baslik } },
          });
        } else if (v.type === 'MEDIA_STATUS') bitir();
        else if (['LOAD_FAILED', 'LOAD_CANCELLED', 'INVALID_REQUEST', 'LAUNCH_ERROR'].includes(v.type)) {
          bitir(new Error(v.type === 'LOAD_FAILED' ? 'Mi Stick bu dosyayı oynatamadı (mp4, webm, mp3, jpg, png oynatır)' : 'Mi Stick isteği reddetti: ' + v.type));
        }
      }
    });
    soket.on('error', () => bitir(new Error('Mi Stick\'in Cast bağlantısı kurulamadı')));
    soket.on('close', () => { clearInterval(nabiz); if (aktif === kayit) aktif = null; bitir(new Error('Mi Stick bağlantıyı kapattı')); });
  });
}

function durdur() {
  if (!aktif) return false;
  aktif.gonder('receiver-0', NS_ALICI, { type: 'STOP', requestId: 3, sessionId: aktif.oturum });
  const s = aktif.soket;
  setTimeout(() => s.destroy(), 500);
  return true;
}

module.exports = { oynat, durdur };

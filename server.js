// Samsung UE40D6500 (2011, D serisi) + HDMI'daki Mi Stick için web kumandası. Bağımlılık yok: node server.js
// Samsung tuşları: TCP 55000 (eski Samsung protokolü). Ses ve medya: UPnP / DLNA, port 52235.
// Mi Stick (Android TV): mi.js, TLS 6466 / 6467.
const http = require('http');
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TV_IP = process.env.TV_IP || '192.168.1.190';
const TV_MODEL = 'UE40D6500';
const PORT = Number(process.env.PORT || 8190);
const AYAR_DOSYASI = path.join(__dirname, 'ayarlar.json');
const UYGULAMA = 'iphone.iapp.samsung';
const TV_UYGULAMA = `iphone.${TV_MODEL}.iapp.samsung`;
const TUS_ARASI_MS = 250;

const MEDYA_TURLERI = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mkv': 'video/x-mkv', '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime', '.wmv': 'video/x-ms-wmv', '.mpg': 'video/mpeg', '.mpeg': 'video/mpeg',
  '.ts': 'video/mpeg', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
};

// ---------- ayarlar ----------
function ayarlariOku() {
  const varsayilan = {
    medyaKlasoru: path.join(os.homedir(), 'Videos'), kisayollar: [], miIp: '',
    miUygulamalar: [
      { ad: 'YouTube', baglanti: 'https://www.youtube.com' },
      { ad: 'Netflix', baglanti: 'https://www.netflix.com/title' },
      { ad: 'Prime Video', baglanti: 'https://app.primevideo.com' },
      { ad: 'Disney+', baglanti: 'https://www.disneyplus.com' },
    ],
  };
  try {
    return { ...varsayilan, ...JSON.parse(fs.readFileSync(AYAR_DOSYASI, 'utf8')) };
  } catch {
    fs.writeFileSync(AYAR_DOSYASI, JSON.stringify(varsayilan, null, 2));
    return varsayilan;
  }
}
let ayarlar = ayarlariOku();
const ayarlariYaz = () => fs.writeFileSync(AYAR_DOSYASI, JSON.stringify(ayarlar, null, 2));

// TV ile aynı alt ağdaki yerel arayüz (TV'ye kendimizi bununla tanıtırız, medya adresi de bu).
function yerelArayuz() {
  const onEk = TV_IP.split('.').slice(0, 3).join('.') + '.';
  const hepsi = Object.values(os.networkInterfaces()).flat().filter((a) => a.family === 'IPv4' && !a.internal);
  return hepsi.find((a) => a.address.startsWith(onEk)) || hepsi[0] || { address: '127.0.0.1', mac: '00:00:00:00:00:00' };
}

// ---------- kumanda protokolü (port 55000) ----------
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
function alan(s) {
  const veri = Buffer.isBuffer(s) ? s : Buffer.from(s, 'latin1');
  const boy = Buffer.alloc(2);
  boy.writeUInt16LE(veri.length);
  return Buffer.concat([boy, veri]);
}
const paket = (uygulama, yuk) => Buffer.concat([Buffer.from([0]), alan(uygulama), alan(yuk)]);

function yetkiPaketi() {
  const a = yerelArayuz();
  const yuk = Buffer.concat([Buffer.from([0x64, 0]), alan(b64(a.address)), alan(b64(a.mac.replace(/:/g, '-'))), alan(b64('Web Kumanda'))]);
  return paket(UYGULAMA, yuk);
}
const tusPaketi = (tus) => paket(TV_UYGULAMA, Buffer.concat([Buffer.from([0, 0, 0]), alan(b64(tus))]));
const yaziPaketi = (metin) => paket(UYGULAMA, Buffer.concat([Buffer.from([1, 0]), alan(b64(metin))]));

let baglanti = null; // { soket, hazir: Promise<Socket> }
let bosZamanlayici = null;
let izinBekleniyor = false;

function baglan() {
  if (baglanti) return baglanti.hazir;
  const soket = net.connect({ host: TV_IP, port: 55000 });
  const kayit = { soket };
  kayit.hazir = new Promise((tamam, hata) => {
    let tampon = Buffer.alloc(0);
    let bitti = false;
    let zaman = setTimeout(() => bitir(new Error('TV yanıt vermedi (kapalı olabilir)')), 4000);
    function bitir(e) {
      if (bitti) return;
      bitti = true;
      izinBekleniyor = false;
      clearTimeout(zaman);
      if (e) { soket.destroy(); hata(e); } else tamam(soket);
    }
    soket.on('connect', () => soket.write(yetkiPaketi()));
    soket.on('data', (d) => {
      if (bitti) return;
      tampon = Buffer.concat([tampon, d]);
      while (tampon.length >= 5) {
        const n = tampon.readUInt16LE(1);
        if (tampon.length < n + 5) break;
        const m = tampon.readUInt16LE(n + 3);
        if (tampon.length < n + 5 + m) break;
        const y = tampon.subarray(n + 5, n + 5 + m);
        tampon = tampon.subarray(n + 5 + m);
        if (y[0] === 0x64 && y[2] === 1) bitir();
        else if (y[0] === 0x64 && y[2] === 0) bitir(new Error('TV bu cihazı reddetmiş. TV menüsünden izni aç: Menü > Ağ > AllShare Ayarları'));
        else if (y[0] === 0x0a && y[2] === 2) {
          izinBekleniyor = true;
          clearTimeout(zaman);
          zaman = setTimeout(() => bitir(new Error('TV ekranındaki izin sorusu yanıtlanmadı')), 30000);
        } else if (y[0] === 0x65) bitir(new Error('TV ekranındaki izin sorusu iptal edildi'));
      }
    });
    soket.on('error', () => bitir(new Error('TV\'ye bağlanılamadı (kapalı olabilir)')));
    soket.on('close', () => {
      if (baglanti === kayit) baglanti = null;
      bitir(new Error('TV bağlantıyı kapattı'));
    });
  });
  kayit.hazir.catch(() => {});
  baglanti = kayit;
  return kayit.hazir;
}

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
let kuyruk = Promise.resolve();
// Tuşlar sırayla gider; bağlantı 15 sn boşta kalınca kapanır.
function gonder(paketler) {
  const is = kuyruk.then(async () => {
    const soket = await baglan();
    for (const p of paketler) {
      if (soket.destroyed) throw new Error('TV bağlantıyı kapattı');
      soket.write(p);
      await bekle(TUS_ARASI_MS);
    }
    clearTimeout(bosZamanlayici);
    bosZamanlayici = setTimeout(() => soket.end(), 15000);
  });
  kuyruk = is.catch(() => {});
  return is;
}

// "12" -> 1, 2, Enter; "MENU" -> KEY_MENU
function tuslariCoz(girdi) {
  const parcalar = Array.isArray(girdi) ? girdi : String(girdi).split(/[\s,]+/);
  const tuslar = [];
  for (const ham of parcalar.filter(Boolean)) {
    const p = String(ham).toUpperCase();
    if (/^\d+$/.test(p)) tuslar.push(...[...p].map((r) => 'KEY_' + r), 'KEY_ENTER');
    else if (/^(KEY_)?[A-Z0-9_]+$/.test(p)) tuslar.push(p.startsWith('KEY_') ? p : 'KEY_' + p);
    else throw new Error('Geçersiz tuş: ' + ham);
  }
  if (!tuslar.length || tuslar.length > 40) throw new Error('Tuş listesi boş ya da çok uzun');
  return tuslar;
}

// ---------- UPnP (ses, medya) ----------
const xmlKacis = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function soap(servis, eylem, govde = '', sureMs = 4000) {
  const tur = `urn:schemas-upnp-org:service:${servis}:1`;
  const xml = `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:${eylem} xmlns:u="${tur}"><InstanceID>0</InstanceID>${govde}</u:${eylem}></s:Body></s:Envelope>`;
  const y = await fetch(`http://${TV_IP}:52235/upnp/control/${servis}1`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset="utf-8"', SOAPACTION: `"${tur}#${eylem}"` },
    body: xml,
    signal: AbortSignal.timeout(sureMs),
  });
  const metin = await y.text();
  if (!y.ok) {
    const neden = etiket(metin, 'errorDescription');
    throw new Error(`TV ${eylem} isteğini reddetti` + (neden ? `: ${neden}` : ''));
  }
  return metin;
}
function etiket(xml, ad) {
  return (new RegExp(`<${ad}[^>]*>([^<]*)`).exec(xml) || [])[1];
}

async function durum() {
  try {
    const [ses, sessiz] = await Promise.all([
      soap('RenderingControl', 'GetVolume', '<Channel>Master</Channel>', 1500),
      soap('RenderingControl', 'GetMute', '<Channel>Master</Channel>', 1500),
    ]);
    return { acik: true, ses: Number(etiket(ses, 'CurrentVolume')), sessiz: etiket(sessiz, 'CurrentMute') === '1', izinBekleniyor };
  } catch {
    return { acik: false, izinBekleniyor };
  }
}

// ---------- Mi Stick (Android TV) ----------
const mi = require('./mi')(() => ayarlar, ayarlariYaz);

// Ağda Mi Stick arar; bulursa adresini kaydeder. Adres değiştiyse true döner.
async function miBul() {
  const bulunan = await mi.ara(yerelArayuz().address.split('.').slice(0, 3).join('.') + '.', TV_IP);
  if (!bulunan.length) throw new Error('Ağda Mi Stick bulunamadı (fişte ve aynı Wi-Fi\'da mı?)');
  if (bulunan.includes(ayarlar.miIp)) return false;
  ayarlar.miIp = bulunan[0];
  ayarlariYaz();
  mi.kopar();
  return true;
}
// Bağlantı kurulamazsa (adres DHCP ile değişmiş olabilir) bir kez yeniden arar.
async function miDene(is) {
  try {
    return await is();
  } catch (e) {
    if (!/bağlanılamadı|yanıt vermedi/.test(e.message) || !(await miBul().catch(() => false))) throw e;
    return is();
  }
}

// ---------- medya ----------
function medyaYolu(goreli) {
  const kok = path.resolve(ayarlar.medyaKlasoru);
  const tam = path.resolve(kok, goreli || '.');
  if (tam !== kok && !tam.startsWith(kok + path.sep)) throw new Error('Medya klasörünün dışına çıkılamaz');
  return tam;
}

function medyaListesi(goreli) {
  const klasor = medyaYolu(goreli);
  const ogeler = fs.readdirSync(klasor, { withFileTypes: true })
    .filter((o) => !o.name.startsWith('.') && (o.isDirectory() || MEDYA_TURLERI[path.extname(o.name).toLowerCase()]))
    .map((o) => ({ ad: o.name, klasor: o.isDirectory() }))
    .sort((a, b) => b.klasor - a.klasor || a.ad.localeCompare(b.ad, 'tr'));
  return { yol: path.relative(path.resolve(ayarlar.medyaKlasoru), klasor).split(path.sep).join('/'), ogeler };
}

async function oynat(goreli) {
  const dosya = medyaYolu(goreli);
  const tur = MEDYA_TURLERI[path.extname(dosya).toLowerCase()];
  if (!tur || !fs.statSync(dosya).isFile()) throw new Error('Desteklenmeyen dosya');
  const adres = `http://${yerelArayuz().address}:${PORT}/medya/` + goreli.split('/').map(encodeURIComponent).join('/');
  const sinif = tur.startsWith('video') ? 'videoItem' : tur.startsWith('audio') ? 'audioItem.musicTrack' : 'imageItem.photo';
  const didl = `<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"><item id="1" parentID="0" restricted="1"><dc:title>${xmlKacis(path.basename(dosya))}</dc:title><upnp:class>object.item.${sinif}</upnp:class><res protocolInfo="http-get:*:${tur}:DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000">${xmlKacis(adres)}</res></item></DIDL-Lite>`;
  await soap('AVTransport', 'Stop').catch(() => {});
  await soap('AVTransport', 'SetAVTransportURI', `<CurrentURI>${xmlKacis(adres)}</CurrentURI><CurrentURIMetaData>${xmlKacis(didl)}</CurrentURIMetaData>`, 8000);
  await soap('AVTransport', 'Play', '<Speed>1</Speed>', 8000);
}

function medyaSun(istek, yanit, goreli) {
  const dosya = medyaYolu(goreli);
  const tur = MEDYA_TURLERI[path.extname(dosya).toLowerCase()];
  const bilgi = tur && fs.statSync(dosya, { throwIfNoEntry: false });
  if (!bilgi || !bilgi.isFile()) { yanit.writeHead(404).end(); return; }
  let bas = 0;
  let son = bilgi.size - 1;
  const aralik = /bytes=(\d*)-(\d*)/.exec(istek.headers.range || '');
  if (aralik && (aralik[1] || aralik[2])) {
    if (aralik[1] === '') bas = Math.max(0, bilgi.size - Number(aralik[2]));
    else { bas = Number(aralik[1]); if (aralik[2]) son = Math.min(Number(aralik[2]), son); }
    if (bas > son) { yanit.writeHead(416, { 'Content-Range': `bytes */${bilgi.size}` }).end(); return; }
  }
  const basliklar = {
    'Content-Type': tur, 'Content-Length': son - bas + 1, 'Accept-Ranges': 'bytes',
    'transferMode.dlna.org': 'Streaming',
    'contentFeatures.dlna.org': 'DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000',
  };
  if (aralik) basliklar['Content-Range'] = `bytes ${bas}-${son}/${bilgi.size}`;
  yanit.writeHead(aralik ? 206 : 200, basliklar);
  if (istek.method === 'HEAD') yanit.end();
  else fs.createReadStream(dosya, { start: bas, end: son }).pipe(yanit);
}

// ---------- HTTP ----------
function govdeOku(istek) {
  return new Promise((tamam, hata) => {
    let veri = '';
    istek.on('data', (d) => { veri += d; if (veri.length > 20000) istek.destroy(); });
    istek.on('end', () => { try { tamam(veri ? JSON.parse(veri) : {}); } catch { hata(new Error('Geçersiz istek')); } });
    istek.on('error', hata);
  });
}

const yollar = {
  'GET /api/durum': async () => ({ ...(await durum()), mi: mi.durum() }),
  'POST /api/mi/eslestir': async (g) => {
    if (g.kod) { await mi.eslestirmeBitir(g.kod); return { eslesti: true }; }
    if (!ayarlar.miIp) await miBul();
    await miDene(() => mi.eslestirmeBaslat());
    return { kodBekleniyor: true, ip: ayarlar.miIp };
  },
  'POST /api/mi/tus': async (g) => { await miDene(() => mi.tus(g.tuslar)); },
  'POST /api/mi/yazi': async (g) => {
    if (typeof g.metin !== 'string' || !g.metin || g.metin.length > 500) throw new Error('Metin boş ya da çok uzun');
    await miDene(() => mi.yazi(g.metin));
  },
  'GET /api/mi/uygulamalar': () => ayarlar.miUygulamalar.map((u) => u.ad),
  'POST /api/mi/uygulama': async (g) => {
    const u = ayarlar.miUygulamalar[g.sira];
    if (!u) throw new Error('Uygulama bulunamadı');
    await miDene(() => mi.uygulamaAc(String(u.baglanti)));
  },
  'POST /api/tus': async (g) => { await gonder(tuslariCoz(g.tuslar).map(tusPaketi)); },
  'POST /api/yazi': async (g) => {
    if (typeof g.metin !== 'string' || !g.metin) throw new Error('Metin boş');
    await gonder([yaziPaketi(g.metin)]);
  },
  'POST /api/ses': async (g) => {
    if (typeof g.sessiz === 'boolean') await soap('RenderingControl', 'SetMute', `<Channel>Master</Channel><DesiredMute>${g.sessiz ? 1 : 0}</DesiredMute>`);
    if (Number.isInteger(g.seviye) && g.seviye >= 0 && g.seviye <= 100) await soap('RenderingControl', 'SetVolume', `<Channel>Master</Channel><DesiredVolume>${g.seviye}</DesiredVolume>`);
  },
  'GET /api/kisayollar': () => ayarlar.kisayollar,
  'POST /api/kisayollar': (g) => {
    if (!Array.isArray(g.kisayollar)) throw new Error('Geçersiz liste');
    const liste = g.kisayollar.slice(0, 60).map((k) => ({ ad: String(k.ad || '').trim().slice(0, 30), tuslar: String(k.tuslar || '').trim().slice(0, 300) }));
    for (const k of liste) { if (!k.ad) throw new Error('Kısayol adı boş'); tuslariCoz(k.tuslar); }
    ayarlar.kisayollar = liste;
    ayarlariYaz();
    return liste;
  },
  'GET /api/medya': (_, sorgu) => medyaListesi(sorgu.get('yol') || ''),
  'POST /api/oynat': async (g) => { await oynat(String(g.yol || '')); },
  'POST /api/medya-komut': async (g) => {
    if (!['Play', 'Pause', 'Stop'].includes(g.komut)) throw new Error('Geçersiz komut');
    await soap('AVTransport', g.komut, g.komut === 'Play' ? '<Speed>1</Speed>' : '');
  },
};

http.createServer(async (istek, yanit) => {
  const url = new URL(istek.url, 'http://x');
  try {
    if (url.pathname === '/' && istek.method === 'GET') {
      yanit.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      fs.createReadStream(path.join(__dirname, 'index.html')).pipe(yanit);
      return;
    }
    if (url.pathname.startsWith('/medya/') && ['GET', 'HEAD'].includes(istek.method)) {
      medyaSun(istek, yanit, decodeURIComponent(url.pathname.slice(7)));
      return;
    }
    const isleyici = yollar[`${istek.method} ${url.pathname}`];
    if (!isleyici) { yanit.writeHead(404).end(); return; }
    const sonuc = await isleyici(istek.method === 'POST' ? await govdeOku(istek) : {}, url.searchParams);
    yanit.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    yanit.end(JSON.stringify(sonuc ?? { tamam: true }));
  } catch (e) {
    if (!yanit.headersSent) yanit.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    yanit.end(JSON.stringify({ hata: e.message }));
  }
}).listen(PORT, () => {
  console.log(`TV kumandası hazır (TV: ${TV_IP}, Mi Stick: ${ayarlar.miIp || 'henüz eşleştirilmedi'})`);
  console.log(`  Bu bilgisayar: http://localhost:${PORT}`);
  console.log(`  Telefon (aynı Wi-Fi): http://${yerelArayuz().address}:${PORT}`);
});

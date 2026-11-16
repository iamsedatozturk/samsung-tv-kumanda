// Modem (Zyxel EX3501-T0) durum okuma: UPnP IGD. Yalnız okur, modemde hiçbir şeyi değiştirmez.
const ADRES = process.env.MODEM_UPNP || 'http://192.168.1.1:38400';

async function soap(servis, eylem, govde = '') {
  const tur = `urn:schemas-upnp-org:service:${servis}:1`;
  const y = await fetch(`${ADRES}/${servis}:1`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset="utf-8"', SOAPACTION: `"${tur}#${eylem}"` },
    body: `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:${eylem} xmlns:u="${tur}">${govde}</u:${eylem}></s:Body></s:Envelope>`,
    signal: AbortSignal.timeout(3000),
  });
  if (!y.ok) throw new Error(eylem + ' reddedildi');
  return y.text();
}
const etiket = (xml, ad) => (new RegExp(`<${ad}[^>]*>([^<]*)`).exec(xml) || [])[1] || '';

let onceki = null; // { an, alinan, gonderilen }
let portlar = { an: 0, liste: [] };

async function portListesi() {
  if (Date.now() - portlar.an < 30000) return portlar.liste;
  const liste = [];
  for (let i = 0; i < 40; i++) {
    const x = await soap('WANPPPConnection', 'GetGenericPortMappingEntry', `<NewPortMappingIndex>${i}</NewPortMappingIndex>`).catch(() => null);
    if (!x) break;
    liste.push({
      ad: etiket(x, 'NewPortMappingDescription'), protokol: etiket(x, 'NewProtocol'), disPort: etiket(x, 'NewExternalPort'),
      icAdres: etiket(x, 'NewInternalClient'), icPort: etiket(x, 'NewInternalPort'),
    });
  }
  portlar = { an: Date.now(), liste };
  return liste;
}

async function durum() {
  try {
    const [d, ip, alinanXml, gonderilenXml, hat] = await Promise.all([
      soap('WANPPPConnection', 'GetStatusInfo'), soap('WANPPPConnection', 'GetExternalIPAddress'),
      soap('WANCommonInterfaceConfig', 'GetTotalBytesReceived'), soap('WANCommonInterfaceConfig', 'GetTotalBytesSent'),
      soap('WANCommonInterfaceConfig', 'GetCommonLinkProperties'),
    ]);
    const simdi = { an: Date.now(), alinan: Number(etiket(alinanXml, 'NewTotalBytesReceived')), gonderilen: Number(etiket(gonderilenXml, 'NewTotalBytesSent')) };
    let inis = null, cikis = null;
    if (onceki && simdi.an - onceki.an >= 1000 && simdi.alinan >= onceki.alinan && simdi.gonderilen >= onceki.gonderilen) {
      const sn = (simdi.an - onceki.an) / 1000;
      inis = Math.round((simdi.alinan - onceki.alinan) / sn);
      cikis = Math.round((simdi.gonderilen - onceki.gonderilen) / sn);
    }
    if (!onceki || simdi.an - onceki.an >= 1000) onceki = simdi;
    return {
      ulasildi: true, bagli: etiket(d, 'NewConnectionStatus') === 'Connected', hat: etiket(hat, 'NewPhysicalLinkStatus') === 'Up',
      sureSn: Number(etiket(d, 'NewUptime')), disIp: etiket(ip, 'NewExternalIPAddress'), inis, cikis, portlar: await portListesi(),
    };
  } catch {
    return { ulasildi: false };
  }
}

module.exports = { durum };

# TV Kumanda

Evdeki Samsung UE40D6500 (2011, D serisi) ve ona HDMI ile bağlı Mi Stick (Android TV) için web kumanda. Bağımlılık yok, yalnız Node.

## Çalıştırma
Sunucu pencere açmadan arka planda çalışır; kumanda yalnız adresle kullanılır:
bilgisayarda `http://localhost:8190`, aynı Wi-Fi'daki telefonda `http://<bilgisayarın-ip'si>:8190` (adres `sunucu.log` içinde).
- `otomatik-baslat.cmd`: bir kez çalıştırılır; Windows her açıldığında sunucu gizli başlar (`otomatik-baslat.cmd kaldir` ile geri alınır)
- `baslat.cmd`: sunucu kapalıysa gizli başlatır, sayfayı açar · `durdur.cmd`: sunucuyu kapatır
- `arkaplan.vbs`: gizli başlatmanın kendisi; çıktı `sunucu.log`

**Telefona uygulama olarak kurma:** Chrome'da adresi aç → ⋮ → "Ana ekrana ekle". Sayfa `manifest.webmanifest` ve `sw.js` ile
kurulabilir uygulamadır, ama Chrome tam uygulama (adres çubuksuz) kurulumunu yalnız güvenli adreste yapar. Ev ağındaki `http://` adres için
telefonda bir kez `chrome://flags` → "Insecure origins treated as secure" → `http://<ip>:8190` yaz, Enabled, Chrome'u yeniden başlat; sonra "Uygulamayı yükle".
Bilgisayarın IP'si değişirse telefondaki uygulama açılmaz: modemde bilgisayara sabit IP (DHCP rezervasyonu) verilmeli.
Telefondan açılmıyorsa Windows Güvenlik Duvarı'nda Node'a özel ağ izni gerekir. Simgeler: `node simge/uret.js`.

İlk tuşta TV ekranında izin sorusu çıkar; TV kumandasıyla bir kez "İzin ver" seçilir.

**TV adresi:** `ayarlar.json` → `tvIp` (ilk değer `192.168.1.190`). Modem adresi değiştirirse sunucu bağlanamayınca ağı tarar
(port 55000) ve yeni adresi kendisi kaydeder. Elle: kumandada **TV adresi** sekmesi → IP yaz ya da **Ağda bul**.

## Ne yapar
- Tüm kumanda tuşları, basılı tutunca tekrar (ses, kanal, oklar), bilgisayarda klavye kısayolları
- Ses sürgüsü ve sessiz durumu (TV'den okunur)
- Kanal numarasına doğrudan gitme, TV'deki yazı kutusuna klavyeden yazı
- Kısayollar: ad + kanal no ya da tuş dizisi (`MENU DOWN DOWN ENTER`); `ayarlar.json` içinde saklanır, telefon ve bilgisayar ortak görür
- Bilgisayardaki video / müzik / resmi TV'de oynatma (DLNA). Klasör `ayarlar.json` → `medyaKlasoru` (varsayılan: Videolar)

## Mi Stick (Android TV)
Sayfa tek bir kumanda gövdesidir. Üstteki **Samsung TV / Mi Stick** seçicisi ortak tuşların (yön, OK, Geri, Ana ekran, Güç, oynatma)
hangi cihaza gideceğini belirler; ses, Kaynak ve HDMI hep Samsung'a gider. Kanal, rakam, kısayol ve medya yalnız Samsung'da;
ek bölümler (123, Yazı, Kısayollar, Medya, Uygulamalar, Eşleştir) alttaki sekmelerle açılır. `?cihaz=mi` ya da `?cihaz=tv` ile doğrudan o modda açılır.
Mi Stick'in ağda kendi adresi vardır (TV'ninkinden ayrı); sunucu onu kendi bulur (port 6466 taraması) ve `ayarlar.json` → `miIp` içine yazar.
Adres değişirse ilk başarısız tuşta yeniden arar.

- **Eşleştirme (bir kez):** TV'yi Mi Stick'in HDMI girişine al, Mi Stick sekmesinde "Eşleştir"e bas, ekranda çıkan 6 haneli kodu yaz.
  Mi Stick'te ayar açmak gerekmez (Google TV uygulamasının protokolü: TLS 6467 eşleştirme, 6466 kumanda; kod `mi.js`).
- Yön tuşları, OK, Geri, Ana ekran, Menü, Ayarlar, Asistan, Güç (uyut / uyandır), oynatma tuşları, yazı gönderme
- Uygulama düğmeleri: `ayarlar.json` → `miUygulamalar` (`ad` + `baglanti`; bağlantı uygulamanın açtığı adres ya da `market://launch?id=<paket>`)
- Mi Stick sekmesinde üst bölüm (HDMI, Kaynak, ses sürgüsü) Samsung'u yönetmeye devam eder; ses TV'den ayarlanır.
- Eşleştirme kimliği (sertifika + özel anahtar) `ayarlar.json` içindedir; dosya git'e gitmez. Silinirse yeniden eşleştirilir.

## Sınırlar
- TV kapalıyken ağdan açılamaz (bu model desteklemiyor); kapatma çalışır.
- Kimlik doğrulama yok: ev ağındaki herkes kumandayı kullanabilir ve medya klasöründeki dosyaları okuyabilir.
- Başka TV / port: `TV_IP` (ayarı ezer) ve `PORT` ortam değişkenleri. Protokol yalnız 2011–2013 Samsung (port 55000) içindir.

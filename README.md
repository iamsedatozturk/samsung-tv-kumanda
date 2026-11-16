# TV Kumanda

Evdeki Samsung UE40D6500 (2011, D serisi, `192.168.1.190`) ve ona HDMI ile bağlı Mi Stick (Android TV) için web kumanda. Bağımlılık yok, yalnız Node.

## Çalıştırma
`baslat.cmd` (ya da `node server.js`). Bilgisayarda `http://localhost:8190`, aynı Wi-Fi'daki telefonda
`http://<bilgisayarın-ip'si>:8190` (adres başlarken konsola yazılır). Telefonda "Ana ekrana ekle" ile uygulama gibi açılır.
Telefondan açılmıyorsa Windows Güvenlik Duvarı'nda Node'a özel ağ izni gerekir.

İlk tuşta TV ekranında izin sorusu çıkar; TV kumandasıyla bir kez "İzin ver" seçilir.

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
- Başka TV / port: `TV_IP` ve `PORT` ortam değişkenleri. Protokol yalnız 2011–2013 Samsung (port 55000) içindir.

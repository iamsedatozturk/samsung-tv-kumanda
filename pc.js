// Bu bilgisayarın kumandası: medya ve ses tuşları, gezinme tuşları, kilit, ekranı kapat. Yalnız Windows.
// Yalnız aşağıdaki listedeki tuşlar gönderilir; serbest yazı ya da fare yoktur.
const { spawn } = require('child_process');

// [sanal tuş kodu, genişletilmiş tuş mu]
const TUSLAR = {
  PLAY_PAUSE: [0xb3, 0], NEXT: [0xb0, 0], PREV: [0xb1, 0], STOP: [0xb2, 0], MUTE: [0xad, 0], VOLDOWN: [0xae, 0], VOLUP: [0xaf, 0],
  UP: [0x26, 1], DOWN: [0x28, 1], LEFT: [0x25, 1], RIGHT: [0x27, 1], PGUP: [0x21, 1], PGDN: [0x22, 1],
  ENTER: [0x0d, 0], ESC: [0x1b, 0], SPACE: [0x20, 0], F: [0x46, 0],
};
const OZEL = {
  LOCK: '[void][W.U]::LockWorkStation()',
  EKRAN: '[void][W.U]::PostMessage([IntPtr]0xffff, 0x0112, [IntPtr]0xF170, [IntPtr]2)', // SC_MONITORPOWER: kapat
};
const TANIM = 'Add-Type -Namespace W -Name U -MemberDefinition \'[DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, UIntPtr e); [DllImport("user32.dll")] public static extern bool LockWorkStation(); [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);\'';

let kabuk = null;
function kabukAl() {
  if (process.platform !== 'win32') throw new Error('Bilgisayar kumandası yalnız Windows\'ta çalışır');
  if (kabuk && kabuk.exitCode === null) return kabuk;
  kabuk = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '-'], { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true });
  kabuk.on('error', () => { kabuk = null; });
  kabuk.stdin.on('error', () => {});
  kabuk.stdin.write(TANIM + '\n');
  return kabuk;
}

function tus(girdi) {
  const adlar = (Array.isArray(girdi) ? girdi : [girdi]).map((t) => String(t).toUpperCase());
  if (!adlar.length || adlar.length > 10) throw new Error('Tuş listesi boş ya da çok uzun');
  const satirlar = adlar.map((t) => {
    if (OZEL[t]) return OZEL[t];
    if (!TUSLAR[t]) throw new Error('Geçersiz tuş: ' + t);
    const [kod, genis] = TUSLAR[t];
    return `[W.U]::keybd_event(${kod}, 0, ${genis}, [UIntPtr]::Zero); [W.U]::keybd_event(${kod}, 0, ${genis + 2}, [UIntPtr]::Zero)`;
  });
  kabukAl().stdin.write(satirlar.join('\n') + '\n');
}

module.exports = { tus };

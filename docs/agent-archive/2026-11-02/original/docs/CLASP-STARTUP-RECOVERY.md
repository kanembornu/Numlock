# NUMLOCK: startup dan OAuth

Gunakan launcher proyek untuk memuat katalog agent dan memeriksa izin sebelum prompt pertama:

```sh
python3 /Users/azer/Documents/GitHub/Numlock/scripts/numlock-opencode.py
```

Untuk perintah tanpa antarmuka interaktif:

```sh
python3 /Users/azer/Documents/GitHub/Numlock/scripts/numlock-opencode.py "Tugas Anda"
```

Untuk pemeriksaan kesiapan saja:

```sh
python3 /Users/azer/Documents/GitHub/Numlock/scripts/numlock-opencode.py --check-only
```

Launcher memakai binary V2 absolut, lokasi Numlock eksplisit, `agent.list`, lalu pemeriksaan identitas 10 agent dan 60 keputusan izin. Launcher menolak melanjutkan jika gate gagal (exit 78); ia tidak memberi persetujuan otomatis. Pemeriksaan push/pull hanya menguji keputusan, tidak menjalankan perintah. Permintaan ask audit dibersihkan tanpa disetujui. Setiap peluncuran membuat sesi baru terikat proyek. `numlock-sol` hanya diperiksa izinnya, modelnya tidak dipanggil.

Sesudah reload manual, mulai kembali melalui launcher sebelum mengirim pekerjaan baru. Launcher tidak memperbaiki internal binary OpenCode dan tidak melindungi klien lain yang melewati jalur ini atau reload di tengah turn. Reload tetap harus dikoordinasikan saat sesi idle. Penggunaan `opencode` polos dari direktori proyek dapat memilih binary lain pada PATH.

OAuth: profil `numlock-run` dipulihkan memakai client dan akun sama, scope lama dipertahankan. Profil default tidak diubah. Login resmi CLASP meminta scope standar tambahannya, termasuk Cloud Platform dan Service Management; rincian scope terukur ada di `oauth-identity.json` dalam output audit. Backup awal dan salinan pemulihan berada dalam direktori `work/oauth-private` sesi audit (direktori 700, berkas kredensial 600), bukan output publik. Jangan mengunggah direktori tersebut. Pemulihan OAuth tidak menjamin token tidak dicabut/kedaluwarsa di kemudian hari.

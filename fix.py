"""
fix.py - Perbaiki tensorflowjs untuk kompatibilitas NumPy ≥ 1.20
Memperbaiki read_weights.py dan write_weights.py
"""

import os
import sys
import site
import glob

def find_tensorflowjs_files():
    """Cari file read_weights.py dan write_weights.py di package tensorflowjs"""
    site_packages = site.getsitepackages()
    found_files = {}

    for path in site_packages:
        matches = glob.glob(
            os.path.join(path, "tensorflowjs", "*.py"),
            recursive=True
        )
        for f in matches:
            if os.path.basename(f) in ["read_weights.py", "write_weights.py"]:
                found_files[os.path.basename(f)] = f

    # Coba cari di user-specific site-packages
    user_site = site.getusersitepackages()
    for filename in ["read_weights.py", "write_weights.py"]:
        user_path = os.path.join(user_site, "tensorflowjs", filename)
        if os.path.exists(user_path):
            found_files[filename] = user_path

    return found_files

def fix_file(filepath):
    """Ganti np.bool → bool dan np.object → object"""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Backup file asli
    backup_path = filepath + ".bak"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(content)

    # Lakukan penggantian
    updated_content = content.replace("np.bool", "bool").replace("np.object", "object")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(updated_content)

    print(f"✅ File berhasil diperbaiki: {filepath}")
    print(f"📂 Backup tersimpan di: {backup_path}")

def main():
    print("🔧 Memulai perbaikan tensorflowjs untuk kompatibilitas NumPy ≥ 1.20\n")

    files = find_tensorflowjs_files()
    if not files:
        print("❌ Tidak ada file tensorflowjs yang ditemukan.")
        print("Pastikan tensorflowjs sudah terinstall.")
        sys.exit(1)

    for filename, filepath in files.items():
        print(f"📄 Ditemukan file: {filepath}")
        try:
            fix_file(filepath)
        except Exception as e:
            print(f"❌ Gagal memperbaiki {filename}: {str(e)}")
            continue

    print("\n🎉 Semua file berhasil diperbaiki!")
    print("Silakan coba kembali script preconvert_models.py")

if __name__ == "__main__":
    main()
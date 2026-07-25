"""
karuAPP - Backup de base de datos
Soporta:
  1. Backup local con timestamp
  2. Sincronizacion con Google Drive via rclone
  3. Subida directa via Google Drive API (opcional)

Uso:
  python backup_db.py                      # backup local
  python backup_db.py --rclone             # backup local + rclone
  python backup_db.py --upload             # backup local + Google Drive API
"""

import os
import sys
import json
import shutil
import datetime
import sqlite3
import subprocess
import tempfile
from pathlib import Path

BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / 'datos.db'
BACKUP_DIR = BASE_DIR / 'backups'
CONFIG_PATH = BASE_DIR / 'backup_config.json'

DEFAULT_CONFIG = {
    "rclone_path": "rclone",
    "rclone_dest": "GDrive:KaruApp-Backups",
    "google_drive_credentials": "credentials.json",
    "google_drive_folder_id": "",
    "keep_local_days": 30,
    "auto_cleanup": True
}


def cargar_config():
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, 'r') as f:
            return {**DEFAULT_CONFIG, **json.load(f)}
    return dict(DEFAULT_CONFIG)


def guardar_config(config):
    with open(CONFIG_PATH, 'w') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


def generar_nombre():
    ahora = datetime.datetime.now()
    return f"karuapp_backup_{ahora.strftime('%Y%m%d_%H%M%S')}.db"


def hacer_backup_local(tag=''):
    if not DB_PATH.exists():
        return {'ok': False, 'error': f'No se encuentra la base de datos: {DB_PATH}'}

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    nombre = generar_nombre()
    if tag:
        nombre = nombre.replace('.db', f'_{tag}.db')

    dest = BACKUP_DIR / nombre

    try:
        src_conn = sqlite3.connect(str(DB_PATH))
        dst_conn = sqlite3.connect(str(dest))
        src_conn.backup(dst_conn, pages=100)
        dst_conn.close()
        src_conn.close()
    except Exception as e:
        try:
            shutil.copy2(str(DB_PATH), str(dest))
        except Exception as e2:
            return {'ok': False, 'error': f'Backup fallo: {e} / {e2}'}

    tamano = dest.stat().st_size
    return {'ok': True, 'path': str(dest), 'tamano': tamano, 'nombre': nombre}


def limpiar_backups_viejos(dias):
    if not BACKUP_DIR.exists():
        return 0
    ahora = datetime.datetime.now()
    limite = ahora - datetime.timedelta(days=dias)
    eliminados = 0
    for f in BACKUP_DIR.iterdir():
        if f.suffix in ('.db', '.sqlite') and f.name.startswith('karuapp_backup_'):
            try:
                fecha_str = f.stem.replace('karuapp_backup_', '')[:15]
                fecha = datetime.datetime.strptime(fecha_str, '%Y%m%d_%H%M%S')
                if fecha < limite:
                    f.unlink()
                    eliminados += 1
            except (ValueError, OSError):
                pass
    return eliminados


def sincronizar_rclone(config):
    rclone = config.get('rclone_path', 'rclone')
    destino = config.get('rclone_dest', 'GDrive:KaruApp-Backups')
    try:
        result = subprocess.run(
            [rclone, 'copy', str(BACKUP_DIR), destino, '--verbose', '--log-file', str(BASE_DIR / 'rclone.log')],
            capture_output=True, text=True, timeout=300
        )
        if result.returncode == 0:
            return {'ok': True, 'output': result.stdout}
        else:
            return {'ok': False, 'error': result.stderr[:500]}
    except FileNotFoundError:
        return {'ok': False, 'error': f'rclone no encontrado en "{rclone}". Instalalo en https://rclone.org/downloads/'}
    except subprocess.TimeoutExpired:
        return {'ok': False, 'error': 'Timeoutexpirado (5 min)'}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


def subir_google_drive_api(config):
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload
    except ImportError:
        return {'ok': False, 'error': 'Faltan dependencias. Instala: pip install google-auth-oauthlib google-api-python-client'}

    creds_path = BASE_DIR / config.get('google_drive_credentials', 'credentials.json')
    if not creds_path.exists():
        return {'ok': False, 'error': f'No se encuentra {creds_path}. Crea credenciales en https://console.cloud.google.com/apis/credentials'}

    SCOPES = ['https://www.googleapis.com/auth/drive.file']
    token_path = BASE_DIR / 'token_drive.json'

    creds = None
    if token_path.exists():
        with open(token_path, 'r') as f:
            creds = Credentials.from_authorized_user_info(json.load(f), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), SCOPES)
            creds = flow.run_local_server(port=0)
        with open(token_path, 'w') as f:
            f.write(creds.to_json())

    service = build('drive', 'v3', credentials=creds)

    folder_id = config.get('google_drive_folder_id', '')
    if not folder_id:
        folder_meta = {
            'name': 'KaruApp-Backups',
            'mimeType': 'application/vnd.google-apps.folder'
        }
        folder = service.files().create(body=folder_meta, fields='id').execute()
        folder_id = folder.get('id')
        config['google_drive_folder_id'] = folder_id
        guardar_config(config)

    archivos = sorted(BACKUP_DIR.glob('karuapp_backup_*.db'), key=os.path.getmtime)
    if not archivos:
        return {'ok': False, 'error': 'No hay backups para subir'}

    ultimo = archivos[-1]
    file_meta = {
        'name': ultimo.name,
        'parents': [folder_id]
    }
    media = MediaFileUpload(str(ultimo), mimetype='application/octet-stream')
    service.files().create(body=file_meta, media_body=media).execute()

    return {'ok': True, 'archivo': ultimo.name}


def main():
    import argparse
    parser = argparse.ArgumentParser(description='karuAPP Backup Database')
    parser.add_argument('--rclone', action='store_true', help='Sincronizar con Google Drive via rclone')
    parser.add_argument('--upload', action='store_true', help='Subir a Google Drive via API')
    parser.add_argument('--tag', type=str, default='', help='Etiqueta opcional para el backup')
    parser.add_argument('--cleanup', type=int, default=0, help='Limpiar backups mas viejos que N dias')
    parser.add_argument('--status', action='store_true', help='Mostrar info de los backups existentes')
    args = parser.parse_args()

    if args.status:
        if not BACKUP_DIR.exists():
            print(json.dumps({'ok': True, 'backups': [], 'total': 0}))
            return
        backups = sorted(BACKUP_DIR.glob('karuapp_backup_*.db'), key=os.path.getmtime, reverse=True)
        info = []
        for b in backups:
            info.append({
                'nombre': b.name,
                'tamano': b.stat().st_size,
                'fecha': datetime.datetime.fromtimestamp(b.stat().st_mtime).isoformat()
            })
        print(json.dumps({'ok': True, 'backups': info, 'total': len(info)}))
        return

    config = cargar_config()

    result = hacer_backup_local(args.tag)
    if not result['ok']:
        print(json.dumps(result))
        sys.exit(1)

    rclone_ok = None
    upload_ok = None

    if args.rclone:
        rclone_ok = sincronizar_rclone(config)

    if args.upload:
        upload_ok = subir_google_drive_api(config)

    if config.get('auto_cleanup', True):
        dias_limpiar = args.cleanup or config.get('keep_local_days', 30)
        if dias_limpiar:
            limpiar = limpiar_backups_viejos(dias_limpiar)
            result['backups_eliminados'] = limpiar

    result['rclone'] = rclone_ok
    result['upload'] = upload_ok

    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
